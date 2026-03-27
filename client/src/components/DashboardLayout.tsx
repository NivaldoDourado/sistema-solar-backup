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
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  Wrench,
  Settings,
  Users,
  UserCog,
  RefreshCw,
  Package,
  ShoppingCart,
  Building2,
  Shield
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
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
  ];

  // Filtrar itens do menu baseado nas permissões
  const menuItems = allMenuItems.filter(item => {
    // Permissões: visível apenas para Consultoria e Admin
    if (item.path === "/permissoes") {
      return userRole === "consultoria" || userRole === "admin";
    }
    if (!item.module) return true; // Dashboard e Cadastros sempre visíveis
    return hasModuleAccess(item.module);
  });

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Faça login para continuar
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              O acesso ao sistema requer autenticação. Continue para fazer login.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <DashboardLayoutContent
        menuItems={menuItems}
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
  sidebarWidth,
  setSidebarWidth,
  user,
  logout,
}: {
  children: React.ReactNode;
  menuItems: any[];
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
  const activeMenuItem = menuItems.find(item => item.path === location);
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
            <LayoutDashboard className="h-6 w-6 text-primary shrink-0" />
            <span className="font-semibold text-lg group-data-[collapsible=icon]:hidden">
              PEDREIRA SOLAR
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-2">
          <SidebarMenu>
            {menuItems.map(item => {
              const isActive = location === item.path;
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
                  // Determinar para onde redirecionar após logout:
                  // Usuários locais (loginMethod === 'local') vão para /login
                  // Usuários OAuth do Manus vão para o portal OAuth
                  const isLocalUser = user?.loginMethod === 'local';
                  const redirectUrl = isLocalUser ? "/login" : getLoginUrl();
                  const doRedirect = (url: string) => {
                    if (url.startsWith("/")) {
                      // Rota interna: sempre no frame atual
                      window.location.href = url;
                    } else {
                      // URL externa (portal OAuth): usar frame pai se dentro de iframe
                      try {
                        if (window.top && window.top !== window) {
                          window.top.location.href = url;
                        } else {
                          window.location.href = url;
                        }
                      } catch {
                        window.open(url, "_blank");
                      }
                    }
                  };
                  logout.mutate(undefined, {
                    onSuccess: () => doRedirect(redirectUrl),
                    onError: () => doRedirect(redirectUrl),
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
