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
  reajusteSalario,
} from "../drizzle/schema";

// IDs das contas de salário
const CONTA_SAL_ADM_ID = 1;       // Sal.Adm./Almox./Ofic./Serv.Aux./Encargos → setores
const CONTA_SAL_DIRETORIA_ID = 12; // Sal. Diretoria/Pró-Labore → setores
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

  // ============================
  // REAJUSTE SALARIAL
  // ============================

  // Consultar reajuste de um período
  getReajuste: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({ periodoCustoId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db
        .select()
        .from(reajusteSalario)
        .where(eq(reajusteSalario.periodoCustoId, input.periodoCustoId))
        .limit(1);
      return row ?? null;
    }),

  // Definir/atualizar percentual de reajuste para um período
  setReajuste: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(z.object({
      periodoCustoId: z.number(),
      percentual: z.number().min(-100).max(500), // -100% a +500%
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verificar se já existe reajuste para este período
      const [existing] = await db
        .select()
        .from(reajusteSalario)
        .where(eq(reajusteSalario.periodoCustoId, input.periodoCustoId))
        .limit(1);

      if (existing) {
        // Atualizar
        await db.update(reajusteSalario).set({
          percentual: input.percentual.toFixed(2),
          observacoes: input.observacoes ?? existing.observacoes,
          aplicado: "nao", // Reset aplicado quando percentual muda
        }).where(eq(reajusteSalario.id, existing.id));
        return { id: existing.id, action: "updated" as const };
      } else {
        // Criar
        const result = await db.insert(reajusteSalario).values({
          periodoCustoId: input.periodoCustoId,
          percentual: input.percentual.toFixed(2),
          observacoes: input.observacoes ?? null,
          userId: ctx.user.id,
        });
        return { id: Number(result[0].insertId), action: "created" as const };
      }
    }),

  // Aplicar reajuste: gera lançamentos de salário para o período atual baseado no mês anterior
  aplicarReajuste: protectedProcedure
    .use(requirePermission("custos", "create"))
    .input(z.object({ periodoCustoId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Buscar o período atual
      const [periodoAtual] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, input.periodoCustoId))
        .limit(1);
      if (!periodoAtual) throw new TRPCError({ code: "NOT_FOUND", message: "Período não encontrado" });
      if (periodoAtual.fechado === "sim") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Período fechado." });
      }

      // Buscar o reajuste configurado
      const [reajuste] = await db
        .select()
        .from(reajusteSalario)
        .where(eq(reajusteSalario.periodoCustoId, input.periodoCustoId))
        .limit(1);
      if (!reajuste) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum percentual de reajuste configurado para este período." });

      const percentual = parseFloat(String(reajuste.percentual));

      // Encontrar o período anterior
      let mesAnterior = periodoAtual.mes - 1;
      let anoAnterior = periodoAtual.ano;
      if (mesAnterior === 0) {
        mesAnterior = 12;
        anoAnterior = anoAnterior - 1;
      }

      const [periodoAnterior] = await db
        .select()
        .from(periodoCusto)
        .where(and(
          eq(periodoCusto.mes, mesAnterior),
          eq(periodoCusto.ano, anoAnterior)
        ))
        .limit(1);
      if (!periodoAnterior) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Período anterior (${mesAnterior}/${anoAnterior}) não encontrado. É necessário ter salários lançados no mês anterior.` });
      }

      // Buscar salários de operadores do mês anterior (conta 30004 = Sal.Oper./Enc. Oper.)
      const salariosAnteriores = await db
        .select()
        .from(lancamentoSalario)
        .where(and(
          eq(lancamentoSalario.periodoCustoId, periodoAnterior.id),
          eq(lancamentoSalario.contaCustoId, CONTA_SAL_OPER_ID)
        ));

      if (salariosAnteriores.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Nenhum salário de operador encontrado no período ${mesAnterior}/${anoAnterior}.` });
      }

      // Excluir lançamentos de Sal.Oper. existentes no período atual (para evitar duplicatas)
      await db.delete(lancamentoSalario).where(and(
        eq(lancamentoSalario.periodoCustoId, input.periodoCustoId),
        eq(lancamentoSalario.contaCustoId, CONTA_SAL_OPER_ID)
      ));

      // Gerar novos lançamentos com o reajuste aplicado
      const fator = 1 + (percentual / 100);
      const novosLancamentos = salariosAnteriores.map(sal => ({
        periodoCustoId: input.periodoCustoId,
        contaCustoId: CONTA_SAL_OPER_ID,
        valor: (parseFloat(String(sal.valor)) * fator).toFixed(2),
        equipamentoId: sal.equipamentoId,
        setorId: null as number | null,
        descricao: sal.descricao ?? null,
        observacoes: `Reajuste de ${percentual >= 0 ? "+" : ""}${percentual}% sobre ${mesAnterior}/${anoAnterior}`,
        userId: ctx.user.id,
      }));

      // Inserir em batch
      for (const lancamento of novosLancamentos) {
        await db.insert(lancamentoSalario).values(lancamento);
      }

      // Marcar reajuste como aplicado
      await db.update(reajusteSalario).set({ aplicado: "sim" }).where(eq(reajusteSalario.id, reajuste.id));

      const totalAnterior = salariosAnteriores.reduce((sum, s) => sum + parseFloat(String(s.valor)), 0);
      const totalNovo = totalAnterior * fator;

      return {
        success: true,
        qtdLancamentos: novosLancamentos.length,
        totalAnterior,
        totalNovo,
        percentual,
      };
    }),

  // Preview do reajuste (sem aplicar)
  previewReajuste: protectedProcedure
    .use(requirePermission("custos", "view"))
    .input(z.object({
      periodoCustoId: z.number(),
      percentual: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], totalAnterior: 0, totalNovo: 0 };

      // Buscar o período atual
      const [periodoAtual] = await db
        .select()
        .from(periodoCusto)
        .where(eq(periodoCusto.id, input.periodoCustoId))
        .limit(1);
      if (!periodoAtual) return { items: [], totalAnterior: 0, totalNovo: 0 };

      // Encontrar o período anterior
      let mesAnterior = periodoAtual.mes - 1;
      let anoAnterior = periodoAtual.ano;
      if (mesAnterior === 0) {
        mesAnterior = 12;
        anoAnterior = anoAnterior - 1;
      }

      const [periodoAnterior] = await db
        .select()
        .from(periodoCusto)
        .where(and(
          eq(periodoCusto.mes, mesAnterior),
          eq(periodoCusto.ano, anoAnterior)
        ))
        .limit(1);
      if (!periodoAnterior) return { items: [], totalAnterior: 0, totalNovo: 0 };

      // Buscar salários de operadores do mês anterior
      const salariosAnteriores = await db
        .select({
          id: lancamentoSalario.id,
          valor: lancamentoSalario.valor,
          equipamentoId: lancamentoSalario.equipamentoId,
          descricao: lancamentoSalario.descricao,
        })
        .from(lancamentoSalario)
        .where(and(
          eq(lancamentoSalario.periodoCustoId, periodoAnterior.id),
          eq(lancamentoSalario.contaCustoId, CONTA_SAL_OPER_ID)
        ))
        .orderBy(desc(lancamentoSalario.valor));

      if (salariosAnteriores.length === 0) return { items: [], totalAnterior: 0, totalNovo: 0 };

      // Buscar nomes dos equipamentos
      const equips = await db.select({ id: equipamentos.id, codigoTag: equipamentos.codigoTag, nome: equipamentos.nomeDoEquipamento }).from(equipamentos);
      const equipMap = new Map(equips.map(e => [e.id, `${e.codigoTag} - ${e.nome}`]));

      const fator = 1 + (input.percentual / 100);
      const items = salariosAnteriores.map(sal => {
        const valorAnterior = parseFloat(String(sal.valor));
        const valorNovo = valorAnterior * fator;
        return {
          equipamentoId: sal.equipamentoId,
          equipamentoNome: sal.equipamentoId ? equipMap.get(sal.equipamentoId) ?? `Equip. #${sal.equipamentoId}` : "Sem equipamento",
          valorAnterior,
          valorNovo,
          diferenca: valorNovo - valorAnterior,
        };
      });

      const totalAnterior = items.reduce((sum, i) => sum + i.valorAnterior, 0);
      const totalNovo = items.reduce((sum, i) => sum + i.valorNovo, 0);

      return { items, totalAnterior, totalNovo, mesAnterior, anoAnterior };
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
