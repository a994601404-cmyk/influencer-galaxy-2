# Influencer Galaxy - 交接文档（2026-07-22 修订版）

> 本文档替代旧版 HANDOVER.md。旧版的部署排障记录已过时（根因已定位并修复），且旧版含明文密钥，请立即删除旧文件。

## 项目概述
网红管理系统：网红卡片管理、报价协商、脚本/视频/发布四项审核流、话题追踪、卡片分类、站内通知、垃圾箱、双主题。

## 技术栈
- **前端**: React 19 + TypeScript + Vite 7 + Tailwind CSS v3 + shadcn/ui + @dnd-kit/core
- **后端**: Hono + tRPC 11（Vercel 单 Serverless Function，Node 运行时）
- **数据库**: TiDB Cloud（MySQL 兼容，强制 TLS）
- **部署**: Vercel（前端静态资源 + /api 单函数），GitHub push 到 main 自动部署（约 75 秒）

## 线上环境
- 生产地址: https://www.influencergalaxy.app （裸域 308 跳转 www）
- Vercel 项目: `influencer-galaxy-2`（唯一项目，旧的 influencer-galaxy 已删除）
- GitHub: `a994601404-cmyk/influencer-galaxy-2`
- 旧历史备份分支: `backup/pre-vercel-fix`

## 部署流程（现行）
1. 每次改动线上正式版前必须过 **TOTP 验证码闸门**：`node scripts/deploy-gate.mjs verify <6位码>`
   （种子在所有者设备 `~/.influencer-galaxy-secure/deploy-gate.json`，600 权限，不进 git）
2. 验证通过 → `git push origin main` → Vercel 自动部署约 75 秒 → curl 验证
3. 数据库 DDL（如加列）：我没有生产库访问权（TiDB 密码已轮换，仅所有者持有），
   由所有者在 TiDB Cloud → Chat2Query 手动执行（注意先在左上角选中业务库，否则报 "No database selected"）
4. **待办（更硬的门禁）**：GitHub Environment `production` 已创建并配好 required reviewers，
   但 Actions 工作流文件（`/tmp/deploy-workflow.yml` 草稿：.workflow 内容需所有者在 GitHub 网页手动创建，
   因为 PAT 缺 `workflow` scope 推不上去）+ `VERCEL_TOKEN` secret 尚未就位。就位后可断 Vercel 自动部署，
   改为 Actions 审批制部署。

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
`APP_ID`、`APP_SECRET`、`SESSION_SECRET`、`DATABASE_URL`、`KIMI_AUTH_URL`、`KIMI_OPEN_URL`、`VITE_APP_ID`、`VITE_KIMI_AUTH_URL`、`OWNER_UNION_ID`、`NPM_CONFIG_REGISTRY`
⚠️ 密钥值永不写入文档或仓库；查看请到 Vercel → Settings → Environment Variables。
注：`SESSION_SECRET`（2026-07-20 新增）是登录会话 JWT 的专用签名密钥，与 OAuth 的
`APP_SECRET` 刻意分离——旧 `APP_SECRET` 曾明文泄露过且 Kimi 平台不提供自助重置，
分离后泄露的 `APP_SECRET` 无法伪造登录会话。该值仅存在于 Vercel（管道写入，无人见过明文）。
轮换 `APP_SECRET` 或 `SESSION_SECRET` 都会使全部已登录会话失效（重新登录即可）。

## 数据库表（19 张）
users, influencers, negotiationRecords, scriptReviews, videoReviews, postRecords,
trendingTopics, scripts, storyboards, campaigns, campaignInfluencers,
influencerMetrics, notifications, invitationCodes, hashtagCategories, hashtags,
apiConfigs, cardCategories, cardCategoryItems, userCardPreferences

列变更历史：
- `postRecords`：2026-07-17 增加 `status` / `adminNote` / `reviewedAt`（发布审核流）
- `users`：2026-07-17 增加 `passwordHash` / `passwordSalt`（服务端账号体系，scrypt）
- `influencers`：2026-07-21 增加 `deletedAt` VARCHAR(20) / `deletedByUnionId` VARCHAR(320)（垃圾箱）
- `influencers.hidden` 语义：**0=正常，1=管理员隐藏，2=垃圾箱（软删除）**

## tRPC 路由（server/router.ts，20 个）
auth / influencer / negotiation / scriptReview / videoReview / notification /
trending / script / storyboard / campaign / analytics / metrics / instagram /
social / config / invitation / post / hashtag / cardPreference / cardCategory

## 数据权限（2026-07-21/22 收口）
- **influencer.list / getById 服务端隔离**：非管理员只返回自己创建的卡片；未登录返回空；
  垃圾箱（hidden=2）对所有人不可见；管理员可见全部（含隐藏卡）
