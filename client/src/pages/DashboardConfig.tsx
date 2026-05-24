import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LayoutDashboard, RotateCcw, Save, Eye, EyeOff, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
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

type CardConfig = {
  cardId: string;
  visivel: boolean;
  ordem: number;
};

export default function DashboardConfig() {
  const { userRole } = usePermissions();
  const [selectedRole, setSelectedRole] = useState<string>("diretor");
  const [cardConfigs, setCardConfigs] = useState<CardConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Resumo": true,
    "Comercial": true,
    "Produção": true,
    "Gráficos": true,
    "Manutenção": true,
    "Sistema": true,
  });

  const { data: metadata } = trpc.dashboardConfig.metadata.useQuery();
  const { data: roleConfig, refetch } = trpc.dashboardConfig.getByRole.useQuery(
    { perfil: selectedRole },
    { enabled: !!selectedRole }
  );

  const saveMutation = trpc.dashboardConfig.save.useMutation({
    onSuccess: () => {
      toast.success("Configuração do Dashboard salva com sucesso!");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const resetMutation = trpc.dashboardConfig.resetToDefault.useMutation({
    onSuccess: () => {
      toast.success("Configuração resetada para o padrão!");
      setHasChanges(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao resetar: ${error.message}`);
    },
  });

  useEffect(() => {
    if (roleConfig) {
      setCardConfigs(roleConfig.map((c, idx) => ({
        cardId: c.cardId,
        visivel: c.visivel,
        ordem: c.ordem ?? idx,
      })));
      setHasChanges(false);
    }
  }, [roleConfig]);

  const toggleCard = (cardId: string) => {
    setCardConfigs(prev => prev.map(c =>
      c.cardId === cardId ? { ...c, visivel: !c.visivel } : c
    ));
    setHasChanges(true);
  };

  const toggleAllInGroup = (groupCards: string[], visible: boolean) => {
    setCardConfigs(prev => prev.map(c =>
      groupCards.includes(c.cardId) ? { ...c, visivel: visible } : c
    ));
    setHasChanges(true);
  };

  const moveCard = (cardId: string, direction: "up" | "down") => {
    setCardConfigs(prev => {
      const sorted = [...prev].sort((a, b) => a.ordem - b.ordem);
      const idx = sorted.findIndex(c => c.cardId === cardId);
      if (direction === "up" && idx > 0) {
        const temp = sorted[idx].ordem;
        sorted[idx].ordem = sorted[idx - 1].ordem;
        sorted[idx - 1].ordem = temp;
      } else if (direction === "down" && idx < sorted.length - 1) {
        const temp = sorted[idx].ordem;
        sorted[idx].ordem = sorted[idx + 1].ordem;
        sorted[idx + 1].ordem = temp;
      }
      return sorted;
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      perfil: selectedRole as any,
      cards: cardConfigs,
    });
  };

  const handleReset = () => {
    if (confirm("Resetar configuração deste perfil para o padrão?")) {
      resetMutation.mutate({ perfil: selectedRole as any });
    }
  };

  const visibleCount = cardConfigs.filter(c => c.visivel).length;
  const totalCount = cardConfigs.length;

  if (!["admin", "consultoria"].includes(userRole || "")) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito à Consultoria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Configuração do Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure quais cards cada perfil visualiza no Dashboard
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar Padrão
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      {/* Seletor de Perfil */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Perfil</CardTitle>
          <CardDescription>Selecione o perfil para configurar a visibilidade dos cards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(metadata?.roles || Object.keys(roleLabels)).map((role) => (
              <Button
                key={role}
                variant={selectedRole === role ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRole(role)}
                className="gap-2"
              >
                <div className={`w-2 h-2 rounded-full ${roleColors[role] || "bg-gray-400"}`} />
                {roleLabels[role] || role}
              </Button>
            ))}
          </div>
          {selectedRole && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              <span>{visibleCount} de {totalCount} cards visíveis para o perfil <strong>{roleLabels[selectedRole]}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards por Grupo */}
      {metadata?.groups.map((group) => {
        const groupCardConfigs = cardConfigs
          .filter(c => group.cards.includes(c.cardId))
          .sort((a, b) => a.ordem - b.ordem);
        const allVisible = groupCardConfigs.every(c => c.visivel);
        const noneVisible = groupCardConfigs.every(c => !c.visivel);
        const isExpanded = expandedGroups[group.label] !== false;

        return (
          <Card key={group.label}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center gap-2 cursor-pointer select-none"
                  onClick={() => setExpandedGroups(prev => ({ ...prev, [group.label]: !isExpanded }))}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <CardTitle className="text-lg">{group.label}</CardTitle>
                  <Badge variant="secondary" className="ml-2">
                    {groupCardConfigs.filter(c => c.visivel).length}/{groupCardConfigs.length}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAllInGroup(group.cards, true)}
                    disabled={allVisible}
                    className="text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Todos
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAllInGroup(group.cards, false)}
                    disabled={noneVisible}
                    className="text-xs"
                  >
                    <EyeOff className="h-3 w-3 mr-1" />
                    Nenhum
                  </Button>
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                <div className="space-y-2">
                  {groupCardConfigs.map((config) => {
                    const cardMeta = metadata?.cards.find(c => c.id === config.cardId);
                    return (
                      <div
                        key={config.cardId}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          config.visivel
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/30 border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={config.visivel}
                            onCheckedChange={() => toggleCard(config.cardId)}
                          />
                          <div>
                            <span className={`text-sm font-medium ${!config.visivel ? "text-muted-foreground line-through" : ""}`}>
                              {cardMeta?.label || config.cardId}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveCard(config.cardId, "up")}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => moveCard(config.cardId, "down")}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          {config.visivel ? (
                            <Eye className="h-4 w-4 text-primary ml-2" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground ml-2" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Aviso de alterações não salvas */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="border-primary shadow-lg">
            <CardContent className="p-4 flex items-center gap-3">
              <span className="text-sm font-medium">Alterações não salvas</span>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-3 w-3 mr-1" />
                Salvar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
