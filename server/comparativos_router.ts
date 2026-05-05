import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { z } from "zod";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import {
  periodoCusto, custoSetor, resumoVendasProduto, avaliacaoGlobal,
  abastecimento, producao, lancamentoCusto
} from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

/**
 * Router de Comparativos Históricos
 * Consolida dados mensais de múltiplos módulos para análise comparativa.
 */
export const comparativosRouter = router({

  /**
   * Retorna série histórica mensal consolidada:
   * faturamento, frete, custoTotal, producaoTotal, qtdVendida,
   * saldoBruto, margemBruta, custoTon, combustivelLitros, combustivelCusto
   */
  serieHistorica: protectedProcedure
    .input(z.object({
      anoInicio: z.number().int().min(2020).max(2030),
      anoFim: z.number().int().min(2020).max(2030),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // 1. Buscar todos os períodos de custo no intervalo
      const periodos = await db
        .select()
        .from(periodoCusto)
        .where(
          and(
            gte(periodoCusto.ano, input.anoInicio),
            lte(periodoCusto.ano, input.anoFim)
          )
        )
        .orderBy(periodoCusto.ano, periodoCusto.mes);

      // 2. Para cada período, buscar custo total (soma dos custoSetor)
      const custosMap: Record<string, number> = {};
      if (periodos.length > 0) {
        const periodoIds = periodos.map(p => p.id);
        const custoRows = await db
          .select({
            periodoCustoId: custoSetor.periodoCustoId,
            totalGeral: sql<string>`SUM(${custoSetor.totalGeral})`,
          })
          .from(custoSetor)
          .where(sql`${custoSetor.periodoCustoId} IN (${sql.join(periodoIds.map(id => sql`${id}`), sql`, `)})`)
          .groupBy(custoSetor.periodoCustoId);
        for (const row of custoRows) {
          custosMap[String(row.periodoCustoId)] = parseFloat(String(row.totalGeral || "0"));
        }
      }

      // 3. Buscar avaliação global para frete e investimentos
      const avaliacoes = await db
        .select()
        .from(avaliacaoGlobal)
        .where(
          and(
            gte(avaliacaoGlobal.ano, input.anoInicio),
            lte(avaliacaoGlobal.ano, input.anoFim)
          )
        );
      const avaliacaoMap: Record<string, typeof avaliacoes[0]> = {};
      for (const av of avaliacoes) {
        avaliacaoMap[`${av.ano}-${av.mes}`] = av;
      }

      // 4. Buscar faturamento (resumo_vendas_produto) agrupado por mês/ano
      const faturamentoRows = await db
        .select({
          mes: sql<number>`MONTH(${resumoVendasProduto.periodoInicio})`,
          ano: sql<number>`YEAR(${resumoVendasProduto.periodoInicio})`,
          totalReceita: sql<string>`SUM(${resumoVendasProduto.valor})`,
          totalQuantidade: sql<string>`SUM(${resumoVendasProduto.quantidade})`,
        })
        .from(resumoVendasProduto)
        .where(
          and(
            gte(sql`YEAR(${resumoVendasProduto.periodoInicio})`, input.anoInicio),
            lte(sql`YEAR(${resumoVendasProduto.periodoInicio})`, input.anoFim)
          )
        )
        .groupBy(
          sql`YEAR(${resumoVendasProduto.periodoInicio})`,
          sql`MONTH(${resumoVendasProduto.periodoInicio})`
        );
      const faturamentoMap: Record<string, { receita: number; quantidade: number }> = {};
      for (const row of faturamentoRows) {
        faturamentoMap[`${row.ano}-${row.mes}`] = {
          receita: parseFloat(String(row.totalReceita || "0")),
          quantidade: parseFloat(String(row.totalQuantidade || "0")),
        };
      }

      // 5. Buscar combustível (abastecimento) agrupado por mês/ano
      const combustivelRows = await db
        .select({
          mes: sql<number>`MONTH(${abastecimento.data})`,
          ano: sql<number>`YEAR(${abastecimento.data})`,
          totalLitros: sql<string>`SUM(${abastecimento.quantidade})`,
          totalCusto: sql<string>`SUM(${abastecimento.valorTotal})`,
        })
        .from(abastecimento)
        .where(
          and(
            gte(sql`YEAR(${abastecimento.data})`, input.anoInicio),
            lte(sql`YEAR(${abastecimento.data})`, input.anoFim)
          )
        )
        .groupBy(
          sql`YEAR(${abastecimento.data})`,
          sql`MONTH(${abastecimento.data})`
        );
      const combustivelMap: Record<string, { litros: number; custo: number }> = {};
      for (const row of combustivelRows) {
        combustivelMap[`${row.ano}-${row.mes}`] = {
          litros: parseFloat(String(row.totalLitros || "0")),
          custo: parseFloat(String(row.totalCusto || "0")),
        };
      }

      // 6. Buscar produção (producao) agrupada por mês/ano
      const producaoRows = await db
        .select({
          mes: sql<number>`MONTH(${producao.data})`,
          ano: sql<number>`YEAR(${producao.data})`,
          totalProducao: sql<string>`SUM(${producao.quantidade})`,
        })
        .from(producao)
        .where(
          and(
            gte(sql`YEAR(${producao.data})`, input.anoInicio),
            lte(sql`YEAR(${producao.data})`, input.anoFim)
          )
        )
        .groupBy(
          sql`YEAR(${producao.data})`,
          sql`MONTH(${producao.data})`
        );
      const producaoMap: Record<string, number> = {};
      for (const row of producaoRows) {
        producaoMap[`${row.ano}-${row.mes}`] = parseFloat(String(row.totalProducao || "0"));
      }

      // 7. Montar série histórica
      const serie = periodos.map(p => {
        const key = `${p.ano}-${p.mes}`;
        const fat = faturamentoMap[key] ?? { receita: 0, quantidade: 0 };
        const comb = combustivelMap[key] ?? { litros: 0, custo: 0 };
        const prod = producaoMap[key] ?? 0;
        const av = avaliacaoMap[key];
        const custo = custosMap[String(p.id)] ?? 0;
        const despesasIndiretas = parseFloat(String(p.despesasIndiretas || "0"));
        const custoTotal = custo + despesasIndiretas;
        const frete = av ? parseFloat(String(av.frete || "0")) : parseFloat(String(p.fretePeriodo || "0"));
        const receitaProdutos = fat.receita - frete;
        const saldoBruto = fat.receita - custoTotal - frete;
        const margemBruta = fat.receita > 0 ? (saldoBruto / fat.receita) * 100 : 0;
        const producaoTotal = parseFloat(String(p.producaoTotal || "0")) || prod;
        const custoTon = producaoTotal > 0 ? custoTotal / producaoTotal : 0;
        const investimentos = av
          ? parseFloat(String(av.investEquip || "0")) + parseFloat(String(av.investBritagem || "0"))
          : 0;
        const totalD = av
          ? investimentos +
            parseFloat(String(av.difFrete || "0")) +
            parseFloat(String(av.difImpostos || "0")) +
            parseFloat(String(av.distribLucro || "0")) +
            parseFloat(String(av.outros || "0"))
          : 0;
        const saldoFinal = saldoBruto - totalD;
        const margemFinal = fat.receita > 0 ? (saldoFinal / fat.receita) * 100 : 0;

        return {
          mes: p.mes,
          ano: p.ano,
          label: `${String(p.mes).padStart(2, "0")}/${p.ano}`,
          faturamento: fat.receita,
          frete,
          receitaProdutos,
          custoTotal,
          saldoBruto,
          margemBruta,
          saldoFinal,
          margemFinal,
          producaoTotal,
          qtdVendida: parseFloat(String(p.quantidadeVendida || "0")) || fat.quantidade,
          custoTon,
          combustivelLitros: comb.litros,
          combustivelCusto: comb.custo,
          investimentos,
          totalD,
          temAvaliacao: !!av,
          temCusto: custo > 0,
          temVendas: fat.receita > 0,
        };
      });

      return { serie };
    }),

  /**
   * Evolução de custos por setor/grupo ao longo dos períodos
   */
  evolucaoCustoSetor: protectedProcedure
    .input(z.object({
      anoInicio: z.number().int().min(2020).max(2030),
      anoFim: z.number().int().min(2020).max(2030),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar períodos
      const periodos = await db
        .select({ id: periodoCusto.id, mes: periodoCusto.mes, ano: periodoCusto.ano })
        .from(periodoCusto)
        .where(
          and(
            gte(periodoCusto.ano, input.anoInicio),
            lte(periodoCusto.ano, input.anoFim)
          )
        )
        .orderBy(periodoCusto.ano, periodoCusto.mes);

      if (periodos.length === 0) return { periodos: [], grupos: [], dados: [] };

      const periodoIds = periodos.map(p => p.id);

      // Buscar custo por grupo para cada período
      const custoRows = await db
        .select({
          periodoCustoId: custoSetor.periodoCustoId,
          grupoNome: custoSetor.grupoNome,
          totalGeral: sql<string>`SUM(${custoSetor.totalGeral})`,
        })
        .from(custoSetor)
        .where(sql`${custoSetor.periodoCustoId} IN (${sql.join(periodoIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(custoSetor.periodoCustoId, custoSetor.grupoNome);

      // Coletar grupos únicos
      const gruposSet = new Set<string>();
      for (const row of custoRows) {
        gruposSet.add(row.grupoNome);
      }
      const grupos = Array.from(gruposSet).sort();

      // Montar matriz: periodos x grupos
      const dadosMap: Record<string, Record<string, number>> = {};
      for (const row of custoRows) {
        const p = periodos.find(p => p.id === row.periodoCustoId);
        if (!p) continue;
        const label = `${String(p.mes).padStart(2, "0")}/${p.ano}`;
        if (!dadosMap[label]) dadosMap[label] = {};
        dadosMap[label][row.grupoNome] = parseFloat(String(row.totalGeral || "0"));
      }

      const periodosLabels = periodos.map(p => `${String(p.mes).padStart(2, "0")}/${p.ano}`);

      return {
        periodos: periodosLabels,
        grupos,
        dados: periodosLabels.map(label => ({
          label,
          ...Object.fromEntries(grupos.map(g => [g, dadosMap[label]?.[g] ?? 0])),
        })),
      };
    }),

  /**
   * Evolução de combustível (litros e custo) por mês
   */
  evolucaoCombustivel: protectedProcedure
    .input(z.object({
      anoInicio: z.number().int().min(2020).max(2030),
      anoFim: z.number().int().min(2020).max(2030),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const rows = await db
        .select({
          mes: sql<number>`MONTH(${abastecimento.data})`,
          ano: sql<number>`YEAR(${abastecimento.data})`,
          totalLitros: sql<string>`SUM(${abastecimento.quantidade})`,
          totalCusto: sql<string>`SUM(${abastecimento.valorTotal})`,
          mediaPreco: sql<string>`AVG(${abastecimento.valorUnitario})`,
          qtdAbastecimentos: sql<number>`COUNT(*)`,
        })
        .from(abastecimento)
        .where(
          and(
            gte(sql`YEAR(${abastecimento.data})`, input.anoInicio),
            lte(sql`YEAR(${abastecimento.data})`, input.anoFim)
          )
        )
        .groupBy(
          sql`YEAR(${abastecimento.data})`,
          sql`MONTH(${abastecimento.data})`
        )
        .orderBy(
          sql`YEAR(${abastecimento.data})`,
          sql`MONTH(${abastecimento.data})`
        );

      return rows.map(r => ({
        label: `${String(r.mes).padStart(2, "0")}/${r.ano}`,
        mes: r.mes,
        ano: r.ano,
        litros: parseFloat(String(r.totalLitros || "0")),
        custo: parseFloat(String(r.totalCusto || "0")),
        mediaPreco: parseFloat(String(r.mediaPreco || "0")),
        qtdAbastecimentos: r.qtdAbastecimentos,
      }));
    }),
});
