import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { custoSetor } from "../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

export const custoSetorRouter = router({
  // Listar todos os lançamentos de custo por setor de um período
  listarPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetor)
        .where(eq(custoSetor.periodoCustoId, input.periodoCustoId))
        .orderBy(asc(custoSetor.ordemExibicao), asc(custoSetor.grupoNome), asc(custoSetor.subsetorNome));
    }),

  // Upsert (criar ou atualizar) um lançamento de custo por setor
  upsert: protectedProcedure
    .input(
      z.object({
        periodoCustoId: z.number(),
        grupoNome: z.string(),
        subsetorNome: z.string(),
        setorId: z.number().optional().nullable(),
        custoFixo: z.number().default(0),
        custoVariavel: z.number().default(0),
        totalCusto: z.number().default(0),
        despesaFixa: z.number().default(0),
        despesaVariavel: z.number().default(0),
        totalDespesa: z.number().default(0),
        totalGeral: z.number().default(0),
        custoTon: z.number().default(0),
        percentualTotal: z.number().default(0),
        ordemExibicao: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Verificar se já existe
      const [existing] = await db
        .select({ id: custoSetor.id })
        .from(custoSetor)
        .where(
          and(
            eq(custoSetor.periodoCustoId, input.periodoCustoId),
            eq(custoSetor.subsetorNome, input.subsetorNome)
          )
        )
        .limit(1);

      const data = {
        periodoCustoId: input.periodoCustoId,
        grupoNome: input.grupoNome,
        subsetorNome: input.subsetorNome,
        setorId: input.setorId ?? null,
        custoFixo: input.custoFixo.toFixed(2),
        custoVariavel: input.custoVariavel.toFixed(2),
        totalCusto: input.totalCusto.toFixed(2),
        despesaFixa: input.despesaFixa.toFixed(2),
        despesaVariavel: input.despesaVariavel.toFixed(2),
        totalDespesa: input.totalDespesa.toFixed(2),
        totalGeral: input.totalGeral.toFixed(2),
        custoTon: input.custoTon.toFixed(4),
        percentualTotal: input.percentualTotal.toFixed(4),
        ordemExibicao: input.ordemExibicao,
        userId: ctx.user.id,
      };

      if (existing) {
        await db.update(custoSetor).set(data).where(eq(custoSetor.id, existing.id));
        return { id: existing.id, action: "updated" };
      } else {
        const [result] = await db.insert(custoSetor).values(data);
        return { id: (result as any).insertId, action: "created" };
      }
    }),

  // Deletar todos os lançamentos de um período (para reimportação)
  deletarPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(custoSetor).where(eq(custoSetor.periodoCustoId, input.periodoCustoId));
      return { success: true };
    }),

  // Relatório consolidado por grupo (com subtotais)
  relatorio: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { grupos: [], totalGeral: 0, totalCustoTon: 0, lancamentos: [] };

      const lancamentos = await db
        .select()
        .from(custoSetor)
        .where(eq(custoSetor.periodoCustoId, input.periodoCustoId))
        .orderBy(asc(custoSetor.ordemExibicao), asc(custoSetor.grupoNome), asc(custoSetor.subsetorNome));

      // Agrupar por grupoNome
      type LancItem = typeof lancamentos[0];
      type Grupo = {
        grupoNome: string;
        subsetores: LancItem[];
        subtotalCusto: number;
        subtotalDespesa: number;
        subtotalGeral: number;
        subtotalCustoTon: number;
      };
      const grupos: Record<string, Grupo> = {};

      for (const l of lancamentos) {
        if (!grupos[l.grupoNome]) {
          grupos[l.grupoNome] = {
            grupoNome: l.grupoNome,
            subsetores: [],
            subtotalCusto: 0,
            subtotalDespesa: 0,
            subtotalGeral: 0,
            subtotalCustoTon: 0,
          };
        }
        grupos[l.grupoNome].subsetores.push(l);
        grupos[l.grupoNome].subtotalCusto += parseFloat(l.totalCusto ?? "0");
        grupos[l.grupoNome].subtotalDespesa += parseFloat(l.totalDespesa ?? "0");
        grupos[l.grupoNome].subtotalGeral += parseFloat(l.totalGeral ?? "0");
        grupos[l.grupoNome].subtotalCustoTon += parseFloat(l.custoTon ?? "0");
      }

      const totalGeral = lancamentos.reduce(
        (s: number, l: LancItem) => s + parseFloat(l.totalGeral ?? "0"),
        0
      );
      const totalCustoTon = lancamentos.reduce(
        (s: number, l: LancItem) => s + parseFloat(l.custoTon ?? "0"),
        0
      );

      return {
        grupos: Object.values(grupos),
        totalGeral,
        totalCustoTon,
        lancamentos,
      };
    }),
});
