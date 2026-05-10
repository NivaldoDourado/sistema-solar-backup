import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, protectedProcedure, requirePermission } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import {
  lancamentoSalario,
  contaCusto,
  equipamentos,
  setores,
  periodoCusto,
} from "../drizzle/schema";

// IDs das contas de salário
const CONTA_SAL_ADM_ID = 1;       // Sal.Adm./Diretoria/Pró-Lab./Almox./Ofic./Serv./Aux./Encargos → setores
const CONTA_SAL_DIRETORIA_ID = 12; // Sal. Diretoria → setores
const CONTA_SAL_OPER_ID = 30004;   // Sal.Oper./Enc. Oper. → equipamentos

// Contas que alocam em setores
const CONTAS_SETOR = [CONTA_SAL_ADM_ID, CONTA_SAL_DIRETORIA_ID];
// Contas que alocam em equipamentos
const CONTAS_EQUIPAMENTO = [CONTA_SAL_OPER_ID];

export const salariosRouter = router({
  // Listar contas de salário disponíveis
  contasSalario: protectedProcedure
    .use(requirePermission("custos", "view"))
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({ id: contaCusto.id, nome: contaCusto.nome })
        .from(contaCusto)
        .where(
          eq(contaCusto.id, CONTA_SAL_ADM_ID)
        );
      // Buscar as 3 contas específicas
      const allContas = await db
        .select({ id: contaCusto.id, nome: contaCusto.nome })
        .from(contaCusto);
      const ids = [CONTA_SAL_ADM_ID, CONTA_SAL_DIRETORIA_ID, CONTA_SAL_OPER_ID];
      return allContas
        .filter(c => ids.includes(c.id))
        .map(c => ({
          id: c.id,
          nome: c.nome,
          tipoDestino: CONTAS_EQUIPAMENTO.includes(c.id) ? "equipamento" as const : "setor" as const,
        }));
    }),

  // Listar lançamentos de salário de um período
  listByPeriodo: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: lancamentoSalario.id,
          periodoCustoId: lancamentoSalario.periodoCustoId,
          contaCustoId: lancamentoSalario.contaCustoId,
          contaNome: contaCusto.nome,
          valor: lancamentoSalario.valor,
          equipamentoId: lancamentoSalario.equipamentoId,
          setorId: lancamentoSalario.setorId,
          descricao: lancamentoSalario.descricao,
          observacoes: lancamentoSalario.observacoes,
          createdAt: lancamentoSalario.createdAt,
        })
        .from(lancamentoSalario)
        .innerJoin(contaCusto, eq(lancamentoSalario.contaCustoId, contaCusto.id))
        .where(eq(lancamentoSalario.periodoCustoId, input.periodoCustoId))
        .orderBy(desc(lancamentoSalario.valor));
      return rows;
    }),

  // Criar lançamento de salário
  create: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(z.object({
      periodoCustoId: z.number(),
      contaCustoId: z.number(),
      valor: z.string(),
      equipamentoId: z.number().optional(),
      setorId: z.number().optional(),
      descricao: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verificar se o período está fechado
      const [periodo] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, input.periodoCustoId))
        .limit(1);
      if (!periodo) throw new TRPCError({ code: "NOT_FOUND", message: "Período não encontrado" });
      if (periodo.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado. Não é possível lançar salários." });
      }

      // Validar destino conforme a conta
      if (CONTAS_EQUIPAMENTO.includes(input.contaCustoId)) {
        if (!input.equipamentoId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Para esta conta, é obrigatório selecionar um equipamento." });
        }
      } else if (CONTAS_SETOR.includes(input.contaCustoId)) {
        if (!input.setorId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Para esta conta, é obrigatório selecionar um setor." });
        }
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conta de salário inválida." });
      }

      const result = await db.insert(lancamentoSalario).values({
        periodoCustoId: input.periodoCustoId,
        contaCustoId: input.contaCustoId,
        valor: input.valor,
        equipamentoId: input.equipamentoId ?? null,
        setorId: input.setorId ?? null,
        descricao: input.descricao ?? null,
        observacoes: input.observacoes ?? null,
        userId: ctx.user.id,
      });

      return { id: Number(result[0].insertId), success: true };
    }),

  // Atualizar lançamento de salário
  update: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(z.object({
      id: z.number(),
      valor: z.string(),
      equipamentoId: z.number().optional(),
      setorId: z.number().optional(),
      descricao: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select()
        .from(lancamentoSalario)
        .where(eq(lancamentoSalario.id, input.id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });

      // Verificar se o período está fechado
      const [periodo] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, existing.periodoCustoId))
        .limit(1);
      if (periodo?.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado." });
      }

      await db.update(lancamentoSalario).set({
        valor: input.valor,
        equipamentoId: input.equipamentoId ?? existing.equipamentoId,
        setorId: input.setorId ?? existing.setorId,
        descricao: input.descricao ?? existing.descricao,
        observacoes: input.observacoes ?? existing.observacoes,
      }).where(eq(lancamentoSalario.id, input.id));

      return { success: true };
    }),

  // Excluir lançamento de salário
  delete: protectedProcedure
    .use(requirePermission("custos", "delete"))
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select()
        .from(lancamentoSalario)
        .where(eq(lancamentoSalario.id, input.id))
        .limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });

      // Verificar se o período está fechado
      const [periodo] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, existing.periodoCustoId))
        .limit(1);
      if (periodo?.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado." });
      }

      await db.delete(lancamentoSalario).where(eq(lancamentoSalario.id, input.id));
      return { success: true };
    }),

  // Detalhe de salários por destino (equipamento ou setor) para drill-down analítico
  detalhePorDestino: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({
      periodoCustoId: z.number(),
      contaCustoId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: lancamentoSalario.id,
          valor: lancamentoSalario.valor,
          equipamentoId: lancamentoSalario.equipamentoId,
          setorId: lancamentoSalario.setorId,
          descricao: lancamentoSalario.descricao,
          observacoes: lancamentoSalario.observacoes,
        })
        .from(lancamentoSalario)
        .where(
          and(
            eq(lancamentoSalario.periodoCustoId, input.periodoCustoId),
            eq(lancamentoSalario.contaCustoId, input.contaCustoId)
          )
        )
        .orderBy(desc(lancamentoSalario.valor));

      // Enriquecer com nomes de equipamento/setor
      if (rows.length === 0) return [];

      const equipIds = rows.filter(r => r.equipamentoId).map(r => r.equipamentoId!);
      const setorIds = rows.filter(r => r.setorId).map(r => r.setorId!);

      let equipMap = new Map<number, string>();
      let setorMap = new Map<number, string>();

      if (equipIds.length > 0) {
        const equips = await db.select({ id: equipamentos.id, codigoTag: equipamentos.codigoTag, nome: equipamentos.nomeDoEquipamento }).from(equipamentos);
        for (const e of equips) {
          equipMap.set(e.id, `${e.codigoTag} - ${e.nome}`);
        }
      }
      if (setorIds.length > 0) {
        const secs = await db.select({ id: setores.id, nome: setores.nome }).from(setores);
        for (const s of secs) {
          setorMap.set(s.id, s.nome ?? `Setor ${s.id}`);
        }
      }

      return rows.map(r => ({
        id: r.id,
        valor: parseFloat(String(r.valor ?? "0")),
        destino: r.equipamentoId
          ? equipMap.get(r.equipamentoId) ?? `Equip. #${r.equipamentoId}`
          : r.setorId
            ? setorMap.get(r.setorId) ?? `Setor #${r.setorId}`
            : "Sem destino",
        tipoDestino: r.equipamentoId ? "equipamento" as const : "setor" as const,
        descricao: r.descricao,
        observacoes: r.observacoes,
      }));
    }),

  // Resumo de salários por período (total por conta)
  resumoPorPeriodo: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { totalSalOper: 0, totalSalAdm: 0, totalSalDiretoria: 0, total: 0 };
      const rows = await db
        .select({
          contaCustoId: lancamentoSalario.contaCustoId,
          valor: lancamentoSalario.valor,
        })
        .from(lancamentoSalario)
        .where(eq(lancamentoSalario.periodoCustoId, input.periodoCustoId));

      let totalSalOper = 0, totalSalAdm = 0, totalSalDiretoria = 0;
      for (const r of rows) {
        const v = Number(r.valor) || 0;
        if (r.contaCustoId === CONTA_SAL_OPER_ID) totalSalOper += v;
        else if (r.contaCustoId === CONTA_SAL_ADM_ID) totalSalAdm += v;
        else if (r.contaCustoId === CONTA_SAL_DIRETORIA_ID) totalSalDiretoria += v;
      }
      return { totalSalOper, totalSalAdm, totalSalDiretoria, total: totalSalOper + totalSalAdm + totalSalDiretoria };
    }),
});
