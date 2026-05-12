import { z } from "zod";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  itemDespesaImportado,
  equipamentos,
  periodoCusto,
  equipamentoExcluidoTag,
} from "../drizzle/schema";
import { TAGS_OUTRAS_DESP_SETOR, TAGS_CONTA_EXPLOSIVOS } from "./importDespesas_correspondencias";

const CLASSIFICACAO_LABELS: Record<string, string> = {
  combustivel: "Combustível",
  lubrificantes: "Lubrificantes",
  pecas_desgaste: "Peças de Desgaste",
  pecas_reposicao: "Peças de Reposição / Itens de Consumo",
  outras_despesas: "Outras Despesas dos Equipamentos",
};

/**
 * Calcula consumo lt/hr entre abastecimentos consecutivos de um equipamento.
 * Ordena por horímetro crescente e calcula:
 *   consumo = litros / (horímetro_atual - horímetro_anterior)
 * Retorna array com consumo calculado por item + resumo.
 */
function calcularConsumoCombustivel(itens: {
  id: number;
  data: string | null;
  produto: string;
  quantidade: number;
  custo: number;
  hodometro: number | null;
  intervalo: number | null;
  litrosPorHora: string | null;
  horaPorLitro: string | null;
}[]) {
  // Ordenar por horímetro crescente (itens sem horímetro vão ao final)
  const ordenados = [...itens].sort((a, b) => {
    if (a.hodometro === null && b.hodometro === null) return 0;
    if (a.hodometro === null) return 1;
    if (b.hodometro === null) return -1;
    return a.hodometro - b.hodometro;
  });

  let totalLitros = 0;
  let totalCusto = 0;
  let totalHorasCalculadas = 0;
  let abastecimentosComConsumo = 0;
  let consumoMin = Infinity;
  let consumoMax = 0;
  let horimetroMin: number | null = null;
  let horimetroMax: number | null = null;

  const itensComConsumo = ordenados.map((item, index) => {
    totalLitros += item.quantidade;
    totalCusto += item.custo;

    let consumoCalculado: number | null = null;
    let horasCalculadas: number | null = null;

    if (item.hodometro !== null) {
      if (horimetroMin === null || item.hodometro < horimetroMin) horimetroMin = item.hodometro;
      if (horimetroMax === null || item.hodometro > horimetroMax) horimetroMax = item.hodometro;
    }

    // Usar o campo intervalo da planilha se disponível
    if (item.intervalo && item.intervalo > 0 && item.quantidade > 0) {
      horasCalculadas = item.intervalo;
      consumoCalculado = item.quantidade / item.intervalo;
    }
    // Senão, calcular a partir dos horímetros consecutivos
    else if (index > 0 && item.hodometro !== null) {
      const anterior = ordenados[index - 1];
      if (anterior.hodometro !== null && item.hodometro > anterior.hodometro) {
        horasCalculadas = item.hodometro - anterior.hodometro;
        if (horasCalculadas > 0 && item.quantidade > 0) {
          consumoCalculado = item.quantidade / horasCalculadas;
        }
      }
    }

    if (consumoCalculado !== null && consumoCalculado > 0 && consumoCalculado < 200) {
      // Filtrar valores absurdos (> 200 lt/hr indica erro de leitura)
      abastecimentosComConsumo++;
      totalHorasCalculadas += horasCalculadas!;
      if (consumoCalculado < consumoMin) consumoMin = consumoCalculado;
      if (consumoCalculado > consumoMax) consumoMax = consumoCalculado;
    } else {
      consumoCalculado = null; // Marcar como indisponível se absurdo
    }

    // Também usar o litrosPorHora da planilha como referência
    const ltHrPlanilha = item.litrosPorHora ? parseFloat(item.litrosPorHora.replace(",", ".")) : null;

    return {
      ...item,
      consumoCalculado: consumoCalculado ? Math.round(consumoCalculado * 100) / 100 : null,
      horasCalculadas,
      ltHrPlanilha: ltHrPlanilha && ltHrPlanilha > 0 ? Math.round(ltHrPlanilha * 100) / 100 : null,
    };
  });

  // Média geral do período: total litros / total horas trabalhadas
  const mediaGeral = totalHorasCalculadas > 0
    ? Math.round((totalLitros / (horimetroMax! - horimetroMin! || 1)) * 100) / 100
    : null;

  // Média ponderada: soma(litros) / soma(horas) dos abastecimentos com consumo válido
  const mediaPonderada = totalHorasCalculadas > 0
    ? Math.round((itensComConsumo
        .filter(i => i.consumoCalculado !== null)
        .reduce((sum, i) => sum + i.quantidade, 0) / totalHorasCalculadas) * 100) / 100
    : null;

  return {
    itens: itensComConsumo,
    resumo: {
      totalAbastecimentos: itens.length,
      abastecimentosComConsumo,
      totalLitros: Math.round(totalLitros * 100) / 100,
      totalCusto: Math.round(totalCusto * 100) / 100,
      horimetroInicial: horimetroMin,
      horimetroFinal: horimetroMax,
      totalHorasTrabalhadas: horimetroMin !== null && horimetroMax !== null
        ? Math.round((horimetroMax - horimetroMin) * 100) / 100
        : null,
      mediaGeral,
      mediaPonderada,
      consumoMinimo: consumoMin !== Infinity ? Math.round(consumoMin * 100) / 100 : null,
      consumoMaximo: consumoMax > 0 ? Math.round(consumoMax * 100) / 100 : null,
      custoMedioPorLitro: totalLitros > 0 ? Math.round((totalCusto / totalLitros) * 100) / 100 : null,
      custoMedioPorHora: totalHorasCalculadas > 0
        ? Math.round((totalCusto / (horimetroMax! - horimetroMin! || 1)) * 100) / 100
        : null,
    },
  };
}

