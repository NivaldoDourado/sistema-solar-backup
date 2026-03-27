import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, requirePermission } from "./_core/trpc";
import { usuariosRouter } from "./usuarios_router";
import { vendasRouter } from "./vendas_router";
import { permissoesRouter } from "./permissoes_router";
import { authLocalRouter } from "./auth_router";
import { temposDescargaRouter, configuracoesRouter } from "./tempos_descarga_router";
import { z } from "zod";
import { getDb } from "./db";
import {
  equipamentos,
  setores,
  servicos,
  produtos,
  combustiveis,
  unidades,
  gruposDeEquipamentos,
  setorDeCusto,
  contaCusto,
  tiposDeProdutos,
  operadoresMotoristas,
  parteDiaria,
  parteDiariaItens,
  abastecimento,
  producao,
  custos,
  paradasMecanicas,
  medicaoPilhas,
  notificacoes,
  configuracoes,
  destinatariosWhatsapp,
  pesagensEquipamentos,
  categoriasPecasDesgaste,
  pecasDesgaste,
  movimentacoesPecas,
  trocasPecasParteDiaria,
  temposDescarga as temposDescargaTable,
} from "../drizzle/schema";
import { eq, desc, asc, sql, and, gte, lte, count } from "drizzle-orm";

/** Converte Date (vindo do superjson) para string YYYY-MM-DD compatível com MySQL DATE */
function toDateStr(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().split('T')[0];
  return String(d).split('T')[0];
}

/** Extrai string YYYY-MM-DD de qualquer formato de data (Date object ou string) */
function extractDateStr(d: unknown): string {
  if (d instanceof Date) return d.toISOString().split('T')[0];
  const s = String(d);
  // Se já está no formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Se contém T (ISO format)
  if (s.includes('T')) return s.split('T')[0];
  // Tentar parsear como Date
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return s;
}

/** Retorna sql template para inserir data no formato YYYY-MM-DD */
function toDateSql(d: Date | string) {
  return sql`${toDateStr(d)}`;
}

/**
 * Busca a capacidade vigente de um equipamento em uma data específica.
 * Retorna a capacidade da pesagem com dataVigencia <= data informada (mais recente).
 * Se não houver pesagem, retorna a capacidade do próprio equipamento.
 */
async function getCapacidadeVigente(
  db: any,
  equipamentoId: number,
  data: string, // YYYY-MM-DD
  todasPesagens?: any[], // cache opcional
  equipamentosCache?: Map<number, any> // cache opcional
): Promise<number> {
  // Se temos cache de pesagens, usar
  const pesagens = todasPesagens
    ? todasPesagens.filter(p => p.equipamentoId === equipamentoId)
    : await db.select().from(pesagensEquipamentos).where(eq(pesagensEquipamentos.equipamentoId, equipamentoId)).orderBy(desc(pesagensEquipamentos.dataVigencia));
  
  // Encontrar a pesagem vigente na data
  const vigente = pesagens.find((p: any) => {
    const dv = extractDateStr(p.dataVigencia);
    return dv <= data;
  });
  
  if (vigente) {
    return parseFloat(vigente.capacidade) || 0;
  }
  
  // Fallback: usar capacidade do equipamento
  if (equipamentosCache) {
    const equip = equipamentosCache.get(equipamentoId);
    return equip?.capacidade ? parseFloat(equip.capacidade) : 0;
  }
  
  const equip = await db.select().from(equipamentos).where(eq(equipamentos.id, equipamentoId)).limit(1);
  return equip[0]?.capacidade ? parseFloat(equip[0].capacidade) : 0;
}

/** Converte string vazia ou "0" para null (para campos decimal opcionais do MySQL) */
function emptyToNull(val: string | undefined | null): string | null {
  if (val === undefined || val === null || val === '' || val.trim() === '') return null;
  return val;
}

