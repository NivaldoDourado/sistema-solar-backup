import { z } from "zod";
import { eq, and, sql, desc, inArray, notInArray } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  itemDespesaImportado,
  equipamentos,
  equipamentoExcluidoTag,
} from "../drizzle/schema";
import { TAGS_OUTRAS_DESP_SETOR, TAGS_CONTA_EXPLOSIVOS, CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS } from "./importDespesas_correspondencias";

// Classificações incluídas neste relatório (sem combustível e sem salário operador)
const CLASSIFICACOES_INCLUIDAS = ["lubrificantes", "pecas_desgaste", "pecas_reposicao", "outras_despesas"];

const CLASSIFICACAO_LABELS: Record<string, string> = {
  lubrificantes: "Lubrificantes",
  pecas_desgaste: "Peças de Desgaste",
  pecas_reposicao: "Peças de Reposição / Itens de Consumo",
  outras_despesas: "Outras Despesas dos Equipamentos",
};

const CLASSIFICACAO_ORDER: Record<string, number> = {
  lubrificantes: 1,
  pecas_desgaste: 2,
  pecas_reposicao: 3,
  outras_despesas: 4,
};

// Helper: buscar IDs de equipamentos excluídos do custo
async function getIdsEquipExcluidos(): Promise<Set<number>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db
    .select({ id: equipamentos.id })
    .from(equipamentos)
    .where(sql`${equipamentos.excluidoCusto} = 'sim'`);
  return new Set(rows.map(r => r.id));
}

// Helper: buscar tags excluídas
async function getTagsExcluidas(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  const rows = await db.select({ tag: equipamentoExcluidoTag.tag }).from(equipamentoExcluidoTag);
  return new Set(rows.map(r => r.tag.toUpperCase()));
}

/**
 * Build reverse mapping: equipamentoId → planilha tags
 */
function buildReverseTagMap(): { idToTags: Map<number, string[]>; tagToId: Map<string, number> } {
  const tagToId = new Map<string, number>();
  const idToTags = new Map<number, string[]>();
  for (const [tag, id] of Object.entries(CORRESPONDENCIAS_APROVADAS)) {
    tagToId.set(tag.toUpperCase(), id);
    if (!idToTags.has(id)) idToTags.set(id, []);
    idToTags.get(id)!.push(tag);
  }
  for (const [tag, info] of Object.entries(CORRESPONDENCIAS_FORCADAS)) {
    tagToId.set(tag.toUpperCase(), info.equipamentoId);
    if (!idToTags.has(info.equipamentoId)) idToTags.set(info.equipamentoId, []);
    idToTags.get(info.equipamentoId)!.push(tag);
  }
  return { idToTags, tagToId };
}

