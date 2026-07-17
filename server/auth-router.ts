import * as cookie from "cookie";
import { z } from "zod";
import { Session } from "../contracts/constants.js";
import { getSessionCookieOptions } from "./lib/cookies.js";
import { createRouter, authedQuery, adminQuery, publicQuery } from "./middleware.js";
import { getDb } from "./queries/connection.js";
import { users, invitationCodes, apiConfigs } from "../db/schema.js";
import { eq, or } from "drizzle-orm";
import { hashPassword, verifyPassword, sha256Hex, safeEqualHex } from "./lib/password.js";
import { signSessionToken } from "./kimi/session.js";
import { env } from "./lib/env.js";
import { createNotification, getAdminUnionIds } from "./notification-router.js";
import { findUserByUnionId } from "./queries/users.js";
import type { TrpcContext } from "./context.js";

// platform key of the row in apiConfigs that stores the SHA-256 of the
// owner-held master recovery key (plaintext never leaves the owner's device)
const MASTER_KEY_PLATFORM = "security_master_key";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("邮箱格式不正确")
  .max(320);
const passwordSchema = z.string().min(8, "密码至少 8 位").max(72, "密码最长 72 位");

function localUnionId(email: string) {
  return `local_${email}`;
}

// Beijing time "YYYY-MM-DD HH:mm" — matches invitationCodes.usedAt convention
function beijingNow(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 8 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}`;
}

// Mint the same session cookie that Kimi OAuth issues
async function issueSession(ctx: TrpcContext, unionId: string) {
  const token = await signSessionToken({ unionId, clientId: env.appId });
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: 60 * 60 * 24 * 365,
    }),
  );
}

function sanitizeUser<T extends Record<string, any>>(u: T | undefined | null) {
  if (!u) return u;
  const { passwordHash: _ph, passwordSalt: _ps, ...rest } = u as any;
  return rest;
}

export const authRouter = createRouter({
  me: authedQuery.query((opts) => ({
    ...sanitizeUser(opts.ctx.user),
    hasPassword: !!opts.ctx.user.passwordHash,
  })),

  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),

  // ─── Email/password registration (server-side, invitation-gated) ───
  register: publicQuery
    .input(
      z.object({
        name: z.string().trim().min(1, "请填写姓名").max(50),
        email: emailSchema,
        password: passwordSchema,
        invitationCode: z.string().trim().length(6, "邀请码为 6 位"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const email = input.email;
      const code = input.invitationCode.toUpperCase();

      // 1. Invitation code must exist and be unused
      const codeRows = await db
        .select()
        .from(invitationCodes)
        .where(eq(invitationCodes.code, code))
        .limit(1);
      const record = codeRows[0];
      if (!record) throw new Error("邀请码不存在");
      if (record.usedByUnionId) throw new Error("该邀请码已被使用");

      // 2. Email must not be registered yet (local account or OAuth-synced)
      const unionId = localUnionId(email);
      const dup = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.unionId, unionId), eq(users.email, email)))
        .limit(1);
      if (dup[0]) throw new Error("该邮箱已被注册");

      // 3. Create the account with a scrypt-hashed password
      const { salt, hash } = hashPassword(input.password);
      await db.insert(users).values({
        unionId,
        name: input.name,
        email,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
        role: "user",
        passwordHash: hash,
        passwordSalt: salt,
        lastSignInAt: new Date(),
      });

      // 4. Burn the invitation code
      await db
        .update(invitationCodes)
        .set({ usedByUnionId: unionId, usedAt: beijingNow() })
        .where(eq(invitationCodes.id, record.id));

      // 5. Sign the user in
      await issueSession(ctx, unionId);
      const user = await findUserByUnionId(unionId);
      return sanitizeUser(user);
    }),

  // ─── Email/password login ───
  login: publicQuery
    .input(z.object({ email: emailSchema, password: z.string().min(1, "请输入密码") }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const unionId = localUnionId(input.email);
      const rows = await db.select().from(users).where(eq(users.unionId, unionId)).limit(1);
      const user = rows[0];
      if (!user || !user.passwordHash || !user.passwordSalt) {
        throw new Error("邮箱或密码错误");
      }
      if (!verifyPassword(input.password, user.passwordSalt, user.passwordHash)) {
        throw new Error("邮箱或密码错误");
      }
      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
      await issueSession(ctx, unionId);
      return sanitizeUser(user);
    }),

  // ─── Forgot password: notify admins (no SMTP available) ───
  forgotPassword: publicQuery
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(users)
        .where(or(eq(users.unionId, localUnionId(input.email)), eq(users.email, input.email)))
        .limit(1);
      const user = rows[0];
      if (user) {
        const admins = await getAdminUnionIds();
        await Promise.all(
          admins.map((a) =>
            createNotification({
              receiverUnionId: a,
              type: "password_reset_request",
              title: "密码重置请求",
              message: `用户 ${user.name || "未命名"}（${input.email}）请求重置登录密码。请在「设置 → 安全设置」为其重置，并通过站外渠道告知新密码。`,
            }),
          ),
        );
      }
      // Never reveal whether the account exists
      return {
        success: true,
        message: "如果该邮箱已注册，管理员会收到重置请求并尽快联系你。",
      };
    }),

  // ─── Self-service reset with the owner-held master recovery key ───
  resetWithMasterKey: publicQuery
    .input(
      z.object({
        email: emailSchema,
        masterKey: z.string().trim().min(1, "请输入恢复密钥"),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const keyRows = await db
        .select()
        .from(apiConfigs)
        .where(eq(apiConfigs.platform, MASTER_KEY_PLATFORM))
        .limit(1);
      const storedHash = keyRows[0]?.apiKey;
      if (!storedHash) throw new Error("系统未配置恢复密钥，请联系管理员");
      if (!safeEqualHex(sha256Hex(input.masterKey), storedHash)) {
        throw new Error("恢复密钥不正确");
      }

      const rows = await db
        .select()
        .from(users)
        .where(or(eq(users.unionId, localUnionId(input.email)), eq(users.email, input.email)))
        .limit(1);
      const user = rows[0];
      if (!user) throw new Error("该邮箱对应的账号不存在");

      const { salt, hash } = hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash: hash, passwordSalt: salt })
        .where(eq(users.id, user.id));

      await createNotification({
        receiverUnionId: user.unionId,
        type: "password_reset_done",
        title: "密码已重置",
        message: "你的登录密码已通过恢复密钥重置。如非本人操作，请立即联系管理员。",
      });
      return { success: true };
    }),

  // ─── Change my own password (logged in) ───
  changePassword: authedQuery
    .input(
      z.object({
        oldPassword: z.string().optional(),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const rows = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      const user = rows[0];
      if (!user) throw new Error("用户不存在");

      // Accounts with an existing password must prove the old one;
      // OAuth-only accounts may set a password without it.
      if (user.passwordHash && user.passwordSalt) {
        if (!input.oldPassword || !verifyPassword(input.oldPassword, user.passwordSalt, user.passwordHash)) {
          throw new Error("当前密码不正确");
        }
      }
      const { salt, hash } = hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash: hash, passwordSalt: salt })
        .where(eq(users.id, user.id));
      return { success: true };
    }),

  // ─── Admin: reset any user's password ───
  adminResetPassword: adminQuery
    .input(z.object({ userId: z.number(), newPassword: passwordSchema }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      const user = rows[0];
      if (!user) throw new Error("用户不存在");
      const { salt, hash } = hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash: hash, passwordSalt: salt })
        .where(eq(users.id, user.id));
      await createNotification({
        receiverUnionId: user.unionId,
        type: "password_reset_done",
        title: "密码已由管理员重置",
        message: "管理员已为你重置登录密码，请向管理员索取新密码，登录后请尽快修改。",
      });
      return { success: true };
    }),

  // Admin: list all registered users (OAuth + local auth synced to DB)
  list: adminQuery.query(async () => {
    const db = getDb();
    const result = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatar: users.avatar,
        role: users.role,
        unionId: users.unionId,
        createdAt: users.createdAt,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .orderBy(users.createdAt);
    return result.map(({ passwordHash, ...u }) => ({
      ...u,
      hasPassword: !!passwordHash,
    }));
  }),
});
