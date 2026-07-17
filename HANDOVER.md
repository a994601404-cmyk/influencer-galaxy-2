# Influencer Galaxy - 交接文档（2026-07-17 修订版）

> 本文档替代旧版 HANDOVER.md。旧版的部署排障记录已过时（根因已定位并修复），且旧版含明文密钥，请立即删除旧文件。

## 项目概述
网红管理系统：网红卡片管理、报价协商、脚本/视频/发布四项审核流、话题追踪、卡片分类、站内通知。

## 技术栈
- **前端**: React 19 + TypeScript + Vite 7 + Tailwind CSS v3 + shadcn/ui
- **后端**: Hono + tRPC 11（Vercel 单 Serverless Function，Node 运行时）
- **数据库**: TiDB Cloud（MySQL 兼容，强制 TLS）
- **部署**: Vercel（前端静态资源 + /api 单函数），GitHub push 到 main 自动部署（约 40 秒）

## 线上环境
- 生产地址: https://www.influencergalaxy.app （裸域 308 跳转 www）
- Vercel 项目: `influencer-galaxy-2`（唯一项目，旧的 influencer-galaxy 已删除）
- GitHub: `a994601404-cmyk/influencer-galaxy-2`
- 旧历史备份分支: `backup/pre-vercel-fix`

## 目录结构与部署架构（重要）
- `api/index.ts` — 唯一的 Serverless Function 入口（自研 Node 风格 handler：手动缓冲请求体 → 构造 Fetch Request → 流式回写响应）。
  ⚠️ **api/ 下只能有这一个文件**：Vercel 会把 api/ 下每个 .ts 都构建成独立函数（Hobby 套餐上限 12 个/次部署）。
  ⚠️ **不要用 `@hono/node-server/vercel` 的 `handle`**：它对 Vercel 预缓冲的请求体做懒桥接会永久挂起——所有 POST 变更 30 秒超时、GET 正常；鉴权中间件先于读 body 抛 401 所以极具迷惑性（2026-07-17 踩坑）。
- `server/` — 全部后端代码（boot.ts Hono 入口、20 个 tRPC 路由、lib/、kimi/、queries/）
- **强制约定**：`server/`、`db/`、`contracts/`、`api/` 内所有相对导入必须带 `.js` 扩展名（Vercel 以 nodenext 规则编译 ESM TS，缺扩展名会在运行时 ERR_MODULE_NOT_FOUND）。
- 数据库连接必须显式 SSL：`server/queries/connection.ts` 解析 DATABASE_URL 的 sslaccept/sslmode 参数启用 TLS（TiDB 拒绝明文连接，mysql2 会忽略 URL 里的 sslaccept，必须转为配置项）。
- `vercel.json`：buildCommand 为 `vite build`（只构建前端；esbuild 产出的 dist/boot.js 仅供 Docker/VPS 独立部署用）；`/api/*` 重写到 `/api/index`；SPA 回退到 `/index.html`。

## ⚠️ 从 Kimi 平台重新同步代码后的必做步骤
平台导出包不含部署修复。重新同步后，在仓库根目录运行**一键修复脚本**：

```bash
npm run vercel:fixes        # 幂等；全部 ok 后即可 push
npm run vercel:fixes check  # 只校验不修改
```

脚本会自动恢复：vercel.json、api/index.ts（`@hono/node-server/vercel`，api/ 下唯一文件）、
全部相对导入的 `.js` 扩展名、connection.ts 的 SSL、JWKS 懒加载、tRPC onError、
tsconfig.server.json，并检测 .env 泄密。结构不识别时会 WARN 并提示人工处理。

核心原理（脚本失效时参考）：
- Vercel 会把 api/ 下每个 .ts 构建成独立函数 → api/ 只能有 index.ts（用 `@hono/node-server/vercel` 的 `handle`，不是 hono/vercel）
- Vercel 以 nodenext 规则编译 ESM TS → server/、db/、contracts/、api/ 相对导入必须带 `.js`
- TiDB 拒绝明文连接，mysql2 忽略 URL 里的 sslaccept → 必须解析 DATABASE_URL 显式配置 ssl
- **切勿提交平台包里的 .env（含生产密钥）**

## 环境变量（均已在 Vercel 项目配置，敏感变量不可回读）
`APP_ID`、`APP_SECRET`、`DATABASE_URL`、`KIMI_AUTH_URL`、`KIMI_OPEN_URL`、`VITE_APP_ID`、`VITE_KIMI_AUTH_URL`、`OWNER_UNION_ID`、`NPM_CONFIG_REGISTRY`
⚠️ 密钥值永不写入文档或仓库；查看请到 Vercel → Settings → Environment Variables。

