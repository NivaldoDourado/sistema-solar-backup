import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { z } from "zod";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import {
  periodoCusto, custoSetorEquipamento, custoSetorDespesa,
  resumoVendasProduto, avaliacaoGlobal, abastecimento, producao
} from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

/**
 * Calcula o custo total por grupo/subsetor para um conjunto de períodos
 * usando custo_setor_equipamento + custo_setor_despesa (fonte primária, igual ao custoSetorRas_router).
 * Não depende da tabela custo_setor (que requer importação RSSET separada).
 */
async function calcularCustosPorPeriodos(
  db: Awaited<ReturnType<typeof getDb>>,
  periodoIds: number[]
): Promise<{
  totalPorPeriodo: Record<string, number>;
  totalPorGrupoPeriodo: Record<string, Record<string, number>>;
}> {
  if (!db || periodoIds.length === 0) {
    return { totalPorPeriodo: {}, totalPorGrupoPeriodo: {} };
  }

  const idsSql = sql.join(periodoIds.map(id => sql`${id}`), sql`, `);

  const [equipamentos, despesas] = await Promise.all([
    db.select({
      periodoCustoId: custoSetorEquipamento.periodoCustoId,
      grupoNome: custoSetorEquipamento.grupoNome,
      total: sql<string>`SUM(${custoSetorEquipamento.totalDespesasEquipamento})`,
    })
      .from(custoSetorEquipamento)
      .where(sql`${custoSetorEquipamento.periodoCustoId} IN (${idsSql})`)
      .groupBy(custoSetorEquipamento.periodoCustoId, custoSetorEquipamento.grupoNome),
    db.select({
      periodoCustoId: custoSetorDespesa.periodoCustoId,
      grupoNome: custoSetorDespesa.grupoNome,
      total: sql<string>`SUM(${custoSetorDespesa.valor})`,
    })
      .from(custoSetorDespesa)
      .where(sql`${custoSetorDespesa.periodoCustoId} IN (${idsSql})`)
      .groupBy(custoSetorDespesa.periodoCustoId, custoSetorDespesa.grupoNome),
  ]);

  // Consolidar totais por período e por grupo/período
  const totalPorPeriodo: Record<string, number> = {};
  const totalPorGrupoPeriodo: Record<string, Record<string, number>> = {};

  const addValor = (periodoCustoId: number, grupoNome: string, valor: number) => {
    const pid = String(periodoCustoId);
    totalPorPeriodo[pid] = (totalPorPeriodo[pid] ?? 0) + valor;
    if (!totalPorGrupoPeriodo[pid]) totalPorGrupoPeriodo[pid] = {};
    totalPorGrupoPeriodo[pid][grupoNome] = (totalPorGrupoPeriodo[pid][grupoNome] ?? 0) + valor;
  };

  for (const row of equipamentos) {
    addValor(row.periodoCustoId, row.grupoNome, parseFloat(String(row.total || "0")));
  }
  for (const row of despesas) {
    addValor(row.periodoCustoId, row.grupoNome, parseFloat(String(row.total || "0")));
  }

  return { totalPorPeriodo, totalPorGrupoPeriodo };
}

/**
 * Router de Comparativos Históricos
 * Consolida dados mensais de múltiplos módulos para análise comparativa.
 */
