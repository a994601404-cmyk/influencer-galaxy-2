import { z } from "zod";
import { createRouter, publicQuery, authedQuery, adminQuery } from "./middleware.js";
import { getDb, getRawConnection } from "./queries/connection.js";
import { invitationCodes } from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";

// Generate random 6-char code (uppercase letters + numbers, no ambiguous chars)
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes I, O, 0, 1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const invitationRouter = createRouter({
  // Admin: generate invitation codes
  generate: adminQuery
    .input(z.object({ count: z.number().min(1).max(50).default(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conn = await getRawConnection();
      const now = new Date().toISOString().split("T")[0] + " " + new Date().toTimeString().slice(0, 5);
      const codes: string[] = [];

      for (let i = 0; i < input.count; i++) {
        let code = generateCode();
        // Ensure uniqueness by checking DB
        let attempts = 0;
        while (attempts < 10) {
          const [existing] = await conn.execute(
            `SELECT id FROM invitationCodes WHERE code = ?`, [code]
          );
          if ((existing as any[]).length === 0) break;
          code = generateCode();
          attempts++;
        }

        await db.insert(invitationCodes).values({
          code,
          createdByUnionId: ctx.user.unionId,
          createdAt: now,
        });
        codes.push(code);
      }

      return { success: true, codes };
    }),

  // Admin: list all invitation codes
  list: adminQuery
    .query(async () => {
      const db = getDb();
      const result = await db
        .select()
        .from(invitationCodes)
        .orderBy(desc(invitationCodes.createdAt));
      return result;
    }),

  // Admin: delete unused invitation code
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(invitationCodes).where(eq(invitationCodes.id, input.id));
      return { success: true };
    }),

  // Public: validate invitation code (check if it's valid and unused)
  validate: publicQuery
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db
        .select()
        .from(invitationCodes)
        .where(eq(invitationCodes.code, input.code.toUpperCase()))
        .limit(1);

      const record = result[0];
      if (!record) {
        return { valid: false, message: "邀请码不存在" };
      }
      if (record.usedByUnionId) {
        return { valid: false, message: "该邀请码已被使用" };
      }
      return { valid: true, message: "邀请码有效" };
    }),

  // Public: use an invitation code (mark it as used)
  // This is called after successful registration
  use: publicQuery
    .input(z.object({ code: z.string().length(6), unionId: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date().toISOString().split("T")[0] + " " + new Date().toTimeString().slice(0, 5);

      // Check if code exists and is unused
      const result = await db
        .select()
        .from(invitationCodes)
        .where(eq(invitationCodes.code, input.code.toUpperCase()))
        .limit(1);

      const record = result[0];
      if (!record) {
        throw new Error("邀请码不存在");
      }
      if (record.usedByUnionId) {
        throw new Error("该邀请码已被使用");
      }

      // Mark as used
      await db
        .update(invitationCodes)
        .set({
          usedByUnionId: input.unionId,
          usedAt: now,
        })
        .where(eq(invitationCodes.id, record.id));

      return { success: true };
    }),
});
