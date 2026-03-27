import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { users } from "../drizzle/schema";

/**
 * Middleware que verifica se o usuário tem permissão para gerenciar usuários
 * Apenas Consultoria e Admin podem gerenciar outros usuários
 */
const consultoriaOnlyProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "consultoria"];
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o perfil Consultoria pode gerenciar usuários.",
    });
  }
  return next({ ctx });
});

export const usuariosRouter = router({
  // Listar usuários - Consultoria vê todos, demais perfis veem apenas o próprio
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const isConsultoria = ["admin", "consultoria"].includes(ctx.user.role);
    if (isConsultoria) {
      return await db.select().from(users).orderBy(users.name);
    }
    // Demais perfis veem apenas o próprio usuário
    return await db.select().from(users).where(eq(users.id, ctx.user.id));
  }),

  // Editar qualquer usuário - restrito a Consultoria
  update: consultoriaOnlyProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        whatsapp: z.string().optional(),
        cargo: z.string().optional(),
        role: z.enum(["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const updateData: any = { role: input.role };
      if (input.name) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email || null;
      if (input.whatsapp !== undefined) updateData.whatsapp = input.whatsapp || null;
      if (input.cargo !== undefined) updateData.cargo = input.cargo || null;

      await db.update(users).set(updateData).where(eq(users.id, input.id));
      
      return { success: true };
    }),

  // Editar o próprio perfil - qualquer usuário autenticado (mas não pode alterar role)
  updateMyProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        whatsapp: z.string().optional(),
        cargo: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email || null;
      if (input.whatsapp !== undefined) updateData.whatsapp = input.whatsapp || null;
      if (input.cargo !== undefined) updateData.cargo = input.cargo || null;

      await db.update(users).set(updateData).where(eq(users.id, ctx.user.id));
      
      return { success: true };
    }),

  // Excluir usuário - restrito a Consultoria
  delete: consultoriaOnlyProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      if (input.id === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Você não pode excluir seu próprio usuário",
        });
      }

      await db.delete(users).where(eq(users.id, input.id));
      
      return { success: true };
    }),

  /**
   * Força a atualização do perfil do usuário atual
   */
  refreshMyProfile: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const freshUser = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    
    if (!freshUser || freshUser.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Usuário não encontrado",
      });
    }

    return freshUser[0];
  }),
});