export { calcularConsumoCombustivel };

// Helper: buscar IDs de equipamentos excluídos do custo (cadastrados)
async function getIdsEquipExcluidos(): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db
    .select({ id: equipamentos.id })
    .from(equipamentos)
    .where(sql`${equipamentos.excluidoCusto} = 'sim'`);
  return new Set(rows.map(r => r.id));
}

// Helper: buscar tags excluídas (equipamentos sem vínculo no cadastro)
async function getTagsExcluidas(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db.select({ tag: equipamentoExcluidoTag.tag }).from(equipamentoExcluidoTag);
  return new Set(rows.map(r => r.tag.toUpperCase()));
}

export const itensDespesaRouter = router({
  // Listar equipamentos com itens importados para um período
  listarEquipamentosPorPeriodo: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const idsExcluidos = await getIdsEquipExcluidos();
      const tagsExcluidas = await getTagsExcluidas();
      const tagsSetores = new Set(Object.keys(TAGS_OUTRAS_DESP_SETOR).map(t => t.toUpperCase()));

      const result = await db2
        .select({
          equipamentoTag: itemDespesaImportado.equipamentoTag,
          equipamentoDescricao: itemDespesaImportado.equipamentoDescricao,
          equipamentoSistemaId: itemDespesaImportado.equipamentoSistemaId,
          totalItens: sql<number>`COUNT(*)`.as("totalItens"),
          totalCusto: sql<string>`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`.as("totalCusto"),
        })
        .from(itemDespesaImportado)
        .where(eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId))
        .groupBy(
          itemDespesaImportado.equipamentoTag,
          itemDespesaImportado.equipamentoDescricao,
          itemDespesaImportado.equipamentoSistemaId,
        )
        .orderBy(desc(sql`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`));

      // Filtrar: remover tags que pertencem ao bloco de setores (exibidas separadamente)
      return result
        .filter(r => !tagsSetores.has(r.equipamentoTag.toUpperCase()))
        .map(r => ({
          equipamentoTag: r.equipamentoTag,
          equipamentoDescricao: r.equipamentoDescricao,
          equipamentoSistemaId: r.equipamentoSistemaId,
          totalItens: Number(r.totalItens),
          totalCusto: Number(r.totalCusto) || 0,
          excluidoCusto: (r.equipamentoSistemaId ? idsExcluidos.has(r.equipamentoSistemaId) : false) || tagsExcluidas.has(r.equipamentoTag.toUpperCase()),
        }));
    }),

  // Listar equipamentos filtrados por uma classificação específica (para drill-down por conta)
  equipamentosPorClassificacao: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      classificacao: z.string(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const idsExcluidos = await getIdsEquipExcluidos();
      const tagsExcluidas = await getTagsExcluidas();

      const result = await db2
        .select({
          equipamentoTag: itemDespesaImportado.equipamentoTag,
          equipamentoDescricao: itemDespesaImportado.equipamentoDescricao,
          equipamentoSistemaId: itemDespesaImportado.equipamentoSistemaId,
          totalItens: sql<number>`COUNT(*)`.as("totalItens"),
          totalCusto: sql<string>`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`.as("totalCusto"),
        })
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.classificacao, input.classificacao),
        ))
        .groupBy(
          itemDespesaImportado.equipamentoTag,
          itemDespesaImportado.equipamentoDescricao,
          itemDespesaImportado.equipamentoSistemaId,
        )
        .orderBy(desc(sql`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`));
      // Tags de explosivos que devem ser excluídas deste drill-down
      // (seus itens têm classificacao "pecas_reposicao" no itemDespesaImportado,
      //  mas o lançamento de custo vai para a conta "Explosivos e Acessórios")
      const tagsExplosivos = new Set(TAGS_CONTA_EXPLOSIVOS.map(t => t.toUpperCase()));
      // Tags de outras despesas de setor (mesma lógica)
      const tagsOutrasDesp = new Set(Object.keys(TAGS_OUTRAS_DESP_SETOR).map(t => t.toUpperCase()));

      return result
        .filter(r => {
          const tagUpper = r.equipamentoTag.toUpperCase();
          // Excluir equipamentos excluídos
          if ((r.equipamentoSistemaId && idsExcluidos.has(r.equipamentoSistemaId)) || tagsExcluidas.has(tagUpper)) return false;
          // Excluir tags de explosivos (lançadas em conta específica)
          if (tagsExplosivos.has(tagUpper)) return false;
          // Excluir tags de outras despesas de setor
          if (tagsOutrasDesp.has(tagUpper)) return false;
          return true;
        })
        .map(r => ({
          equipamentoTag: r.equipamentoTag,
          equipamentoDescricao: r.equipamentoDescricao,
          equipamentoSistemaId: r.equipamentoSistemaId,
          totalItens: Number(r.totalItens),
          totalCusto: Number(r.totalCusto) || 0,
        }));
    }),

  // Listar classificações de um equipamento num período
  listarClassificacoesPorEquipamento: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      equipamentoTag: z.string(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db2
        .select({
          classificacao: itemDespesaImportado.classificacao,
          totalItens: sql<number>`COUNT(*)`.as("totalItens"),
          totalCusto: sql<string>`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`.as("totalCusto"),
        })
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.equipamentoTag, input.equipamentoTag),
        ))
        .groupBy(itemDespesaImportado.classificacao)
        .orderBy(desc(sql`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`));

      return result.map(r => ({
        classificacao: r.classificacao,
        classificacaoLabel: CLASSIFICACAO_LABELS[r.classificacao] || r.classificacao,
        totalItens: Number(r.totalItens),
        totalCusto: Number(r.totalCusto) || 0,
      }));
    }),

  // Listar itens detalhados de uma classificação de um equipamento num período
  listarItensDetalhados: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      equipamentoTag: z.string(),
      classificacao: z.string(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.equipamentoTag, input.equipamentoTag),
          eq(itemDespesaImportado.classificacao, input.classificacao),
        ))
        .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));

      return result.map(r => ({
        id: r.id,
        sequencia: r.sequencia,
        data: r.data,
        produto: r.produto,
        grupoProduto: r.grupoProduto,
        quantidade: Number(r.quantidade) || 0,
        custo: Number(r.custo) || 0,
        centroCusto: r.centroCusto,
        hodometro: r.hodometro ? Number(r.hodometro) : null,
        intervalo: r.intervalo ? Number(r.intervalo) : null,
        horaPorLitro: r.horaPorLitro,
        litrosPorHora: r.litrosPorHora,
        observacoes: r.observacoes,
      }));
    }),

  // Verificar se um período tem itens detalhados importados
  temItensDetalhados: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db2
        .select({
          total: sql<number>`COUNT(*)`.as("total"),
        })
        .from(itemDespesaImportado)
        .where(eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId));

      return { temItens: Number(result[0]?.total || 0) > 0, totalItens: Number(result[0]?.total || 0) };
    }),

  // Resumo geral por classificação para um período (todos os equipamentos, excluindo os marcados)
  resumoPorClassificacao: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const idsExcluidos = await getIdsEquipExcluidos();
      const tagsExcluidas = await getTagsExcluidas();

      const result = await db2
        .select({
          classificacao: itemDespesaImportado.classificacao,
          equipamentoSistemaId: itemDespesaImportado.equipamentoSistemaId,
          equipamentoTag: itemDespesaImportado.equipamentoTag,
          custo: itemDespesaImportado.custo,
        })
        .from(itemDespesaImportado)
        .where(eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId));

      // Filtrar excluídos (cadastrados + por tag) e agrupar em memória
      const filtrado = result.filter(r => !((r.equipamentoSistemaId && idsExcluidos.has(r.equipamentoSistemaId)) || tagsExcluidas.has(r.equipamentoTag.toUpperCase())));
      const grupos: Record<string, { classificacao: string; totalItens: number; totalCusto: number; tags: Set<string> }> = {};
      for (const r of filtrado) {
        if (!grupos[r.classificacao]) {
          grupos[r.classificacao] = { classificacao: r.classificacao, totalItens: 0, totalCusto: 0, tags: new Set() };
        }
        grupos[r.classificacao].totalItens++;
        grupos[r.classificacao].totalCusto += Number(r.custo) || 0;
        grupos[r.classificacao].tags.add(r.equipamentoTag);
      }

      return Object.values(grupos)
        .map(g => ({
          classificacao: g.classificacao,
          classificacaoLabel: CLASSIFICACAO_LABELS[g.classificacao] || g.classificacao,
          totalItens: g.totalItens,
          totalCusto: Math.round(g.totalCusto * 100) / 100,
          totalEquipamentos: g.tags.size,
        }))
        .sort((a, b) => b.totalCusto - a.totalCusto);
    }),

  // =============================================
  // CONSUMO DE COMBUSTÍVEL (lt/hr)
  // =============================================

  // Análise de consumo de combustível por equipamento num período
  // Retorna itens ordenados por horímetro com consumo calculado + resumo
  consumoPorEquipamento: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      equipamentoTag: z.string(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.equipamentoTag, input.equipamentoTag),
          eq(itemDespesaImportado.classificacao, "combustivel"),
        ))
        .orderBy(asc(sql`CAST(${itemDespesaImportado.hodometro} AS DECIMAL(12,2))`));

      const itens = result.map(r => ({
        id: r.id,
        data: r.data,
        produto: r.produto,
        quantidade: Number(r.quantidade) || 0,
        custo: Number(r.custo) || 0,
        hodometro: r.hodometro ? Number(r.hodometro) : null,
        intervalo: r.intervalo ? Number(r.intervalo) : null,
        litrosPorHora: r.litrosPorHora,
        horaPorLitro: r.horaPorLitro,
      }));

      return calcularConsumoCombustivel(itens);
    }),

  // Ranking de consumo de combustível de todos os equipamentos num período
  // Retorna lista de equipamentos com média de consumo lt/hr, ordenado por custo total
  rankingConsumo: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar todos os itens de combustível do período
      const result = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.classificacao, "combustivel"),
        ))
        .orderBy(
          asc(itemDespesaImportado.equipamentoTag),
          asc(sql`CAST(${itemDespesaImportado.hodometro} AS DECIMAL(12,2))`),
        );

      // Filtrar equipamentos excluídos do custo
      const idsExcluidos = await getIdsEquipExcluidos();
      const tagsExcluidas = await getTagsExcluidas();

      // Agrupar por equipamento
      const porEquipamento = new Map<string, {
        tag: string;
        descricao: string | null;
        sistemaId: number | null;
        itens: typeof result;
      }>();

      for (const row of result) {
        // Pular equipamentos excluídos (cadastrados + por tag)
        if (row.equipamentoSistemaId && idsExcluidos.has(row.equipamentoSistemaId)) continue;
        if (tagsExcluidas.has(row.equipamentoTag.toUpperCase())) continue;

        const tag = row.equipamentoTag;
        if (!porEquipamento.has(tag)) {
          porEquipamento.set(tag, {
            tag,
            descricao: row.equipamentoDescricao,
            sistemaId: row.equipamentoSistemaId,
            itens: [],
          });
        }
        porEquipamento.get(tag)!.itens.push(row);
      }

      // Calcular consumo para cada equipamento
      const ranking = Array.from(porEquipamento.values()).map(equip => {
        const itens = equip.itens.map(r => ({
          id: r.id,
          data: r.data,
          produto: r.produto,
          quantidade: Number(r.quantidade) || 0,
          custo: Number(r.custo) || 0,
          hodometro: r.hodometro ? Number(r.hodometro) : null,
          intervalo: r.intervalo ? Number(r.intervalo) : null,
          litrosPorHora: r.litrosPorHora,
          horaPorLitro: r.horaPorLitro,
        }));

        const analise = calcularConsumoCombustivel(itens);

        return {
          equipamentoTag: equip.tag,
          equipamentoDescricao: equip.descricao,
          equipamentoSistemaId: equip.sistemaId,
          ...analise.resumo,
        };
      });

      // Ordenar por custo total decrescente
      ranking.sort((a, b) => b.totalCusto - a.totalCusto);

      // Calcular totais gerais
      const totais = {
        totalEquipamentos: ranking.length,
        totalLitros: Math.round(ranking.reduce((s, r) => s + r.totalLitros, 0) * 100) / 100,
        totalCusto: Math.round(ranking.reduce((s, r) => s + r.totalCusto, 0) * 100) / 100,
        totalAbastecimentos: ranking.reduce((s, r) => s + r.totalAbastecimentos, 0),
        mediaGeralGlobal: null as number | null,
      };

      // Média geral global = total litros / total horas trabalhadas de todos os equipamentos
      const totalHoras = ranking.reduce((s, r) => s + (r.totalHorasTrabalhadas || 0), 0);
      if (totalHoras > 0) {
        totais.mediaGeralGlobal = Math.round((totais.totalLitros / totalHoras) * 100) / 100;
      }

      return { ranking, totais };
    }),

  // Listar itens detalhados de uma tag de Outras Desp. Setores (todas classificações)
  listarItensPorTagOutrasDesp: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      equipamentoTag: z.string(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const result = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.equipamentoTag, input.equipamentoTag),
        ))
        .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));
      return result.map(r => ({
        id: r.id,
        sequencia: r.sequencia,
        data: r.data,
        produto: r.produto,
        grupoProduto: r.grupoProduto,
        classificacao: r.classificacao,
        quantidade: Number(r.quantidade) || 0,
        custo: Number(r.custo) || 0,
        centroCusto: r.centroCusto,
        hodometro: r.hodometro ? Number(r.hodometro) : null,
        observacoes: r.observacoes,
      }));
    }),

  // =============================================
  // DESPESAS ESPECÍFICAS DE SETORES
  // =============================================

  // Listar despesas de setores agrupadas por tag (setor) para um período
  listarDespesasSetores: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const tagsExcluidas = await getTagsExcluidas();
      const tagsSetores = Object.keys(TAGS_OUTRAS_DESP_SETOR);

      if (tagsSetores.length === 0) return [];

      const result = await db2
        .select({
          equipamentoTag: itemDespesaImportado.equipamentoTag,
          equipamentoDescricao: itemDespesaImportado.equipamentoDescricao,
          totalItens: sql<number>`COUNT(*)`.as("totalItens"),
          totalCusto: sql<string>`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`.as("totalCusto"),
        })
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          inArray(itemDespesaImportado.equipamentoTag, tagsSetores),
        ))
        .groupBy(
          itemDespesaImportado.equipamentoTag,
          itemDespesaImportado.equipamentoDescricao,
        )
        .orderBy(desc(sql`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`));

      return result.map(r => ({
        equipamentoTag: r.equipamentoTag,
        equipamentoDescricao: r.equipamentoDescricao,
        setorDestino: TAGS_OUTRAS_DESP_SETOR[r.equipamentoTag] || "OUTROS SERVIÇOS",
        totalItens: Number(r.totalItens),
        totalCusto: Number(r.totalCusto) || 0,
        excluidoCusto: tagsExcluidas.has(r.equipamentoTag.toUpperCase()),
      }));
    }),

  // Listar itens detalhados de uma tag de setor
  listarItensSetor: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      equipamentoTag: z.string(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const result = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.equipamentoTag, input.equipamentoTag),
        ))
        .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));
      return result.map(r => ({
        id: r.id,
        sequencia: r.sequencia,
        data: r.data,
        produto: r.produto,
        grupoProduto: r.grupoProduto,
        classificacao: r.classificacao,
        quantidade: Number(r.quantidade) || 0,
        custo: Number(r.custo) || 0,
        centroCusto: r.centroCusto,
        observacoes: r.observacoes,
      }));
    }),

  // Excluir itens detalhados de um período (para reimportação)
  excluirPorPeriodo: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db2
        .delete(itemDespesaImportado)
        .where(eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId));

      return { sucesso: true };
    }),

  // ===== REVISÃO DE CORRESPONDÊNCIAS EQUIPAMENTO → SETOR =====

  // Listar todas as correspondências equipamento → setor para revisão
  listarCorrespondenciasSetor: protectedProcedure
    .query(async () => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Importar correspondências
      const { CORRESPONDENCIAS_APROVADAS: CA, CORRESPONDENCIAS_FORCADAS: CF } = await import("./importDespesas_correspondencias");

      // Buscar todos os equipamentos com setor e grupo
      const equipsList = await db2
        .select({
          id: equipamentos.id,
          codigoTag: equipamentos.codigoTag,
          nomeDoEquipamento: equipamentos.nomeDoEquipamento,
          setorId: equipamentos.setorId,
          grupoId: equipamentos.grupoId,
          excluidoCusto: equipamentos.excluidoCusto,
        })
        .from(equipamentos)
        .orderBy(asc(equipamentos.nomeDoEquipamento));

      // Buscar setores
      const { setores: setoresTable } = await import("../drizzle/schema");
      const setoresRows = await db2.select({ id: setoresTable.id, nome: setoresTable.nome }).from(setoresTable);
      const setoresMap = new Map(setoresRows.map(s => [s.id, s.nome]));

      // Buscar grupos
      const { gruposDeEquipamentos: gruposTable } = await import("../drizzle/schema");
      const gruposRows = await db2.select({ id: gruposTable.id, nome: gruposTable.nome }).from(gruposTable);
      const gruposMap = new Map(gruposRows.map(g => [g.id, g.nome]));

      // Mapeamento de grupo para setor padrão (fallback)
      const GRUPO_PARA_SETOR: Record<string, string> = {
        "BRITADORES": "BRITAGEM SECUNDÁRIA",
        "PENEIRAS VIBRATÓRIAS": "BRITAGEM SECUNDÁRIA",
        "TRANSPORTADORES DE CORREIA": "BRITAGEM SECUNDÁRIA",
        "COMPRESSORES DE AR DIESEL": "DESMONTE PRIMÁRIO",
        "PERFURATRIZES HIDRAULICAS": "DESMONTE PRIMÁRIO",
        "PERFURATRIZES PNEUMÁTICAS": "DESMONTE PRIMÁRIO",
        "ESCAVADEIRAS HIDRÁULICAS": "CARGA E TRANSPORTE DE PEDRA DA MINA",
        "CAMINHÕES INTERNOS": "CARGA E TRANSPORTE DE PEDRA DA MINA",
        "CAMINHÕES MELOSA": "CARGA E TRANSPORTE DE PEDRA DA MINA",
        "CAMINHÕES PIPA": "OUTROS SERVIÇOS AUXILIARES",
        "CAMINHÕES DA ENTREGA DE MATERIAL": "EXPEDIÇÃO",
        "PÁS CARREGADEIRAS": "EXPEDIÇÃO",
        "DRAGAS E BOMBA D'AGUA SUCÇÃO DIESEL": "DESMONTE PRIMÁRIO",
        "CARROS PEQUENOS": "ADMINISTRACAO",
        "OUTROS PARA CUSTO": "OUTROS SERVIÇOS AUXILIARES",
      };

      // Resolver setor para cada equipamento
      function resolverSetor(equip: typeof equipsList[0]): { setorNome: string; origem: string } {
        // 1. Setor cadastrado diretamente
        if (equip.setorId && setoresMap.has(equip.setorId)) {
          return { setorNome: setoresMap.get(equip.setorId)!, origem: "cadastro" };
        }
        // 2. Inferir pelo grupo
        if (equip.grupoId && gruposMap.has(equip.grupoId)) {
          const grupoNome = gruposMap.get(equip.grupoId)!;
          if (GRUPO_PARA_SETOR[grupoNome]) {
            return { setorNome: GRUPO_PARA_SETOR[grupoNome], origem: "grupo (" + grupoNome + ")" };
          }
        }
        // 3. Inferir pelo nome
        const nome = equip.nomeDoEquipamento.toUpperCase();
        if (nome.includes('EXPLOSIVOS')) return { setorNome: 'DESMONTE PRIMÁRIO', origem: 'nome' };
        if (nome.includes('PERFURATRIZ')) return { setorNome: 'DESMONTE PRIMÁRIO', origem: 'nome' };
        if (nome.includes('COMPRESSOR')) return { setorNome: 'DESMONTE PRIMÁRIO', origem: 'nome' };
        if (nome.includes('DRAGA')) return { setorNome: 'DESMONTE PRIMÁRIO', origem: 'nome' };
        if (nome.includes('BRITADOR') && nome.includes('MOVEL')) return { setorNome: 'BRITAGEM MÓVEL', origem: 'nome' };
        if (nome.includes('BRITADOR') || nome.includes('PENEIRA') || nome.includes('ALIMENTADOR') || nome.includes('CALHA')) return { setorNome: 'BRITAGEM SECUNDÁRIA', origem: 'nome' };
        if (nome.includes('TRANSP') && nome.includes('CORREIA')) return { setorNome: 'BRITAGEM SECUNDÁRIA', origem: 'nome' };
        if (nome.includes('ESCAVADEIRA') || nome.includes('KOMATSU')) return { setorNome: 'CARGA E TRANSPORTE DE PEDRA DA MINA', origem: 'nome' };
        if (nome.includes('CAVALINHO') || nome.includes('CARRETA')) return { setorNome: 'EXPEDIÇÃO', origem: 'nome' };
        if (nome.includes('PIPA')) return { setorNome: 'OUTROS SERVIÇOS AUXILIARES', origem: 'nome' };
        if (nome.includes('BASCULANTE')) return { setorNome: 'CARGA E TRANSPORTE DE PEDRA DA MINA', origem: 'nome' };
        if (nome.includes('MELOSA') || nome.includes('MELOZA')) return { setorNome: 'CARGA E TRANSPORTE DE PEDRA DA MINA', origem: 'nome' };
        if (nome.includes('RANGER') || nome.includes('VAN')) return { setorNome: 'ADMINISTRACAO', origem: 'nome' };
        return { setorNome: 'NÃO DEFINIDO', origem: 'nenhum' };
      }

      // Montar mapa de tags de correspondência para identificar a tag da planilha
      const tagParaEquipId = new Map<string, number>();
      for (const [tag, id] of Object.entries(CA)) tagParaEquipId.set(tag, id);
      for (const [tag, info] of Object.entries(CF)) tagParaEquipId.set(tag, info.equipamentoId);

      // Inverter: equipId → tags da planilha
      const equipIdParaTags = new Map<number, string[]>();
      for (const [tag, id] of Array.from(tagParaEquipId.entries())) {
        if (!equipIdParaTags.has(id)) equipIdParaTags.set(id, []);
        equipIdParaTags.get(id)!.push(tag);
      }

      // Montar resultado
      const resultado = equipsList.map(equip => {
        const { setorNome, origem } = resolverSetor(equip);
        const tagsPlanilha = equipIdParaTags.get(equip.id) || [];
        const grupoNome = equip.grupoId ? gruposMap.get(equip.grupoId) || null : null;
        return {
          id: equip.id,
          codigoTag: equip.codigoTag,
          nomeDoEquipamento: equip.nomeDoEquipamento,
          setorId: equip.setorId,
          setorNome,
          origemSetor: origem,
          grupoNome,
          tagsPlanilha,
          excluidoCusto: equip.excluidoCusto === "sim",
        };
      });

      return {
        equipamentos: resultado,
        setores: setoresRows.map(s => ({ id: s.id, nome: s.nome })),
      };
    }),

  // ===== DRILL-DOWN: EXPLOSIVOS E ACESSÓRIOS =====
  // Listar itens de explosivos agrupados por produto num período
  itensExplosivos: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const tagsExplosivos = TAGS_CONTA_EXPLOSIVOS.map(t => t.toUpperCase());
      if (tagsExplosivos.length === 0) return [];

      const result = await db2
        .select({
          produto: itemDespesaImportado.produto,
          grupoProduto: itemDespesaImportado.grupoProduto,
          totalItens: sql<number>`COUNT(*)`.as("totalItens"),
          totalQuantidade: sql<string>`SUM(CAST(${itemDespesaImportado.quantidade} AS DECIMAL(14,3)))`.as("totalQuantidade"),
          totalCusto: sql<string>`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`.as("totalCusto"),
        })
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          inArray(sql`UPPER(${itemDespesaImportado.equipamentoTag})`, tagsExplosivos),
        ))
        .groupBy(
          itemDespesaImportado.produto,
          itemDespesaImportado.grupoProduto,
        )
        .orderBy(desc(sql`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`));

      return result.map(r => ({
        produto: r.produto,
        grupoProduto: r.grupoProduto,
        totalItens: Number(r.totalItens),
        totalQuantidade: Number(r.totalQuantidade) || 0,
        totalCusto: Number(r.totalCusto) || 0,
      }));
    }),

  // Listar itens detalhados de explosivos num período (todos os itens individuais)
  itensExplosivosDetalhados: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const tagsExplosivos = TAGS_CONTA_EXPLOSIVOS.map(t => t.toUpperCase());
      if (tagsExplosivos.length === 0) return [];

      const result = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          inArray(sql`UPPER(${itemDespesaImportado.equipamentoTag})`, tagsExplosivos),
        ))
        .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));

      return result.map(r => ({
        id: r.id,
        sequencia: r.sequencia,
        data: r.data,
        produto: r.produto,
        grupoProduto: r.grupoProduto,
        quantidade: Number(r.quantidade) || 0,
        custo: Number(r.custo) || 0,
        centroCusto: r.centroCusto,
        observacoes: r.observacoes,
      }));
    }),

  // Alterar o setor de um equipamento (para revisão de correspondências)
  alterarSetorEquipamento: protectedProcedure
    .input(z.object({
      equipamentoId: z.number(),
      setorId: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db2.update(equipamentos)
        .set({ setorId: input.setorId })
        .where(eq(equipamentos.id, input.equipamentoId));

      return { sucesso: true };
    }),
});
