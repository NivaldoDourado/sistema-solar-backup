import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { contaExcluidaFluxo } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const contaExcluidaRouter = router({
  /**
   * Lista todas as contas excluídas do Fluxo Realizado
   */
  listar: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const contas = await db
      .select()
      .from(contaExcluidaFluxo)
      .orderBy(contaExcluidaFluxo.codigo);
    return contas;
  }),

  /**
   * Adiciona uma conta à lista de exclusão
   */
  adicionar: protectedProcedure
    .input(z.object({
      codigo: z.string().min(1, "Código é obrigatório"),
      nome: z.string().min(1, "Nome é obrigatório"),
      motivo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }: { input: { codigo: string; nome: string; motivo?: string }; ctx: { user: { id: number } } }) => {
      const db = (await getDb())!;

      // Verificar se já existe
      const existente = await db
        .select()
        .from(contaExcluidaFluxo)
        .where(eq(contaExcluidaFluxo.codigo, input.codigo))
        .limit(1);

      if (existente.length > 0) {
        return { success: false, message: `Conta ${input.codigo} já está na lista de exclusão.` };
      }

      await db.insert(contaExcluidaFluxo).values({
        codigo: input.codigo,
        nome: input.nome,
        motivo: input.motivo || null,
        userId: ctx.user.id,
      });

      return { success: true, message: `Conta ${input.codigo}-${input.nome} adicionada à lista de exclusão.` };
    }),

  /**
   * Remove uma conta da lista de exclusão (volta a ser importada)
   */
  remover: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }: { input: { id: number } }) => {
      const db = (await getDb())!;
      await db.delete(contaExcluidaFluxo).where(eq(contaExcluidaFluxo.id, input.id));
      return { success: true };
    }),

  /**
   * Retorna apenas os códigos das contas excluídas (para uso na importação)
   */
  listarCodigos: protectedProcedure.query(async () => {
    const db = (await getDb())!;
    const contas = await db
      .select({ codigo: contaExcluidaFluxo.codigo })
      .from(contaExcluidaFluxo);
    return contas.map((c: { codigo: string }) => c.codigo);
  }),
});
