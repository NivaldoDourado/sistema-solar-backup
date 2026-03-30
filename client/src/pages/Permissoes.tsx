import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, RotateCcw, Save, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/hooks/usePermissions";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  diretor: "Diretor",
  gerente: "Gerente",
  consultoria: "Consultoria",
  coordenador: "Coordenador",
  usuario: "Usuário",
  controle: "Controle",
  operador: "Operador",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-500",
  diretor: "bg-purple-500",
  gerente: "bg-blue-500",
  consultoria: "bg-green-500",
  coordenador: "bg-yellow-500",
  usuario: "bg-gray-500",
  controle: "bg-orange-500",
  operador: "bg-cyan-500",
};

// Agrupamento de módulos para melhor organização visual
const moduleGroups = [
  {
    label: "Operacional",
    modules: ["parteDiaria", "abastecimento", "producao", "manutencao", "medicaoPilhas"],
  },
  {
    label: "Comercial",
    modules: ["vendas", "clientes"],
  },
  {
    label: "Financeiro",
    modules: ["custos", "pecasDesgaste"],
  },
  {
    label: "Cadastros",
    modules: ["equipamentos", "setores", "servicos", "produtos", "combustiveis", "unidades", "gruposEquipamentos", "setorDeCusto", "contaCusto", "tiposProdutos", "operadoresMotoristas", "outrasParadas"],
  },
  {
    label: "Administração",
    modules: ["usuarios"],
  },
];

