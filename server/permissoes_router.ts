import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { permissoesPerfilModulo, users } from "../drizzle/schema";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// Lista de todos os módulos do sistema
const ALL_MODULES = [
  "equipamentos",
  "setores",
  "servicos",
  "produtos",
  "combustiveis",
  "unidades",
  "gruposEquipamentos",
  "setorDeCusto",
  "tiposProdutos",
  "operadoresMotoristas",
  "parteDiaria",
  "abastecimento",
  "producao",
  "custos",
  "manutencao",
  "medicaoPilhas",
  "pecasDesgaste",
  "vendas",
  "clientes",
  "usuarios",
] as const;

const ALL_ROLES = [
  "admin",
  "diretor",
  "gerente",
  "consultoria",
  "coordenador",
  "usuario",
  "controle",
  "operador",
] as const;

// Labels amigáveis para os módulos
const MODULE_LABELS: Record<string, string> = {
  equipamentos: "Equipamentos",
  setores: "Setores",
  servicos: "Serviços",
  produtos: "Produtos",
  combustiveis: "Combustíveis",
  unidades: "Unidades",
  gruposEquipamentos: "Grupos de Equipamentos",
  setorDeCusto: "Setor de Custo",
  tiposProdutos: "Tipos de Produtos",
  operadoresMotoristas: "Operadores/Motoristas",
  parteDiaria: "Parte Diária",
  abastecimento: "Abastecimento",
  producao: "Produção",
  custos: "Custos",
  manutencao: "Manutenção",
  medicaoPilhas: "Medição de Pilhas",
  pecasDesgaste: "Peças de Desgaste",
  vendas: "Vendas",
  clientes: "Clientes",
  usuarios: "Usuários",
};

// Permissões padrão (fallback) - mesmas regras que existiam antes
type DefaultPermissions = Record<string, Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>;

const DEFAULT_PERMISSIONS: DefaultPermissions = {
  admin: Object.fromEntries(ALL_MODULES.map(m => [m, { view: true, create: true, edit: true, delete: true }])),
  diretor: Object.fromEntries(ALL_MODULES.map(m => [m, { view: true, create: true, edit: true, delete: true }])),
  gerente: Object.fromEntries(ALL_MODULES.map(m => [m, { view: true, create: false, edit: false, delete: false }])),
  consultoria: Object.fromEntries(ALL_MODULES.map(m => [m, { view: true, create: true, edit: true, delete: true }])),
  coordenador: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? { view: false, create: false, edit: false, delete: false } : { view: true, create: true, edit: true, delete: true }])),
  usuario: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? { view: false, create: false, edit: false, delete: false } : { view: true, create: true, edit: true, delete: true }])),
  controle: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? { view: false, create: false, edit: false, delete: false } : { view: true, create: true, edit: true, delete: true }])),
  operador: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? { view: false, create: false, edit: false, delete: false } : { view: true, create: true, edit: true, delete: false }])),
};

/**
 * Middleware que verifica se o usuário é Consultoria (único perfil que pode gerenciar permissões)
 */
const consultoriaProcedure = protectedProcedure.use(({ ctx, next }) => {
  const allowedRoles = ["admin", "consultoria"];
  if (!allowedRoles.includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Apenas o perfil Consultoria pode gerenciar permissões.",
    });
  }
  return next({ ctx });
});

