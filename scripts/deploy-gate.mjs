#!/usr/bin/env node
/**
 * deploy-gate.mjs — 部署验证码闸门（TOTP，RFC 6238）。
 *
 * 用途：每次要改动线上正式版（git push 触发 Vercel 部署）之前，必须先
 * 输入站点所有者设备上 Authenticator 应用里的 6 位动态验证码。
 *
 * 首次绑定（只需一次）：
 *   npm run deploy:gate -- setup
 *   → 用 Google Authenticator / 1Password / 微软 Authenticator 扫描输出的
 *     otpauth:// 链接（或手动输入显示的密钥）。
 *
 * 每次部署前验证：
 *   npm run deploy:gate -- verify 123456
 *
 * 其他：
 *   npm run deploy:gate -- status     查看是否已绑定
 *   npm run deploy:gate -- setup --force   重新生成（旧验证码全部失效）
 *
 * 密钥保存在 ~/.influencer-galaxy-secure/deploy-gate.json（权限 600），
 * 不会进入 git 仓库。
 *
 * 注意：种子保存在本机，理论上本机上的程序可以读取。这是一道强摩擦 +
 * 审计闸门，不是密码学铁墙。如需硬门禁，请在 GitHub 仓库设置
 * Environment required reviewers（部署需手机端审批），见 HANDOVER.md。
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const DIR = path.join(os.homedir(), ".influencer-galaxy-secure");
const FILE = path.join(DIR, "deploy-gate.json");

// ─── Base32 (RFC 4648, no padding) ──────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const clean = str.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character: " + ch);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ─── TOTP (HMAC-SHA1, 30s step, 6 digits) ───────────────────
function totp(secret, timeStep) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac("sha1", secret).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

function loadSecret() {
  if (!fs.existsSync(FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return base32Decode(data.secret);
  } catch {
    return null;
  }
}

const cmd = process.argv[2];

if (cmd === "setup") {
  const force = process.argv.includes("--force");
  if (fs.existsSync(FILE) && !force) {
    console.error("已绑定过验证码。如需重新生成（旧码全部失效），运行: npm run deploy:gate -- setup --force");
    process.exit(1);
  }
  const secret = crypto.randomBytes(20);
  const b32 = base32Encode(secret);
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(FILE, JSON.stringify({ secret: b32, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  const label = "InfluencerGalaxy Deploy:owner";
  const uri = `otpauth://totp/${encodeURIComponent(label)}?secret=${b32}&issuer=${encodeURIComponent("InfluencerGalaxy Deploy")}&digits=6&period=30`;
  console.log("\n✅ 部署验证码已生成。请用 Authenticator / 1Password 添加以下条目：\n");
  console.log("扫码/粘贴链接:");
  console.log(uri);
  console.log("\n或手动输入密钥（Base32）:");
  console.log(b32);
  console.log("\n当前验证码（可用来验证绑定是否成功）: " + totp(secret, Math.floor(Date.now() / 1000 / 30)));
  console.log("\n密钥文件: " + FILE + "（权限 600，不要移动或分享）\n");
} else if (cmd === "verify") {
  const code = (process.argv[3] || "").trim();
  if (!/^\d{6}$/.test(code)) {
    console.error("用法: npm run deploy:gate -- verify <6位验证码>");
    process.exit(2);
  }
  const secret = loadSecret();
  if (!secret) {
    console.error("尚未绑定验证码，请先运行: npm run deploy:gate -- setup");
    process.exit(2);
  }
  const step = Math.floor(Date.now() / 1000 / 30);
  // 容忍前后各一个 30 秒窗口（设备时间漂移）
  const valid = [step - 1, step, step + 1].some((s) => totp(secret, s) === code);
  if (valid) {
    console.log("✅ 验证码正确，允许部署。");
    process.exit(0);
  } else {
    console.error("❌ 验证码错误或已过期，拒绝部署。");
    process.exit(1);
  }
} else if (cmd === "status") {
  if (fs.existsSync(FILE)) {
    const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
    console.log("已绑定 ✓  创建于 " + data.createdAt + "  文件: " + FILE);
  } else {
    console.log("未绑定。运行: npm run deploy:gate -- setup");
  }
} else {
  console.log("用法: npm run deploy:gate -- <setup|verify <code>|status> [--force]");
  process.exit(2);
}
