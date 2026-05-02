import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Equipamentos from "./pages/Equipamentos";
import Setores from "./pages/Setores";
import Servicos from "./pages/Servicos";
import Produtos from "./pages/Produtos";
import Combustiveis from "./pages/Combustiveis";
import ParteDiaria from "./pages/ParteDiaria";
import Abastecimento from "./pages/Abastecimento";
import Producao from "./pages/Producao";
import Custos from "./pages/Custos";
import Cadastros from "./pages/Cadastros";

import Unidades from "./pages/Unidades";
import GruposEquipamentos from "./pages/GruposEquipamentos";
import SetoresCusto from "./pages/SetoresCusto";
import ContasCusto from "./pages/ContasCusto";
import PeriodoCusto from "./pages/PeriodoCusto";
import LancamentoCusto from "./pages/LancamentoCusto";
import ApuracaoCusto from "./pages/ApuracaoCusto";
import CustoSetor from "./pages/CustoSetor";
import ImportacaoCusto from "./pages/ImportacaoCusto";
import Manutencao from "./pages/Manutencao";
import Usuarios from "./pages/Usuarios";
import MeuPerfil from "./pages/MeuPerfil";
import OperadoresMotoristas from "./pages/OperadoresMotoristas";
import MedicaoPilhas from "./pages/MedicaoPilhas";
import DestinatariosWhatsapp from "./pages/DestinatariosWhatsapp";
import PecasDesgaste from "./pages/PecasDesgaste";
import Vendas from "./pages/Vendas";
import Clientes from "./pages/Clientes";
import Permissoes from "./pages/Permissoes";
import Login from "./pages/Login";
import TrocarSenha from "./pages/TrocarSenha";
import MobileDashboard from "./pages/MobileDashboard";
import MetasAlertas from "./pages/MetasAlertas";
import OutrasParadas from "./pages/OutrasParadas";
import Rotinas from "./pages/Rotinas";

function Router() {
  return (
    <Switch>
      {/* Dashboard - acesso livre */}
      <Route path={"/"}>
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      
      {/* Página de Cadastros - acesso livre */}
      <Route path={"/cadastros"}>
        <DashboardLayout>
          <Cadastros />
        </DashboardLayout>
      </Route>
      
      {/* Cadastros Básicos - protegidos por módulo */}
      <Route path={"/equipamentos"}>
        <DashboardLayout>
          <ProtectedRoute module="equipamentos">
            <Equipamentos />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/setores"}>
        <DashboardLayout>
          <ProtectedRoute module="setores">
            <Setores />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/servicos"}>
        <DashboardLayout>
          <ProtectedRoute module="servicos">
            <Servicos />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/produtos"}>
        <DashboardLayout>
          <ProtectedRoute module="produtos">
            <Produtos />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/combustiveis"}>
        <DashboardLayout>
          <ProtectedRoute module="combustiveis">
            <Combustiveis />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/unidades"}>
        <DashboardLayout>
          <ProtectedRoute module="unidades">
            <Unidades />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/grupos-equipamentos"}>
        <DashboardLayout>
          <ProtectedRoute module="gruposEquipamentos">
            <GruposEquipamentos />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/setores-custo"}>
        <DashboardLayout>
          <ProtectedRoute module="setorDeCusto">
            <SetoresCusto />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/contas-custo"}>
        <DashboardLayout>
          <ProtectedRoute module="contaCusto">
            <ContasCusto />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/periodo-custo"}>
        <DashboardLayout>
          <ProtectedRoute module="custos">
            <PeriodoCusto />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/lancamento-custo"}>
        <DashboardLayout>
          <ProtectedRoute module="custos">
            <LancamentoCusto />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/apuracao-custo"}>
        <DashboardLayout>
          <ProtectedRoute module="custos">
            <ApuracaoCusto />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/custo-setor"}>
        <DashboardLayout>
          <ProtectedRoute module="custos">
            <CustoSetor />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/importacao-custo"}>
        <DashboardLayout>
          <ProtectedRoute module="custos">
            <ImportacaoCusto />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/outras-paradas"}>
        <DashboardLayout>
          <ProtectedRoute module="outrasParadas">
            <OutrasParadas />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/operadores-motoristas"}>
        <DashboardLayout>
          <ProtectedRoute module="operadoresMotoristas">
            <OperadoresMotoristas />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      
      {/* Módulos Operacionais - protegidos por módulo */}
      <Route path={"/parte-diaria"}>
        <DashboardLayout>
          <ProtectedRoute module="parteDiaria">
            <ParteDiaria />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/abastecimento"}>
        <DashboardLayout>
          <ProtectedRoute module="abastecimento">
            <Abastecimento />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/producao"}>
        <DashboardLayout>
          <ProtectedRoute module="producao">
            <Producao />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/custos"}>
        <DashboardLayout>
          <ProtectedRoute module="custos">
            <Custos />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/manutencao"}>
        <DashboardLayout>
          <ProtectedRoute module="manutencao">
            <Manutencao />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/medicao-pilhas"}>
        <DashboardLayout>
          <ProtectedRoute module="medicaoPilhas">
            <MedicaoPilhas />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/destinatarios-whatsapp"}>
        <DashboardLayout>
          <ProtectedRoute module="usuarios">
            <DestinatariosWhatsapp />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/pecas-desgaste"}>
        <DashboardLayout>
          <ProtectedRoute module="pecasDesgaste">
            <PecasDesgaste />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/vendas"}>
        <DashboardLayout>
          <ProtectedRoute module="vendas">
            <Vendas />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/clientes"}>
        <DashboardLayout>
          <ProtectedRoute module="clientes">
            <Clientes />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/usuarios"}>
        <DashboardLayout>
          <ProtectedRoute module="usuarios">
            <Usuarios />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>
      <Route path={"/admin/usuarios"}>
        <DashboardLayout>
          <ProtectedRoute module="usuarios">
            <Usuarios />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      {/* Permissões - acesso restrito a Consultoria */}
      <Route path={"/permissoes"}>
        <DashboardLayout>
          <Permissoes />
        </DashboardLayout>
      </Route>

      {/* Rotinas Diárias - acesso restrito a Consultoria/Admin */}
      <Route path={"/rotinas"}>
        <DashboardLayout>
          <Rotinas />
        </DashboardLayout>
      </Route>

      {/* Meu Perfil - acesso livre (qualquer usuário autenticado) */}
      <Route path={"/meu-perfil"}>
        <DashboardLayout>
          <MeuPerfil />
        </DashboardLayout>
      </Route>
      
      {/* PWA Mobile - Dashboard para celular, sem DashboardLayout */}
      <Route path="/mobile">
        <MobileDashboard />
      </Route>

      {/* Metas e Alertas Push - dentro do DashboardLayout */}
      <Route path="/metas-alertas">
        <DashboardLayout>
          <ProtectedRoute module="usuarios">
            <MetasAlertas />
          </ProtectedRoute>
        </DashboardLayout>
      </Route>

      {/* Autenticação - páginas públicas (sem DashboardLayout) */}
      <Route path="/login">
        <Login />
      </Route>
      <Route path="/trocar-senha">
        <TrocarSenha />
      </Route>

      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
