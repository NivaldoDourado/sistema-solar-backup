import { z } from "zod";
import { eq, and, desc, sql, like } from "drizzle-orm";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { lancamentoCusto, contaCusto, periodoCusto } from "../drizzle/schema";

export const lancamentoCustoRouter = router({
  // Listar lançamentos de um período específico
  listByPeriodo: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select({
          id: lancamentoCusto.id,
          periodoCustoId: lancamentoCusto.periodoCustoId,
          contaCustoId: lancamentoCusto.contaCustoId,
          contaNome: contaCusto.nome,
          contaClassificacao: contaCusto.classificacao,
          contaDivisor: contaCusto.divisor,
          valor: lancamentoCusto.valor,
          observacoes: lancamentoCusto.observacoes,
          createdAt: lancamentoCusto.createdAt,
        })
        .from(lancamentoCusto)
        .innerJoin(contaCusto, eq(lancamentoCusto.contaCustoId, contaCusto.id))
        .where(eq(lancamentoCusto.periodoCustoId, input.periodoCustoId))
        .orderBy(contaCusto.classificacao, desc(lancamentoCusto.valor));
    }),

  // Criar ou atualizar lançamento (upsert por periodoCustoId + contaCustoId)
  upsert: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(
      z.object({
        periodoCustoId: z.number(),
        contaCustoId: z.number(),
        valor: z.string(),
        observacoes: z.string().optional(),
      })
    )
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
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado. Não é possível lançar custos." });
      }

      // Verificar se já existe lançamento para esta conta neste período
      const [existing] = await db
        .select()
        .from(lancamentoCusto)
        .where(
          and(
            eq(lancamentoCusto.periodoCustoId, input.periodoCustoId),
            eq(lancamentoCusto.contaCustoId, input.contaCustoId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(lancamentoCusto)
          .set({
            valor: input.valor,
            observacoes: input.observacoes ?? null,
          })
          .where(eq(lancamentoCusto.id, existing.id));
        return { id: existing.id, action: "updated" };
      } else {
        const result = await db.insert(lancamentoCusto).values({
          periodoCustoId: input.periodoCustoId,
          contaCustoId: input.contaCustoId,
          valor: input.valor,
          observacoes: input.observacoes ?? null,
          userId: ctx.user.id,
        });
        return { id: Number(result[0].insertId), action: "created" };
      }
    }),

  // Salvar múltiplos lançamentos de uma vez (batch upsert)
  batchUpsert: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(
      z.object({
        periodoCustoId: z.number(),
        lancamentos: z.array(
          z.object({
            contaCustoId: z.number(),
            valor: z.string(),
            observacoes: z.string().optional(),
          })
        ),
      })
    )
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
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado. Não é possível lançar custos." });
      }

      // Buscar lançamentos existentes para este período
      const existentes = await db
        .select()
        .from(lancamentoCusto)
        .where(eq(lancamentoCusto.periodoCustoId, input.periodoCustoId));

      const existenteMap = new Map(existentes.map((l) => [l.contaCustoId, l]));

      let created = 0;
      let updated = 0;

      for (const item of input.lancamentos) {
        const existing = existenteMap.get(item.contaCustoId);
        if (existing) {
          await db
            .update(lancamentoCusto)
            .set({ valor: item.valor, observacoes: item.observacoes ?? null })
            .where(eq(lancamentoCusto.id, existing.id));
          updated++;
        } else {
          await db.insert(lancamentoCusto).values({
            periodoCustoId: input.periodoCustoId,
            contaCustoId: item.contaCustoId,
            valor: item.valor,
            observacoes: item.observacoes ?? null,
            userId: ctx.user.id,
          });
          created++;
        }
      }

      return { created, updated };
    }),

  // Excluir lançamento
  delete: protectedProcedure
    .use(requirePermission("custos", "delete"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [row] = await db
        .select({ id: lancamentoCusto.id, periodoCustoId: lancamentoCusto.periodoCustoId })
        .from(lancamentoCusto)
        .where(eq(lancamentoCusto.id, input.id))
        .limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });

      // Verificar se o período está fechado
      const [periodo] = await db
        .select({ fechado: periodoCusto.fechado })
        .from(periodoCusto)
        .where(eq(periodoCusto.id, row.periodoCustoId))
        .limit(1);
      if (periodo?.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado. Não é possível excluir lançamentos." });
      }

      await db.delete(lancamentoCusto).where(eq(lancamentoCusto.id, input.id));
      return { success: true };
    }),

  // Resumo por classificação para um período
  resumoPorClassificacao: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          classificacao: contaCusto.classificacao,
          divisor: contaCusto.divisor,
          valor: lancamentoCusto.valor,
        })
        .from(lancamentoCusto)
        .innerJoin(contaCusto, eq(lancamentoCusto.contaCustoId, contaCusto.id))
        .where(eq(lancamentoCusto.periodoCustoId, input.periodoCustoId));

      // Agrupar por classificação
      const grupos: Record<string, { classificacao: string; divisor: string; total: number }> = {};
      for (const row of rows) {
        const key = row.classificacao ?? "custo_variavel";
        if (!grupos[key]) {
          grupos[key] = { classificacao: key, divisor: row.divisor ?? "producao", total: 0 };
        }
        grupos[key].total += parseFloat(String(row.valor || "0"));
      }
      return Object.values(grupos);
    }),

  // Subsetores de "Outras Despesas de Setores" — agrupa lançamentos [Import] por setor destino
  subsetoresOutrasDesp: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { subsetores: [], total: 0 };
      // Buscar conta "Outras Despesas de Setores"
      const [contaODS] = await db.select({ id: contaCusto.id }).from(contaCusto)
        .where(like(contaCusto.nome, "%Outras Despesas de Setores%"));
      if (!contaODS) return { subsetores: [], total: 0 };
      // Buscar lançamentos [Import] dessa conta no período
      const rows = await db.select({
        id: lancamentoCusto.id,
        valor: lancamentoCusto.valor,
        observacoes: lancamentoCusto.observacoes,
      }).from(lancamentoCusto).where(and(
        eq(lancamentoCusto.periodoCustoId, input.periodoCustoId),
        eq(lancamentoCusto.contaCustoId, contaODS.id),
        like(lancamentoCusto.observacoes, "%[Import]%"),
      )).orderBy(desc(lancamentoCusto.valor));
      // Extrair setor destino do campo observacoes: "[Import] TAG - DESC | Outras Desp. Setor → SETOR"
      const porSetor: Record<string, { setor: string; valor: number; itens: { tag: string; descricao: string; valor: number }[] }> = {};
      for (const row of rows) {
        const obs = row.observacoes ?? "";
        const matchSetor = obs.match(/Outras Desp\. Setor → (.+)$/);
        const matchTag = obs.match(/\[Import\] (.+?) - (.+?) \|/);
        const setor = matchSetor ? matchSetor[1].trim() : "Outros";
        const tag = matchTag ? matchTag[1].trim() : "";
        const descricao = matchTag ? matchTag[2].trim() : "";
        const valor = parseFloat(String(row.valor || "0"));
        if (!porSetor[setor]) porSetor[setor] = { setor, valor: 0, itens: [] };
        porSetor[setor].valor += valor;
        porSetor[setor].itens.push({ tag, descricao, valor });
      }
      const subsetores = Object.values(porSetor).sort((a, b) => b.valor - a.valor);
      const total = subsetores.reduce((s, r) => s + r.valor, 0);
      return { subsetores, total };
    }),
});
