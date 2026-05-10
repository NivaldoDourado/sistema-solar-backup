import { z } from "zod";
import { eq, and, desc, like } from "drizzle-orm";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  lancamentoCusto,
  contaCusto,
  periodoCusto,
} from "../drizzle/schema";

// ID da conta "Impostos, CEFEM e Outras Taxas"
const CONTA_IMPOSTOS_ID = 2;
const OBS_PREFIX = "[Impostos Manual]";

export const impostosRouter = router({
  // Listar lançamentos manuais de impostos de um período
  listByPeriodo: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: lancamentoCusto.id,
          periodoCustoId: lancamentoCusto.periodoCustoId,
          contaCustoId: lancamentoCusto.contaCustoId,
          valor: lancamentoCusto.valor,
          observacoes: lancamentoCusto.observacoes,
          createdAt: lancamentoCusto.createdAt,
        })
        .from(lancamentoCusto)
        .where(
          and(
            eq(lancamentoCusto.periodoCustoId, input.periodoCustoId),
            eq(lancamentoCusto.contaCustoId, CONTA_IMPOSTOS_ID),
            like(lancamentoCusto.observacoes, `${OBS_PREFIX}%`)
          )
        )
        .orderBy(desc(lancamentoCusto.createdAt));
      return rows;
    }),

  // Resumo: total de impostos manuais + importados para o período
  resumoPorPeriodo: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { totalManual: 0, totalImportado: 0, totalGeral: 0 };

      const rows = await db
        .select({
          valor: lancamentoCusto.valor,
          observacoes: lancamentoCusto.observacoes,
        })
        .from(lancamentoCusto)
        .where(
          and(
            eq(lancamentoCusto.periodoCustoId, input.periodoCustoId),
            eq(lancamentoCusto.contaCustoId, CONTA_IMPOSTOS_ID)
          )
        );

      let totalManual = 0;
      let totalImportado = 0;
      for (const r of rows) {
        const v = Number(r.valor) || 0;
        if (r.observacoes?.startsWith(OBS_PREFIX)) {
          totalManual += v;
        } else {
          totalImportado += v;
        }
      }
      return { totalManual, totalImportado, totalGeral: totalManual + totalImportado };
    }),

  // Criar lançamento manual de imposto
  create: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(z.object({
      periodoCustoId: z.number(),
      valor: z.string(),
      descricao: z.string().optional(), // ex: "ICMS, PIS, COFINS, CEFEM"
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verificar se o período está fechado
      const [periodo] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, input.periodoCustoId))
        .limit(1);
      if (!periodo) throw new TRPCError({ code: "NOT_FOUND", message: "Período não encontrado" });
      if (periodo.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado. Não é possível lançar impostos." });
      }

      const obs = input.descricao
        ? `${OBS_PREFIX} ${input.descricao}`
        : `${OBS_PREFIX} Previsão de Impostos`;

      const result = await db.insert(lancamentoCusto).values({
        periodoCustoId: input.periodoCustoId,
        contaCustoId: CONTA_IMPOSTOS_ID,
        valor: input.valor,
        observacoes: obs,
        userId: ctx.user.id,
      });

      return { id: Number(result[0].insertId), success: true };
    }),

  // Atualizar lançamento manual de imposto
  update: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(z.object({
      id: z.number(),
      valor: z.string(),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select()
        .from(lancamentoCusto)
        .where(eq(lancamentoCusto.id, input.id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });

      // Verificar se é um lançamento manual
      if (!existing.observacoes?.startsWith(OBS_PREFIX)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Este lançamento não é manual e não pode ser editado aqui." });
      }

      // Verificar se o período está fechado
      const [periodo] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, existing.periodoCustoId))
        .limit(1);
      if (periodo?.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado." });
      }

      const obs = input.descricao
        ? `${OBS_PREFIX} ${input.descricao}`
        : existing.observacoes;

      await db.update(lancamentoCusto).set({
        valor: input.valor,
        observacoes: obs,
      }).where(eq(lancamentoCusto.id, input.id));

      return { success: true };
    }),

  // Excluir lançamento manual de imposto
  delete: protectedProcedure
    .use(requirePermission("custos", "delete"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select()
        .from(lancamentoCusto)
        .where(eq(lancamentoCusto.id, input.id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });

      // Verificar se é um lançamento manual
      if (!existing.observacoes?.startsWith(OBS_PREFIX)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Este lançamento não é manual e não pode ser excluído aqui." });
      }

      // Verificar se o período está fechado
      const [periodo] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, existing.periodoCustoId))
        .limit(1);
      if (periodo?.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado." });
      }

      await db.delete(lancamentoCusto).where(eq(lancamentoCusto.id, input.id));
      return { success: true };
    }),
});