export const rankingEquipamentosRouter = router({
  /**
   * Ranking geral: lista equipamentos ordenados por gasto total (desc)
   * Inclui apenas: lubrificantes, pecas_desgaste, pecas_reposicao, outras_despesas
   */
  ranking: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const idsExcluidos = await getIdsEquipExcluidos();
      const tagsExcluidas = await getTagsExcluidas();
      const tagsSetores = new Set(Object.keys(TAGS_OUTRAS_DESP_SETOR).map(t => t.toUpperCase()));
      const tagsExplosivos = new Set(TAGS_CONTA_EXPLOSIVOS.map(t => t.toUpperCase()));

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
          inArray(itemDespesaImportado.classificacao, CLASSIFICACOES_INCLUIDAS),
        ))
        .groupBy(
          itemDespesaImportado.equipamentoTag,
          itemDespesaImportado.equipamentoDescricao,
          itemDespesaImportado.equipamentoSistemaId,
        )
        .orderBy(desc(sql`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`));

      // Filtrar equipamentos excluídos, tags de setores e tags de explosivos
      const filtered = result.filter(r => {
        const tagUpper = r.equipamentoTag.toUpperCase();
        if ((r.equipamentoSistemaId && idsExcluidos.has(r.equipamentoSistemaId)) || tagsExcluidas.has(tagUpper)) return false;
        if (tagsSetores.has(tagUpper)) return false;
        if (tagsExplosivos.has(tagUpper)) return false;
        return true;
      });

      // Buscar info do equipamento cadastrado (setor, nome)
      // Also resolve via CORRESPONDENCIAS_APROVADAS/FORCADAS for items without equipamentoSistemaId
      const resolvedIds = new Set<number>();
      const tagToResolvedId = new Map<string, number>();
      for (const r of filtered) {
        if (r.equipamentoSistemaId) {
          resolvedIds.add(r.equipamentoSistemaId);
          tagToResolvedId.set(r.equipamentoTag, r.equipamentoSistemaId);
        } else {
          // Try to resolve from correspondencias
          const tagUpper = r.equipamentoTag.toUpperCase();
          const fromAprovadas = Object.entries(CORRESPONDENCIAS_APROVADAS).find(([k]) => k.toUpperCase() === tagUpper);
          if (fromAprovadas) {
            resolvedIds.add(fromAprovadas[1]);
            tagToResolvedId.set(r.equipamentoTag, fromAprovadas[1]);
          } else {
            const fromForcadas = Object.entries(CORRESPONDENCIAS_FORCADAS).find(([k]) => k.toUpperCase() === tagUpper);
            if (fromForcadas) {
              resolvedIds.add(fromForcadas[1].equipamentoId);
              tagToResolvedId.set(r.equipamentoTag, fromForcadas[1].equipamentoId);
            }
          }
        }
      }
      let equipMap = new Map<number, { nome: string; setor: string; codigoTag: string }>();
      const equipIdsArr = Array.from(resolvedIds);
      if (equipIdsArr.length > 0) {
        const equipRows = await db2
          .select({
            id: equipamentos.id,
            nome: equipamentos.nomeDoEquipamento,
            codigoTag: equipamentos.codigoTag,
            setorId: equipamentos.setorId,
          })
          .from(equipamentos)
          .where(inArray(equipamentos.id, equipIdsArr));
        // Get setor names
        const { setores } = await import("../drizzle/schema");
        const setorRows = await db2.select({ id: setores.id, nome: setores.nome }).from(setores);
        const setorMap = new Map(setorRows.map(s => [s.id, s.nome]));
        for (const e of equipRows) {
          equipMap.set(e.id, {
            nome: e.nome,
            setor: e.setorId ? (setorMap.get(e.setorId) || "\u2014") : "\u2014",
            codigoTag: e.codigoTag || "",
          });
        }
      }

      // Calcular total geral para percentuais
      const totalGeral = filtered.reduce((sum, r) => sum + (Number(r.totalCusto) || 0), 0);

      return {
        equipamentos: filtered.map((r, idx) => {
          const resolvedId = r.equipamentoSistemaId || tagToResolvedId.get(r.equipamentoTag);
          const info = resolvedId ? equipMap.get(resolvedId) : null;
          const custo = Number(r.totalCusto) || 0;
          return {
            posicao: idx + 1,
            equipamentoTag: r.equipamentoTag,
            equipamentoDescricao: r.equipamentoDescricao || r.equipamentoTag,
            equipamentoSistemaId: resolvedId || null,
            nomeEquipamento: info?.nome || r.equipamentoDescricao || r.equipamentoTag,
            setor: info?.setor || "\u2014",
            codigoTag: info?.codigoTag || r.equipamentoTag,
            totalItens: Number(r.totalItens),
            totalCusto: custo,
            percentual: totalGeral > 0 ? (custo / totalGeral) * 100 : 0,
          };
        }),
        totalGeral,
        totalEquipamentos: filtered.length,
      };
    }),

  /**
   * Drill-down nível 2: classificações de despesa de um equipamento
   */
  classificacoesEquipamento: protectedProcedure
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
          inArray(itemDespesaImportado.classificacao, CLASSIFICACOES_INCLUIDAS),
        ))
        .groupBy(itemDespesaImportado.classificacao)
        .orderBy(sql`FIELD(${itemDespesaImportado.classificacao}, 'lubrificantes', 'pecas_desgaste', 'pecas_reposicao', 'outras_despesas')`);

      const totalEquip = result.reduce((sum, r) => sum + (Number(r.totalCusto) || 0), 0);

      return {
        classificacoes: result.map(r => ({
          classificacao: r.classificacao,
          label: CLASSIFICACAO_LABELS[r.classificacao] || r.classificacao,
          totalItens: Number(r.totalItens),
          totalCusto: Number(r.totalCusto) || 0,
          percentual: totalEquip > 0 ? ((Number(r.totalCusto) || 0) / totalEquip) * 100 : 0,
          ordem: CLASSIFICACAO_ORDER[r.classificacao] || 99,
        })),
        totalEquipamento: totalEquip,
      };
    }),

  /**
   * Drill-down nível 3: itens detalhados de uma classificação de um equipamento
   */
  itensClassificacao: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
      equipamentoTag: z.string(),
      classificacao: z.string(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Tentar match direto
      let result = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          eq(itemDespesaImportado.equipamentoTag, input.equipamentoTag),
          eq(itemDespesaImportado.classificacao, input.classificacao),
        ))
        .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));

      // Se não encontrou, tentar match normalizado
      if (result.length === 0) {
        const tagNorm = input.equipamentoTag.replace(/\s+/g, "");
        result = await db2
          .select()
          .from(itemDespesaImportado)
          .where(and(
            eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
            sql`REPLACE(${itemDespesaImportado.equipamentoTag}, ' ', '') = ${tagNorm}`,
            eq(itemDespesaImportado.classificacao, input.classificacao),
          ))
          .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));
      }

      // Se ainda não encontrou, usar mapa de correspondências
      if (result.length === 0) {
        const { idToTags, tagToId } = buildReverseTagMap();
        const tags = new Set<string>();
        tags.add(input.equipamentoTag);
        const idFromCorr = tagToId.get(input.equipamentoTag.toUpperCase());
        if (idFromCorr && idToTags.has(idFromCorr)) {
          for (const t of idToTags.get(idFromCorr)!) tags.add(t);
        }
        const dbEquip = await db2
          .select({ id: equipamentos.id })
          .from(equipamentos)
          .where(eq(equipamentos.codigoTag, input.equipamentoTag));
        for (const row of dbEquip) {
          if (idToTags.has(row.id)) {
            for (const t of idToTags.get(row.id)!) tags.add(t);
          }
        }
        const altTags = Array.from(tags).filter(t => t !== input.equipamentoTag);
        if (altTags.length > 0) {
          result = await db2
            .select()
            .from(itemDespesaImportado)
            .where(and(
              eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
              inArray(itemDespesaImportado.equipamentoTag, altTags),
              eq(itemDespesaImportado.classificacao, input.classificacao),
            ))
            .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));
        }
      }

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

  /**
   * Dados completos para exportação: todos os equipamentos com todas as classificações e itens
   */
  dadosExportacao: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const idsExcluidos = await getIdsEquipExcluidos();
      const tagsExcluidas = await getTagsExcluidas();
      const tagsSetores = new Set(Object.keys(TAGS_OUTRAS_DESP_SETOR).map(t => t.toUpperCase()));
      const tagsExplosivos = new Set(TAGS_CONTA_EXPLOSIVOS.map(t => t.toUpperCase()));

      // Buscar todos os itens do período com classificações incluídas
      const allItems = await db2
        .select()
        .from(itemDespesaImportado)
        .where(and(
          eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId),
          inArray(itemDespesaImportado.classificacao, CLASSIFICACOES_INCLUIDAS),
        ))
        .orderBy(desc(sql`CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2))`));

      // Filtrar itens de equipamentos excluídos
      const filteredItems = allItems.filter(item => {
        const tagUpper = item.equipamentoTag.toUpperCase();
        if ((item.equipamentoSistemaId && idsExcluidos.has(item.equipamentoSistemaId)) || tagsExcluidas.has(tagUpper)) return false;
        if (tagsSetores.has(tagUpper)) return false;
        if (tagsExplosivos.has(tagUpper)) return false;
        return true;
      });

      // Agrupar por equipamento
      const equipMap = new Map<string, {
        tag: string;
        descricao: string;
        sistemaId: number | null;
        classificacoes: Map<string, { custo: number; itens: any[] }>;
        totalCusto: number;
      }>();

      for (const item of filteredItems) {
        if (!equipMap.has(item.equipamentoTag)) {
          equipMap.set(item.equipamentoTag, {
            tag: item.equipamentoTag,
            descricao: item.equipamentoDescricao || item.equipamentoTag,
            sistemaId: item.equipamentoSistemaId,
            classificacoes: new Map(),
            totalCusto: 0,
          });
        }
        const equip = equipMap.get(item.equipamentoTag)!;
        const custo = Number(item.custo) || 0;
        equip.totalCusto += custo;

        if (!equip.classificacoes.has(item.classificacao)) {
          equip.classificacoes.set(item.classificacao, { custo: 0, itens: [] });
        }
        const classif = equip.classificacoes.get(item.classificacao)!;
        classif.custo += custo;
        classif.itens.push({
          sequencia: item.sequencia,
          data: item.data,
          produto: item.produto,
          custo,
        });
      }

      // Ordenar equipamentos por custo total decrescente
      const equipamentos_sorted = Array.from(equipMap.values())
        .sort((a, b) => b.totalCusto - a.totalCusto);

      const totalGeral = equipamentos_sorted.reduce((sum, e) => sum + e.totalCusto, 0);

      return {
        equipamentos: equipamentos_sorted.map((e, idx) => ({
          posicao: idx + 1,
          tag: e.tag,
          descricao: e.descricao,
          totalCusto: e.totalCusto,
          percentual: totalGeral > 0 ? (e.totalCusto / totalGeral) * 100 : 0,
          classificacoes: CLASSIFICACOES_INCLUIDAS
            .filter(c => e.classificacoes.has(c))
            .map(c => ({
              classificacao: c,
              label: CLASSIFICACAO_LABELS[c],
              totalCusto: e.classificacoes.get(c)!.custo,
              itens: e.classificacoes.get(c)!.itens,
            })),
        })),
        totalGeral,
        totalEquipamentos: equipamentos_sorted.length,
      };
    }),
});