const moduleLabels: Record<string, string> = {
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

type PermMap = Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;

export default function Permissoes() {
  const { userRole } = usePermissions();
  const [selectedRole, setSelectedRole] = useState<string>("coordenador");
  const [permissions, setPermissions] = useState<PermMap>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Operacional": true,
    "Comercial": true,
    "Financeiro": true,
    "Cadastros": false,
    "Administração": true,
  });

  const { data: rolePermissions, refetch } = trpc.permissoes.getByRole.useQuery(
    { perfil: selectedRole },
    { enabled: !!selectedRole }
  );

  const saveMutation = trpc.permissoes.save.useMutation({
    onSuccess: () => {
      toast.success("Permissões salvas com sucesso!");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const resetMutation = trpc.permissoes.resetToDefault.useMutation({
    onSuccess: () => {
      toast.success("Permissões resetadas para o padrão!");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao resetar: ${error.message}`);
    },
  });

  useEffect(() => {
    if (rolePermissions) {
      setPermissions(rolePermissions);
      setHasChanges(false);
    }
  }, [rolePermissions]);

  const togglePermission = (module: string, perm: "view" | "create" | "edit" | "delete") => {
    setPermissions(prev => {
      const current = prev[module] || { view: false, create: false, edit: false, delete: false };
      const newPerms = { ...current, [perm]: !current[perm] };
      
      // Se desmarcar "view", desmarcar tudo
      if (perm === "view" && !newPerms.view) {
        newPerms.create = false;
        newPerms.edit = false;
        newPerms.delete = false;
      }
      
      // Se marcar create/edit/delete, marcar view automaticamente
      if ((perm === "create" || perm === "edit" || perm === "delete") && newPerms[perm]) {
        newPerms.view = true;
      }
      
      return { ...prev, [module]: newPerms };
    });
    setHasChanges(true);
  };

  const toggleAllInGroup = (modules: string[], perm: "view" | "create" | "edit" | "delete", value: boolean) => {
    setPermissions(prev => {
      const newPerms = { ...prev };
      for (const module of modules) {
        const current = newPerms[module] || { view: false, create: false, edit: false, delete: false };
        const updated = { ...current, [perm]: value };
        
        if (perm === "view" && !value) {
          updated.create = false;
          updated.edit = false;
          updated.delete = false;
        }
        if ((perm === "create" || perm === "edit" || perm === "delete") && value) {
          updated.view = true;
        }
        
        newPerms[module] = updated;
      }
      return newPerms;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      perfil: selectedRole as any,
      permissoes: permissions,
    });
  };

  const handleReset = () => {
    if (confirm(`Tem certeza que deseja resetar as permissões do perfil "${roleLabels[selectedRole]}" para os valores padrão?`)) {
      resetMutation.mutate({ perfil: selectedRole as any });
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  // Verificar se o perfil Consultoria pode acessar
  if (userRole !== "admin" && userRole !== "consultoria") {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas o perfil Consultoria pode gerenciar permissões do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Contadores de permissões
  const permCounts = useMemo(() => {
    let total = 0;
    let granted = 0;
    for (const module of Object.keys(moduleLabels)) {
      const p = permissions[module];
      if (p) {
        total += 4;
        if (p.view) granted++;
        if (p.create) granted++;
        if (p.edit) granted++;
        if (p.delete) granted++;
      }
    }
    return { total, granted, percentage: total > 0 ? Math.round((granted / total) * 100) : 0 };
  }, [permissions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Permissões</h1>
          <p className="text-muted-foreground">
            Configure o acesso a funcionalidades específicas por perfil de usuário
          </p>
        </div>
      </div>

      {/* Seletor de Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecione o Perfil</CardTitle>
          <CardDescription>
            Escolha o perfil que deseja configurar as permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(roleLabels).map(([value, label]) => (
              <Button
                key={value}
                variant={selectedRole === value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRole(value)}
                className="gap-2"
              >
                <Badge className={`${roleColors[value]} text-white text-[10px] px-1.5 py-0`}>
                  {label.charAt(0)}
                </Badge>
                {label}
              </Button>
            ))}
          </div>
          
          {/* Resumo */}
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {permCounts.granted} de {permCounts.total} permissões ativas ({permCounts.percentage}%)
              </span>
            </div>
            <div className="flex-1 bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${permCounts.percentage}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Permissões por Grupo */}
      {moduleGroups.map(group => {
        const isExpanded = expandedGroups[group.label] !== false;
        
        return (
          <Card key={group.label}>
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleGroup(group.label)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {group.label}
                  <Badge variant="secondary" className="ml-2">
                    {group.modules.length} módulos
                  </Badge>
                </CardTitle>
                {isExpanded && (
                  <div className="flex gap-2 text-xs text-muted-foreground" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => toggleAllInGroup(group.modules, "view", true)}
                    >
                      Todos Visualizar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        toggleAllInGroup(group.modules, "view", true);
                        toggleAllInGroup(group.modules, "create", true);
                        toggleAllInGroup(group.modules, "edit", true);
                        toggleAllInGroup(group.modules, "delete", true);
                      }}
                    >
                      Acesso Total
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive"
                      onClick={() => toggleAllInGroup(group.modules, "view", false)}
                    >
                      Nenhum
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-sm">Módulo</th>
                        <th className="text-center py-2 px-3 font-medium text-sm w-24">Visualizar</th>
                        <th className="text-center py-2 px-3 font-medium text-sm w-24">Criar</th>
                        <th className="text-center py-2 px-3 font-medium text-sm w-24">Editar</th>
                        <th className="text-center py-2 px-3 font-medium text-sm w-24">Excluir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.modules.map(module => {
                        const perm = permissions[module] || { view: false, create: false, edit: false, delete: false };
                        return (
                          <tr key={module} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="py-3 px-3 text-sm font-medium">
                              {moduleLabels[module] || module}
                            </td>
                            <td className="text-center py-3 px-3">
                              <Checkbox
                                checked={perm.view}
                                onCheckedChange={() => togglePermission(module, "view")}
                              />
                            </td>
                            <td className="text-center py-3 px-3">
                              <Checkbox
                                checked={perm.create}
                                onCheckedChange={() => togglePermission(module, "create")}
                              />
                            </td>
                            <td className="text-center py-3 px-3">
                              <Checkbox
                                checked={perm.edit}
                                onCheckedChange={() => togglePermission(module, "edit")}
                              />
                            </td>
                            <td className="text-center py-3 px-3">
                              <Checkbox
                                checked={perm.delete}
                                onCheckedChange={() => togglePermission(module, "delete")}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Barra de Ações Fixa */}
      <div className="sticky bottom-4 z-10">
        <Card className={`shadow-lg ${hasChanges ? "border-primary" : ""}`}>
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasChanges ? (
                <Badge variant="default" className="bg-amber-500">Alterações não salvas</Badge>
              ) : (
                <Badge variant="secondary">Salvo</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Perfil: <strong>{roleLabels[selectedRole]}</strong>
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={resetMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Resetar Padrão
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
              >
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Permissões"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
