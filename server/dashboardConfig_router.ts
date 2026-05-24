import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { dashboardCardsConfig } from "../drizzle/schema";

// ============================================================================
// DEFINIÇÃO DOS CARDS DO DASHBOARD
// ============================================================================

/**
 * Lista completa de todos os cards disponíveis no Dashboard.
 * Cada card tem um id único, label para exibição e grupo para organização.
 */
export const ALL_DASHBOARD_CARDS = [
  // KPIs Resumo
  { id: "status_lancamentos", label: "Status dos Lançamentos", grupo: "Resumo" },
  { id: "custos_totais", label: "Custos Totais", grupo: "Resumo" },
  { id: "combustivel", label: "Combustível (L)", grupo: "Resumo" },
  { id: "estoque_minimo", label: "Estoque Mínimo de Peças", grupo: "Resumo" },
  // Vendas
  { id: "vendas", label: "Vendas", grupo: "Comercial" },
  { id: "amortizacoes", label: "Amortizações", grupo: "Comercial" },
  { id: "doacoes", label: "Doações", grupo: "Comercial" },
  // Produção
  { id: "producao_caminhoes", label: "Produção Método Caminhões", grupo: "Produção" },
  { id: "medicao_pilhas", label: "Medição das Pilhas", grupo: "Produção" },
  { id: "producao_balancas", label: "Produção Balanças Integradoras", grupo: "Produção" },
  { id: "producao_ultimo_dia", label: "Produção Último Dia Caminhões", grupo: "Produção" },
  { id: "producao_perfuracao", label: "Produção de Perfuração", grupo: "Produção" },
  { id: "producao_motoristas", label: "Produção dos Motoristas", grupo: "Produção" },
  // Gráficos de Produção
  { id: "producao_setor", label: "Produção por Setor", grupo: "Gráficos" },
  { id: "producao_servico", label: "Produção por Serviço", grupo: "Gráficos" },
  { id: "producao_equipamento", label: "Produção por Equipamento", grupo: "Gráficos" },
  { id: "horas_trabalhadas", label: "Horas Trabalhadas", grupo: "Gráficos" },
  { id: "km_rodado", label: "Km Rodado", grupo: "Gráficos" },
  { id: "horas_por_setor", label: "Horas Trabalhadas por Setor", grupo: "Gráficos" },
  // Manutenção
  { id: "revisoes_preventivas", label: "Revisões Preventivas", grupo: "Manutenção" },
  // Sistema
  { id: "acesso_rapido", label: "Acesso Rápido aos Módulos", grupo: "Sistema" },
  { id: "visao_geral", label: "Visão Geral do Sistema", grupo: "Sistema" },
] as const;

export type DashboardCardId = typeof ALL_DASHBOARD_CARDS[number]["id"];

// Agrupamento para exibição na tela de configuração
export const CARD_GROUPS = [
  { label: "Resumo", cards: ["status_lancamentos", "custos_totais", "combustivel", "estoque_minimo"] },
  { label: "Comercial", cards: ["vendas", "amortizacoes", "doacoes"] },
  { label: "Produção", cards: ["producao_caminhoes", "medicao_pilhas", "producao_balancas", "producao_ultimo_dia", "producao_perfuracao", "producao_motoristas"] },
  { label: "Gráficos", cards: ["producao_setor", "producao_servico", "producao_equipamento", "horas_trabalhadas", "km_rodado", "horas_por_setor"] },
  { label: "Manutenção", cards: ["revisoes_preventivas"] },
  { label: "Sistema", cards: ["acesso_rapido", "visao_geral"] },
];

const ALL_ROLES = [
  "admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador",
] as const;

// ============================================================================
// CONFIGURAÇÃO PADRÃO POR PERFIL
// Quando não há configuração no banco, estes são os cards visíveis por padrão
// ============================================================================

const DEFAULT_VISIBLE_CARDS: Record<string, string[]> = {
  admin: ALL_DASHBOARD_CARDS.map(c => c.id),
  consultoria: ALL_DASHBOARD_CARDS.map(c => c.id),
  diretor: [
    "custos_totais", "combustivel", "vendas", "amortizacoes", "doacoes",
    "producao_caminhoes", "medicao_pilhas", "producao_balancas",
    "producao_ultimo_dia", "producao_perfuracao",
    "producao_setor", "producao_equipamento", "horas_trabalhadas",
    "revisoes_preventivas",
  ],
  gerente: [
    "status_lancamentos", "custos_totais", "combustivel", "estoque_minimo",
    "producao_caminhoes", "medicao_pilhas", "producao_balancas",
    "producao_ultimo_dia", "producao_perfuracao", "producao_motoristas",
    "producao_setor", "producao_servico", "producao_equipamento",
    "horas_trabalhadas", "km_rodado", "horas_por_setor",
    "revisoes_preventivas",
  ],
  coordenador: [
    "status_lancamentos", "combustivel", "estoque_minimo",
    "producao_caminhoes", "producao_ultimo_dia", "producao_perfuracao",
    "producao_motoristas", "producao_setor", "producao_servico",
    "producao_equipamento", "horas_trabalhadas", "km_rodado",
    "horas_por_setor", "revisoes_preventivas",
  ],
  usuario: [
    "status_lancamentos", "combustivel",
    "producao_caminhoes", "producao_ultimo_dia",
    "producao_motoristas", "horas_trabalhadas",
  ],
  controle: [
    "status_lancamentos", "custos_totais", "combustivel", "estoque_minimo",
    "producao_caminhoes", "producao_balancas", "producao_ultimo_dia",
    "producao_motoristas", "horas_trabalhadas", "km_rodado",
    "revisoes_preventivas",
  ],
  operador: [
    "status_lancamentos", "producao_ultimo_dia",
  ],
};

