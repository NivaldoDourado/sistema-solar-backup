import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { usePermissions, type Module } from "@/hooks/usePermissions";
import { useAuth } from "@/_core/hooks/useAuth";

interface ProtectedRouteProps {
  module: Module;
  children: React.ReactNode;
  /** Se definido, restringe o acesso apenas a usuários com esse perfil */
  requireRole?: string;
}

/**
 * Componente que protege rotas verificando se o usuário tem acesso ao módulo.
 * Opcionalmente, pode exigir um perfil (role) específico.
 * Se não tiver permissão, redireciona ao Dashboard com uma mensagem informativa.
 * Se o usuário ainda não estiver autenticado, renderiza os children normalmente
 * (o DashboardLayout já cuida da tela de login).
 */
export default function ProtectedRoute({ module, children, requireRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { hasModuleAccess, userRole } = usePermissions();
  const [, setLocation] = useLocation();
  const hasRedirected = useRef(false);

  const moduleLabels: Record<Module, string> = {
    equipamentos: "Equipamentos",
    setores: "Setores",
    servicos: "Serviços",
    produtos: "Produtos",
    combustiveis: "Combustíveis",
    unidades: "Unidades",
    gruposEquipamentos: "Grupos de Equipamentos",
    setorDeCusto: "Plano de Contas",
    contaCusto: "Conta Custo",
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
    outrasParadas: "Outras Paradas",
  };

  const hasAccess = hasModuleAccess(module) && (!requireRole || userRole === requireRole);

  useEffect(() => {
    // Só verifica permissão após o carregamento e se o usuário estiver autenticado
    if (!loading && user && !hasAccess && !hasRedirected.current) {
      hasRedirected.current = true;
      const reason = requireRole && userRole !== requireRole
        ? `Acesso restrito ao perfil "${requireRole}". Seu perfil atual é "${userRole}".`
        : `Acesso negado ao módulo "${moduleLabels[module]}". Você não tem permissão para acessar esta página.`;
      toast.error(reason, {
        duration: 5000,
      });
      setLocation("/");
    }
  }, [loading, user, hasAccess, setLocation]);

  // Durante carregamento ou se não autenticado, renderiza normalmente
  // (DashboardLayout cuida da tela de login)
  if (loading || !user) {
    return <>{children}</>;
  }

  // Se não tem acesso, não renderiza nada (o useEffect vai redirecionar)
  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
