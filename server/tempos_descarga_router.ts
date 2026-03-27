import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { temposDescarga, configuracoesSistema } from "../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return db;
}

export const temposDescargaRouter = router({
  // Listar tempos de descarga de um item da parte diária
  listByItem: protectedProcedure
    .input(z.object({ parteDiariaItemId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const result = await db
        .select()
        .from(temposDescarga)
        .where(eq(temposDescarga.parteDiariaItemId, input.parteDiariaItemId))
        .orderBy(asc(temposDescarga.numeroViagem));
      return result;
    }),

  // Listar todos os tempos de descarga de uma parte diária
  listByParteDiaria: protectedProcedure
    .input(z.object({ parteDiariaId: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const result = await db
        .select()
        .from(temposDescarga)
        .where(eq(temposDescarga.parteDiariaId, input.parteDiariaId))
        .orderBy(asc(temposDescarga.parteDiariaItemId), asc(temposDescarga.numeroViagem));
      return result;
    }),

  // Adicionar tempo de descarga
  create: protectedProcedure
    .input(z.object({
      parteDiariaItemId: z.number(),
      parteDiariaId: z.number(),
      numeroViagem: z.number(),
      horaInicio: z.string(),
      horaFinal: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      // Calcular tempo em minutos
      const tempoMinutos = calcularTempoMinutos(input.horaInicio, input.horaFinal);
      
      const result = await db.insert(temposDescarga).values({
        parteDiariaItemId: input.parteDiariaItemId,
        parteDiariaId: input.parteDiariaId,
        numeroViagem: input.numeroViagem,
        horaInicio: input.horaInicio,
        horaFinal: input.horaFinal,
        tempoMinutos,
      });
      return { id: result[0].insertId };
    }),

  // Salvar múltiplos tempos de descarga de uma vez (para o formulário)
  saveAll: protectedProcedure
    .input(z.object({
      parteDiariaItemId: z.number(),
      parteDiariaId: z.number(),
      tempos: z.array(z.object({
        numeroViagem: z.number(),
        horaInicio: z.string(),
        horaFinal: z.string(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      // Remover tempos existentes do item
      await db.delete(temposDescarga).where(
        eq(temposDescarga.parteDiariaItemId, input.parteDiariaItemId)
      );

      // Inserir novos tempos
      if (input.tempos.length > 0) {
        const values = input.tempos.map(t => ({
          parteDiariaItemId: input.parteDiariaItemId,
          parteDiariaId: input.parteDiariaId,
          numeroViagem: t.numeroViagem,
          horaInicio: t.horaInicio,
          horaFinal: t.horaFinal,
          tempoMinutos: calcularTempoMinutos(t.horaInicio, t.horaFinal),
        }));
        await db.insert(temposDescarga).values(values);
      }

      return { success: true };
    }),

  // Excluir tempo de descarga
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(temposDescarga).where(eq(temposDescarga.id, input.id));
      return { success: true };
    }),

  // Excluir todos os tempos de um item
  deleteAllByItem: protectedProcedure
    .input(z.object({ parteDiariaItemId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      await db.delete(temposDescarga).where(
        eq(temposDescarga.parteDiariaItemId, input.parteDiariaItemId)
      );
      return { success: true };
    }),
});

// Router de configurações do sistema
export const configuracoesRouter = router({
  // Obter valor de uma configuração
  get: protectedProcedure
    .input(z.object({ chave: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const result = await db
        .select()
        .from(configuracoesSistema)
        .where(eq(configuracoesSistema.chave, input.chave))
        .limit(1);
      return result[0] || null;
    }),

  // Listar todas as configurações
  list: protectedProcedure.query(async () => {
    const db = await requireDb();
    return db.select().from(configuracoesSistema);
  }),

  // Criar ou atualizar configuração (upsert)
  upsert: protectedProcedure
    .input(z.object({
      chave: z.string(),
      valor: z.string(),
      descricao: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const existing = await db
        .select()
        .from(configuracoesSistema)
        .where(eq(configuracoesSistema.chave, input.chave))
        .limit(1);

      if (existing.length > 0) {
        await db.update(configuracoesSistema)
          .set({ valor: input.valor, descricao: input.descricao })
          .where(eq(configuracoesSistema.chave, input.chave));
      } else {
        await db.insert(configuracoesSistema).values({
          chave: input.chave,
          valor: input.valor,
          descricao: input.descricao,
        });
      }
      return { success: true };
    }),
});

// Função auxiliar para calcular tempo em minutos entre dois horários HH:MM
function calcularTempoMinutos(horaInicio: string, horaFinal: string): number {
  const [hi, mi] = horaInicio.split(":").map(Number);
  const [hf, mf] = horaFinal.split(":").map(Number);
  const inicioMin = hi * 60 + mi;
  const finalMin = hf * 60 + mf;
  // Se final < inicio, assume que passou da meia-noite
  if (finalMin < inicioMin) {
    return (24 * 60 - inicioMin) + finalMin;
  }
  return finalMin - inicioMin;
}
