/**
 * Sistema de Permissões Granulares
 * Consulta permissões do banco de dados, com fallback para a matriz padrão
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { permissoesPerfilModulo } from "../drizzle/schema";

export type UserRole = "admin" | "diretor" | "gerente" | "consultoria" | "coordenador" | "usuario" | "controle" | "operador";

export type Permission = "view" | "create" | "edit" | "delete";

export type Module = 
  | "equipamentos"
  | "setores"
  | "servicos"
  | "produtos"
  | "combustiveis"
  | "unidades"
  | "gruposEquipamentos"
  | "setorDeCusto"
  | "tiposProdutos"
  | "operadoresMotoristas"
  | "parteDiaria"
  | "abastecimento"
  | "producao"
  | "custos"
  | "manutencao"
  | "medicaoPilhas"
  | "pecasDesgaste"
  | "vendas"
  | "clientes"
  | "contaCusto"
  | "usuarios";

const ALL_MODULES: Module[] = [
  "equipamentos", "setores", "servicos", "produtos", "combustiveis",
  "unidades", "gruposEquipamentos", "setorDeCusto", "tiposProdutos",
  "operadoresMotoristas", "parteDiaria", "abastecimento", "producao",
  "custos", "manutencao", "medicaoPilhas", "pecasDesgaste", "vendas",
  "clientes", "contaCusto", "usuarios",
];

/**
 * Matriz de permissões padrão (fallback quando não há configuração no banco)
 */
const defaultPermissionsMatrix: Record<UserRole, Record<Module, Permission[]>> = {
  admin: Object.fromEntries(ALL_MODULES.map(m => [m, ["view", "create", "edit", "delete"] as Permission[]])) as Record<Module, Permission[]>,
  diretor: Object.fromEntries(ALL_MODULES.map(m => [m, ["view", "create", "edit", "delete"] as Permission[]])) as Record<Module, Permission[]>,
  gerente: Object.fromEntries(ALL_MODULES.map(m => [m, m === "usuarios" ? [] as Permission[] : ["view"] as Permission[]])) as Record<Module, Permission[]>,
  consultoria: Object.fromEntries(ALL_MODULES.map(m => [m, ["view", "create", "edit", "delete"] as Permission[]])) as Record<Module, Permission[]>,
  coordenador: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? [] as Permission[] : ["view", "create", "edit", "delete"] as Permission[]])) as Record<Module, Permission[]>,
  usuario: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? [] as Permission[] : ["view", "create", "edit", "delete"] as Permission[]])) as Record<Module, Permission[]>,
  controle: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? [] as Permission[] : ["view", "create", "edit", "delete"] as Permission[]])) as Record<Module, Permission[]>,
  operador: Object.fromEntries(ALL_MODULES.map(m => [m, m === "custos" || m === "usuarios" ? [] as Permission[] : ["view", "create", "edit"] as Permission[]])) as Record<Module, Permission[]>,
};

// Cache de permissões do banco (TTL de 30 segundos)
let permissionsCache: Record<string, Record<string, Permission[]>> = {};
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 segundos

/**
 * Carrega as permissões do banco de dados e atualiza o cache
 */
async function loadPermissionsFromDb(): Promise<Record<string, Record<string, Permission[]>>> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && Object.keys(permissionsCache).length > 0) {
    return permissionsCache;
  }

  try {
    const db = await getDb();
    if (!db) return {};

    const dbPerms = await db.select().from(permissoesPerfilModulo);
    
    const result: Record<string, Record<string, Permission[]>> = {};
    
    for (const perm of dbPerms) {
      if (!result[perm.perfil]) result[perm.perfil] = {};
      const perms: Permission[] = [];
      if (perm.visualizar === "sim") perms.push("view");
      if (perm.criar === "sim") perms.push("create");
      if (perm.editar === "sim") perms.push("edit");
      if (perm.excluir === "sim") perms.push("delete");
      result[perm.perfil][perm.modulo] = perms;
    }

    permissionsCache = result;
    cacheTimestamp = now;
    return result;
  } catch {
    return {};
  }
}

/**
 * Verifica se um usuário tem permissão específica em um módulo
 * Primeiro consulta o banco, depois usa fallback padrão
 */
export async function hasPermissionAsync(
  userRole: UserRole,
  module: Module,
  permission: Permission
): Promise<boolean> {
  const dbPerms = await loadPermissionsFromDb();
  
  // Se existe configuração no banco para este perfil e módulo, usar ela
  if (dbPerms[userRole]?.[module]) {
    return dbPerms[userRole][module].includes(permission);
  }
  
  // Fallback para a matriz padrão
  const modulePermissions = defaultPermissionsMatrix[userRole]?.[module];
  if (!modulePermissions) return false;
  return modulePermissions.includes(permission);
}

/**
 * Versão síncrona para compatibilidade (usa cache ou fallback)
 */
export function hasPermission(
  userRole: UserRole,
  module: Module,
  permission: Permission
): boolean {
  // Se temos cache, usar
  if (Object.keys(permissionsCache).length > 0 && permissionsCache[userRole]?.[module]) {
    return permissionsCache[userRole][module].includes(permission);
  }
  
  // Fallback para a matriz padrão
  const modulePermissions = defaultPermissionsMatrix[userRole]?.[module];
  if (!modulePermissions) return false;
  return modulePermissions.includes(permission);
}

/**
 * Verifica se um usuário tem acesso a um módulo (qualquer permissão)
 */
export function hasModuleAccess(userRole: UserRole, module: Module): boolean {
  // Se temos cache, usar
  if (Object.keys(permissionsCache).length > 0 && permissionsCache[userRole]?.[module]) {
    return permissionsCache[userRole][module].length > 0;
  }
  
  const modulePermissions = defaultPermissionsMatrix[userRole]?.[module];
  return modulePermissions ? modulePermissions.length > 0 : false;
}

/**
 * Retorna todas as permissões de um usuário em um módulo
 */
export function getModulePermissions(
  userRole: UserRole,
  module: Module
): Permission[] {
  if (Object.keys(permissionsCache).length > 0 && permissionsCache[userRole]?.[module]) {
    return permissionsCache[userRole][module];
  }
  return defaultPermissionsMatrix[userRole]?.[module] || [];
}

/**
 * Força a recarga do cache de permissões
 */
export function invalidatePermissionsCache(): void {
  permissionsCache = {};
  cacheTimestamp = 0;
}

/**
 * Verifica se o usuário pode criar registros em um módulo
 */
export function canCreate(userRole: UserRole, module: Module): boolean {
  return hasPermission(userRole, module, "create");
}

/**
 * Verifica se o usuário pode editar registros em um módulo
 */
export function canEdit(userRole: UserRole, module: Module): boolean {
  return hasPermission(userRole, module, "edit");
}

/**
 * Verifica se o usuário pode excluir registros em um módulo
 */
export function canDelete(userRole: UserRole, module: Module): boolean {
  return hasPermission(userRole, module, "delete");
}

/**
 * Verifica se o usuário pode visualizar um módulo
 */
export function canView(userRole: UserRole, module: Module): boolean {
  return hasPermission(userRole, module, "view");
}