- **删除规则**：管理员可删所有卡片，普通用户只能删自己创建的；删除=软删进垃圾箱
- **垃圾箱**：`trashList`（管理员看全部/用户看自己删的，按删除时间倒序）、`restore`（恢复原分类原位置）、
  `destroy`（物理删除，级联清理 negotiationRecords/scriptReviews/videoReviews/postRecords/cardCategoryItems）
- update/updateUserPrice/hide 等写操作维持 admin-or-owner 校验

## 网红页交互（2026-07-21 重写）
- **乐观更新**：删除/隐藏/置顶/卡片排序/分类排序/移动分类全部 onMutate 乐观更新 + 失败回滚 + onSettled 失效同步，点击秒响应（src/lib/influencer-api.ts）
- **置顶/排序**：`togglePin` 与 `saveCardOrder` 均按 `(influencerId, categoryId)` 寻址，无 cardCategoryItems 行时自动建行——未分类兜底卡片也能置顶/排序；分类内不限置顶数；服务端按 isPinned DESC, sortOrder ASC 返回
- **拖拽**：卡片左缘 ⋮⋮ 把手（@dnd-kit/core 的 useDraggable/useDroppable，2026-07-21 重新引入，无当年 TDZ 问题）；同分类拖到目标卡=插入排序，拖到其他分类=移到末尾；筛选/批量模式下自动禁用
- **批量管理**：点击进选择模式（复选框），底部操作条：移动到分类/删除（进垃圾箱）/取消，管理员额外有隐藏
- **默认三分类**：对接中/已发布/网红库，cardCategory.list 服务端为 0 分类用户自动补建（前端 useEffect 兜底仍在）
- **添加网红表单**：分「网红基础信息」（名称/平台/领域/性别/国家/主页链接）与「合作详情」（报价/合作方式/备注）两区块；主页链接支持多条（每条带平台备注），存 profileUrl 为 JSON 数组 `[{platform,url}]`，渲染端 `parseProfileLinks`（src/lib/profile-links.ts）兼容旧的单链接字符串；「账号」栏位已移除，handle 由首条链接末段或名称自动派生；「简介」改名「备注」（DB 仍用 bio 列）
- **编辑资料**：详情页头部「编辑资料」弹窗改基础信息+链接+备注；报价走谈价记录、合作方式走合作区块（各有历史记录逻辑）
- **领域选项**：可选集精简为 SELECTABLE_NICHES（src/lib/niche-map.ts）：生活方式/AI创作者/AI虚拟网红/AI prompts博主/AI垂类/科技泛类博主/Content Creator/其他；旧键保留映射仅用于老卡片标签显示；自定义领域名存 localStorage customNicheNames
- 已清理：DEBUG 横幅、window.__debug、分类重命名断头按钮（已接通 useUpdateCardCategory）

## 审核中心工作逻辑
- **报价审核**：最新一轮谈价有网红报价且无审核报价 → 管理员填审核报价后移出
- **脚本/视频审核**：存在 `status='pending'` 的审核记录 → 通过/驳回后移出
- **发布审核**：存在 `status='pending'` 的发布记录 → 同上
- 卡片可点击打开详情弹窗；管理员在弹窗内完成审核；提交 → 通知管理员，审核 → 通知创建者
- **计数徽标与卡片列表共用同一可见网红集合**（2026-07-22 修复：之前徽标统计含垃圾箱/孤儿记录导致虚高）
- **卡片左上角显示「由***提交」**（2026-07-22 新增，Review.tsx creatorMap 来自 auth.list）
- **审核报价详情同步**（2026-07-22 修复）：旧 useUpdateNegotiation 用 zod 会剥离的 influencerId 做精准
  invalidate 导致 negotiation.list 永不刷新，已改为无参广域 invalidate + 乐观更新

## 「审核中」锁定分类（2026-07-22 新增）
- 默认置顶分类，cardCategory.list 服务端兜底：0 分类用户建 4 个默认分类（审核中/对接中/已发布/网红库）；
  已有分类但缺「审核中」的老用户自动 insert 到 minOrder-1 置顶位
- **锁定语义**：moveCard 任一端为「审核中」即拒绝；create/update/delete 禁止创建/改名/删除该分类
- **自动流转**：新网红添加后前端 assignCard 进「审核中」；管理员 updateAdminPrice（price>0）或
  setNotCooperating 时，服务端 moveOutOfReview 把该网红在所有人「审核中」里的卡片移到各自「对接中」（没有则创建）
- 前端：琥珀色边框区分 + Lock 图标 + 提示文案；审核中分类内卡片禁用拖拽把手和移动菜单；
  移动目标列表（卡片菜单/批量移动）均过滤掉「审核中」；handleDragEnd 拦截拖入
