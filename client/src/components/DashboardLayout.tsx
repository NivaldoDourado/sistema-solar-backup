import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { usePermissions } from "@/hooks/usePermissions";
import {
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Truck,
  FileText,
  Fuel,
  BarChart3,
  DollarSign,
  FileUp,
  Wrench,
  Settings,
  Users,
  UserCog,
  RefreshCw,
  Package,
  ShoppingCart,
  Building2,
  Shield,
  Bell,
  Smartphone,
  ClipboardList,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  PieChart,
  TrendingUp,
  Activity,
} from "lucide-react";
import React, { CSSProperties, useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { NotificationBell } from "./NotificationBell";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { hasModuleAccess, userRole } = usePermissions();
  const logout = trpc.auth.logout.useMutation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Definir itens do menu com controle de acesso
  // Itens de custo agrupados sob "Apropriação de Custo"
  const custoSubItems = [
    { icon: DollarSign, label: "Lançamento de Custos", path: "/lancamento-custo", module: "custos" as const },
    { icon: BarChart3, label: "Apuração de Custo", path: "/apuracao-custo", module: "custos" as const },
    { icon: PieChart, label: "Custo por Setor", path: "/custo-setor", module: "custos" as const },
    { icon: BarChart3, label: "Relatório Analítico", path: "/custo-setor-analitico", module: "custos" as const },
    { icon: FileUp, label: "Importação de Planilha", path: "/importacao-custo", module: "custos" as const },
    { icon: FileUp, label: "Import. Despesas Equip.", path: "/import-despesas", module: "custos" as const },
    { icon: BarChart3, label: "Avaliação Global", path: "/avaliacao-global", module: "custos" as const },
    { icon: TrendingUp, label: "Comparativos Históricos", path: "/comparativos-historicos", module: "custos" as const },
    { icon: Activity, label: "Simulação de Custos", path: "/simulacao-custo", module: "custos" as const },
    { icon: ClipboardCheck, label: "Revisão Correspondências", path: "/revisao-correspondencias", module: "custos" as const },
  ];

  const allMenuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/", module: null },
    { icon: FileText, label: "Parte Diária", path: "/parte-diaria", module: "parteDiaria" as const },
    { icon: Fuel, label: "Abastecimento", path: "/abastecimento", module: "abastecimento" as const },
    { icon: BarChart3, label: "Produção", path: "/producao", module: "producao" as const },
    { icon: DollarSign, label: "Custos", path: "/custos", module: "custos" as const },
    { icon: Wrench, label: "Manutenção", path: "/manutencao", module: "manutencao" as const },
    { icon: BarChart3, label: "Medição Pilhas", path: "/medicao-pilhas", module: "medicaoPilhas" as const },
    { icon: Package, label: "Peças de Desgaste", path: "/pecas-desgaste", module: null },
    { icon: ShoppingCart, label: "Vendas", path: "/vendas", module: "vendas" as const },
    { icon: Building2, label: "Clientes", path: "/clientes", module: "clientes" as const },
    { icon: Truck, label: "Equipamentos", path: "/equipamentos", module: "equipamentos" as const },
    { icon: Settings, label: "Cadastros", path: "/cadastros", module: null },
    { icon: Users, label: "Usuários", path: "/usuarios", module: "usuarios" as const },
    { icon: Shield, label: "Permissões", path: "/permissoes", module: null },
    { icon: ClipboardList, label: "Rotinas Diárias", path: "/rotinas", module: null },
    { icon: Bell, label: "Metas e Alertas", path: "/metas-alertas", module: null },
    { icon: Smartphone, label: "App Mobile", path: "/mobile", module: null },
  ];

  // Perfis com acesso administrativo
  const isAdminRole = userRole === "admin" || userRole === "consultoria" || userRole === "diretor";

  // Filtrar subitens de Apropriação de Custo
  const filteredCustoSubItems = custoSubItems.filter(() => hasModuleAccess("custos"));

  // Filtrar itens do menu baseado nas permissões
  const menuItems = allMenuItems.filter(item => {
    // Permissões: visível apenas para Consultoria e Admin
    if (item.path === "/permissoes") {
      return userRole === "consultoria" || userRole === "admin";
    }
    // Rotinas Diárias: visível apenas para Consultoria e Admin
    if (item.path === "/rotinas") {
      return userRole === "consultoria" || userRole === "admin";
    }
    // Usuários: visível apenas para Admin, Consultoria e Diretor
    if (item.path === "/usuarios" || item.path === "/admin/usuarios") {
      return isAdminRole;
    }
    // Metas e Alertas: visível apenas para Admin, Consultoria e Diretor
    if (item.path === "/metas-alertas") {
      return isAdminRole;
    }
    // App Mobile: visível para todos
    if (item.path === "/mobile") {
      return true;
    }
    if (!item.module) return true; // Dashboard e Cadastros sempre visíveis
    return hasModuleAccess(item.module);
  });

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    // Redirecionar automaticamente para a tela de login personalizada
    window.location.href = "/login";
    return null;
  }

  return (
    <SidebarProvider>
      <DashboardLayoutContent
        menuItems={menuItems}
        custoSubItems={filteredCustoSubItems}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        user={user}
        logout={logout}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  menuItems,
  custoSubItems,
  sidebarWidth,
  setSidebarWidth,
  user,
  logout,
}: {
  children: React.ReactNode;
  menuItems: any[];
  custoSubItems: any[];
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  user: any;
  logout: any;
}) {
  const [location, setLocation] = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  // Detectar se algum subitem de custo está ativo
  const custoSubPaths = custoSubItems.map(i => i.path);
  const isCustoActive = custoSubPaths.includes(location);
  const [custoOpen, setCustoOpen] = useState(() => isCustoActive);

  // Abrir o grupo de custo automaticamente quando navegar para uma rota de custo
  useEffect(() => {
    if (isCustoActive) setCustoOpen(true);
  }, [isCustoActive]);

  // activeMenuItem considera tanto os itens principais quanto os subitens de custo
  const activeMenuItem = menuItems.find(item => item.path === location)
    ?? custoSubItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <Sidebar
        ref={sidebarRef}
        collapsible="icon"
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <SidebarHeader className="p-4 border-b">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            {/* Ícone compacto quando sidebar recolhida */}
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/dgsolar-icon-192-v1774802666_01352d9a.png"
              alt="SOLAR"
              className="h-7 w-7 rounded-md shrink-0 object-cover"
            />
            {/* Logomarca horizontal quando sidebar expandida */}
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/logo-solar-horizontal_c2527f96.png"
              alt="SOLAR - Pedreira Solar"
              className="h-8 object-contain group-data-[collapsible=icon]:hidden"
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="p-2">
          <SidebarMenu>
            {menuItems.map(item => {
              const isActive = location === item.path;

              // Após o item "Custos" inserir o grupo "Apropriação de Custo"
              if (item.path === "/custos" && custoSubItems.length > 0) {
                return (
                  <React.Fragment key="custos-group">
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-10 transition-all font-normal"
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Grupo Apropriação de Custo */}
                    <SidebarMenuItem key="apropriacao-custo-group">
                      <SidebarMenuButton
                        isActive={isCustoActive}
                        onClick={() => setCustoOpen(o => !o)}
                        tooltip="Apropriação de Custo"
                        className="h-10 transition-all font-normal"
                      >
                        <PieChart className={`h-4 w-4 ${isCustoActive ? "text-primary" : ""}`} />
                        <span>Apropriação de Custo</span>
                        {custoOpen
                          ? <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                      </SidebarMenuButton>
                      {custoOpen && (
                        <SidebarMenuSub>
                          {custoSubItems.map(sub => {
                            const isSubActive = location === sub.path;
                            return (
                              <SidebarMenuSubItem key={sub.path}>
                                <SidebarMenuSubButton
                                  isActive={isSubActive}
                                  onClick={() => setLocation(sub.path)}
                                  className="h-9 font-normal"
                                >
                                  <sub.icon className={`h-3.5 w-3.5 ${isSubActive ? "text-primary" : ""}`} />
                                  <span>{sub.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  </React.Fragment>
                );
              }

              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className={`h-10 transition-all font-normal`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                    />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate capitalize">
                    {user?.role}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => setLocation("/meu-perfil")}
                className="cursor-pointer"
              >
                <UserCog className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  window.location.reload();
                }}
                className="cursor-pointer"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // Sempre redirecionar para a tela de login personalizada após logout
                  logout.mutate(undefined, {
                    onSuccess: () => { window.location.href = "/login"; },
                    onError: () => { window.location.href = "/login"; },
                  });
                }}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>

        {!isCollapsed && !isMobile && (
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            style={{
              background: isResizing ? "hsl(var(--primary) / 0.2)" : undefined,
            }}
          />
        )}
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background px-6 sticky top-0 z-10">
          <SidebarTrigger>
            <PanelLeft className="h-5 w-5" />
          </SidebarTrigger>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">
              {activeMenuItem?.label || "Dashboard"}
            </h1>
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