export const appRouter = router({
  system: systemRouter,
  temposDescarga: temposDescargaRouter,
  configSistema: configuracoesRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============================================================================
  // CADASTROS BÁSICOS
  // ============================================================================

  equipamentos: router({
    list: protectedProcedure
      .use(requirePermission("equipamentos", "view"))
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const result = await db
          .select({
            id: equipamentos.id,
            codigoTag: equipamentos.codigoTag,
            nomeDoEquipamento: equipamentos.nomeDoEquipamento,
            modelo: equipamentos.modelo,
            ano: equipamentos.ano,
            serie: equipamentos.serie,
            capacidade: equipamentos.capacidade,
            hrAcumulado: equipamentos.hrAcumulado,
            kmAcumulado: equipamentos.kmAcumulado,
            siglaUnidadeId: equipamentos.siglaUnidadeId,
            grupoId: equipamentos.grupoId,
            setorId: equipamentos.setorId,
            ativo: equipamentos.ativo,
            grupoNome: gruposDeEquipamentos.nome,
          })
          .from(equipamentos)
          .leftJoin(gruposDeEquipamentos, eq(equipamentos.grupoId, gruposDeEquipamentos.id))
          .orderBy(asc(equipamentos.nomeDoEquipamento));
        return result;
      }),
    
    create: protectedProcedure
      .use(requirePermission("equipamentos", "create"))
      .input(z.object({
        codigoTag: z.string().optional(),
        nomeDoEquipamento: z.string().min(1),
        modelo: z.string().optional(),
        ano: z.string().optional(),
        serie: z.string().optional(),
        capacidade: z.string().optional(),
        hrAcumulado: z.string().optional(),
        kmAcumulado: z.string().optional(),
        siglaUnidadeId: z.number().optional(),
        grupoId: z.number().optional(),
        setorId: z.number().optional(),
        ativo: z.enum(["sim", "nao"]).default("sim"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(equipamentos).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("equipamentos", "edit"))
      .input(z.object({
        id: z.number(),
        codigoTag: z.string().optional(),
        nomeDoEquipamento: z.string().min(1),
        modelo: z.string().optional(),
        ano: z.string().optional(),
        serie: z.string().optional(),
        capacidade: z.string().optional(),
        hrAcumulado: z.string().optional(),
        kmAcumulado: z.string().optional(),
        siglaUnidadeId: z.number().optional(),
        grupoId: z.number().optional(),
        setorId: z.number().optional(),
        ativo: z.enum(["sim", "nao"]).default("sim"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(equipamentos).set(data).where(eq(equipamentos.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("equipamentos", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(equipamentos).where(eq(equipamentos.id, input.id));
        return { success: true };
      }),
  }),

  setores: router({
    list: protectedProcedure

      .use(requirePermission("setores", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(setores).orderBy(asc(setores.nome));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("setores", "create"))
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(setores).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("setores", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(setores).set(data).where(eq(setores.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("setores", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(setores).where(eq(setores.id, input.id));
        return { success: true };
      }),
  }),

  servicos: router({
    list: protectedProcedure

      .use(requirePermission("servicos", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(servicos).orderBy(asc(servicos.nome));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("servicos", "create"))
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(servicos).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("servicos", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(servicos).set(data).where(eq(servicos.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("servicos", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(servicos).where(eq(servicos.id, input.id));
        return { success: true };
      }),
  }),

  produtos: router({
    list: protectedProcedure

      .use(requirePermission("produtos", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(produtos).orderBy(asc(produtos.nome));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("produtos", "create"))
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
        unidadeId: z.number().optional(),
        tipoId: z.number().optional(),
        densidade: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(produtos).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("produtos", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
        densidade: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(produtos).set(data).where(eq(produtos.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("produtos", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(produtos).where(eq(produtos.id, input.id));
        return { success: true };
      }),
  }),

  combustiveis: router({
    list: protectedProcedure

      .use(requirePermission("combustiveis", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(combustiveis).orderBy(asc(combustiveis.nome));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("combustiveis", "create"))
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
        unidadeId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(combustiveis).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("combustiveis", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(combustiveis).set(data).where(eq(combustiveis.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("combustiveis", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(combustiveis).where(eq(combustiveis.id, input.id));
        return { success: true };
      }),
  }),

  unidades: router({
    list: protectedProcedure

      .use(requirePermission("unidades", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(unidades).orderBy(asc(unidades.sigla));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("unidades", "create"))
      .input(z.object({
        sigla: z.string().min(1).max(10),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(unidades).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("unidades", "edit"))
      .input(z.object({
        id: z.number(),
        sigla: z.string().min(1).max(10),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(unidades).set(data).where(eq(unidades.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("unidades", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(unidades).where(eq(unidades.id, input.id));
        return { success: true };
      }),
  }),

  gruposDeEquipamentos: router({
    list: protectedProcedure

      .use(requirePermission("gruposEquipamentos", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(gruposDeEquipamentos).orderBy(asc(gruposDeEquipamentos.nome));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("gruposEquipamentos", "create"))
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(gruposDeEquipamentos).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("gruposEquipamentos", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(gruposDeEquipamentos).set(data).where(eq(gruposDeEquipamentos.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("gruposEquipamentos", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(gruposDeEquipamentos).where(eq(gruposDeEquipamentos.id, input.id));
        return { success: true };
      }),
  }),

  setoresDeCusto: router({
    list: protectedProcedure

      .use(requirePermission("setorDeCusto", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(setorDeCusto).orderBy(asc(setorDeCusto.nome));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("setorDeCusto", "create"))
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(setorDeCusto).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("setorDeCusto", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(setorDeCusto).set(data).where(eq(setorDeCusto.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("setorDeCusto", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(setorDeCusto).where(eq(setorDeCusto.id, input.id));
        return { success: true };
      }),
  }),

  contasCusto: router({
    list: protectedProcedure
      .use(requirePermission("contaCusto", "view"))
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(contaCusto).orderBy(asc(contaCusto.nome));
      }),

    create: protectedProcedure
      .use(requirePermission("contaCusto", "create"))
      .input(z.object({
        nome: z.string().min(1),
        observacao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.insert(contaCusto).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),

    update: protectedProcedure
      .use(requirePermission("contaCusto", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        observacao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const { id, ...data } = input;
        await db.update(contaCusto).set(data).where(eq(contaCusto.id, id));
        return input;
      }),

    delete: protectedProcedure
      .use(requirePermission("contaCusto", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(contaCusto).where(eq(contaCusto.id, input.id));
        return { success: true };
      }),
  }),

  operadoresMotoristas: router({
    list: protectedProcedure
      .use(requirePermission("operadoresMotoristas", "view"))
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        return await db.select().from(operadoresMotoristas).orderBy(asc(operadoresMotoristas.nome));
      }),
    
    create: protectedProcedure
      .use(requirePermission("operadoresMotoristas", "create"))
      .input(z.object({
        nome: z.string().min(1),
        funcao: z.enum(["operador", "motorista", "ambos"]).default("ambos"),
        matricula: z.string().optional(),
        telefone: z.string().optional(),
        ativo: z.enum(["sim", "nao"]).default("sim"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(operadoresMotoristas).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("operadoresMotoristas", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        funcao: z.enum(["operador", "motorista", "ambos"]).default("ambos"),
        matricula: z.string().optional(),
        telefone: z.string().optional(),
        ativo: z.enum(["sim", "nao"]).default("sim"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(operadoresMotoristas).set(data).where(eq(operadoresMotoristas.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("operadoresMotoristas", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(operadoresMotoristas).where(eq(operadoresMotoristas.id, input.id));
        return { success: true };
      }),
  }),

  tiposDeProdutos: router({
    list: protectedProcedure

      .use(requirePermission("tiposProdutos", "view")).query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(tiposDeProdutos).orderBy(asc(tiposDeProdutos.nome));
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("tiposProdutos", "create"))
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(tiposDeProdutos).values(input);
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("tiposProdutos", "edit"))
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        descricao: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, ...data } = input;
        await db.update(tiposDeProdutos).set(data).where(eq(tiposDeProdutos.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("tiposProdutos", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(tiposDeProdutos).where(eq(tiposDeProdutos.id, input.id));
        return { success: true };
      }),
  }),

  // ============================================================================
  // MÓDULOS OPERACIONAIS
  // ============================================================================

    parteDiaria: router({
    list: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        
        // Buscar partes diárias com seus itens
        const partes = await db.select().from(parteDiaria).orderBy(desc(parteDiaria.data));
        
        // Para cada parte diária, buscar seus itens
        const partesComItens = await Promise.all(
          partes.map(async (parte) => {
            const itens = await db
              .select()
              .from(parteDiariaItens)
              .where(eq(parteDiariaItens.parteDiariaId, parte.id));
            
            return {
              ...parte,
              itens,
            };
          })
        );
        
        return partesComItens;
      }),
    
    create: protectedProcedure
      .use(requirePermission("parteDiaria", "create"))
      .input(z.object({
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number(),
        turno: z.string().optional(),
        // Campos de Hora/Km (renomeados de horímetro)
        horaKmInicial: z.string().optional(),
        horaKmFinal: z.string().optional(),
        horaKmTrabalhados: z.string().optional(),
        // Campos de tempo
        tempoParadoLigado: z.string().optional(),
        tempoParadoDesligado: z.string().optional(),
        tempoProdutivo: z.string().optional(),
        // Campos de produção
        producaoLivre: z.string().optional(),
        qtdFuros: z.string().optional(),
        profundidadeFuros: z.string().optional(),
        producaoPerfuracao: z.string().optional(),
        // Campos de Produção Balança
        leituraInicialBalanca: z.string().optional(),
        leituraFinalBalanca: z.string().optional(),
        producaoBalanca: z.string().optional(),
        observacoes: z.string().optional(),
        itens: z.array(z.object({
          setorId: z.number(),
          servicoId: z.number(),
          quantidade: z.string(),
          operadorMotoristaId: z.number().optional(),
        })),
        trocasPecas: z.array(z.object({
          pecaId: z.number(),
          quantidade: z.number().default(1),
          custoUnitario: z.string().optional(),
          observacoes: z.string().optional(),
        })).optional(),
        temposDescarga: z.array(z.object({
          numeroViagem: z.number(),
          horaInicio: z.string(),
          horaFinal: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Converter Date para string YYYY-MM-DD para o campo date do MySQL
        const dataStr = toDateStr(input.data);
        
        // Buscar capacidade vigente do equipamento na data do registro
        const capacidade = await getCapacidadeVigente(db, input.equipamentoId, dataStr);
        
        // Cálculos automáticos
        const horaKmInicial = input.horaKmInicial ? parseFloat(input.horaKmInicial) : 0;
        const horaKmFinal = input.horaKmFinal ? parseFloat(input.horaKmFinal) : 0;
        const horaKmTrabalhados = horaKmFinal > horaKmInicial ? (horaKmFinal - horaKmInicial).toString() : input.horaKmTrabalhados;
        
        const tempoParadoLigadoVal = input.tempoParadoLigado ? parseFloat(input.tempoParadoLigado) : 0;
        const horasTrab = horaKmTrabalhados ? parseFloat(horaKmTrabalhados) : 0;
        const tempoProdutivo = horasTrab > 0 && tempoParadoLigadoVal > 0 ? (horasTrab - tempoParadoLigadoVal).toFixed(2) : input.tempoProdutivo;
        
        const qtdFuros = input.qtdFuros ? parseFloat(input.qtdFuros) : 0;
        const profundidadeFuros = input.profundidadeFuros ? parseFloat(input.profundidadeFuros) : 0;
        const producaoPerfuracao = qtdFuros > 0 && profundidadeFuros > 0 ? (qtdFuros * profundidadeFuros).toString() : input.producaoPerfuracao;
        
        // Cálculo automático Produção Balança
        const leituraInicialBalanca = input.leituraInicialBalanca ? parseFloat(input.leituraInicialBalanca) : 0;
        const leituraFinalBalanca = input.leituraFinalBalanca ? parseFloat(input.leituraFinalBalanca) : 0;
        const producaoBalanca = leituraFinalBalanca > 0 && leituraInicialBalanca >= 0 ? (leituraFinalBalanca - leituraInicialBalanca).toString() : input.producaoBalanca;
        
        // Inserir cabeçalho da parte diária
        const result = await db.insert(parteDiaria).values({
          data: sql`${dataStr}`,
          equipamentoId: input.equipamentoId,
          turno: emptyToNull(input.turno),
          horaKmInicial: emptyToNull(input.horaKmInicial),
          horaKmFinal: emptyToNull(input.horaKmFinal),
          horaKmTrabalhados: emptyToNull(horaKmTrabalhados),
          tempoParadoLigado: emptyToNull(input.tempoParadoLigado),
          tempoParadoDesligado: emptyToNull(input.tempoParadoDesligado),
          tempoProdutivo: emptyToNull(tempoProdutivo),
          producaoLivre: emptyToNull(input.producaoLivre),
          qtdFuros: emptyToNull(input.qtdFuros),
          profundidadeFuros: emptyToNull(input.profundidadeFuros),
          producaoPerfuracao: emptyToNull(producaoPerfuracao),
          leituraInicialBalanca: emptyToNull(input.leituraInicialBalanca),
          leituraFinalBalanca: emptyToNull(input.leituraFinalBalanca),
          producaoBalanca: emptyToNull(producaoBalanca),
          observacoes: emptyToNull(input.observacoes),
          userId: ctx.user.id,
        });
        
        const parteDiariaId = Number(result[0].insertId);
        
        // Inserir itens da parte diária (usando capacidade vigente na data)
        if (input.itens.length > 0) {
          const itensParaInserir = input.itens.map(item => ({
            parteDiariaId,
            setorId: item.setorId,
            servicoId: item.servicoId,
            quantidade: item.quantidade,
            producao: (parseFloat(item.quantidade) * capacidade).toString(),
            operadorMotoristaId: item.operadorMotoristaId || null,
          }));
          
          await db.insert(parteDiariaItens).values(itensParaInserir);
        }
        
        // Inserir tempos de descarga (se houver)
        if (input.temposDescarga && input.temposDescarga.length > 0) {
          // Buscar os itens recém-inseridos para vincular os tempos
          const itensInseridos = await db.select().from(parteDiariaItens).where(eq(parteDiariaItens.parteDiariaId, parteDiariaId));
          // Vincular tempos ao primeiro item (caminhão = equipamento principal)
          if (itensInseridos.length > 0) {
            const primeiroItemId = itensInseridos[0].id;
            const temposParaInserir = input.temposDescarga.map(t => {
              const [hi, mi] = t.horaInicio.split(':').map(Number);
              const [hf, mf] = t.horaFinal.split(':').map(Number);
              let inicioMin = hi * 60 + mi;
              let finalMin = hf * 60 + mf;
              if (finalMin < inicioMin) finalMin += 24 * 60;
              const tempoMinutos = finalMin - inicioMin;
              const h = Math.floor(tempoMinutos / 60);
              const m = tempoMinutos % 60;
              const tempoStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
              return {
                parteDiariaId,
                parteDiariaItemId: primeiroItemId,
                numeroViagem: t.numeroViagem,
                horaInicio: t.horaInicio,
                horaFinal: t.horaFinal,
                tempo: tempoStr,
                tempoMinutos,
              };
            });
            await db.insert(temposDescargaTable).values(temposParaInserir);
          }
        }
        
        // Inserir trocas de peças de desgaste (se houver)
        if (input.trocasPecas && input.trocasPecas.length > 0) {
          for (const troca of input.trocasPecas) {
            const custoUnit = troca.custoUnitario ? parseFloat(troca.custoUnitario) : 0;
            const custoTotal = custoUnit * troca.quantidade;
            
            // Criar movimentação automática no módulo de Peças de Desgaste
            const [mov] = await db.insert(movimentacoesPecas).values({
              data: sql`${dataStr}`,
              pecaId: troca.pecaId,
              tipo: 'troca',
              quantidade: troca.quantidade,
              equipamentoId: input.equipamentoId,
              valorUnitario: troca.custoUnitario || null,
              valorTotal: custoTotal > 0 ? String(custoTotal.toFixed(2)) : null,
              observacoes: troca.observacoes || `Troca registrada via Parte Diária #${parteDiariaId}`,
              userId: ctx.user.id,
            }).$returningId();
            
            // Criar registro de troca vinculada
            await db.insert(trocasPecasParteDiaria).values({
              parteDiariaId,
              pecaId: troca.pecaId,
              quantidade: troca.quantidade,
              custoUnitario: troca.custoUnitario || null,
              custoTotal: custoTotal > 0 ? String(custoTotal.toFixed(2)) : null,
              observacoes: troca.observacoes || null,
              movimentacaoId: mov.id,
            });
          }
        }
        
        return { success: true, id: parteDiariaId };
      }),
    
    update: protectedProcedure
      .use(requirePermission("parteDiaria", "edit"))
      .input(z.object({
        id: z.number(),
        data: z.string().optional(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number().optional(),
        turno: z.string().optional(),
        // Campos de Hora/Km (renomeados de horímetro)
        horaKmInicial: z.string().optional(),
        horaKmFinal: z.string().optional(),
        horaKmTrabalhados: z.string().optional(),
        // Campos de tempo
        tempoParadoLigado: z.string().optional(),
        tempoParadoDesligado: z.string().optional(),
        tempoProdutivo: z.string().optional(),
        // Campos de produção
        producaoLivre: z.string().optional(),
        qtdFuros: z.string().optional(),
        profundidadeFuros: z.string().optional(),
        producaoPerfuracao: z.string().optional(),
        // Campos de Produção Balança
        leituraInicialBalanca: z.string().optional(),
        leituraFinalBalanca: z.string().optional(),
        producaoBalanca: z.string().optional(),
        observacoes: z.string().optional(),
        itens: z.array(z.object({
          setorId: z.number(),
          servicoId: z.number(),
          quantidade: z.string(),
          operadorMotoristaId: z.number().optional(),
        })).optional(),
        temposDescarga: z.array(z.object({
          numeroViagem: z.number(),
          horaInicio: z.string(),
          horaFinal: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Cálculos automáticos
        const horaKmInicial = input.horaKmInicial ? parseFloat(input.horaKmInicial) : 0;
        const horaKmFinal = input.horaKmFinal ? parseFloat(input.horaKmFinal) : 0;
        const horaKmTrabalhados = horaKmFinal > horaKmInicial ? (horaKmFinal - horaKmInicial).toString() : input.horaKmTrabalhados;
        
        const tempoParadoLigadoVal = input.tempoParadoLigado ? parseFloat(input.tempoParadoLigado) : 0;
        const horasTrab = horaKmTrabalhados ? parseFloat(horaKmTrabalhados) : 0;
        const tempoProdutivo = horasTrab > 0 && tempoParadoLigadoVal > 0 ? (horasTrab - tempoParadoLigadoVal).toFixed(2) : input.tempoProdutivo;
        
        const qtdFuros = input.qtdFuros ? parseFloat(input.qtdFuros) : 0;
        const profundidadeFuros = input.profundidadeFuros ? parseFloat(input.profundidadeFuros) : 0;
        const producaoPerfuracao = qtdFuros > 0 && profundidadeFuros > 0 ? (qtdFuros * profundidadeFuros).toString() : input.producaoPerfuracao;
        
        // Cálculo automático Produção Balança
        const leituraInicialBalanca = input.leituraInicialBalanca ? parseFloat(input.leituraInicialBalanca) : 0;
        const leituraFinalBalanca = input.leituraFinalBalanca ? parseFloat(input.leituraFinalBalanca) : 0;
        const producaoBalanca = leituraFinalBalanca > 0 && leituraInicialBalanca >= 0 ? (leituraFinalBalanca - leituraInicialBalanca).toString() : input.producaoBalanca;
        
        // Atualizar cabeçalho
        const { id, itens, equipamentoId, data: inputData, temposDescarga, ...updateData } = input;
        
        // Converter Date para formato compatível se fornecida
        const dataStrUpdate = inputData ? toDateStr(inputData) : undefined;
        
        // Adicionar campos calculados - converter strings vazias em null para campos decimais
        const dataToUpdate = {
          ...updateData,
          ...(dataStrUpdate ? { data: sql`${dataStrUpdate}` } : {}),
          turno: emptyToNull(updateData.turno),
          horaKmInicial: emptyToNull(updateData.horaKmInicial),
          horaKmFinal: emptyToNull(updateData.horaKmFinal),
          horaKmTrabalhados: emptyToNull(horaKmTrabalhados),
          tempoParadoLigado: emptyToNull(updateData.tempoParadoLigado),
          tempoParadoDesligado: emptyToNull(updateData.tempoParadoDesligado),
          tempoProdutivo: emptyToNull(tempoProdutivo),
          producaoLivre: emptyToNull(updateData.producaoLivre),
          qtdFuros: emptyToNull(updateData.qtdFuros),
          profundidadeFuros: emptyToNull(updateData.profundidadeFuros),
          producaoPerfuracao: emptyToNull(producaoPerfuracao),
          leituraInicialBalanca: emptyToNull(updateData.leituraInicialBalanca),
          leituraFinalBalanca: emptyToNull(updateData.leituraFinalBalanca),
          producaoBalanca: emptyToNull(producaoBalanca),
          observacoes: emptyToNull(updateData.observacoes),
        };
        
        await db
          .update(parteDiaria)
          .set(dataToUpdate)
          .where(eq(parteDiaria.id, id));
        
        // Se itens foram fornecidos, atualizar
        if (itens && equipamentoId) {
          // Buscar a data da parte diária para determinar a capacidade vigente
          const pdRecord = await db.select({ data: parteDiaria.data }).from(parteDiaria).where(eq(parteDiaria.id, id)).limit(1);
          const pdDataStr = dataStrUpdate || (pdRecord[0] ? extractDateStr(pdRecord[0].data) : new Date().toISOString().split('T')[0]);
          
          // Buscar capacidade vigente na data do registro
          const capacidade = await getCapacidadeVigente(db, equipamentoId, pdDataStr);
          
          // Deletar itens antigos
          await db.delete(parteDiariaItens).where(eq(parteDiariaItens.parteDiariaId, id));
          
          // Inserir novos itens (usando capacidade vigente na data)
          if (itens.length > 0) {
            const itensParaInserir = itens.map(item => ({
              parteDiariaId: id,
              setorId: item.setorId,
              servicoId: item.servicoId,
              quantidade: item.quantidade,
              producao: (parseFloat(item.quantidade) * capacidade).toString(),
              operadorMotoristaId: item.operadorMotoristaId || null,
            }));
            
            await db.insert(parteDiariaItens).values(itensParaInserir);
          }
        }
        
        // Tempos de descarga
        if (temposDescarga) {
          // Deletar tempos antigos
          await db.delete(temposDescargaTable).where(eq(temposDescargaTable.parteDiariaId, id));
          
          // Inserir novos tempos
          if (temposDescarga.length > 0) {
            // Buscar o primeiro item da parte diária para vincular
            const itensExistentes = await db.select().from(parteDiariaItens).where(eq(parteDiariaItens.parteDiariaId, id));
            const primeiroItemId = itensExistentes.length > 0 ? itensExistentes[0].id : 0;
            
            if (primeiroItemId > 0) {
              const temposParaInserir = temposDescarga.map(tempo => {
                const [hi, mi] = tempo.horaInicio.split(':').map(Number);
                const [hf, mf] = tempo.horaFinal.split(':').map(Number);
                let inicioMin = hi * 60 + mi;
                let finalMin = hf * 60 + mf;
                if (finalMin < inicioMin) finalMin += 24 * 60;
                const tempoMinutos = finalMin - inicioMin;
                return {
                  parteDiariaItemId: primeiroItemId,
                  parteDiariaId: id,
                  numeroViagem: tempo.numeroViagem,
                  horaInicio: tempo.horaInicio,
                  horaFinal: tempo.horaFinal,
                  tempoMinutos,
                };
              });
              await db.insert(temposDescargaTable).values(temposParaInserir);
            }
          }
        }
        
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("parteDiaria", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Deletar itens primeiro
        await db.delete(parteDiariaItens).where(eq(parteDiariaItens.parteDiariaId, input.id));
        
        // Deletar cabeçalho
        await db.delete(parteDiaria).where(eq(parteDiaria.id, input.id));
        
        return { success: true };
      }),
    
    // Agregação de produção por Setor
    producaoPorSetor: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        // Buscar todos os itens com seus relacionamentos
        const itens = await db
          .select({
            setorId: parteDiariaItens.setorId,
            producao: parteDiariaItens.producao,
            data: parteDiaria.data,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));
        
        // Filtrar por data se especificado
        let itensFiltrados = itens;
        if (input?.dataInicio || input?.dataFim) {
          itensFiltrados = itens.filter(item => {
            const itemDateStr = extractDateStr(item.data);
            if (input?.dataInicio && itemDateStr < input.dataInicio) return false;
            if (input?.dataFim && itemDateStr > input.dataFim) return false;
            return true;
          });
        }
        
        // Agrupar por setor
        const porSetor = new Map<number, number>();
        itensFiltrados.forEach(item => {
          const atual = porSetor.get(item.setorId) || 0;
          porSetor.set(item.setorId, atual + parseFloat(item.producao || '0'));
        });
        
        // Buscar nomes dos setores
        const setoresData = await db.select().from(setores);
        const setoresMap = new Map(setoresData.map(s => [s.id, s.nome]));
        
        return Array.from(porSetor.entries()).map(([setorId, producaoTotal]) => ({
          setorId,
          setorNome: setoresMap.get(setorId) || 'Desconhecido',
          producaoTotal,
        })).sort((a, b) => b.producaoTotal - a.producaoTotal);
      }),
    
    // Agregação de produção por Serviço
    producaoPorServico: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        // Buscar todos os itens com seus relacionamentos
        const itens = await db
          .select({
            servicoId: parteDiariaItens.servicoId,
            producao: parteDiariaItens.producao,
            data: parteDiaria.data,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));
        
        // Filtrar por data se especificado
        let itensFiltrados = itens;
        if (input?.dataInicio || input?.dataFim) {
          itensFiltrados = itens.filter(item => {
            const itemDateStr = extractDateStr(item.data);
            if (input?.dataInicio && itemDateStr < input.dataInicio) return false;
            if (input?.dataFim && itemDateStr > input.dataFim) return false;
            return true;
          });
        }
        
        // Agrupar por serviço
        const porServico = new Map<number, number>();
        itensFiltrados.forEach(item => {
          const atual = porServico.get(item.servicoId) || 0;
          porServico.set(item.servicoId, atual + parseFloat(item.producao || '0'));
        });
        
        // Buscar nomes dos serviços
        const servicosData = await db.select().from(servicos);
        const servicosMap = new Map(servicosData.map(s => [s.id, s.nome]));
        
        return Array.from(porServico.entries()).map(([servicoId, producaoTotal]) => ({
          servicoId,
          servicoNome: servicosMap.get(servicoId) || 'Desconhecido',
          producaoTotal,
        })).sort((a, b) => b.producaoTotal - a.producaoTotal);
      }),
    
    // Agregação de produção por Equipamento
    producaoPorEquipamento: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        // Buscar todos os itens com seus relacionamentos
        const itens = await db
          .select({
            equipamentoId: parteDiaria.equipamentoId,
            producao: parteDiariaItens.producao,
            data: parteDiaria.data,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));
        
        // Filtrar por data se especificado
        let itensFiltrados = itens;
        if (input?.dataInicio || input?.dataFim) {
          itensFiltrados = itens.filter(item => {
            const itemDateStr = extractDateStr(item.data);
            if (input?.dataInicio && itemDateStr < input.dataInicio) return false;
            if (input?.dataFim && itemDateStr > input.dataFim) return false;
            return true;
          });
        }
        
        // Agrupar por equipamento
        const porEquipamento = new Map<number, number>();
        itensFiltrados.forEach(item => {
          const atual = porEquipamento.get(item.equipamentoId) || 0;
          porEquipamento.set(item.equipamentoId, atual + parseFloat(item.producao || '0'));
        });
        
        // Buscar dados dos equipamentos
        const equipamentosData = await db.select().from(equipamentos);
        const equipamentosMap = new Map(equipamentosData.map(e => [e.id, { 
          nome: e.nomeDoEquipamento, 
          tag: e.codigoTag,
          capacidade: e.capacidade
        }]));
        
        return Array.from(porEquipamento.entries()).map(([equipamentoId, producaoTotal]) => {
          const eq = equipamentosMap.get(equipamentoId);
          return {
            equipamentoId,
            equipamentoNome: eq?.nome || 'Desconhecido',
            equipamentoTag: eq?.tag || '',
            capacidade: eq?.capacidade || '0',
            producaoTotal,
          };
        }).sort((a, b) => b.producaoTotal - a.producaoTotal);
      }),
    
    // Produção total geral
    producaoTotal: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { total: 0 };
        
        // Buscar todos os itens com seus relacionamentos
        const itens = await db
          .select({
            producao: parteDiariaItens.producao,
            data: parteDiaria.data,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));
        
        // Filtrar por data se especificado
        let itensFiltrados = itens;
        if (input?.dataInicio || input?.dataFim) {
          itensFiltrados = itens.filter(item => {
            const itemDateStr = extractDateStr(item.data);
            if (input?.dataInicio && itemDateStr < input.dataInicio) return false;
            if (input?.dataFim && itemDateStr > input.dataFim) return false;
            return true;
          });
        }
        
        const total = itensFiltrados.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
        
        return { total };
      }),

    // Produção Método Caminhões - soma apenas dos serviços específicos
    producaoMetodoCaminhoes: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { total: 0, totalViagens: 0, caminhoes: [], britagemFixa: { total: 0, totalViagens: 0, caminhoes: [] }, britagemMovel: { total: 0, totalViagens: 0, caminhoes: [] } };
        
        // Buscar nomes dos serviços para filtrar
        const servicosData = await db.select().from(servicos);
        
        // Serviços de Britagem Fixa
        const servicosBritagemFixa = servicosData.filter(s => 
          s.nome.toUpperCase().includes('TRANSPORTE DE PEDRA PARA O BRITADOR') ||
          s.nome.toUpperCase().includes('ALIMENTANDO O BRITADOR PRIMARIO') ||
          s.nome.toUpperCase().includes('TRANSP. PEDRA DO ESTOQUE PARA O BRITADOR')
        ).map(s => s.id);
        
        // Serviços de Britagem Móvel
        const servicosBritagemMovel = servicosData.filter(s => 
          s.nome.toUpperCase().includes('TRANSPORTE DE PEDRA PARA BRITAGEM MOVEL')
        ).map(s => s.id);
        
        const servicosCaminhoes = [...servicosBritagemFixa, ...servicosBritagemMovel];
        
        // Buscar itens com data, equipamentoId, quantidade (viagens) e servicoId
        const itens = await db
          .select({
            servicoId: parteDiariaItens.servicoId,
            producao: parteDiariaItens.producao,
            quantidade: parteDiariaItens.quantidade,
            data: parteDiaria.data,
            equipamentoId: parteDiaria.equipamentoId,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));
        
        // Filtrar por data e serviços específicos
        let itensFiltrados = itens.filter(item => servicosCaminhoes.includes(item.servicoId));
        if (input?.dataInicio || input?.dataFim) {
          itensFiltrados = itensFiltrados.filter(item => {
            const itemDateStr = extractDateStr(item.data);
            if (input?.dataInicio && itemDateStr < input.dataInicio) return false;
            if (input?.dataFim && itemDateStr > input.dataFim) return false;
            return true;
          });
        }
        
        // Separar itens por tipo de britagem
        const itensFixa = itensFiltrados.filter(item => servicosBritagemFixa.includes(item.servicoId));
        const itensMovel = itensFiltrados.filter(item => servicosBritagemMovel.includes(item.servicoId));
        
        // Buscar nomes/placas e capacidades dos equipamentos
        const equipamentosData = await db.select().from(equipamentos);
        const equipMap = new Map(equipamentosData.map(e => [e.id, e]));
        
        // Buscar todas as pesagens para cache
        const todasPesagens = await db.select().from(pesagensEquipamentos).orderBy(desc(pesagensEquipamentos.dataVigencia));
        
        // Função para agrupar itens por equipamento e gerar dados
        const agruparPorEquipamento = async (itensGrupo: typeof itensFiltrados, totalGeral: number) => {
          const porEquipamento = new Map<number, { equipamentoId: number; totalProduzido: number; totalViagens: number; datasRegistros: string[] }>();
          for (const item of itensGrupo) {
            const qtd = parseFloat(item.producao || '0');
            const viagens = parseFloat(item.quantidade || '0');
            const eqId = item.equipamentoId;
            const dataStr = extractDateStr(item.data);
            const existing = porEquipamento.get(eqId);
            if (existing) {
              existing.totalProduzido += qtd;
              existing.totalViagens += viagens;
              if (!existing.datasRegistros.includes(dataStr)) {
                existing.datasRegistros.push(dataStr);
              }
            } else {
              porEquipamento.set(eqId, { equipamentoId: eqId, totalProduzido: qtd, totalViagens: viagens, datasRegistros: [dataStr] });
            }
          }
          
          const totalGrupo = itensGrupo.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
          const totalViagensGrupo = itensGrupo.reduce((acc, item) => acc + parseFloat(item.quantidade || '0'), 0);
          
          const caminhoesPromises = Array.from(porEquipamento.values()).map(async (c) => {
            const equip = equipMap.get(c.equipamentoId);
            const dataRecente = c.datasRegistros.sort().reverse()[0] || '';
            const capacidadeVigente = await getCapacidadeVigente(db, c.equipamentoId, dataRecente, todasPesagens, equipMap as any);
            return {
              equipamentoId: c.equipamentoId,
              placa: equip?.codigoTag || equip?.nomeDoEquipamento || 'Desconhecido',
              totalProduzido: c.totalProduzido,
              totalViagens: c.totalViagens,
              capacidade: capacidadeVigente,
              percentual: totalGeral > 0 ? (c.totalProduzido / totalGeral) * 100 : 0,
            };
          });
          
          const caminhoes = (await Promise.all(caminhoesPromises))
            .sort((a, b) => b.totalProduzido - a.totalProduzido);
          
          return { total: totalGrupo, totalViagens: totalViagensGrupo, caminhoes };
        };
        
        const total = itensFiltrados.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
        const totalViagens = itensFiltrados.reduce((acc, item) => acc + parseFloat(item.quantidade || '0'), 0);
        
        const britagemFixa = await agruparPorEquipamento(itensFixa, total);
        const britagemMovel = await agruparPorEquipamento(itensMovel, total);
        
        // Caminhões gerais (todos juntos para compatibilidade)
        const todosGrupo = await agruparPorEquipamento(itensFiltrados, total);
        
        return { total, totalViagens, caminhoes: todosGrupo.caminhoes, britagemFixa, britagemMovel };
      }),

    // Produção de Perfuração - soma de producaoPerfuracao (qtdFuros × profundidadeFuros)
    producaoPerfuracao: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { total: 0, totalFuros: 0, totalMetros: 0 };
        
        const registros = await db
          .select({
            qtdFuros: parteDiaria.qtdFuros,
            profundidadeFuros: parteDiaria.profundidadeFuros,
            producaoPerfuracao: parteDiaria.producaoPerfuracao,
            data: parteDiaria.data,
          })
          .from(parteDiaria);
        
        let filtrados = registros;
        if (input?.dataInicio || input?.dataFim) {
          filtrados = filtrados.filter(item => {
            const itemDateStr = extractDateStr(item.data);
            if (input?.dataInicio && itemDateStr < input.dataInicio) return false;
            if (input?.dataFim && itemDateStr > input.dataFim) return false;
            return true;
          });
        }
        
        const total = filtrados.reduce((acc, item) => acc + parseFloat(item.producaoPerfuracao || '0'), 0);
        const totalFuros = filtrados.reduce((acc, item) => acc + parseFloat(item.qtdFuros || '0'), 0);
        const totalMetros = filtrados.reduce((acc, item) => acc + parseFloat(item.profundidadeFuros || '0'), 0);
        return { total, totalFuros, totalMetros };
      }),

    // Produção dos Motoristas - viagens, produção por motorista/serviço, totais e percentuais
    producaoMotoristas: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { totalViagens: 0, totalProducao: 0, motoristas: [] };
        
        // Buscar itens com data, motorista e serviço
        const itens = await db
          .select({
            quantidade: parteDiariaItens.quantidade,
            producao: parteDiariaItens.producao,
            operadorMotoristaId: parteDiariaItens.operadorMotoristaId,
            operadorMotorista: parteDiariaItens.operadorMotorista,
            servicoId: parteDiariaItens.servicoId,
            data: parteDiaria.data,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));
        
        // Filtrar por data
        let itensFiltrados = itens;
        if (input?.dataInicio || input?.dataFim) {
          itensFiltrados = itensFiltrados.filter(item => {
            const itemDateStr = extractDateStr(item.data);
            if (input?.dataInicio && itemDateStr < input.dataInicio) return false;
            if (input?.dataFim && itemDateStr > input.dataFim) return false;
            return true;
          });
        }
        
        // Buscar nomes dos serviços e motoristas
        const servicosData = await db.select().from(servicos);
        const servicoMap = new Map(servicosData.map(s => [s.id, s.nome]));
        const motoristasData = await db.select().from(operadoresMotoristas);
        const motoristaMap = new Map(motoristasData.map(m => [m.id, m.nome]));
        
        // Agrupar por motorista e serviço
        const porMotorista = new Map<string, {
          motoristaId: number | null;
          motoristaNome: string;
          servicos: Map<number, { servicoNome: string; viagens: number; producao: number }>;
          totalViagens: number;
          totalProducao: number;
        }>();
        
        for (const item of itensFiltrados) {
          const motId = item.operadorMotoristaId;
          const motNome = motId ? (motoristaMap.get(motId) || item.operadorMotorista || 'Desconhecido') : (item.operadorMotorista || 'Sem motorista');
          const key = motId ? String(motId) : (item.operadorMotorista || 'sem_motorista');
          const viagens = parseFloat(item.quantidade || '0');
          const prod = parseFloat(item.producao || '0');
          
          if (!porMotorista.has(key)) {
            porMotorista.set(key, {
              motoristaId: motId,
              motoristaNome: motNome,
              servicos: new Map(),
              totalViagens: 0,
              totalProducao: 0,
            });
          }
          const mot = porMotorista.get(key)!;
          mot.totalViagens += viagens;
          mot.totalProducao += prod;
          
          const svcId = item.servicoId;
          if (!mot.servicos.has(svcId)) {
            mot.servicos.set(svcId, {
              servicoNome: servicoMap.get(svcId) || 'Serviço desconhecido',
              viagens: 0,
              producao: 0,
            });
          }
          const svc = mot.servicos.get(svcId)!;
          svc.viagens += viagens;
          svc.producao += prod;
        }
        
        const totalViagens = itensFiltrados.reduce((acc, item) => acc + parseFloat(item.quantidade || '0'), 0);
        const totalProducao = itensFiltrados.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
        
        const motoristas = Array.from(porMotorista.values())
          .sort((a, b) => b.totalProducao - a.totalProducao)
          .map(m => ({
            motoristaId: m.motoristaId,
            motoristaNome: m.motoristaNome,
            totalViagens: m.totalViagens,
            totalProducao: m.totalProducao,
            percentual: totalProducao > 0 ? (m.totalProducao / totalProducao) * 100 : 0,
            servicos: Array.from(m.servicos.values()).sort((a, b) => b.producao - a.producao),
          }));
        
        return { totalViagens, totalProducao, motoristas };
      }),

    // Produção Último Dia Caminhões - mesmo cálculo do producaoMetodoCaminhoes mas só do último dia
    producaoUltimoDia: protectedProcedure
      .use(requirePermission("parteDiaria", "view"))
      .query(async () => {
        const db = await getDb();
        if (!db) return { total: 0, caminhoes: [], dataReferencia: null };
        
        // Buscar nomes dos serviços para filtrar
        const servicosData = await db.select().from(servicos);
        const servicosCaminhoes = servicosData.filter(s => 
          s.nome.toUpperCase().includes('TRANSPORTE DE PEDRA PARA O BRITADOR') ||
          s.nome.toUpperCase().includes('ALIMENTANDO O BRITADOR PRIMARIO') ||
          s.nome.toUpperCase().includes('TRANSP. PEDRA DO ESTOQUE PARA O BRITADOR')
        ).map(s => s.id);
        
        // Buscar todos os itens com data e equipamentoId
        const itens = await db
          .select({
            servicoId: parteDiariaItens.servicoId,
            producao: parteDiariaItens.producao,
            data: parteDiaria.data,
            equipamentoId: parteDiaria.equipamentoId,
          })
          .from(parteDiariaItens)
          .innerJoin(parteDiaria, eq(parteDiariaItens.parteDiariaId, parteDiaria.id));
        
        // Filtrar apenas serviços de caminhões
        const itensCaminhoes = itens.filter(item => servicosCaminhoes.includes(item.servicoId));
        
        if (itensCaminhoes.length === 0) {
          return { total: 0, caminhoes: [], dataReferencia: null };
        }
        
        // Encontrar o último dia registrado
        const datas = itensCaminhoes.map(item => extractDateStr(item.data));
        const ultimoDia = datas.sort().pop()!;
        
        // Filtrar apenas itens do último dia
        const itensUltimoDia = itensCaminhoes.filter(item => extractDateStr(item.data) === ultimoDia);
        
        // Agrupar por equipamento (caminhão)
        const porEquipamento = new Map<number, { equipamentoId: number; totalProduzido: number }>();
        for (const item of itensUltimoDia) {
          const qtd = parseFloat(item.producao || '0');
          const eqId = item.equipamentoId;
          const existing = porEquipamento.get(eqId);
          if (existing) {
            existing.totalProduzido += qtd;
          } else {
            porEquipamento.set(eqId, { equipamentoId: eqId, totalProduzido: qtd });
          }
        }
        
        const total = itensUltimoDia.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0);
        
        // Buscar nomes/placas dos equipamentos
        const equipamentosData = await db.select().from(equipamentos);
        const equipMap = new Map(equipamentosData.map(e => [e.id, { tag: e.codigoTag, nome: e.nomeDoEquipamento }]));
        
        const caminhoes = Array.from(porEquipamento.values())
          .sort((a, b) => b.totalProduzido - a.totalProduzido)
          .map(c => {
            const eq = equipMap.get(c.equipamentoId);
            return {
              equipamentoId: c.equipamentoId,
              placa: eq?.tag || eq?.nome || 'Desconhecido',
              totalProduzido: c.totalProduzido,
              percentual: total > 0 ? (c.totalProduzido / total) * 100 : 0,
            };
          });
        
        return { total, caminhoes, dataReferencia: ultimoDia };
      }),
  }),

  // ============================================================================
  // CONFIGURAÇÕES DO SISTEMA
  // ============================================================================

  configuracoes: router({
    get: protectedProcedure
      .input(z.object({ chave: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const result = await db.select().from(configuracoes).where(eq(configuracoes.chave, input.chave)).limit(1);
        return result[0] || null;
      }),

    set: protectedProcedure
      .input(z.object({ chave: z.string(), valor: z.string(), descricao: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const existing = await db.select().from(configuracoes).where(eq(configuracoes.chave, input.chave)).limit(1);
        if (existing.length > 0) {
          await db.update(configuracoes).set({ valor: input.valor }).where(eq(configuracoes.chave, input.chave));
        } else {
          await db.insert(configuracoes).values({
            chave: input.chave,
            valor: input.valor,
            descricao: input.descricao || '',
          });
        }
        return { success: true };
      }),
  }),

  abastecimento: router({
    list: protectedProcedure
      .use(requirePermission("abastecimento", "view"))
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        equipamentoId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(abastecimento.data, sql`${input.dataInicio}`));
      if (input?.dataFim) conditions.push(lte(abastecimento.data, sql`${input.dataFim}`));
      if (input?.equipamentoId) conditions.push(eq(abastecimento.equipamentoId, input.equipamentoId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db.select().from(abastecimento).where(where).orderBy(desc(abastecimento.data)).limit(pageSize).offset(offset),
        db.select({ total: count() }).from(abastecimento).where(where),
      ]);
      const total = Number(totalRows[0]?.total ?? 0);
      return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }),
    
    create: protectedProcedure
    
      .use(requirePermission("abastecimento", "create"))
      .input(z.object({
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number(),
        combustivelId: z.number(),
        quantidade: z.string(),
        horaKm: z.string().optional(),
        valorUnitario: z.string().optional(),
        valorTotal: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(abastecimento).values({
          data: toDateSql(input.data),
          equipamentoId: input.equipamentoId,
          combustivelId: input.combustivelId,
          quantidade: input.quantidade,
          horaKm: input.horaKm,
          valorUnitario: input.valorUnitario,
          valorTotal: input.valorTotal,
          observacoes: input.observacoes,
          userId: ctx.user.id,
        });
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("abastecimento", "edit"))
      .input(z.object({
        id: z.number(),
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number(),
        combustivelId: z.number(),
        quantidade: z.string(),
        horaKm: z.string().optional(),
        valorUnitario: z.string().optional(),
        valorTotal: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, data: abastData, ...restAbast } = input;
        await db.update(abastecimento).set({ ...restAbast, data: toDateSql(abastData) }).where(eq(abastecimento.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("abastecimento", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(abastecimento).where(eq(abastecimento.id, input.id));
        return { success: true };
      }),

    totais: protectedProcedure
      .use(requirePermission("abastecimento", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { totalQuantidade: 0, totalRegistros: 0, totalValor: 0 };
        const conditions = [];
        if (input.dataInicio) conditions.push(gte(abastecimento.data, new Date(input.dataInicio + 'T00:00:00')));
        if (input.dataFim) conditions.push(lte(abastecimento.data, new Date(input.dataFim + 'T23:59:59')));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const [result] = await db.select({
          totalQuantidade: sql<number>`COALESCE(SUM(CAST(${abastecimento.quantidade} AS DECIMAL(15,4))), 0)`,
          totalRegistros: count(),
          totalValor: sql<number>`COALESCE(SUM(CAST(${abastecimento.valorTotal} AS DECIMAL(15,4))), 0)`,
        }).from(abastecimento).where(where);
        return result ?? { totalQuantidade: 0, totalRegistros: 0, totalValor: 0 };
      }),
  }),
  producao: router({
    list: protectedProcedure
      .use(requirePermission("producao", "view"))
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        equipamentoId: z.number().optional(),
        produtoId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(producao.data, sql`${input.dataInicio}`));
      if (input?.dataFim) conditions.push(lte(producao.data, sql`${input.dataFim}`));
      if (input?.equipamentoId) conditions.push(eq(producao.equipamentoId, input.equipamentoId));
      if (input?.produtoId) conditions.push(eq(producao.produtoId, input.produtoId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db.select().from(producao).where(where).orderBy(desc(producao.data)).limit(pageSize).offset(offset),
        db.select({ total: count() }).from(producao).where(where),
      ]);
      const total = Number(totalRows[0]?.total ?? 0);
      return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }),
    
    create: protectedProcedure
    
      .use(requirePermission("producao", "create"))
      .input(z.object({
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        produtoId: z.number(),
        equipamentoId: z.number(),
        quantidade: z.string(),
        metaDiaria: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(producao).values({
          data: toDateSql(input.data),
          produtoId: input.produtoId,
          equipamentoId: input.equipamentoId,
          quantidade: input.quantidade,
          metaDiaria: input.metaDiaria,
          observacoes: input.observacoes,
          userId: ctx.user.id,
        });
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("producao", "edit"))
      .input(z.object({
        id: z.number(),
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        produtoId: z.number(),
        equipamentoId: z.number(),
        quantidade: z.string(),
        metaDiaria: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, data: prodData, ...restProd } = input;
        await db.update(producao).set({ ...restProd, data: toDateSql(prodData) }).where(eq(producao.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("producao", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(producao).where(eq(producao.id, input.id));
        return { success: true };
      }),
  }),

   custos: router({
    list: protectedProcedure
      .use(requirePermission("custos", "view"))
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        equipamentoId: z.number().optional(),
        setorDeCustoId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(custos.data, sql`${input.dataInicio}`));
      if (input?.dataFim) conditions.push(lte(custos.data, sql`${input.dataFim}`));
      if (input?.equipamentoId) conditions.push(eq(custos.equipamentoId, input.equipamentoId));
      if (input?.setorDeCustoId) conditions.push(eq(custos.setorDeCustoId, input.setorDeCustoId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db.select().from(custos).where(where).orderBy(desc(custos.data)).limit(pageSize).offset(offset),
        db.select({ total: count() }).from(custos).where(where),
      ]);
      const total = Number(totalRows[0]?.total ?? 0);
      return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("custos", "create"))
      .input(z.object({
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        descricao: z.string().min(1),
        valor: z.string(),
        setorDeCustoId: z.number(),
        setorId: z.number().optional(),
        equipamentoId: z.number().optional(),
        contaCustoId: z.number().nullable().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const result = await db.insert(custos).values({
          data: toDateSql(input.data),
          descricao: input.descricao,
          valor: input.valor,
          setorDeCustoId: input.setorDeCustoId,
          setorId: input.setorId,
          equipamentoId: input.equipamentoId,
          contaCustoId: input.contaCustoId,
          observacoes: input.observacoes,
          userId: ctx.user.id,
        });
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("custos", "edit"))
      .input(z.object({
        id: z.number(),
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        descricao: z.string().min(1),
        valor: z.string(),
        setorDeCustoId: z.number(),
        setorId: z.number().optional(),
        equipamentoId: z.number().optional(),
        contaCustoId: z.number().nullable().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const { id, data: custoData, ...restCusto } = input;
        await db.update(custos).set({ ...restCusto, data: toDateSql(custoData) }).where(eq(custos.id, id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("custos", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.delete(custos).where(eq(custos.id, input.id));
        return { success: true };
      }),

    totais: protectedProcedure
      .use(requirePermission("custos", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { totalValor: 0, totalRegistros: 0 };
        const conditions = [];
        if (input.dataInicio) conditions.push(gte(custos.data, new Date(input.dataInicio + 'T00:00:00')));
        if (input.dataFim) conditions.push(lte(custos.data, new Date(input.dataFim + 'T23:59:59')));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const [result] = await db.select({
          totalValor: sql<number>`COALESCE(SUM(CAST(${custos.valor} AS DECIMAL(15,4))), 0)`,
          totalRegistros: count(),
        }).from(custos).where(where);
        return result ?? { totalValor: 0, totalRegistros: 0 };
      }),
  }),
  // ============================================================================
  // MÓDULO DE MANUTENÇÃOO
  // ============================================================================

   manutencao: router({
    list: protectedProcedure
      .use(requirePermission("manutencao", "view"))
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        equipamentoId: z.number().optional(),
        status: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(paradasMecanicas.dataInicio, new Date(`${input.dataInicio}T00:00:00`)));
      if (input?.dataFim) conditions.push(lte(paradasMecanicas.dataInicio, new Date(`${input.dataFim}T23:59:59`)));
      if (input?.equipamentoId) conditions.push(eq(paradasMecanicas.equipamentoId, input.equipamentoId));
      if (input?.status) conditions.push(eq(paradasMecanicas.status, input.status as any));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db.select().from(paradasMecanicas).where(where).orderBy(desc(paradasMecanicas.id)).limit(pageSize).offset(offset),
        db.select({ total: count() }).from(paradasMecanicas).where(where),
      ]);
      const total = Number(totalRows[0]?.total ?? 0);
      return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }),
    
    create: protectedProcedure

    
      .use(requirePermission("manutencao", "create"))
      .input(z.object({
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number(),
        tipo: z.enum(["preventiva", "corretiva", "preditiva"]),
        descricao: z.string(),
        horaInicio: z.string().optional(),
        horaFim: z.string().optional(),
        horasParadas: z.string().optional(),
        custo: z.string().optional(),
        observacoes: z.string().optional(),
        horKmRevisao: z.string().optional(),
        intervaloRevisao: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Calcular timestamps para dataInicio e dataFim
              const dataStr = toDateStr(input.data);
        const dataInicio = input.horaInicio 
          ? new Date(`${dataStr}T${input.horaInicio}`)
          : new Date(`${dataStr}T00:00:00`);
        
        const dataFim = input.horaFim
          ? new Date(`${dataStr}T${input.horaFim}`)
          : undefined;
        
        // Calcular Hor/Km Próxima Revisão = Hor/Km desta Revisão + Intervalo
        const horKmRevisaoVal = input.tipo === "preventiva" && input.horKmRevisao ? parseFloat(input.horKmRevisao) : 0;
        const intervaloVal = input.tipo === "preventiva" && input.intervaloRevisao ? parseFloat(input.intervaloRevisao) : 0;
        const horKmProximaRevisaoCalc = horKmRevisaoVal + intervaloVal;
        
        const result = await db.insert(paradasMecanicas).values({
          equipamentoId: input.equipamentoId,
          dataInicio,
          dataFim,
          motivoParada: input.tipo,
          descricao: input.descricao,
          tempoParada: input.horasParadas,
          custoEstimado: input.custo,
          horKmRevisao: input.tipo === "preventiva" ? input.horKmRevisao : undefined,
          intervaloRevisao: input.tipo === "preventiva" ? input.intervaloRevisao : undefined,
          horKmProximaRevisao: input.tipo === "preventiva" && (horKmRevisaoVal || intervaloVal) ? String(horKmProximaRevisaoCalc.toFixed(2)) : undefined,
          status: input.horaFim ? "concluida" : "em_andamento",
          userId: ctx.user.id,
        });
        return { id: Number(result[0].insertId), ...input };
      }),
    
    update: protectedProcedure
      .use(requirePermission("manutencao", "edit"))
      .input(z.object({
        id: z.number(),
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number(),
        tipo: z.enum(["preventiva", "corretiva", "preditiva"]),
        descricao: z.string(),
        horaInicio: z.string().optional(),
        horaFim: z.string().optional(),
        horasParadas: z.string().optional(),
        custo: z.string().optional(),
        observacoes: z.string().optional(),
        horKmRevisao: z.string().optional(),
        intervaloRevisao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const dataStr = toDateStr(input.data);
        const dataInicio = input.horaInicio 
          ? new Date(`${dataStr}T${input.horaInicio}`)
          : new Date(`${dataStr}T00:00:00`);
        
        const dataFim = input.horaFim
          ? new Date(`${dataStr}T${input.horaFim}`)
          : undefined;
        
        // Calcular Hor/Km Próxima Revisão = Hor/Km desta Revisão + Intervalo
        const horKmRevisaoVal = input.tipo === "preventiva" && input.horKmRevisao ? parseFloat(input.horKmRevisao) : 0;
        const intervaloVal = input.tipo === "preventiva" && input.intervaloRevisao ? parseFloat(input.intervaloRevisao) : 0;
        const horKmProximaRevisaoCalc = horKmRevisaoVal + intervaloVal;
        
        await db.update(paradasMecanicas).set({
          equipamentoId: input.equipamentoId,
          dataInicio,
          dataFim,
          motivoParada: input.tipo,
          descricao: input.descricao,
          tempoParada: input.horasParadas,
          custoEstimado: input.custo,
          horKmRevisao: input.tipo === "preventiva" ? input.horKmRevisao : null,
          intervaloRevisao: input.tipo === "preventiva" ? input.intervaloRevisao : null,
          horKmProximaRevisao: input.tipo === "preventiva" && (horKmRevisaoVal || intervaloVal) ? String(horKmProximaRevisaoCalc.toFixed(2)) : null,
          status: input.horaFim ? "concluida" : "em_andamento",
        }).where(eq(paradasMecanicas.id, input.id));
        return { success: true };
      }),
    
    delete: protectedProcedure
      .use(requirePermission("manutencao", "delete"))
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
         await db.delete(paradasMecanicas).where(eq(paradasMecanicas.id, input.id));
        return { success: true };
      }),

    totais: protectedProcedure
      .use(requirePermission("manutencao", "view"))
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { totalRegistros: 0, totalHorasParadas: 0, totalCusto: 0 };
        const conditions = [];
        if (input.dataInicio) conditions.push(gte(paradasMecanicas.dataInicio, new Date(input.dataInicio + 'T00:00:00')));
        if (input.dataFim) conditions.push(lte(paradasMecanicas.dataInicio, new Date(input.dataFim + 'T23:59:59')));
        const where = conditions.length > 0 ? and(...conditions) : undefined;
        const [result] = await db.select({
          totalRegistros: count(),
          totalHorasParadas: sql<number>`COALESCE(SUM(CAST(${paradasMecanicas.tempoParada} AS DECIMAL(15,4))), 0)`,
          totalCusto: sql<number>`COALESCE(SUM(CAST(${paradasMecanicas.custoEstimado} AS DECIMAL(15,4))), 0)`,
        }).from(paradasMecanicas).where(where);
        return result ?? { totalRegistros: 0, totalHorasParadas: 0, totalCusto: 0 };
      }),
    revisoesPreventivas: protectedProcedure
      .use(requirePermission("manutencao", "view"))
      .query(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Buscar todas as revisões preventivas
        const revisoes = await db.select({
          id: paradasMecanicas.id,
          equipamentoId: paradasMecanicas.equipamentoId,
          dataInicio: paradasMecanicas.dataInicio,
          horKmRevisao: paradasMecanicas.horKmRevisao,
          intervaloRevisao: paradasMecanicas.intervaloRevisao,
          horKmProximaRevisao: paradasMecanicas.horKmProximaRevisao,
          equipamentoTag: equipamentos.codigoTag,
          equipamentoNome: equipamentos.nomeDoEquipamento,
        })
        .from(paradasMecanicas)
        .leftJoin(equipamentos, eq(paradasMecanicas.equipamentoId, equipamentos.id))
        .where(eq(paradasMecanicas.motivoParada, "preventiva"))
        .orderBy(desc(paradasMecanicas.dataInicio));
        
        // Agrupar por equipamento e pegar a última revisão de cada
        const ultimaRevisaoPorEquip = new Map<number, typeof revisoes[0]>();
        for (const rev of revisoes) {
          if (!ultimaRevisaoPorEquip.has(rev.equipamentoId)) {
            ultimaRevisaoPorEquip.set(rev.equipamentoId, rev);
          }
        }
        
        // Buscar a última parte diária de cada equipamento (horaKmFinal mais recente)
        const partesDiarias = await db.select({
          equipamentoId: parteDiaria.equipamentoId,
          horaKmFinal: parteDiaria.horaKmFinal,
          data: parteDiaria.data,
        })
        .from(parteDiaria)
        .orderBy(desc(parteDiaria.data));
        
        const ultimaPartePorEquip = new Map<number, { horaKmFinal: string | null; data: any }>();
        for (const pd of partesDiarias) {
          if (!ultimaPartePorEquip.has(pd.equipamentoId)) {
            ultimaPartePorEquip.set(pd.equipamentoId, pd);
          }
        }
        
        // Montar resultado
        const resultado = Array.from(ultimaRevisaoPorEquip.values()).map(rev => {
          const ultimaParte = ultimaPartePorEquip.get(rev.equipamentoId);
          const horKmProxima = rev.horKmProximaRevisao ? parseFloat(rev.horKmProximaRevisao) : 0;
          const horaKmFinalAtual = ultimaParte?.horaKmFinal ? parseFloat(ultimaParte.horaKmFinal) : 0;
          const faltam = horKmProxima - horaKmFinalAtual;
          
          return {
            equipamentoId: rev.equipamentoId,
            equipamentoTag: rev.equipamentoTag || rev.equipamentoNome || "Sem tag",
            dataUltimaRevisao: rev.dataInicio,
            horKmRevisao: rev.horKmRevisao ? parseFloat(rev.horKmRevisao) : 0,
            horKmProximaRevisao: horKmProxima,
            horaKmFinalAtual,
            faltam,
          };
        });
        
        // Ordenar por "faltam" crescente (mais urgentes primeiro)
        resultado.sort((a, b) => a.faltam - b.faltam);
        
        return resultado;
      }),
  }),
  
  // ============================================================================
  // MÓDULO MEDIÇÃO DAS PILHAS
  // ============================================================================

  medicaoPilhas: router({
    list: protectedProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(200).default(50),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        equipamentoId: z.number().optional(),
        produtoId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;
      const conditions = [];
      if (input?.dataInicio) conditions.push(gte(medicaoPilhas.data, sql`${input.dataInicio}`));
      if (input?.dataFim) conditions.push(lte(medicaoPilhas.data, sql`${input.dataFim}`));
      if (input?.equipamentoId) conditions.push(eq(medicaoPilhas.equipamentoId, input.equipamentoId));
      if (input?.produtoId) conditions.push(eq(medicaoPilhas.produtoId, input.produtoId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db.select().from(medicaoPilhas).where(where).orderBy(desc(medicaoPilhas.data)).limit(pageSize).offset(offset),
        db.select({ total: count() }).from(medicaoPilhas).where(where),
      ]);
      const total = Number(totalRows[0]?.total ?? 0);
      return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }),

    create: protectedProcedure
      .input(z.object({
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number(),
        produtoId: z.number(),
        medida1: z.number(),
        medida2: z.number(),
        medida3: z.number(),
        volumeRecipiente: z.number(),
        horaProdutiva: z.number(),
        densidade: z.number(),
        observacoes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const medidas = [input.medida1, input.medida2, input.medida3].filter(m => m > 0);
        const mediaMedidas = medidas.length > 0 ? medidas.reduce((a, b) => a + b, 0) / medidas.length : 0;
        const qtdProduzida = mediaMedidas > 0
          ? ((input.volumeRecipiente / mediaMedidas) * 3600 * input.horaProdutiva) * input.densidade
          : 0;

        await db.insert(medicaoPilhas).values({
          data: toDateStr(input.data) as any,
          equipamentoId: input.equipamentoId,
          produtoId: input.produtoId,
          medida1: String(input.medida1),
          medida2: String(input.medida2),
          medida3: String(input.medida3),
          mediaMedidas: String(mediaMedidas),
          volumeRecipiente: String(input.volumeRecipiente),
          horaProdutiva: String(input.horaProdutiva),
          densidade: String(input.densidade),
          qtdProduzida: String(qtdProduzida),
          observacoes: input.observacoes ?? null,
          userId: ctx.user.id,
        });
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.string(), // YYYY-MM-DD string to avoid timezone issues
        equipamentoId: z.number(),
        produtoId: z.number(),
        medida1: z.number(),
        medida2: z.number(),
        medida3: z.number(),
        volumeRecipiente: z.number(),
        horaProdutiva: z.number(),
        densidade: z.number(),
        observacoes: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        const medidas = [input.medida1, input.medida2, input.medida3].filter(m => m > 0);
        const mediaMedidas = medidas.length > 0 ? medidas.reduce((a, b) => a + b, 0) / medidas.length : 0;
        const qtdProduzida = mediaMedidas > 0
          ? ((input.volumeRecipiente / mediaMedidas) * 3600 * input.horaProdutiva) * input.densidade
          : 0;

        await db.update(medicaoPilhas)
          .set({
            data: toDateStr(input.data) as any,
            equipamentoId: input.equipamentoId,
            produtoId: input.produtoId,
            medida1: String(input.medida1),
            medida2: String(input.medida2),
            medida3: String(input.medida3),
            mediaMedidas: String(mediaMedidas),
            volumeRecipiente: String(input.volumeRecipiente),
            horaProdutiva: String(input.horaProdutiva),
            densidade: String(input.densidade),
            qtdProduzida: String(qtdProduzida),
            observacoes: input.observacoes ?? null,
          })
          .where(eq(medicaoPilhas.id, input.id));
        return { success: true };
      }),

    producaoPorProduto: protectedProcedure
      .input(z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        // Buscar todas as medições
        let medicoes = await db.select().from(medicaoPilhas);
        
        // Filtrar por período se informado
        if (input?.dataInicio || input?.dataFim) {
          medicoes = medicoes.filter(m => {
            const d = typeof m.data === 'string' ? (m.data as string).split('T')[0] : new Date(m.data).toISOString().split('T')[0];
            if (input?.dataInicio && d < input.dataInicio) return false;
            if (input?.dataFim && d > input.dataFim) return false;
            return true;
          });
        }
        
        // Buscar nomes dos produtos
        const produtosData = await db.select().from(produtos);
        const produtosMap = new Map(produtosData.map(p => [p.id, p.nome]));
        
        // Agrupar por produto
        const porProduto = new Map<number, { produtoId: number; produtoNome: string; totalProduzido: number }>(); 
        for (const m of medicoes) {
          const qtd = parseFloat(m.qtdProduzida || '0');
          const existing = porProduto.get(m.produtoId);
          if (existing) {
            existing.totalProduzido += qtd;
          } else {
            porProduto.set(m.produtoId, {
              produtoId: m.produtoId,
              produtoNome: produtosMap.get(m.produtoId) || 'Desconhecido',
              totalProduzido: qtd,
            });
          }
        }
        
        const resultado = Array.from(porProduto.values()).sort((a, b) => b.totalProduzido - a.totalProduzido);
        const total = resultado.reduce((sum, r) => sum + r.totalProduzido, 0);
        
        return {
          produtos: resultado.map(r => ({
            ...r,
            percentual: total > 0 ? (r.totalProduzido / total) * 100 : 0,
          })),
          total,
        };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(medicaoPilhas).where(eq(medicaoPilhas.id, input.id));
        return { success: true };
      }),
  }),

  // ============================================================================
  // SISTEMA DE NOTIFICAÇÕES
  // ============================================================================

  notificacoes: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(notificacoes).orderBy(desc(notificacoes.createdAt)).limit(50);
    }),

    naoLidas: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { count: 0, items: [] };
      const items = await db.select().from(notificacoes)
        .where(eq(notificacoes.lida, "nao"))
        .orderBy(desc(notificacoes.createdAt))
        .limit(20);
      return { count: items.length, items };
    }),

    marcarLida: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(notificacoes).set({ lida: "sim" }).where(eq(notificacoes.id, input.id));
        return { success: true };
      }),

    marcarTodasLidas: protectedProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(notificacoes).set({ lida: "sim" }).where(eq(notificacoes.lida, "nao"));
      return { success: true };
    }),

    verificarRevisoes: protectedProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Buscar todas as revisões preventivas
      const revisoes = await db.select({
        id: paradasMecanicas.id,
        equipamentoId: paradasMecanicas.equipamentoId,
        dataInicio: paradasMecanicas.dataInicio,
        horKmProximaRevisao: paradasMecanicas.horKmProximaRevisao,
        equipamentoTag: equipamentos.codigoTag,
        equipamentoNome: equipamentos.nomeDoEquipamento,
      })
      .from(paradasMecanicas)
      .leftJoin(equipamentos, eq(paradasMecanicas.equipamentoId, equipamentos.id))
      .where(eq(paradasMecanicas.motivoParada, "preventiva"))
      .orderBy(desc(paradasMecanicas.dataInicio));
      
      // Pegar última revisão por equipamento
      const ultimaRevisaoPorEquip = new Map<number, typeof revisoes[0]>();
      for (const rev of revisoes) {
        if (!ultimaRevisaoPorEquip.has(rev.equipamentoId)) {
          ultimaRevisaoPorEquip.set(rev.equipamentoId, rev);
        }
      }
      
      // Buscar última parte diária por equipamento
      const partesDiarias = await db.select({
        equipamentoId: parteDiaria.equipamentoId,
        horaKmFinal: parteDiaria.horaKmFinal,
      })
      .from(parteDiaria)
      .orderBy(desc(parteDiaria.data));
      
      const ultimaPartePorEquip = new Map<number, string | null>();
      for (const pd of partesDiarias) {
        if (!ultimaPartePorEquip.has(pd.equipamentoId)) {
          ultimaPartePorEquip.set(pd.equipamentoId, pd.horaKmFinal);
        }
      }
      
      // Buscar notificações já existentes para não duplicar
      const notificacoesExistentes = await db.select({
        equipamentoId: notificacoes.equipamentoId,
        tipo: notificacoes.tipo,
      }).from(notificacoes)
        .where(and(
          eq(notificacoes.tipo, "revisao_preventiva"),
          eq(notificacoes.lida, "nao")
        ));
      
      const equipNotificados = new Set(notificacoesExistentes.map(n => n.equipamentoId));
      
      let novasNotificacoes = 0;
      
      for (const [equipId, rev] of Array.from(ultimaRevisaoPorEquip)) {
        const horKmProxima = rev.horKmProximaRevisao ? parseFloat(rev.horKmProximaRevisao) : 0;
        const horaKmFinal = ultimaPartePorEquip.get(equipId);
        const horaKmFinalNum = horaKmFinal ? parseFloat(horaKmFinal) : 0;
        const faltam = horKmProxima - horaKmFinalNum;
        const nomeEquip = rev.equipamentoTag || rev.equipamentoNome || "Equipamento";
        
        if (faltam <= 0 && !equipNotificados.has(equipId)) {
          await db.insert(notificacoes).values({
            tipo: "revisao_preventiva",
            titulo: `Revisão preventiva vencida: ${nomeEquip}`,
            mensagem: `O equipamento ${nomeEquip} atingiu o limite de Hor/Km para revisão preventiva. Faltam: ${faltam.toFixed(2)}. Hor/Km Próxima Revisão: ${horKmProxima.toFixed(2)}, Hor/Km Final Atual: ${horaKmFinalNum.toFixed(2)}.`,
            equipamentoId: equipId,
          });
          novasNotificacoes++;
          
          // Enviar notificação ao owner
          try {
            const { notifyOwner } = await import("./_core/notification");
            await notifyOwner({
              title: `⚠️ Revisão Preventiva Vencida: ${nomeEquip}`,
              content: `O equipamento ${nomeEquip} atingiu o limite para revisão preventiva.\nFaltam: ${faltam.toFixed(2)} Hor/Km\nHor/Km Próxima Revisão: ${horKmProxima.toFixed(2)}\nHor/Km Final Atual: ${horaKmFinalNum.toFixed(2)}`,
            });
          } catch (e) {
            console.warn("[Notificação] Falha ao notificar owner:", e);
          }
        }
      }
      
      return { novasNotificacoes };
    }),
  }),

  // ============================================================================
  // DESTINATÁRIOS WHATSAPP
  // ============================================================================

  destinatariosWhatsapp: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(destinatariosWhatsapp).orderBy(asc(destinatariosWhatsapp.nome));
    }),

    create: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        telefone: z.string().min(1),
        cargo: z.string().optional(),
        ativo: z.enum(["sim", "nao"]).optional(),
        cardsSelecionados: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const result = await db.insert(destinatariosWhatsapp).values({
          nome: input.nome,
          telefone: input.telefone,
          cargo: input.cargo || null,
          ativo: input.ativo || "sim",
          cardsSelecionados: input.cardsSelecionados || null,
        });
        return { id: result[0].insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1),
        telefone: z.string().min(1),
        cargo: z.string().optional(),
        ativo: z.enum(["sim", "nao"]).optional(),
        cardsSelecionados: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(destinatariosWhatsapp).set({
          nome: input.nome,
          telefone: input.telefone,
          cargo: input.cargo || null,
          ativo: input.ativo || "sim",
          cardsSelecionados: input.cardsSelecionados || null,
        }).where(eq(destinatariosWhatsapp.id, input.id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.delete(destinatariosWhatsapp).where(eq(destinatariosWhatsapp.id, input.id));
        return { success: true };
      }),
  }),

  // ============================================================================
  // HISTÓRICO DE PESAGENS (CAPACIDADE POR VIGÊNCIA)
  // ============================================================================

  pesagens: router({
    // Listar pesagens de um equipamento (ordem decrescente por data)
    list: protectedProcedure
      .input(z.object({ equipamentoId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const result = await db
          .select()
          .from(pesagensEquipamentos)
          .where(eq(pesagensEquipamentos.equipamentoId, input.equipamentoId))
          .orderBy(desc(pesagensEquipamentos.dataVigencia));
        return result;
      }),

    // Listar todas as pesagens (para uso interno)
    listAll: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(pesagensEquipamentos).orderBy(desc(pesagensEquipamentos.dataVigencia));
    }),

    // Criar nova pesagem
    create: protectedProcedure
      .input(z.object({
        equipamentoId: z.number(),
        capacidade: z.string(),
        dataVigencia: z.string(), // YYYY-MM-DD
        observacao: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        await db.insert(pesagensEquipamentos).values({
          equipamentoId: input.equipamentoId,
          capacidade: input.capacidade,
          dataVigencia: sql`${input.dataVigencia}`,
          observacao: input.observacao || null,
          userId: ctx.user.id,
        });
        
        // Atualizar o campo capacidade do equipamento com o valor mais recente
        // Buscar a pesagem com data de vigência mais recente
        const pesagens = await db
          .select()
          .from(pesagensEquipamentos)
          .where(eq(pesagensEquipamentos.equipamentoId, input.equipamentoId))
          .orderBy(desc(pesagensEquipamentos.dataVigencia))
          .limit(1);
        
        if (pesagens.length > 0) {
          await db.update(equipamentos)
            .set({ capacidade: pesagens[0].capacidade })
            .where(eq(equipamentos.id, input.equipamentoId));
        }
        
        return { success: true };
      }),

    // Deletar pesagem
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Buscar a pesagem para saber o equipamentoId
        const pesagem = await db.select().from(pesagensEquipamentos).where(eq(pesagensEquipamentos.id, input.id)).limit(1);
        
        await db.delete(pesagensEquipamentos).where(eq(pesagensEquipamentos.id, input.id));
        
        // Atualizar capacidade do equipamento com a pesagem mais recente restante
        if (pesagem.length > 0) {
          const restantes = await db
            .select()
            .from(pesagensEquipamentos)
            .where(eq(pesagensEquipamentos.equipamentoId, pesagem[0].equipamentoId))
            .orderBy(desc(pesagensEquipamentos.dataVigencia))
            .limit(1);
          
          if (restantes.length > 0) {
            await db.update(equipamentos)
              .set({ capacidade: restantes[0].capacidade })
              .where(eq(equipamentos.id, pesagem[0].equipamentoId));
          }
        }
        
        return { success: true };
      }),

    // Buscar capacidade vigente de um equipamento em uma data específica
    capacidadeVigente: protectedProcedure
      .input(z.object({
        equipamentoId: z.number(),
        data: z.string(), // YYYY-MM-DD
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        
        // Buscar a pesagem com dataVigencia <= data informada, mais recente
        const pesagens = await db
          .select()
          .from(pesagensEquipamentos)
          .where(eq(pesagensEquipamentos.equipamentoId, input.equipamentoId))
          .orderBy(desc(pesagensEquipamentos.dataVigencia));
        
        const vigente = pesagens.find(p => {
          const dv = extractDateStr(p.dataVigencia);
          return dv <= input.data;
        });
        
        return vigente || null;
      }),
  }),

  usuarios: usuariosRouter,

  vendas: vendasRouter,

  permissoes: permissoesRouter,

  authLocal: authLocalRouter,

  // ============================================================================
  // MÓDULO DE PEÇAS DE DESGASTE
  // ============================================================================

  categoriasPecasDesgaste: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(categoriasPecasDesgaste).orderBy(asc(categoriasPecasDesgaste.nome));
    }),

    create: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const [result] = await db.insert(categoriasPecasDesgaste).values({
          nome: input.nome,
          descricao: input.descricao || null,
        });
        return { id: result.insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        descricao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const { id, ...data } = input;
        await db.update(categoriasPecasDesgaste).set(data).where(eq(categoriasPecasDesgaste.id, id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        // Verificar se há peças vinculadas
        const pecasVinculadas = await db.select({ id: pecasDesgaste.id })
          .from(pecasDesgaste)
          .where(eq(pecasDesgaste.categoriaId, input.id))
          .limit(1);
        if (pecasVinculadas.length > 0) {
          throw new Error("Não é possível excluir: existem peças vinculadas a esta categoria.");
        }
        await db.delete(categoriasPecasDesgaste).where(eq(categoriasPecasDesgaste.id, input.id));
        return { success: true };
      }),
  }),

  pecasDesgaste: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const pecas = await db.select().from(pecasDesgaste).orderBy(asc(pecasDesgaste.nome));
      const categorias = await db.select().from(categoriasPecasDesgaste);
      const categoriasMap = new Map(categorias.map(c => [c.id, c.nome]));
      
      // Calcular estoque atual de cada peça
      const movimentacoes = await db.select().from(movimentacoesPecas);
      const estoqueMap = new Map<number, number>();
      for (const mov of movimentacoes) {
        const atual = estoqueMap.get(mov.pecaId) || 0;
        if (mov.tipo === 'entrada') {
          estoqueMap.set(mov.pecaId, atual + mov.quantidade);
        } else {
          estoqueMap.set(mov.pecaId, atual - mov.quantidade);
        }
      }
      
      return pecas.map(p => ({
        ...p,
        categoriaNome: categoriasMap.get(p.categoriaId) || 'Sem categoria',
        estoqueAtual: estoqueMap.get(p.id) || 0,
      }));
    }),

    create: protectedProcedure
      .input(z.object({
        nome: z.string().min(1),
        codigo: z.string().optional(),
        categoriaId: z.number(),
        unidade: z.string().optional(),
        vidaUtilEstimada: z.string().optional(),
        estoqueMinimo: z.number().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const [result] = await db.insert(pecasDesgaste).values({
          nome: input.nome,
          codigo: input.codigo || null,
          categoriaId: input.categoriaId,
          unidade: input.unidade || 'un',
          vidaUtilEstimada: input.vidaUtilEstimada || null,
          estoqueMinimo: input.estoqueMinimo || 0,
          observacoes: input.observacoes || null,
        });
        return { id: result.insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().min(1).optional(),
        codigo: z.string().optional(),
        categoriaId: z.number().optional(),
        unidade: z.string().optional(),
        vidaUtilEstimada: z.string().optional(),
        estoqueMinimo: z.number().optional(),
        observacoes: z.string().optional(),
        ativo: z.enum(['sim', 'nao']).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const { id, ...data } = input;
        await db.update(pecasDesgaste).set(data).where(eq(pecasDesgaste.id, id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        // Verificar se há movimentações vinculadas
        const movsVinculadas = await db.select({ id: movimentacoesPecas.id })
          .from(movimentacoesPecas)
          .where(eq(movimentacoesPecas.pecaId, input.id))
          .limit(1);
        if (movsVinculadas.length > 0) {
          throw new Error("Não é possível excluir: existem movimentações vinculadas a esta peça.");
        }
        await db.delete(pecasDesgaste).where(eq(pecasDesgaste.id, input.id));
        return { success: true };
      }),
  }),

  movimentacoesPecas: router({
    list: protectedProcedure
      .input(z.object({
        pecaId: z.number().optional(),
        categoriaId: z.number().optional(),
        equipamentoId: z.number().optional(),
        tipo: z.enum(['entrada', 'saida', 'troca']).optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions: any[] = [];
        if (input?.pecaId) conditions.push(eq(movimentacoesPecas.pecaId, input.pecaId));
        if (input?.equipamentoId) conditions.push(eq(movimentacoesPecas.equipamentoId, input.equipamentoId));
        if (input?.tipo) conditions.push(eq(movimentacoesPecas.tipo, input.tipo));
        if (input?.dataInicio) conditions.push(gte(movimentacoesPecas.data, new Date(input.dataInicio)));
        if (input?.dataFim) conditions.push(lte(movimentacoesPecas.data, new Date(input.dataFim)));

        let movs;
        if (conditions.length > 0) {
          movs = await db.select().from(movimentacoesPecas)
            .where(and(...conditions))
            .orderBy(desc(movimentacoesPecas.data));
        } else {
          movs = await db.select().from(movimentacoesPecas)
            .orderBy(desc(movimentacoesPecas.data));
        }

        // Enriquecer com nomes
        const pecas = await db.select().from(pecasDesgaste);
        const pecasMap = new Map(pecas.map(p => [p.id, p]));
        const categorias = await db.select().from(categoriasPecasDesgaste);
        const categoriasMap = new Map(categorias.map(c => [c.id, c.nome]));
        const equips = await db.select({ id: equipamentos.id, tag: equipamentos.codigoTag, nome: equipamentos.nomeDoEquipamento }).from(equipamentos);
        const equipsMap = new Map(equips.map(e => [e.id, e.tag || e.nome]));

        // Filtrar por categoria se necessário
        let result = movs.map(m => {
          const peca = pecasMap.get(m.pecaId);
          return {
            ...m,
            pecaNome: peca?.nome || 'Desconhecida',
            pecaCodigo: peca?.codigo || '',
            categoriaNome: peca ? (categoriasMap.get(peca.categoriaId) || '') : '',
            categoriaId: peca?.categoriaId || 0,
            equipamentoNome: m.equipamentoId ? (equipsMap.get(m.equipamentoId) || '') : '',
          };
        });

        if (input?.categoriaId) {
          result = result.filter(r => r.categoriaId === input.categoriaId);
        }

        return result;
      }),

    create: protectedProcedure
      .input(z.object({
        data: z.string(),
        pecaId: z.number(),
        tipo: z.enum(['entrada', 'saida', 'troca']),
        quantidade: z.number().min(1),
        equipamentoId: z.number().optional(),
        notaFiscal: z.string().optional(),
        fornecedor: z.string().optional(),
        valorUnitario: z.string().optional(),
        valorTotal: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const [result] = await db.insert(movimentacoesPecas).values({
          data: new Date(input.data),
          pecaId: input.pecaId,
          tipo: input.tipo,
          quantidade: input.quantidade,
          equipamentoId: input.equipamentoId || null,
          notaFiscal: input.notaFiscal || null,
          fornecedor: input.fornecedor || null,
          valorUnitario: input.valorUnitario || null,
          valorTotal: input.valorTotal || null,
          observacoes: input.observacoes || null,
          userId: ctx.user!.id,
        });
        return { id: result.insertId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.string().optional(),
        pecaId: z.number().optional(),
        tipo: z.enum(['entrada', 'saida', 'troca']).optional(),
        quantidade: z.number().min(1).optional(),
        equipamentoId: z.number().optional(),
        notaFiscal: z.string().optional(),
        fornecedor: z.string().optional(),
        valorUnitario: z.string().optional(),
        valorTotal: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.data) updateData.data = new Date(data.data);
        await db.update(movimentacoesPecas).set(updateData).where(eq(movimentacoesPecas.id, id));
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.delete(movimentacoesPecas).where(eq(movimentacoesPecas.id, input.id));
        return { success: true };
      }),

    // Resumo de estoque por peça
    resumoEstoque: protectedProcedure
      .input(z.object({
        categoriaId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const pecas = await db.select().from(pecasDesgaste).where(eq(pecasDesgaste.ativo, 'sim'));
        const categorias = await db.select().from(categoriasPecasDesgaste);
        const categoriasMap = new Map(categorias.map(c => [c.id, c.nome]));
        const movs = await db.select().from(movimentacoesPecas);

        const estoqueMap = new Map<number, { entradas: number; saidas: number; trocas: number }>();
        for (const mov of movs) {
          const atual = estoqueMap.get(mov.pecaId) || { entradas: 0, saidas: 0, trocas: 0 };
          if (mov.tipo === 'entrada') atual.entradas += mov.quantidade;
          else if (mov.tipo === 'saida') atual.saidas += mov.quantidade;
          else atual.trocas += mov.quantidade;
          estoqueMap.set(mov.pecaId, atual);
        }

        let result = pecas.map(p => {
          const mov = estoqueMap.get(p.id) || { entradas: 0, saidas: 0, trocas: 0 };
          const estoqueAtual = mov.entradas - mov.saidas - mov.trocas;
          return {
            id: p.id,
            nome: p.nome,
            codigo: p.codigo,
            categoriaId: p.categoriaId,
            categoriaNome: categoriasMap.get(p.categoriaId) || '',
            unidade: p.unidade,
            vidaUtilEstimada: p.vidaUtilEstimada,
            estoqueMinimo: p.estoqueMinimo || 0,
            estoqueAtual,
            entradas: mov.entradas,
            saidas: mov.saidas,
            trocas: mov.trocas,
            abaixoMinimo: estoqueAtual < (p.estoqueMinimo || 0),
          };
        });

        if (input?.categoriaId) {
          result = result.filter(r => r.categoriaId === input.categoriaId);
        }

        return result;
      }),
  }),

  // ============================================================================
  // TROCAS DE PEÇAS VINCULADAS À PARTE DIÁRIA
  // ============================================================================
  trocasPecasParteDiaria: router({
    // Listar trocas de uma parte diária específica
    listByParteDiaria: protectedProcedure
      .input(z.object({ parteDiariaId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const trocas = await db.select().from(trocasPecasParteDiaria).where(eq(trocasPecasParteDiaria.parteDiariaId, input.parteDiariaId)).orderBy(desc(trocasPecasParteDiaria.createdAt));
        
        // Enriquecer com nomes das peças e categorias
        const allPecas = await db.select().from(pecasDesgaste);
        const allCategorias = await db.select().from(categoriasPecasDesgaste);
        const pecasMap = new Map(allPecas.map(p => [p.id, p]));
        const catsMap = new Map(allCategorias.map(c => [c.id, c]));
        
        return trocas.map(t => {
          const peca = pecasMap.get(t.pecaId);
          const cat = peca ? catsMap.get(peca.categoriaId) : null;
          return {
            ...t,
            pecaNome: peca?.nome || 'Desconhecida',
            pecaCodigo: peca?.codigo || '',
            categoriaNome: cat?.nome || '',
          };
        });
      }),

    // Adicionar troca de peça vinculada a uma parte diária
    create: protectedProcedure
      .input(z.object({
        parteDiariaId: z.number(),
        pecaId: z.number(),
        quantidade: z.number().min(1).default(1),
        custoUnitario: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('DB não disponível');
        
        // Buscar dados da parte diária para pegar equipamentoId e data
        const [pd] = await db.select().from(parteDiaria).where(eq(parteDiaria.id, input.parteDiariaId));
        if (!pd) throw new Error('Parte Diária não encontrada');
        
        // Calcular custo total
        const custoUnit = input.custoUnitario ? parseFloat(input.custoUnitario) : 0;
        const custoTotal = custoUnit * input.quantidade;
        
        // Criar movimentação automática no módulo de Peças de Desgaste (tipo: troca)
        const [mov] = await db.insert(movimentacoesPecas).values({
          data: pd.data,
          pecaId: input.pecaId,
          tipo: 'troca',
          quantidade: input.quantidade,
          equipamentoId: pd.equipamentoId,
          valorUnitario: input.custoUnitario || null,
          valorTotal: custoTotal > 0 ? String(custoTotal.toFixed(2)) : null,
          observacoes: input.observacoes || `Troca registrada via Parte Diária #${pd.id}`,
          userId: ctx.user.id,
        }).$returningId();
        
        // Criar registro de troca vinculada
        await db.insert(trocasPecasParteDiaria).values({
          parteDiariaId: input.parteDiariaId,
          pecaId: input.pecaId,
          quantidade: input.quantidade,
          custoUnitario: input.custoUnitario || null,
          custoTotal: custoTotal > 0 ? String(custoTotal.toFixed(2)) : null,
          observacoes: input.observacoes || null,
          movimentacaoId: mov.id,
        });
        
        return { success: true };
      }),

    // Remover troca de peça (e a movimentação associada)
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB não disponível');
        
        // Buscar a troca para pegar o movimentacaoId
        const [troca] = await db.select().from(trocasPecasParteDiaria).where(eq(trocasPecasParteDiaria.id, input.id));
        if (!troca) throw new Error('Troca não encontrada');
        
        // Remover a movimentação associada
        if (troca.movimentacaoId) {
          await db.delete(movimentacoesPecas).where(eq(movimentacoesPecas.id, troca.movimentacaoId));
        }
        
        // Remover a troca
        await db.delete(trocasPecasParteDiaria).where(eq(trocasPecasParteDiaria.id, input.id));
        
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
