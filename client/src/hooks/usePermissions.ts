import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

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
  | "usuarios"
  | "outrasParadas";

/**
 * Matriz de permissões padrão (fallback enquanto o banco não responde)
 */
const ALL_MODULES: Module[] = [
  "equipamentos", "setores", "servicos", "produtos", "combustiveis",
  "unidades", "gruposEquipamentos", "setorDeCusto", "tiposProdutos",
  "operadoresMotoristas", "parteDiaria", "abastecimento", "producao",
  "custos", "manutencao", "medicaoPilhas", "pecasDesgaste", "vendas",
  "clientes", "contaCusto", "usuarios", "outrasParadas",
];

type PermMap = Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;

const defaultPermsForRole = (role: UserRole): PermMap => {
  const allAccess = { view: true, create: true, edit: true, delete: true };
  const viewOnly = { view: true, create: false, edit: false, delete: false };
  const noAccess = { view: false, create: false, edit: false, delete: false };
  const noDelete = { view: true, create: true, edit: true, delete: false };

  switch (role) {
    case "admin":
    case "consultoria":
      return Object.fromEntries(ALL_MODULES.map(m => [m, allAccess]));
    case "diretor":
      return Object.fromEntries(ALL_MODULES.map(m => [m, allAccess]));
    case "gerente":
      return Object.fromEntries(ALL_MODULES.map(m => [m, m === "usuarios" ? noAccess : viewOnly]));
    case "coordenador":
    case "usuario":
    case "controle":
      return Object.fromEntries(ALL_MODULES.map(m => [m, (m === "custos" || m === "usuarios") ? noAccess : allAccess]));
    case "operador":
      return Object.fromEntries(ALL_MODULES.map(m => [m, (m === "custos" || m === "usuarios") ? noAccess : noDelete]));
    default:
      return Object.fromEntries(ALL_MODULES.map(m => [m, noAccess]));
  }
};

/**
 * Hook para verificar permissões do usuário atual
 * Consulta as permissões configuradas no banco de dados via tRPC
 */
export function usePermissions() {
  const { user } = useAuth();
  
  const userRole = (user?.role as UserRole) || "usuario";
  
  // Consultar permissões do banco
  const { data: dbPermissions } = trpc.permissoes.myPermissions.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30000, // Cache de 30 segundos
    refetchOnWindowFocus: false,
  });
  
  // Usar permissões do banco se disponíveis, senão fallback
  const perms: PermMap = dbPermissions || defaultPermsForRole(userRole);
  
  /**
   * Verifica se o usuário tem uma permissão específica em um módulo
   */
  const hasPermission = (module: Module, permission: Permission): boolean => {
    const modulePerm = perms[module];
    if (!modulePerm) return false;
    switch (permission) {
      case "view": return modulePerm.view;
      case "create": return modulePerm.create;
      case "edit": return modulePerm.edit;
      case "delete": return modulePerm.delete;
      default: return false;
    }
  };
  
  /**
   * Verifica se o usuário tem acesso a um módulo (qualquer permissão)
   */
  const hasModuleAccess = (module: Module): boolean => {
    const modulePerm = perms[module];
    if (!modulePerm) return false;
    return modulePerm.view || modulePerm.create || modulePerm.edit || modulePerm.delete;
  };
  
  /**
   * Retorna todas as permissões do usuário em um módulo
   */
  const getModulePermissions = (module: Module): Permission[] => {
    const modulePerm = perms[module];
    if (!modulePerm) return [];
    const result: Permission[] = [];
    if (modulePerm.view) result.push("view");
    if (modulePerm.create) result.push("create");
    if (modulePerm.edit) result.push("edit");
    if (modulePerm.delete) result.push("delete");
    return result;
  };
  
  /**
   * Verifica se o usuário pode criar registros em um módulo
   */
  const canCreate = (module: Module): boolean => {
    return hasPermission(module, "create");
  };
  
  /**
   * Verifica se o usuário pode editar registros em um módulo
   */
  const canEdit = (module: Module): boolean => {
    return hasPermission(module, "edit");
  };
  
  /**
   * Verifica se o usuário pode excluir registros em um módulo
   */
  const canDelete = (module: Module): boolean => {
    return hasPermission(module, "delete");
  };
  
  /**
   * Verifica se o usuário pode visualizar um módulo
   */
  const canView = (module: Module): boolean => {
    return hasPermission(module, "view");
  };
  
  /**
   * Verifica se o usuário é apenas visualizador (todas as permissões são view-only)
   */
  const isViewOnly = (): boolean => {
    return userRole === "gerente";
  };
  
  return {
    userRole,
    hasPermission,
    hasModuleAccess,
    getModulePermissions,
    canCreate,
    canEdit,
    canDelete,
    canView,
    isViewOnly,
  };
}