export const permissoesRouter = router({
  // Listar todas as permissões configuradas
  list: consultoriaProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const permissoes = await db.select().from(permissoesPerfilModulo);
    return {
      permissoes,
      modules: ALL_MODULES,
      roles: ALL_ROLES,
      moduleLabels: MODULE_LABELS,
      defaults: DEFAULT_PERMISSIONS,
    };
  }),

  // Obter permissões de um perfil específico
  getByRole: protectedProcedure
    .input(z.object({ perfil: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const permissoes = await db.select()
        .from(permissoesPerfilModulo)
        .where(eq(permissoesPerfilModulo.perfil, input.perfil as any));

      // Montar mapa de permissões: módulo -> { view, create, edit, delete }
      const permsMap: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }> = {};
      
      for (const m of ALL_MODULES) {
        const dbPerm = permissoes.find(p => p.modulo === m);
        if (dbPerm) {
          permsMap[m] = {
            view: dbPerm.visualizar === "sim",
            create: dbPerm.criar === "sim",
            edit: dbPerm.editar === "sim",
            delete: dbPerm.excluir === "sim",
          };
        } else {
          // Usar permissão padrão se não existe no banco
          permsMap[m] = DEFAULT_PERMISSIONS[input.perfil]?.[m] || { view: false, create: false, edit: false, delete: false };
        }
      }

      return permsMap;
    }),

  // Obter permissões do usuário atual (para o frontend)
  myPermissions: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const userRole = ctx.user.role;
    const permissoes = await db.select()
      .from(permissoesPerfilModulo)
      .where(eq(permissoesPerfilModulo.perfil, userRole as any));

    const permsMap: Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }> = {};
    
    for (const m of ALL_MODULES) {
      const dbPerm = permissoes.find(p => p.modulo === m);
      if (dbPerm) {
        permsMap[m] = {
          view: dbPerm.visualizar === "sim",
          create: dbPerm.criar === "sim",
          edit: dbPerm.editar === "sim",
          delete: dbPerm.excluir === "sim",
        };
      } else {
        permsMap[m] = DEFAULT_PERMISSIONS[userRole]?.[m] || { view: false, create: false, edit: false, delete: false };
      }
    }

    return permsMap;
  }),

  // Salvar permissões de um perfil (upsert)
  save: consultoriaProcedure
    .input(
      z.object({
        perfil: z.enum(["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]),
        permissoes: z.record(z.string(), z.object({
          view: z.boolean(),
          create: z.boolean(),
          edit: z.boolean(),
          delete: z.boolean(),
        })),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Para cada módulo, inserir ou atualizar
      for (const [modulo, perms] of Object.entries(input.permissoes)) {
        const existing = await db.select()
          .from(permissoesPerfilModulo)
          .where(
            and(
              eq(permissoesPerfilModulo.perfil, input.perfil),
              eq(permissoesPerfilModulo.modulo, modulo)
            )
          );

        if (existing.length > 0) {
          await db.update(permissoesPerfilModulo)
            .set({
              visualizar: perms.view ? "sim" : "nao",
              criar: perms.create ? "sim" : "nao",
              editar: perms.edit ? "sim" : "nao",
              excluir: perms.delete ? "sim" : "nao",
            })
            .where(eq(permissoesPerfilModulo.id, existing[0].id));
        } else {
          await db.insert(permissoesPerfilModulo).values({
            perfil: input.perfil,
            modulo,
            visualizar: perms.view ? "sim" : "nao",
            criar: perms.create ? "sim" : "nao",
            editar: perms.edit ? "sim" : "nao",
            excluir: perms.delete ? "sim" : "nao",
          });
        }
      }

      return { success: true };
    }),

  // Resetar permissões de um perfil para os padrões
  resetToDefault: consultoriaProcedure
    .input(z.object({
      perfil: z.enum(["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Remover todas as permissões customizadas do perfil
      await db.delete(permissoesPerfilModulo)
        .where(eq(permissoesPerfilModulo.perfil, input.perfil));

      return { success: true };
    }),

  // Cadastrar novo usuário (restrito a Consultoria)
  createUser: consultoriaProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        email: z.string().email("E-mail inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
        whatsapp: z.string().optional(),
        cargo: z.string().optional(),
        role: z.enum(["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verificar se já existe usuário com este email
      const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um usuário com este e-mail.",
        });
      }

      // Gerar hash da senha temporária
      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

      // Gerar um openId único para o usuário
      const openId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const result = await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email,
        passwordHash,
        mustChangePassword: "sim",
        whatsapp: input.whatsapp || null,
        cargo: input.cargo || null,
        role: input.role,
        loginMethod: "local",
      });

      return { success: true, id: Number(result[0].insertId) };
    }),

  // Resetar senha de um usuário (restrito a Consultoria)
  resetPassword: consultoriaProcedure
    .input(
      z.object({
        userId: z.number(),
        newPassword: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);

      await db.update(users)
        .set({
          passwordHash,
          mustChangePassword: "sim",
        })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
});