export const comparativosRouter = router({

  /**
   * Retorna série histórica mensal consolidada
   */
  serieHistorica: protectedProcedure
    .input(z.object({
      anoInicio: z.number().int().min(2020).max(2030),
      anoFim: z.number().int().min(2020).max(2030),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { anoInicio, anoFim } = input;

      // 1. Buscar todos os períodos de custo no intervalo
      const periodos = await db
        .select()
        .from(periodoCusto)
        .where(and(gte(periodoCusto.ano, anoInicio), lte(periodoCusto.ano, anoFim)))
        .orderBy(periodoCusto.ano, periodoCusto.mes);

      if (periodos.length === 0) return { serie: [] };

      const periodoIds = periodos.map(p => p.id);

      // 2. Buscar custos por período (usando custo_setor_equipamento + custo_setor_despesa)
      const { totalPorPeriodo } = await calcularCustosPorPeriodos(db, periodoIds);

      // 3. Buscar avaliação global
      const avaliacoes = await db
        .select()
        .from(avaliacaoGlobal)
        .where(and(gte(avaliacaoGlobal.ano, anoInicio), lte(avaliacaoGlobal.ano, anoFim)));
      const avaliacaoMap: Record<string, typeof avaliacoes[0]> = {};
      for (const av of avaliacoes) {
        avaliacaoMap[`${av.ano}-${av.mes}`] = av;
      }

      // 4. Buscar faturamento agrupado por mês/ano
      const strInicioFat = `${anoInicio}-01-01`;
      const strFimFat = `${anoFim}-12-31`;
      const faturamentoRows = await db
        .select({
          mes: sql<number>`MONTH(${resumoVendasProduto.periodoInicio})`,
          ano: sql<number>`YEAR(${resumoVendasProduto.periodoInicio})`,
          totalReceita: sql<string>`SUM(${resumoVendasProduto.valor})`,
          totalQuantidade: sql<string>`SUM(${resumoVendasProduto.quantidade})`,
        })
        .from(resumoVendasProduto)
        .where(and(
          gte(resumoVendasProduto.periodoInicio, sql`${strInicioFat}`),
          lte(resumoVendasProduto.periodoInicio, sql`${strFimFat}`)
        ))
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

      // 5. Buscar combustível agrupado por mês/ano
      const strInicioAbast = `${anoInicio}-01-01`;
      const strFimAbast = `${anoFim}-12-31`;
      const combustivelRows = await db
        .select({
          mes: sql<number>`MONTH(${abastecimento.data})`,
          ano: sql<number>`YEAR(${abastecimento.data})`,
          totalLitros: sql<string>`SUM(${abastecimento.quantidade})`,
          totalCusto: sql<string>`SUM(${abastecimento.valorTotal})`,
        })
        .from(abastecimento)
        .where(and(
          gte(abastecimento.data, sql`${strInicioAbast}`),
          lte(abastecimento.data, sql`${strFimAbast}`)
        ))
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

      // 6. Buscar produção agrupada por mês/ano
      const strInicioProducao = `${anoInicio}-01-01`;
      const strFimProducao = `${anoFim}-12-31`;
      const producaoRows = await db
        .select({
          mes: sql<number>`MONTH(${producao.data})`,
          ano: sql<number>`YEAR(${producao.data})`,
          totalProducao: sql<string>`SUM(${producao.quantidade})`,
        })
        .from(producao)
        .where(and(
          gte(producao.data, sql`${strInicioProducao}`),
          lte(producao.data, sql`${strFimProducao}`)
        ))
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
        const custo = totalPorPeriodo[String(p.id)] ?? 0;
        const despesasIndiretas = parseFloat(String(p.despesasIndiretas || "0"));
        const custoTotal = custo + despesasIndiretas;
        const frete = av ? parseFloat(String(av.frete || "0")) : parseFloat(String(p.fretePeriodo || "0"));
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
   * Evolução de custos por grupo ao longo dos períodos
   * Usa custo_setor_equipamento + custo_setor_despesa (fonte primária)
   */
  evolucaoCustoSetor: protectedProcedure
    .input(z.object({
      anoInicio: z.number().int().min(2020).max(2030),
      anoFim: z.number().int().min(2020).max(2030),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { anoInicio, anoFim } = input;

      // Buscar períodos
      const periodos = await db
        .select({ id: periodoCusto.id, mes: periodoCusto.mes, ano: periodoCusto.ano })
        .from(periodoCusto)
        .where(and(gte(periodoCusto.ano, anoInicio), lte(periodoCusto.ano, anoFim)))
        .orderBy(periodoCusto.ano, periodoCusto.mes);

      if (periodos.length === 0) return { periodos: [], grupos: [], dados: [] };

      const periodoIds = periodos.map(p => p.id);
      const { totalPorGrupoPeriodo } = await calcularCustosPorPeriodos(db, periodoIds);

      // Coletar grupos únicos
      const gruposSet = new Set<string>();
      for (const grupos of Object.values(totalPorGrupoPeriodo)) {
        for (const g of Object.keys(grupos)) gruposSet.add(g);
      }

      // Ordenar grupos por ordem de exibição
      const ORDEM_GRUPOS: Record<string, number> = {
        "DESMONTE DE ROCHA": 1,
        "CARGA E TRANSPORTE": 2,
        "BRITAGEM": 3,
        "EXPEDIÇÃO": 4,
        "SERVIÇOS AUXILIARES": 5,
        "ADMINISTRAÇÃO": 6,
        "APOIO À PRODUÇÃO": 7,
        "PEDRA PARA BRITADOR": 8,
      };
      const grupos = Array.from(gruposSet).sort(
        (a, b) => (ORDEM_GRUPOS[a] ?? 99) - (ORDEM_GRUPOS[b] ?? 99)
      );

      const periodosLabels = periodos.map(p => `${String(p.mes).padStart(2, "0")}/${p.ano}`);

      const dados = periodos.map((p, i) => {
        const pid = String(p.id);
        const label = periodosLabels[i];
        const entry: Record<string, number | string> = { label };
        for (const g of grupos) {
          entry[g] = totalPorGrupoPeriodo[pid]?.[g] ?? 0;
        }
        return entry;
      });

      return { periodos: periodosLabels, grupos, dados };
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

      const { anoInicio, anoFim } = input;
      const strInicioComb = `${anoInicio}-01-01`;
      const strFimComb = `${anoFim}-12-31`;

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
        .where(and(
          gte(abastecimento.data, sql`${strInicioComb}`),
          lte(abastecimento.data, sql`${strFimComb}`)
        ))
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
