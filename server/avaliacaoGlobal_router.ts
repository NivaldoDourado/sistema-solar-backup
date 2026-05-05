import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { avaliacaoGlobal } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

/**
 * Converte string monetária no formato brasileiro (ex: "1.552.995,14") para string decimal americana ("1552995.14").
 * Aceita também formato americano direto ("1552995.14") e strings vazias/nulas.
 */
function parseBRDecimal(value: string | undefined | null): string {
  if (value === undefined || value === null || String(value).trim() === "") return "0";
  // Remove pontos de milhar e substitui vírgula decimal por ponto
  const cleaned = String(value).trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return "0";
  return num.toFixed(2);
}

export const avaliacaoGlobalRouter = router({
  // Buscar avaliação global de um período (mes/ano)
  getByPeriodo: protectedProcedure
    .input(z.object({ mes: z.number().int().min(1).max(12), ano: z.number().int().min(2020).max(2100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await db
        .select()
        .from(avaliacaoGlobal)
        .where(and(eq(avaliacaoGlobal.mes, input.mes), eq(avaliacaoGlobal.ano, input.ano)))
        .limit(1);
      return rows[0] ?? null;
    }),

  // Listar todos os períodos com avaliação global cadastrada
  listarPeriodos: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    const rows = await db
      .select({
        id: avaliacaoGlobal.id,
        mes: avaliacaoGlobal.mes,
        ano: avaliacaoGlobal.ano,
        frete: avaliacaoGlobal.frete,
        updatedAt: avaliacaoGlobal.updatedAt,
      })
      .from(avaliacaoGlobal)
      .orderBy(avaliacaoGlobal.ano, avaliacaoGlobal.mes);
    return rows;
  }),

  // Criar ou atualizar avaliação global (upsert por mes/ano)
  upsert: protectedProcedure
    .input(
      z.object({
        mes: z.number().int().min(1).max(12),
        ano: z.number().int().min(2020).max(2100),
        frete: z.string().optional(),
        investEquip: z.string().optional(),
        investBritagem: z.string().optional(),
        difFrete: z.string().optional(),
        difImpostos: z.string().optional(),
        distribLucro: z.string().optional(),
        outros: z.string().optional(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const existing = await db
        .select({ id: avaliacaoGlobal.id })
        .from(avaliacaoGlobal)
        .where(and(eq(avaliacaoGlobal.mes, input.mes), eq(avaliacaoGlobal.ano, input.ano)))
        .limit(1);

      // Converte todos os valores monetários do formato BR para decimal americano
      const data = {
        frete: parseBRDecimal(input.frete),
        investEquip: parseBRDecimal(input.investEquip),
        investBritagem: parseBRDecimal(input.investBritagem),
        difFrete: parseBRDecimal(input.difFrete),
        difImpostos: parseBRDecimal(input.difImpostos),
        distribLucro: parseBRDecimal(input.distribLucro),
        outros: parseBRDecimal(input.outros),
        observacoes: input.observacoes ?? null,
        userId: ctx.user.id,
      };

      if (existing.length > 0) {
        await db
          .update(avaliacaoGlobal)
          .set(data)
          .where(and(eq(avaliacaoGlobal.mes, input.mes), eq(avaliacaoGlobal.ano, input.ano)));
        return { success: true, action: "updated" };
      } else {
        await db.insert(avaliacaoGlobal).values({ mes: input.mes, ano: input.ano, ...data });
        return { success: true, action: "created" };
      }
    }),

  // Deletar avaliação global de um período
  deletar: protectedProcedure
    .input(z.object({ mes: z.number().int(), ano: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db
        .delete(avaliacaoGlobal)
        .where(and(eq(avaliacaoGlobal.mes, input.mes), eq(avaliacaoGlobal.ano, input.ano)));
      return { success: true };
    }),
});