/**
 * Middleware: apenas Consultoria/Admin pode gerenciar configurações do dashboard
 */
const consultoriaProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "consultoria"];
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o perfil Consultoria pode gerenciar a configuração do Dashboard.",
    });
  }
  return next({ ctx });
});

// ============================================================================
// ROUTER
// ============================================================================

export const dashboardConfigRouter = router({
  /**
   * Retorna metadados: lista de cards, grupos, perfis e defaults
   */
  metadata: consultoriaProcedure.query(() => {
    return {
      cards: ALL_DASHBOARD_CARDS,
      groups: CARD_GROUPS,
      roles: ALL_ROLES,
      defaults: DEFAULT_VISIBLE_CARDS,
    };
  }),

  /**
   * Obter configuração de cards para um perfil específico (admin)
   */
  getByRole: consultoriaProcedure
    .input(z.object({ perfil: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const configs = await db.select()
        .from(dashboardCardsConfig)
        .where(eq(dashboardCardsConfig.perfil, input.perfil as any));

      // Se não há configuração no banco, retornar defaults
      if (configs.length === 0) {
        const defaultCards = DEFAULT_VISIBLE_CARDS[input.perfil] || [];
        return ALL_DASHBOARD_CARDS.map((card, idx) => ({
          cardId: card.id,
          visivel: defaultCards.includes(card.id),
          ordem: idx,
        }));
      }

      // Retornar configuração do banco, completando com defaults para cards novos
      return ALL_DASHBOARD_CARDS.map((card, idx) => {
        const dbConfig = configs.find(c => c.cardId === card.id);
        if (dbConfig) {
          return {
            cardId: card.id,
            visivel: dbConfig.visivel === "sim",
            ordem: dbConfig.ordem,
          };
        }
        // Card novo sem configuração: usar default
        const defaultCards = DEFAULT_VISIBLE_CARDS[input.perfil] || [];
        return {
          cardId: card.id,
          visivel: defaultCards.includes(card.id),
          ordem: idx,
        };
      }).sort((a, b) => a.ordem - b.ordem);
    }),

  /**
   * Salvar configuração de cards para um perfil (upsert)
   */
  save: consultoriaProcedure
    .input(z.object({
      perfil: z.enum(["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]),
      cards: z.array(z.object({
        cardId: z.string(),
        visivel: z.boolean(),
        ordem: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Deletar configuração existente do perfil e reinserir
      await db.delete(dashboardCardsConfig)
        .where(eq(dashboardCardsConfig.perfil, input.perfil));

      // Inserir nova configuração
      if (input.cards.length > 0) {
        await db.insert(dashboardCardsConfig).values(
          input.cards.map(card => ({
            perfil: input.perfil,
            cardId: card.cardId,
            visivel: card.visivel ? "sim" as const : "nao" as const,
            ordem: card.ordem,
          }))
        );
      }

      return { success: true };
    }),

  /**
   * Resetar configuração de um perfil para os padrões
   */
  resetToDefault: consultoriaProcedure
    .input(z.object({
      perfil: z.enum(["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db.delete(dashboardCardsConfig)
        .where(eq(dashboardCardsConfig.perfil, input.perfil));

      return { success: true };
    }),

  /**
   * Obter configuração de cards do usuário atual (para o frontend renderizar)
   */
  myConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const userRole = ctx.user.role;
    const configs = await db.select()
      .from(dashboardCardsConfig)
      .where(eq(dashboardCardsConfig.perfil, userRole as any));

    // Se não há configuração no banco, retornar defaults
    if (configs.length === 0) {
      const defaultCards = DEFAULT_VISIBLE_CARDS[userRole] || ALL_DASHBOARD_CARDS.map(c => c.id);
      return {
        visibleCards: defaultCards,
        cardOrder: ALL_DASHBOARD_CARDS.map((c, idx) => ({ cardId: c.id, ordem: idx })),
      };
    }

    const visibleCards = configs
      .filter(c => c.visivel === "sim")
      .sort((a, b) => a.ordem - b.ordem)
      .map(c => c.cardId);

    const cardOrder = configs
      .sort((a, b) => a.ordem - b.ordem)
      .map(c => ({ cardId: c.cardId, ordem: c.ordem }));

    return { visibleCards, cardOrder };
  }),
});