- **创建者展示**：管理员视角卡片右下角 `by 用户名` 高亮（InfluencerCard creatorName prop）；
  创建者筛选改为前端过滤（allInfluencers memo），下拉选项基于未筛选列表构建

## 性能与准实时同步（2026-07-22）
- trpc.tsx QueryClient 全局 `staleTime: 15000` + `refetchOnWindowFocus: false`（通知 30s 轮询不受影响）
- 报价/脚本/视频/发布审核 mutation、分类展开、审核报价全部 onMutate 乐观更新 + 失败回滚
- **准实时数据同步**：NotificationBell 收到任何 SSE 新通知时，失效 influencer/cardCategory/negotiation/
  scriptReview/videoReview/post 等数据查询——所有数据变更本就会产生通知，受影响用户页面秒级自动刷新；
  轮询降级模式下未读数增加时同样触发。未引入 WebSocket/第三方推送服务（Vercel serverless 不适合长连接）
- **数据页（Analytics）**：管理员可按创建者筛选；发布数据行新增「合作价格」列（= 该网红最后一次审核报价，
  即 influencers.adminPrice）；「导出 Excel」按当前筛选结果生成 SpreadsheetML .xls（零依赖，Excel/WPS 直接打开）
- **工作台（Dashboard）**：发布数据概览与数据页同口径隔离（普通用户只统计自己可见网红的发布数据）；
  顶部新增「网红卡片分布」四分类计数（cardCategory.statusCounts：普通用户统计自己分类，管理员全站去重统计）
- **落地页双主题**：GalaxyScene 通过 MutationObserver 监听 html.dark，亮色主题用暖白底 + 深绿粒子/线条，
  暗色保持原黑底酸绿


## 双主题（2026-07-21 上线）
- **浅色为默认主题**：暖白底 #F6F6F0 + 白卡片；酸绿 #CCFF00 保留给按钮/高亮（压黑字），
  文字级强调用深绿 #65A30D（`--brand`），青色 #0891B2（`--cy`）
- **深色 = 原主题**，`html.dark` 类切换；导航栏右侧 ☀️/🌙 按钮，偏好存 localStorage `ig-theme`，
  index.html 内联脚本预置类防闪烁；逻辑在 src/lib/theme.ts
- **令牌体系**：tailwind.config.js 的 base/surface/elevated/hover/content/sub/faint/line/lime/brand/cy
  映射 CSS 变量；brand/cy/base 用 RGB 通道 + `<alpha-value>` 支持 /NN 透明度变体
- 新写组件禁用硬编码 hex 类名（bg-[#111]、text-white 等），一律用令牌

## 已知限制
- SSE 通知受 serverless maxDuration 30 秒限制，连接会被断开，前端需自动重连（已改为会话 cookie 鉴权 + 同源连接）
- tsc 存在约 30 个未使用变量告警 + 1 处类型告警（negotiation-router 的 ResultSetHeader 强转），不影响构建与运行
- cardPreference 路由为历史死代码（全局单置顶语义），勿启用；置顶走 cardCategory.togglePin
- Dashboard hero 渐变在双主题改造后变为酸绿薄涂（视觉与原暗绿渐变略有差异，属预期）

## 历史决策（仍然有效）
- AppLayout 静态导入：避免旧 chunk 缓存 404
- 旧账号已补建默认分类（对接中/已发布/网红库），unionId = `local_` + email
- ~~移除 @dnd-kit~~（已过时：2026-07-21 重新引入 @dnd-kit/core，仅把手拖拽，无 TDZ 问题）

## 认证与安全（2026-07-17 重构，07-20 加固）
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
- **部署验证码闸门（TOTP）**：见「部署流程」一节。种子在本机可被本机程序读取，这是强摩擦+审计闸门；
  真正的硬门禁是 GitHub Environment required reviewers（配置进度见部署流程第 4 条）。

## 防御性编码规范
1. `(x || []).length` 代替 `x.length`
2. `.filter(Boolean)` 过滤后端数组中的 null 元素
3. `obj?.prop` 代替 `obj.prop`
4. 修改参数类型时检查所有调用点
5. 修改路由/导航时同步更新桌面端 + 移动端 + 路由配置
6. 组件 props 改名时全仓搜索调用点（inf/influencer prop 不匹配的教训）
7. tRPC mutation 传参对象形状必须与 zod schema 完全一致（裸数字传参被 zod 400 静默拦截的教训——删除/置顶曾因此"点了没反应"）
8. 前端假 ID（如 `uncategorized-${id}`）不得直接传给期望数据库主键的端点；端点按业务键（influencerId+categoryId）寻址更稳
9. 统计口径必须与渲染口径一致（审核徽标虚高的教训：计数集合 ⊇ 渲染集合时必然对不上）
10. 新页面/弹窗一律使用主题令牌，禁止硬编码 hex 色值
