import { z } from "zod";
import { eq, and, sql, desc } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  itemDespesaImportado,
  equipamentos,
  periodoCusto,
} from "../drizzle/schema";

export const itensDespesaRouter = router({
  // Listar equipamentos com itens importados para um período
  // Retorna: equipamentoTag, equipamentoDescricao, equipamentoSistemaId, totalItens, totalCusto
  listarEquipamentosPorPeriodo: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      return result.map(r => ({
        equipamentoTag: r.equipamentoTag,
        equipamentoDescricao: r.equipamentoDescricao,
        equipamentoSistemaId: r.equipamentoSistemaId,
        totalItens: Number(r.totalItens),
        totalCusto: Number(r.totalCusto) || 0,
      }));
    }),

  // Listar classificações de um equipamento num período
  // Retorna: classificacao, totalItens, totalCusto
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

      const CLASSIFICACAO_LABELS: Record<string, string> = {
        combustivel: "Combustível",
        lubrificantes: "Lubrificantes",
        pecas_desgaste: "Peças de Desgaste",
        pecas_reposicao: "Peças de Reposição / Itens de Consumo",
        outras_despesas: "Outras Despesas dos Equipamentos",
      };

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

  // Resumo geral por classificação para um período (todos os equipamentos)
  resumoPorClassificacao: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db2 = await getDb();
      if (!db2) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db2
        .select({
          classificacao: itemDespesaImportado.classificacao,
          totalItens: sql<number>`COUNT(*)`.as("totalItens"),
          totalCusto: sql<string>`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`.as("totalCusto"),
          totalEquipamentos: sql<number>`COUNT(DISTINCT ${itemDespesaImportado.equipamentoTag})`.as("totalEquipamentos"),
        })
        .from(itemDespesaImportado)
        .where(eq(itemDespesaImportado.periodoCustoId, input.periodoCustoId))
        .groupBy(itemDespesaImportado.classificacao)
        .orderBy(desc(sql`SUM(CAST(${itemDespesaImportado.custo} AS DECIMAL(14,2)))`));

      const CLASSIFICACAO_LABELS: Record<string, string> = {
        combustivel: "Combustível",
        lubrificantes: "Lubrificantes",
        pecas_desgaste: "Peças de Desgaste",
        pecas_reposicao: "Peças de Reposição / Itens de Consumo",
        outras_despesas: "Outras Despesas dos Equipamentos",
      };

      return result.map(r => ({
        classificacao: r.classificacao,
        classificacaoLabel: CLASSIFICACAO_LABELS[r.classificacao] || r.classificacao,
        totalItens: Number(r.totalItens),
        totalCusto: Number(r.totalCusto) || 0,
        totalEquipamentos: Number(r.totalEquipamentos),
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
});
