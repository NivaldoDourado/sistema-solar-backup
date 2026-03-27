import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import bcrypt from "bcryptjs";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

const SALT_ROUNDS = 10;

export const authLocalRouter = router({
  // Login por email/senha
  login: publicProcedure
    .input(
      z.object({
        email: z.string().min(1, "E-mail é obrigatório"),
        password: z.string().min(1, "Senha é obrigatória"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar usuário por email
      const result = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      const user = result[0];

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "E-mail ou senha incorretos.",
        });
      }

      // Verificar se o usuário tem senha cadastrada
      if (!user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Este usuário não possui senha cadastrada. Entre em contato com a Consultoria.",
        });
      }

      // Verificar senha
      const isValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "E-mail ou senha incorretos.",
        });
      }

      // Atualizar último login
      await db.update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      // Criar token de sessão usando o SDK existente
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      // Setar cookie de sessão
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return {
        success: true,
        mustChangePassword: user.mustChangePassword === "sim",
        userId: user.id,
      };
    }),

  // Trocar senha (primeiro login ou alteração voluntária)
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().optional(), // Opcional no primeiro login
        newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
        confirmPassword: z.string(),
      }).refine(data => data.newPassword === data.confirmPassword, {
        message: "As senhas não coincidem",
        path: ["confirmPassword"],
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const user = ctx.user;

      // Se o usuário NÃO está no primeiro login, exigir senha atual
      if (user.mustChangePassword !== "sim" && input.currentPassword) {
        if (!user.passwordHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Usuário não possui senha cadastrada.",
          });
        }
        const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Senha atual incorreta.",
          });
        }
      }

      // Hash da nova senha
      const newHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

      // Atualizar senha e desmarcar flag de primeiro login
      await db.update(users)
        .set({
          passwordHash: newHash,
          mustChangePassword: "nao",
        })
        .where(eq(users.id, user.id));

      return { success: true };
    }),

  // Verificar se o usuário precisa trocar a senha
  checkMustChangePassword: protectedProcedure.query(async ({ ctx }) => {
    return {
      mustChangePassword: ctx.user.mustChangePassword === "sim",
    };
  }),
});
