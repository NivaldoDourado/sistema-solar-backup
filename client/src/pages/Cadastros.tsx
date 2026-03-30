import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Truck, 
  Building2, 
  Wrench, 
  CircleStop, 
  Package, 
  Fuel, 
  Ruler,
  FolderTree,
  DollarSign,
  HardHat,
  MessageSquare,
  Wallet
} from "lucide-react";
import { Link } from "wouter";

export default function Cadastros() {
  const cadastros = [
    {
      titulo: "Equipamentos",
      descricao: "Gerenciar equipamentos e frota",
      icone: Truck,
      cor: "text-blue-500",
      link: "/equipamentos",
    },
    {
      titulo: "Setores",
      descricao: "Cadastrar setores operacionais",
      icone: Building2,
      cor: "text-green-500",
      link: "/setores",
    },
    {
      titulo: "Serviços",
      descricao: "Cadastrar tipos de serviços",
      icone: Wrench,
      cor: "text-orange-500",
      link: "/servicos",
    },
    {
      titulo: "Manutenções",
      descricao: "Gerenciar paradas e manutenções",
      icone: CircleStop,
      cor: "text-red-500",
      link: "/manutencao",
    },
    {
      titulo: "Produtos",
      descricao: "Cadastrar produtos",
      icone: Package,
      cor: "text-purple-500",
      link: "/produtos",
    },
    {
      titulo: "Combustíveis",
      descricao: "Cadastrar tipos de combustível",
      icone: Fuel,
      cor: "text-yellow-500",
      link: "/combustiveis",
    },
    {
      titulo: "Unidades",
      descricao: "Cadastrar unidades de medida",
      icone: Ruler,
      cor: "text-cyan-500",
      link: "/unidades",
    },
    {
      titulo: "Grupos de Equipamentos",
      descricao: "Cadastrar grupos de equipamentos",
      icone: FolderTree,
      cor: "text-indigo-500",
      link: "/grupos-equipamentos",
    },
    {
      titulo: "Plano de Contas",
      descricao: "Cadastrar contas do plano de contas",
      icone: DollarSign,
      cor: "text-emerald-500",
      link: "/setores-custo",
    },
    {
      titulo: "Conta Custo",
      descricao: "Cadastrar contas de custo",
      icone: Wallet,
      cor: "text-rose-500",
      link: "/contas-custo",
    },
    {
      titulo: "Operadores / Motoristas",
      descricao: "Cadastrar operadores e motoristas",
      icone: HardHat,
      cor: "text-amber-500",
      link: "/operadores-motoristas",
    },
    {
      titulo: "Destinatários WhatsApp",
      descricao: "Cadastrar destinatários de relatórios via WhatsApp",
      icone: MessageSquare,
      cor: "text-green-500",
      link: "/destinatarios-whatsapp",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cadastros</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie todos os cadastros básicos do sistema
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cadastros.map((cadastro) => {
          const Icone = cadastro.icone;
          return (
            <Link key={cadastro.link} href={cadastro.link}>
              <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${cadastro.cor}`}>
                      <Icone className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{cadastro.titulo}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{cadastro.descricao}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
