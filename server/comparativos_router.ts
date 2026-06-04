import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { z } from "zod";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import {
  periodoCusto, custoSetorEquipamento, custoSetorDespesa,
  resumoVendasProduto, avaliacaoGlobal, abastecimento, producao,
  lancamentoCusto, lancamentoSalario, contaCusto,
  itemDespesaImportado, equipamentoExcluidoTag,
  parteDiaria, parteDiariaItens, servicos, equipamentos,
} from "../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { calcularRateioMem } from "./rateioMem_calc";
import { calcularRateioMset } from "./rateioMset_calc";
import { CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS } from "./importDespesas_correspondencias";

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
      const faturamentoRows = await db
        .select({
          mes: sql<number>`MONTH(${resumoVendasProduto.periodoInicio})`,
          ano: sql<number>`YEAR(${resumoVendasProduto.periodoInicio})`,
          totalReceita: sql<string>`SUM(${resumoVendasProduto.valor})`,
          totalQuantidade: sql<string>`SUM(${resumoVendasProduto.quantidade})`,
        })
        .from(resumoVendasProduto)
        .where(sql`${resumoVendasProduto.periodoInicio} >= ${sql.raw(`'${anoInicio}-01-01'`)} AND ${resumoVendasProduto.periodoInicio} <= ${sql.raw(`'${anoFim}-12-31'`)}`)
        .groupBy(
          sql.raw("YEAR(`periodoInicio`)"),
          sql.raw("MONTH(`periodoInicio`)")
        );
      const faturamentoMap: Record<string, { receita: number; quantidade: number }> = {};
      for (const row of faturamentoRows) {
        faturamentoMap[`${row.ano}-${row.mes}`] = {
          receita: parseFloat(String(row.totalReceita || "0")),
          quantidade: parseFloat(String(row.totalQuantidade || "0")),
        };
      }

      // 5. Buscar combustível agrupado por mês/ano
      const combustivelRows = await db
        .select({
          mes: sql<number>`MONTH(${abastecimento.data})`,
          ano: sql<number>`YEAR(${abastecimento.data})`,
          totalLitros: sql<string>`SUM(${abastecimento.quantidade})`,
          totalCusto: sql<string>`SUM(${abastecimento.valorTotal})`,
        })
        .from(abastecimento)
        .where(sql`${abastecimento.data} >= ${sql.raw(`'${anoInicio}-01-01'`)} AND ${abastecimento.data} <= ${sql.raw(`'${anoFim}-12-31'`)}`)
        .groupBy(
          sql.raw("YEAR(`data`)"),
          sql.raw("MONTH(`data`)")
        );
      const combustivelMap: Record<string, { litros: number; custo: number }> = {};
      for (const row of combustivelRows) {
        combustivelMap[`${row.ano}-${row.mes}`] = {
          litros: parseFloat(String(row.totalLitros || "0")),
          custo: parseFloat(String(row.totalCusto || "0")),
        };
      }

      // 6. Buscar produção agrupada por mês/ano
      const producaoRows = await db
        .select({
          mes: sql<number>`MONTH(${producao.data})`,
          ano: sql<number>`YEAR(${producao.data})`,
          totalProducao: sql<string>`SUM(${producao.quantidade})`,
        })
        .from(producao)
        .where(sql`${producao.data} >= ${sql.raw(`'${anoInicio}-01-01'`)} AND ${producao.data} <= ${sql.raw(`'${anoFim}-12-31'`)}`)
        .groupBy(
          sql.raw("YEAR(`data`)"),
          sql.raw("MONTH(`data`)")
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
   * Comparativo multi-período por Plano de Custo (contas)
   * Usa lancamento_custo + lancamento_salario como fonte unificada (funciona para TODOS os períodos)
   */
  comparativoPlanoCusto: protectedProcedure
    .input(z.object({
      periodos: z.array(z.object({ mes: z.number().int(), ano: z.number().int() })).min(1).max(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { periodos } = input;

      // Buscar os periodo_custo IDs correspondentes
      const allPeriodos = await db.select().from(periodoCusto);
      const periodoMap: Record<string, number> = {};
      for (const p of allPeriodos) {
        periodoMap[`${p.ano}-${p.mes}`] = p.id;
      }

      const periodoIds: { label: string; id: number }[] = [];
      for (const p of periodos) {
        const key = `${p.ano}-${p.mes}`;
        const id = periodoMap[key];
        if (id) {
          periodoIds.push({ label: `${String(p.mes).padStart(2, "0")}/${p.ano}`, id });
        }
      }

      if (periodoIds.length === 0) return { labels: [], contas: [] };

      const ids = periodoIds.map(p => p.id);
      const idsSql = sql.join(ids.map(id => sql`${id}`), sql`, `);

      // Buscar tags excluídas do custo
      const tagsExcluidasRows = await db.select().from(equipamentoExcluidoTag);
      const tagsExcluidasSet = new Set(tagsExcluidasRows.map(t => t.tag.toUpperCase()));

      // Mapeamento de nomes de conta para labels amigáveis no comparativo
      const CONTA_LABELS: Record<string, string> = {
        "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos": "Sal.Adm./Diretoria/Pró-Labore/Encargos",
        "Sal. Diretoria/Pró-Labore": "Sal.Adm./Diretoria/Pró-Labore/Encargos",
        "Sal.Oper./Enc. Oper.": "Sal.Oper./Enc.Oper.",
        "RH - Salários da Operação": "Sal.Oper./Enc.Oper.",
        "Impostos, CEFEM e Outras Taxas": "Imp., Trib., Taxas e CEFEM",
        "Combustível": "Combustível",
        "Peças de Reposição / Itens de Consumo": "Peças de Reposição",
        "Peças de Desgaste": "Peças de Desgaste",
        "Explosivos e Acessórios": "Explosivos e Acessórios",
        "Despesas Indiretas": "Despesas Indiretas",
        "Energia Elétrica": "Energia Elétrica",
        "Despesas Administrativas": "Desp.Admin.Telef.e Inform.",
        "Consultorias Especializadas": "Juridíco/Cons.Esp./Serv.Ter.",
        "Lubrificantes": "Lubrificantes",
        "Frota/Man.Pat./Seg./Out.": "Frota/Man.Pat./Seg./Out.",
        "Outras Despesas dos Equipamentos": "Outras Despesas",
        "Outras Despesas de Setores": "Outras Desp.Setor/Proc.",
        "Comissão de Vendas": "Comissão de Vendas",
        "Equipamentos de Apoio": "Equip.Apoio (Comb./Lub/Peças/Serv.)",
        "Depreciação": "Depreciação",
      };

      // Fonte: lancamento_custo agrupado por conta e período
      const lancRows = await db.select({
        periodoCustoId: lancamentoCusto.periodoCustoId,
        contaNome: contaCusto.nome,
        total: sql<string>`SUM(${lancamentoCusto.valor})`,
      })
        .from(lancamentoCusto)
        .innerJoin(contaCusto, eq(lancamentoCusto.contaCustoId, contaCusto.id))
        .where(sql`${lancamentoCusto.periodoCustoId} IN (${idsSql})`)
        .groupBy(lancamentoCusto.periodoCustoId, contaCusto.nome);

      // Salários agrupados por conta e período
      const salRows = await db.select({
        periodoCustoId: lancamentoSalario.periodoCustoId,
        contaNome: contaCusto.nome,
        total: sql<string>`CAST(SUM(${lancamentoSalario.valor}) AS DECIMAL(14,2))`,
      })
        .from(lancamentoSalario)
        .innerJoin(contaCusto, eq(lancamentoSalario.contaCustoId, contaCusto.id))
        .where(sql`${lancamentoSalario.periodoCustoId} IN (${idsSql})`)
        .groupBy(lancamentoSalario.periodoCustoId, contaCusto.nome);

      // Calcular total dos equipamentos excluídos por período
      // (para subtrair do total de lancamento_custo)
      const excluidos: Record<string, number> = {};
      if (tagsExcluidasSet.size > 0) {
        const tagsArr = Array.from(tagsExcluidasSet);
        const tagsSql = sql.join(tagsArr.map(t => sql`${t}`), sql`, `);
        const exclRows = await db.select({
          periodoCustoId: itemDespesaImportado.periodoCustoId,
          total: sql<string>`SUM(${itemDespesaImportado.custo})`,
        })
          .from(itemDespesaImportado)
          .where(sql`${itemDespesaImportado.periodoCustoId} IN (${idsSql}) AND UPPER(${itemDespesaImportado.equipamentoTag}) IN (${tagsSql})`)
          .groupBy(itemDespesaImportado.periodoCustoId);

        for (const row of exclRows) {
          excluidos[String(row.periodoCustoId)] = parseFloat(String(row.total || "0"));
        }
      }

      // Montar mapa de contas por período
      const contasMap: Record<string, Record<string, number>> = {};

      for (const row of lancRows) {
        const pid = String(row.periodoCustoId);
        const val = parseFloat(String(row.total || "0"));
        if (val <= 0) continue;
        const label = CONTA_LABELS[row.contaNome] ?? row.contaNome;
        if (!contasMap[label]) contasMap[label] = {};
        contasMap[label][pid] = (contasMap[label][pid] ?? 0) + val;
      }

      for (const row of salRows) {
        const pid = String(row.periodoCustoId);
        const val = parseFloat(String(row.total || "0"));
        if (val <= 0) continue;
        const label = CONTA_LABELS[row.contaNome] ?? row.contaNome;
        if (!contasMap[label]) contasMap[label] = {};
        contasMap[label][pid] = (contasMap[label][pid] ?? 0) + val;
      }

      // Converter para array e ordenar por total decrescente
      const contas = Object.entries(contasMap).map(([descricao, valoresPorPeriodo]) => {
        const valores = periodoIds.map(p => valoresPorPeriodo[String(p.id)] ?? 0);
        const total = valores.reduce((s, v) => s + v, 0);
        return { descricao, valores, total };
      }).sort((a, b) => b.total - a.total);

      // Calcular total geral por período e subtrair equipamentos excluídos
      // O total correto = soma das contas - equipamentos excluídos
      // Distribuir a redução proporcionalmente nas contas MEM (Combustível, Lubrificantes, Peças, Outras Despesas)
      const contasMem = ["Combustível", "Lubrificantes", "Peças de Desgaste", "Peças de Reposição", "Outras Despesas"];
      for (const p of periodoIds) {
        const pid = String(p.id);
        const totalExcluido = excluidos[pid] ?? 0;
        if (totalExcluido <= 0) continue;

        // Calcular total das contas MEM neste período
        let totalMem = 0;
        for (const c of contas) {
          if (contasMem.includes(c.descricao)) {
            const idx = periodoIds.findIndex(pp => pp.id === p.id);
            totalMem += c.valores[idx] ?? 0;
          }
        }
        if (totalMem <= 0) continue;

        // Subtrair proporcionalmente
        for (const c of contas) {
          if (contasMem.includes(c.descricao)) {
            const idx = periodoIds.findIndex(pp => pp.id === p.id);
            const proporcao = (c.valores[idx] ?? 0) / totalMem;
            c.valores[idx] = (c.valores[idx] ?? 0) - totalExcluido * proporcao;
          }
        }
      }

      // Recalcular totais após ajuste
      for (const c of contas) {
        c.total = c.valores.reduce((s, v) => s + v, 0);
      }
      contas.sort((a, b) => b.total - a.total);

      return {
        labels: periodoIds.map(p => p.label),
        contas,
      };
    }),

  /**
   * Comparativo multi-período por Setores (grupos)
   * Para períodos com dados RAS importados: usa custo_setor_equipamento + custo_setor_despesa
   * Para períodos sem dados RAS (abril/26+): usa calcularRateioMem + calcularRateioMset (fallback)
   */
  comparativoSetores: protectedProcedure
    .input(z.object({
      periodos: z.array(z.object({ mes: z.number().int(), ano: z.number().int() })).min(1).max(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { periodos } = input;

      // Buscar os periodo_custo IDs correspondentes
      const allPeriodos = await db.select().from(periodoCusto);
      const periodoMap: Record<string, number> = {};
      for (const p of allPeriodos) {
        periodoMap[`${p.ano}-${p.mes}`] = p.id;
      }

      const periodoIds: { label: string; id: number }[] = [];
      for (const p of periodos) {
        const key = `${p.ano}-${p.mes}`;
        const id = periodoMap[key];
        if (id) {
          periodoIds.push({ label: `${String(p.mes).padStart(2, "0")}/${p.ano}`, id });
        }
      }

      if (periodoIds.length === 0) return { labels: [], setores: [] };

      // Montar mapa de setores por período
      const setoresMap: Record<string, Record<string, number>> = {};

      // Processar cada período individualmente para detectar se tem dados RAS ou não
      for (const p of periodoIds) {
        const pid = String(p.id);

        // Verificar se tem dados RAS importados
        const equipCount = await db.select({ cnt: sql<string>`COUNT(*)` })
          .from(custoSetorEquipamento)
          .where(eq(custoSetorEquipamento.periodoCustoId, p.id));
        const hasRas = parseInt(equipCount[0]?.cnt || "0") > 0;

        if (hasRas) {
          // Usar dados RAS importados
          const equipGrupo = await db.select({
            grupoNome: custoSetorEquipamento.grupoNome,
            total: sql<string>`SUM(${custoSetorEquipamento.totalDespesasEquipamento})`,
          })
            .from(custoSetorEquipamento)
            .where(eq(custoSetorEquipamento.periodoCustoId, p.id))
            .groupBy(custoSetorEquipamento.grupoNome);

          const despGrupo = await db.select({
            grupoNome: custoSetorDespesa.grupoNome,
            total: sql<string>`SUM(${custoSetorDespesa.valor})`,
          })
            .from(custoSetorDespesa)
            .where(eq(custoSetorDespesa.periodoCustoId, p.id))
            .groupBy(custoSetorDespesa.grupoNome);

          for (const row of equipGrupo) {
            const val = parseFloat(String(row.total || "0"));
            if (!setoresMap[row.grupoNome]) setoresMap[row.grupoNome] = {};
            setoresMap[row.grupoNome][pid] = (setoresMap[row.grupoNome][pid] ?? 0) + val;
          }

          for (const row of despGrupo) {
            const val = parseFloat(String(row.total || "0"));
            if (!setoresMap[row.grupoNome]) setoresMap[row.grupoNome] = {};
            setoresMap[row.grupoNome][pid] = (setoresMap[row.grupoNome][pid] ?? 0) + val;
          }

          // Adicionar despesas indiretas do lancamento_custo (conta "Despesas Indiretas")
          // que não estão incluídas nas tabelas RAS
          const despIndRows = await db.select({
            total: sql<string>`SUM(${lancamentoCusto.valor})`,
          })
            .from(lancamentoCusto)
            .innerJoin(contaCusto, eq(lancamentoCusto.contaCustoId, contaCusto.id))
            .where(sql`${lancamentoCusto.periodoCustoId} = ${p.id} AND ${contaCusto.nome} = 'Despesas Indiretas'`);
          const despInd = parseFloat(despIndRows[0]?.total ?? "0");
          if (despInd > 0) {
            // Despesas indiretas são alocadas no setor ADMINISTRAÇÃO
            const grupoNome = "ADMINISTRA\u00c7\u00c3O";
            if (!setoresMap[grupoNome]) setoresMap[grupoNome] = {};
            setoresMap[grupoNome][pid] = (setoresMap[grupoNome][pid] ?? 0) + despInd;
          }
        } else {
          // Fallback: usar calcularRateioMem + calcularRateioMset (mesma lógica do relatório sintético)
          const rateioMem = await calcularRateioMem(p.id);
          const rateioMset = await calcularRateioMset(p.id);

          // Agrupar MEM por grupo
          for (const sub of rateioMem.subsetores) {
            const grupoNome = sub.grupoNome;
            const val = sub.totalSubsetor;
            if (val <= 0) continue;
            if (!setoresMap[grupoNome]) setoresMap[grupoNome] = {};
            setoresMap[grupoNome][pid] = (setoresMap[grupoNome][pid] ?? 0) + val;
          }

          // Agrupar MSET por grupo
          for (const desp of rateioMset.despesas) {
            const grupoNome = desp.grupoNome;
            const val = desp.valor;
            if (val <= 0) continue;
            if (!setoresMap[grupoNome]) setoresMap[grupoNome] = {};
            setoresMap[grupoNome][pid] = (setoresMap[grupoNome][pid] ?? 0) + val;
          }

          // Equipamentos sem rateio (não alocados) → SERVIÇOS AUXILIARES
          if (rateioMem.equipamentosSemRateio && rateioMem.equipamentosSemRateio.length > 0) {
            const totalNaoAlocado = rateioMem.equipamentosSemRateio.reduce(
              (s, e) => s + (e.despesaTotal ?? 0), 0
            );
            if (totalNaoAlocado > 0) {
              const grupoNome = "SERVI\u00c7OS AUXILIARES";
              if (!setoresMap[grupoNome]) setoresMap[grupoNome] = {};
              setoresMap[grupoNome][pid] = (setoresMap[grupoNome][pid] ?? 0) + totalNaoAlocado;
            }
          }
        }
      }

      // Converter para array e ordenar por total decrescente
      const setores = Object.entries(setoresMap).map(([grupoNome, valoresPorPeriodo]) => {
        const valores = periodoIds.map(p => valoresPorPeriodo[String(p.id)] ?? 0);
        const total = valores.reduce((s, v) => s + v, 0);
        return { grupoNome, valores, total };
      }).sort((a, b) => b.total - a.total);

      return {
        labels: periodoIds.map(p => p.label),
        setores,
      };
    }),

  /**
   * Comparativo multi-período de indicadores: Custo/t (Produção), Custo/t (Vendas), C.M. s/ DI, C.M. c/ DI
   */
  comparativoIndicadores: protectedProcedure
    .input(z.object({
      periodos: z.array(z.object({ mes: z.number().int(), ano: z.number().int() })).min(1).max(12),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { periodos } = input;

      // Buscar os periodo_custo IDs correspondentes
      const allPeriodos = await db.select().from(periodoCusto);
      const periodoMap: Record<string, typeof allPeriodos[0]> = {};
      for (const p of allPeriodos) {
        periodoMap[`${p.ano}-${p.mes}`] = p;
      }

      const periodoIds: { label: string; id: number; periodo: typeof allPeriodos[0] }[] = [];
      for (const p of periodos) {
        const key = `${p.ano}-${p.mes}`;
        const per = periodoMap[key];
        if (per) {
          periodoIds.push({ label: `${String(p.mes).padStart(2, "0")}/${p.ano}`, id: per.id, periodo: per });
        }
      }

      if (periodoIds.length === 0) return { labels: [], indicadores: [] };

      const ids = periodoIds.map(p => p.id);
      const idsSql = sql.join(ids.map(id => sql`${id}`), sql`, `);

      // Construir set de tags excluídas (mesma lógica de listByPeriodo no lancamentoCusto_router)
      const tagsExcluidasRows = await db.select().from(equipamentoExcluidoTag);
      const tagsExcluidasSet = new Set(tagsExcluidasRows.map(t => t.tag.toUpperCase()));

      // Buscar equipamentos com excluidoCusto = 'sim' e mapear para tags
      const equipExcluidos = await db.select({ id: equipamentos.id })
        .from(equipamentos)
        .where(sql`${equipamentos.excluidoCusto} = 'sim'`);
      const idsExcluidos = new Set(equipExcluidos.map(e => e.id));

      // Mapear IDs excluídos para tags via correspondências
      const allExcludedTags = new Set(tagsExcluidasSet);
      for (const [tag, equipId] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
        if (idsExcluidos.has(equipId)) {
          allExcludedTags.add(tag.toUpperCase());
        }
      }
      for (const [tag, { equipamentoId }] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
        if (idsExcluidos.has(equipamentoId)) {
          allExcludedTags.add(tag.toUpperCase());
        }
      }

      // Buscar lancamentos INDIVIDUAIS (não agrupados) para filtrar excluídos por tag
      const lancRowsRaw = await db.select({
        periodoCustoId: lancamentoCusto.periodoCustoId,
        divisor: contaCusto.divisor,
        classificacao: contaCusto.classificacao,
        valor: lancamentoCusto.valor,
        observacoes: lancamentoCusto.observacoes,
      })
        .from(lancamentoCusto)
        .innerJoin(contaCusto, eq(lancamentoCusto.contaCustoId, contaCusto.id))
        .where(sql`${lancamentoCusto.periodoCustoId} IN (${idsSql})`);

      // Filtrar excluídos (mesma lógica de extractTagFromObservacoes + allExcludedTags)
      function extractTag(obs: string): string | null {
        if (!obs.startsWith("[Import]")) return null;
        const rest = obs.substring(9).trim();
        const dashIdx = rest.indexOf(" - ");
        if (dashIdx === -1) return rest.trim().toUpperCase();
        return rest.substring(0, dashIdx).trim().toUpperCase();
      }

      const lancRows = lancRowsRaw.filter(l => {
        const obs = l.observacoes ?? "";
        if (!obs.startsWith("[Import]")) return true;
        const tag = extractTag(obs);
        if (!tag) return true;
        return !allExcludedTags.has(tag);
      });

      // Buscar salários agrupados por conta e período
      const salRows = await db.select({
        periodoCustoId: lancamentoSalario.periodoCustoId,
        divisor: contaCusto.divisor,
        classificacao: contaCusto.classificacao,
        total: sql<string>`CAST(SUM(${lancamentoSalario.valor}) AS DECIMAL(14,2))`,
      })
        .from(lancamentoSalario)
        .innerJoin(contaCusto, eq(lancamentoSalario.contaCustoId, contaCusto.id))
        .where(sql`${lancamentoSalario.periodoCustoId} IN (${idsSql})`)
        .groupBy(lancamentoSalario.periodoCustoId, contaCusto.divisor, contaCusto.classificacao);

      // Buscar produção e vendas por período
      // Produção: campo producaoTotal do periodo_custo (já preenchido pelo sistema)
      // Vendas: campo quantidadeVendida do periodo_custo
      // Fallback: tabela resumo_vendas_produto
      const vendasRows = await db.select({
        mes: sql<number>`MONTH(${resumoVendasProduto.periodoInicio})`,
        ano: sql<number>`YEAR(${resumoVendasProduto.periodoInicio})`,
        totalQuantidade: sql<string>`SUM(${resumoVendasProduto.quantidade})`,
      })
        .from(resumoVendasProduto)
        .where(sql`${resumoVendasProduto.periodoInicio} >= ${sql.raw(`'${Math.min(...periodos.map(p => p.ano))}-01-01'`)} AND ${resumoVendasProduto.periodoInicio} <= ${sql.raw(`'${Math.max(...periodos.map(p => p.ano))}-12-31'`)}`) 
        .groupBy(
          sql.raw("YEAR(`periodoInicio`)"),
          sql.raw("MONTH(`periodoInicio`)")
        );
      const vendasMap: Record<string, number> = {};
      for (const row of vendasRows) {
        vendasMap[`${row.ano}-${row.mes}`] = parseFloat(String(row.totalQuantidade || "0"));
      }

      // Buscar produção da tabela producao (legado)
      const producaoRows = await db.select({
        mes: sql<number>`MONTH(${producao.data})`,
        ano: sql<number>`YEAR(${producao.data})`,
        totalProducao: sql<string>`SUM(${producao.quantidade})`,
      })
        .from(producao)
        .where(sql`${producao.data} >= ${sql.raw(`'${Math.min(...periodos.map(p => p.ano))}-01-01'`)} AND ${producao.data} <= ${sql.raw(`'${Math.max(...periodos.map(p => p.ano))}-12-31'`)}`) 
        .groupBy(
          sql.raw("YEAR(`data`)"),
          sql.raw("MONTH(`data`)")
        );
      const producaoMap: Record<string, number> = {};
      for (const row of producaoRows) {
        producaoMap[`${row.ano}-${row.mes}`] = parseFloat(String(row.totalProducao || "0"));
      }

      // Produção Método Caminhões (a partir de abril/2026)
      // Buscar serviços de transporte para britador
      const CORTE_ANO = 2026;
      const CORTE_MES = 4;
      const servicosData = await db.select().from(servicos);
      const servicosBritagemFixa = servicosData.filter(s =>
        s.nome.toUpperCase().includes('TRANSPORTE DE PEDRA PARA O BRITADOR') ||
        s.nome.toUpperCase().includes('ALIMENTANDO O BRITADOR PRIMARIO') ||
        s.nome.toUpperCase().includes('TRANSP. PEDRA DO ESTOQUE PARA O BRITADOR')
      ).map(s => s.id);
      const servicosBritagemMovel = servicosData.filter(s =>
        s.nome.toUpperCase().includes('TRANSPORTE DE PEDRA PARA BRITAGEM MOVEL')
      ).map(s => s.id);
      const servicosCaminhoes = [...servicosBritagemFixa, ...servicosBritagemMovel];

      // Para períodos >= abril/2026, calcular produção via Método Caminhões
      const producaoMetodoCaminhoes: Record<string, number> = {};
      const periodosMetodoCaminhoes = periodos.filter(
        p => p.ano > CORTE_ANO || (p.ano === CORTE_ANO && p.mes >= CORTE_MES)
      );
      if (periodosMetodoCaminhoes.length > 0 && servicosCaminhoes.length > 0) {
        // Buscar todos os itens de parte diária com serviços de caminhões no período
        const minAno = Math.min(...periodosMetodoCaminhoes.map(p => p.ano));
        const maxAno = Math.max(...periodosMetodoCaminhoes.map(p => p.ano));
        const allItens = await db
          .select({
            servicoId: parteDiariaItens.servicoId,
            producaoVal: parteDiariaItens.producao,
            data: parteDiaria.data,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id))
          .where(sql`${parteDiaria.data} >= ${sql.raw(`'${minAno}-01-01'`)} AND ${parteDiaria.data} <= ${sql.raw(`'${maxAno}-12-31'`)}`);

        // Filtrar por serviços de caminhões e agrupar por mês/ano
        for (const item of allItens) {
          if (!servicosCaminhoes.includes(item.servicoId)) continue;
          const itemDate = item.data instanceof Date ? item.data : new Date(String(item.data));
          const mes = itemDate.getMonth() + 1;
          const ano = itemDate.getFullYear();
          // Verificar se este período usa método caminhões
          if (ano < CORTE_ANO || (ano === CORTE_ANO && mes < CORTE_MES)) continue;
          const key = `${ano}-${mes}`;
          producaoMetodoCaminhoes[key] = (producaoMetodoCaminhoes[key] ?? 0) + parseFloat(String(item.producaoVal || "0"));
        }
      }

      // Calcular indicadores por período
      const resultados = periodoIds.map(p => {
        const pid = String(p.id);
        const pidNum = p.id;
        const per = p.periodo;
        const key = `${per.ano}-${per.mes}`;

        // Produção: producaoTotal do periodo_custo, fallback Método Caminhões (>=abr/26), fallback tabela producao
        const usarMetodoCaminhoes = per.ano > CORTE_ANO || (per.ano === CORTE_ANO && per.mes >= CORTE_MES);
        let producaoTotal = parseFloat(String(per.producaoTotal || "0"));
        if (!producaoTotal && usarMetodoCaminhoes) {
          producaoTotal = producaoMetodoCaminhoes[key] || 0;
        }
        if (!producaoTotal) {
          producaoTotal = producaoMap[key] || 0;
        }
        // Vendas: quantidadeVendida do periodo_custo, fallback resumo_vendas_produto
        const vendas = parseFloat(String(per.quantidadeVendida || "0")) || vendasMap[key] || 0;

        // Agrupar lançamentos filtrados por tipo
        let totalCustoVariavel = 0;
        let totalDespesaVariavel = 0;
        let totalDespesasIndiretas = 0;

        // Processar lancamentos individuais (já filtrados por exclusão)
        for (const row of lancRows) {
          if (row.periodoCustoId !== pidNum) continue;
          const val = parseFloat(String(row.valor || "0"));
          if (val === 0) continue;
          const divisor = row.divisor ?? "producao";
          const classificacao = row.classificacao ?? "custo_variavel";
          if (classificacao === "despesa_variavel" && divisor === "producao") {
            totalDespesasIndiretas += val;
          } else if (divisor === "vendas") {
            totalDespesaVariavel += val;
          } else {
            totalCustoVariavel += val;
          }
        }

        // Processar salários agrupados
        for (const row of salRows) {
          if (String(row.periodoCustoId) !== pid) continue;
          const val = parseFloat(String(row.total || "0"));
          if (val === 0) continue;
          const divisor = row.divisor ?? "producao";
          const classificacao = row.classificacao ?? "custo_variavel";
          if (classificacao === "despesa_variavel" && divisor === "producao") {
            totalDespesasIndiretas += val;
          } else if (divisor === "vendas") {
            totalDespesaVariavel += val;
          } else {
            totalCustoVariavel += val;
          }
        }

        // Cálculos
        const custoPorTonProducao = producaoTotal > 0 ? totalCustoVariavel / producaoTotal : 0;
        const custoPorTonVendas = vendas > 0 ? totalDespesaVariavel / vendas : 0;
        const custoPorTonDI = producaoTotal > 0 ? totalDespesasIndiretas / producaoTotal : 0;
        const custoMedio = custoPorTonProducao + custoPorTonVendas;
        const custoMedioComDI = custoMedio + custoPorTonDI;

        return {
          custoPorTonProducao,
          custoPorTonVendas,
          custoMedio,
          custoMedioComDI,
          producaoTotal,
          vendas,
        };
      });

      // Montar indicadores como array de linhas
      const indicadores = [
        {
          descricao: "Custo/t (Produ\u00e7\u00e3o)",
          valores: resultados.map(r => r.custoPorTonProducao),
        },
        {
          descricao: "Custo/t (Vendas)",
          valores: resultados.map(r => r.custoPorTonVendas),
        },
        {
          descricao: "C.M. s/ Despesas Indiretas",
          valores: resultados.map(r => r.custoMedio),
        },
        {
          descricao: "C.M. c/ Desp. Indiretas",
          valores: resultados.map(r => r.custoMedioComDI),
        },
      ];

      return {
        labels: periodoIds.map(p => p.label),
        indicadores,
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

      const { anoInicio, anoFim } = input;

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
        .where(sql`${abastecimento.data} >= ${sql.raw(`'${anoInicio}-01-01'`)} AND ${abastecimento.data} <= ${sql.raw(`'${anoFim}-12-31'`)}`)
        .groupBy(
          sql.raw("YEAR(`data`)"),
          sql.raw("MONTH(`data`)")
        )
        .orderBy(
          sql.raw("YEAR(`data`)"),
          sql.raw("MONTH(`data`)")
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
