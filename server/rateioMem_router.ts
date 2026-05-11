/**
 * Router de Rateio MEM (Memória de Cálculo dos Equipamentos)
 * 
 * Expõe procedures tRPC para o cálculo on-the-fly do rateio MEM.
 * A lógica de cálculo está em rateioMem_calc.ts (módulo compartilhado).
 */

import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { calcularRateioMem, calcularProducaoPorSubsetor } from "./rateioMem_calc";

export const rateioMemRouter = router({
  /**
   * Calcula o rateio MEM completo para um período.
   * Retorna os dados agrupados por subsetor MEM com equipamentos e despesas rateadas.
   */
  calcularRateio: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      return await calcularRateioMem(input.periodoCustoId);
    }),

  /**
   * Resumo sintético do rateio MEM por subsetor (para integração com Apuração de Custo)
   */
  resumoPorSubsetor: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const result = await calcularRateioMem(input.periodoCustoId);
      return {
        subsetores: result.subsetores.map(s => ({
          subsetorNome: s.subsetorNome,
          grupoNome: s.grupoNome,
          totalSubsetor: s.totalSubsetor,
          totalHoras: s.totalHoras,
          qtdEquipamentos: s.equipamentos.length,
        })),
        totalGeral: result.totalGeral,
      };
    }),

  /**
   * Calcula a produção (toneladas) por subsetor MEM para um período.
   * Usado para calcular o indicador Custo/Tonelada.
   */
  producaoPorSubsetor: protectedProcedure
    .input(z.object({
      periodoCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      return await calcularProducaoPorSubsetor(input.periodoCustoId);
    }),
});