## 数据库表（19 张）
users, influencers, negotiationRecords, scriptReviews, videoReviews, postRecords,
trendingTopics, scripts, storyboards, campaigns, campaignInfluencers,
influencerMetrics, notifications, invitationCodes, hashtagCategories, hashtags,
apiConfigs, cardCategories, cardCategoryItems, userCardPreferences

注：`postRecords` 已于 2026-07-17 增加 `status` / `adminNote` / `reviewedAt` 列（发布审核流）；
`users` 同日增加 `passwordHash` / `passwordSalt` 列（服务端账号体系，scrypt）。

## tRPC 路由（server/router.ts，20 个）
auth / influencer / negotiation / scriptReview / videoReview / notification /
trending / script / storyboard / campaign / analytics / metrics / instagram /
social / config / invitation / post / hashtag / cardPreference / cardCategory

## 审核中心工作逻辑（2026-07-17 重写）
- **报价审核**：最新一轮谈价有网红报价且无审核报价 → 管理员填审核报价后移出
- **脚本/视频审核**：存在 `status='pending'` 的审核记录 → 通过/驳回后移出
- **发布审核**：存在 `status='pending'` 的发布记录 → 同上
- 卡片可点击打开详情弹窗；管理员在弹窗内完成审核；提交 → 通知管理员，审核 → 通知创建者
- 计数徽标与列表共用同一判定集合，不会不一致

## 已知限制
- SSE 通知受 serverless maxDuration 30 秒限制，连接会被断开，前端需自动重连（已改为会话 cookie 鉴权 + 同源连接）
- 多数 list 接口为 publicQuery（未登录也可读），如需收紧改为 authedQuery
- tsc 存在约 30 个未使用变量告警 + 1 处类型告警（negotiation-router 的 ResultSetHeader 强转），不影响构建与运行

## 历史决策（仍然有效）
- 移除 @dnd-kit：Vite 打包 chunk 加载时序问题（TDZ），分类移动改用下拉菜单
- AppLayout 静态导入：避免旧 chunk 缓存 404
- 旧账号已补建默认分类（对接中/已发布/网红库），unionId = `local_` + email

## 认证与安全（2026-07-17 重构）
- **账号体系在服务端**：邮箱+密码（scrypt 哈希存 users.passwordHash/passwordSalt）与 Kimi OAuth 并存，
  登录后签发同一种会话 JWT（cookie `kimi_sid`）。旧的 localStorage 假登录已删除。
- **已封堵的 P0**：后端曾信任 `x-local-auth-meta` 请求头里的自封身份（任何人可冒充管理员），
  现已只信签名会话；SSE 通知流同理改为 cookie 鉴权；`diag` 端点已改为 adminQuery。
- **管理员账号**：邮箱 admin@pulseboost.ai（unionId `local_admin@pulseboost.ai`，role=admin）。
  所有者用 Kimi OAuth 登录（unionId 匹配 OWNER_UNION_ID）同样是管理员。
- **找回密码**：登录弹窗 →「忘记密码？」→ 两条路径：① 普通用户提交请求 → 管理员收到站内通知 →
  在「设置 → 用户密码重置」生成新密码线下告知；② 持有**恢复密钥（master key）**者可直接重置任何账号密码。
- **恢复密钥 master key**：高熵随机串，SHA-256 存于 apiConfigs(platform=`security_master_key`)，
  明文只保存在所有者设备上（1Password/备忘录）。它是最后的兜底：忘记管理员密码 →
  登录弹窗 → 忘记密码 →「我有恢复密钥」→ 自己重设管理员密码。泄露=可重置任何账号，务必保密。
- **部署验证码闸门（TOTP）**：`npm run deploy:gate`。每次改动线上正式版前必须输入所有者
  Authenticator 里的 6 位动态码。种子在 `~/.influencer-galaxy-secure/deploy-gate.json`（600，不进 git）。
  注意：种子在本机可被本机程序读取，这是强摩擦+审计闸门；真正的硬门禁建议在 GitHub 配
  Environment required reviewers（部署需手机端审批，完全脱离本机）。

## 防御性编码规范
1. `(x || []).length` 代替 `x.length`
2. `.filter(Boolean)` 过滤后端数组中的 null 元素
3. `obj?.prop` 代替 `obj.prop`
4. 修改参数类型时检查所有调用点
5. 修改路由/导航时同步更新桌面端 + 移动端 + 路由配置
6. 组件 props 改名时全仓搜索调用点（本次 inf/influencer prop 不匹配的教训）
