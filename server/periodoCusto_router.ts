import { z } from "zod";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { periodoCusto, producao, parteDiaria, parteDiariaItens, servicos, equipamentos, pesagensEquipamentos } from "../drizzle/schema";

// Data de corte: a partir de abril/2026, produção vem do Método Caminhões
const CORTE_ANO = 2026;
const CORTE_MES = 4; // Abril

// Helper para calcular primeiro e último dia do mês
function getMesDates(mes: number, ano: number) {
  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { dataInicio, dataFim };
}

export const periodoCustoRouter = router({
  // Listar todos os períodos de custo
  list: protectedProcedure
    .use(requirePermission("custos", "view"))
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(periodoCusto)
        .orderBy(desc(periodoCusto.ano), desc(periodoCusto.mes));
    }),

  // Buscar um período específico por mês/ano
  getByMesAno: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(periodoCusto)
        .where(and(eq(periodoCusto.mes, input.mes), eq(periodoCusto.ano, input.ano)))
        .limit(1);
      return row ?? null;
    }),

  // Criar ou atualizar período de custo (upsert)
  upsert: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(
      z.object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2020),
        producaoTotal: z.string().optional(),
        quantidadeVendida: z.string().optional(),
        despesasIndiretas: z.string().optional(),
        fretePeriodo: z.string().optional(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verificar se já existe
      const [existing] = await db
        .select()
        .from(periodoCusto)
        .where(and(eq(periodoCusto.mes, input.mes), eq(periodoCusto.ano, input.ano)))
        .limit(1);

      if (existing) {
        if (existing.fechado === "sim") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado. Não é possível editar." });
        }
        await db
          .update(periodoCusto)
          .set({
            producaoTotal: input.producaoTotal ?? null,
            quantidadeVendida: input.quantidadeVendida ?? null,
            despesasIndiretas: input.despesasIndiretas ?? "0",
            fretePeriodo: input.fretePeriodo ?? "0",
            observacoes: input.observacoes ?? null,
          })
          .where(eq(periodoCusto.id, existing.id));
        return { id: existing.id, action: "updated" };
      } else {
        const result = await db.insert(periodoCusto).values({
          mes: input.mes,
          ano: input.ano,
          producaoTotal: input.producaoTotal ?? null,
          quantidadeVendida: input.quantidadeVendida ?? null,
          despesasIndiretas: input.despesasIndiretas ?? "0",
          fretePeriodo: input.fretePeriodo ?? "0",
          observacoes: input.observacoes ?? null,
          fechado: "nao",
          userId: ctx.user.id,
        });
        return { id: Number(result[0].insertId), action: "created" };
      }
    }),

  // Fechar/abrir período
  toggleFechado: protectedProcedure
    .use(requirePermission("custos", "edit"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [row] = await db.select().from(periodoCusto).where(eq(periodoCusto.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Período não encontrado" });
      const novoStatus = row.fechado === "sim" ? "nao" : "sim";
      await db.update(periodoCusto).set({ fechado: novoStatus }).where(eq(periodoCusto.id, input.id));
      return { fechado: novoStatus };
    }),

  // Buscar produção total do módulo Produção para um período (mês/ano)
  // A partir de abril/2026: usa Produção Método Caminhões (soma toneladas transportadas)
  // Antes de abril/2026: usa tabela producao (legado)
  getProducaoDoModulo: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ mes: z.number().min(1).max(12), ano: z.number().min(2020) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { total: 0, fonte: "indisponivel" as const };
      const { dataInicio, dataFim } = getMesDates(input.mes, input.ano);

      // Verificar se é abril/2026 ou posterior
      const usarMetodoCaminhoes = input.ano > CORTE_ANO || (input.ano === CORTE_ANO && input.mes >= CORTE_MES);

      if (usarMetodoCaminhoes) {
        // Produção Método Caminhões: soma de producao (toneladas) dos itens de parte diária
        // com serviços de transporte para britador
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

        const itens = await db
          .select({
            servicoId: parteDiariaItens.servicoId,
            producao: parteDiariaItens.producao,
            data: parteDiaria.data,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));

        const itensFiltrados = itens.filter(item => {
          if (!servicosCaminhoes.includes(item.servicoId)) return false;
          const itemDate = item.data instanceof Date ? item.data.toISOString().split('T')[0] : String(item.data).split('T')[0];
          return itemDate >= dataInicio && itemDate <= dataFim;
        });

        const total = itensFiltrados.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
        return { total, fonte: "metodo_caminhoes" as const };
      } else {
        // Legado: tabela producao
        const dtInicio = new Date(dataInicio + "T00:00:00");
        const dtFim = new Date(dataFim + "T23:59:59");
        const [result] = await db
          .select({ total: sql<string>`COALESCE(SUM(${producao.quantidade}), 0)` })
          .from(producao)
          .where(and(gte(producao.data, dtInicio), lte(producao.data, dtFim)));
        return { total: parseFloat(String(result?.total ?? "0")), fonte: "legado" as const };
      }
    }),

  // Excluir período
  delete: protectedProcedure
    .use(requirePermission("custos", "delete"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const [row] = await db.select().from(periodoCusto).where(eq(periodoCusto.id, input.id)).limit(1);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Período não encontrado" });
      if (row.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado. Não é possível excluir." });
      }
      await db.delete(periodoCusto).where(eq(periodoCusto.id, input.id));
      return { success: true };
    }),
});
