import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { custoSetorEquipamento, custoSetorDespesa } from "../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

export const custoSetorRasRouter = router({
  // Listar equipamentos de um período e subsetor específico
  listarEquipamentosPorSubsetor: protectedProcedure
    .input(
      z.object({
        periodoCustoId: z.number(),
        subsetorNome: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorEquipamento)
        .where(
          and(
            eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId),
            eq(custoSetorEquipamento.subsetorNome, input.subsetorNome)
          )
        )
        .orderBy(asc(custoSetorEquipamento.ordemExibicao));
    }),

  // Listar todos os equipamentos de um período
  listarEquipamentosPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorEquipamento)
        .where(eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId))
        .orderBy(
          asc(custoSetorEquipamento.grupoNome),
          asc(custoSetorEquipamento.subsetorNome),
          asc(custoSetorEquipamento.ordemExibicao)
        );
    }),

  // Listar despesas específicas de um período e subsetor
  listarDespesasPorSubsetor: protectedProcedure
    .input(
      z.object({
        periodoCustoId: z.number(),
        subsetorNome: z.string(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorDespesa)
        .where(
          and(
            eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId),
            eq(custoSetorDespesa.subsetorNome, input.subsetorNome)
          )
        )
        .orderBy(asc(custoSetorDespesa.ordemExibicao));
    }),

  // Listar todas as despesas de um período
  listarDespesasPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db
        .select()
        .from(custoSetorDespesa)
        .where(eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId))
        .orderBy(
          asc(custoSetorDespesa.grupoNome),
          asc(custoSetorDespesa.subsetorNome),
          asc(custoSetorDespesa.ordemExibicao)
        );
    }),

  // Relatório analítico completo por período
  // Retorna todos os subsetores com seus equipamentos e despesas específicas
  relatorioAnalitico: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { grupos: [], totalGeral: 0 };

      const [equipamentos, despesas] = await Promise.all([
        db
          .select()
          .from(custoSetorEquipamento)
          .where(eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId))
          .orderBy(
            asc(custoSetorEquipamento.grupoNome),
            asc(custoSetorEquipamento.subsetorNome),
            asc(custoSetorEquipamento.ordemExibicao)
          ),
        db
          .select()
          .from(custoSetorDespesa)
          .where(eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId))
          .orderBy(
            asc(custoSetorDespesa.grupoNome),
            asc(custoSetorDespesa.subsetorNome),
            asc(custoSetorDespesa.ordemExibicao)
          ),
      ]);

      // Agrupar por grupo → subsetor
      type EquipItem = typeof equipamentos[0];
      type DespItem = typeof despesas[0];

      type SubsetorData = {
        subsetorNome: string;
        grupoNome: string;
        equipamentos: EquipItem[];
        despesasEspecificas: DespItem[];
        totalEquipamentos: number;
        totalDespesasEspecificas: number;
        totalSubsetor: number;
      };

      type GrupoData = {
        grupoNome: string;
        subsetores: SubsetorData[];
        totalGrupo: number;
      };

      const gruposMap: Record<string, GrupoData> = {};
      const subsetoresMap: Record<string, SubsetorData> = {};

      // Processar equipamentos
      for (const equip of equipamentos) {
        const key = `${equip.grupoNome}||${equip.subsetorNome}`;

        if (!subsetoresMap[key]) {
          subsetoresMap[key] = {
            subsetorNome: equip.subsetorNome,
            grupoNome: equip.grupoNome,
            equipamentos: [],
            despesasEspecificas: [],
            totalEquipamentos: 0,
            totalDespesasEspecificas: 0,
            totalSubsetor: 0,
          };
        }

        subsetoresMap[key].equipamentos.push(equip);
        subsetoresMap[key].totalEquipamentos += parseFloat(
          equip.totalDespesasEquipamento ?? "0"
        );
      }

      // Processar despesas específicas
      for (const desp of despesas) {
        const key = `${desp.grupoNome}||${desp.subsetorNome}`;

        if (!subsetoresMap[key]) {
          subsetoresMap[key] = {
            subsetorNome: desp.subsetorNome,
            grupoNome: desp.grupoNome,
            equipamentos: [],
            despesasEspecificas: [],
            totalEquipamentos: 0,
            totalDespesasEspecificas: 0,
            totalSubsetor: 0,
          };
        }

        subsetoresMap[key].despesasEspecificas.push(desp);
        subsetoresMap[key].totalDespesasEspecificas += parseFloat(desp.valor ?? "0");
      }

      // Calcular totais dos subsetores e agrupar por grupo
      for (const subsetor of Object.values(subsetoresMap)) {
        subsetor.totalSubsetor =
          subsetor.totalEquipamentos + subsetor.totalDespesasEspecificas;

        if (!gruposMap[subsetor.grupoNome]) {
          gruposMap[subsetor.grupoNome] = {
            grupoNome: subsetor.grupoNome,
            subsetores: [],
            totalGrupo: 0,
          };
        }

        gruposMap[subsetor.grupoNome].subsetores.push(subsetor);
        gruposMap[subsetor.grupoNome].totalGrupo += subsetor.totalSubsetor;
      }

      const totalGeral = Object.values(gruposMap).reduce(
        (s, g) => s + g.totalGrupo,
        0
      );

      // Ordenar grupos e subsetores
      const ORDEM_GRUPOS: Record<string, number> = {
        "DESMONTE DE ROCHA": 1,
        "CARGA E TRANSPORTE": 2,
        BRITAGEM: 3,
        "EXPEDIÇÃO": 4,
        "SERVIÇOS AUXILIARES": 5,
        "ADMINISTRAÇÃO": 6,
      };

      const grupos = Object.values(gruposMap).sort(
        (a, b) =>
          (ORDEM_GRUPOS[a.grupoNome] ?? 99) - (ORDEM_GRUPOS[b.grupoNome] ?? 99)
      );

      return { grupos, totalGeral };
    }),

  // Deletar todos os dados RAS de um período (para reimportação)
  deletarPorPeriodo: protectedProcedure
    .input(z.object({ periodoCustoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await Promise.all([
        db
          .delete(custoSetorEquipamento)
          .where(eq(custoSetorEquipamento.periodoCustoId, input.periodoCustoId)),
        db
          .delete(custoSetorDespesa)
          .where(eq(custoSetorDespesa.periodoCustoId, input.periodoCustoId)),
      ]);
      return { success: true };
    }),
});
