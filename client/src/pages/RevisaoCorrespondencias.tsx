import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building2, ArrowRightLeft, Check, AlertTriangle, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function RevisaoCorrespondencias() {
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todos");
  const [filtroSetor, setFiltroSetor] = useState<string>("todos");
  const [editando, setEditando] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.itensDespesa.listarCorrespondenciasSetor.useQuery();

  const alterarSetor = trpc.itensDespesa.alterarSetorEquipamento.useMutation({
    onSuccess: () => {
      toast.success("Setor alterado com sucesso! Os cálculos serão atualizados automaticamente.");
      refetch();
      setEditando(null);
    },
    onError: (err: any) => toast.error(`Erro ao alterar setor: ${err.message}`),
  });

  const equipamentos = data?.equipamentos || [];
  const setores = data?.setores || [];

  // Filtros
  const equipFiltrados = useMemo(() => {
    let lista = equipamentos;

    if (busca) {
      const b = busca.toUpperCase();
      lista = lista.filter(e =>
        e.nomeDoEquipamento.toUpperCase().includes(b) ||
        (e.codigoTag && e.codigoTag.toUpperCase().includes(b)) ||
        e.setorNome.toUpperCase().includes(b) ||
        e.tagsPlanilha.some(t => t.toUpperCase().includes(b))
      );
    }

    if (filtroOrigem !== "todos") {
      lista = lista.filter(e => e.origemSetor === filtroOrigem || e.origemSetor.startsWith(filtroOrigem));
    }

    if (filtroSetor !== "todos") {
      lista = lista.filter(e => e.setorNome === filtroSetor);
    }

    return lista;
  }, [equipamentos, busca, filtroOrigem, filtroSetor]);

  // Estatísticas
  const stats = useMemo(() => {
    const total = equipamentos.length;
    const comCadastro = equipamentos.filter(e => e.origemSetor === "cadastro").length;
    const porGrupo = equipamentos.filter(e => e.origemSetor.startsWith("grupo")).length;
    const porNome = equipamentos.filter(e => e.origemSetor === "nome").length;
    const naoDefinido = equipamentos.filter(e => e.setorNome === "NÃO DEFINIDO").length;
    const excluidos = equipamentos.filter(e => e.excluidoCusto).length;
    return { total, comCadastro, porGrupo, porNome, naoDefinido, excluidos };
  }, [equipamentos]);

  // Setores únicos para filtro
  const setoresUnicos = useMemo(() => {
    const s = new Set(equipamentos.map(e => e.setorNome));
    return Array.from(s).sort();
  }, [equipamentos]);

  const handleAlterarSetor = (equipamentoId: number, setorId: number | null) => {
    alterarSetor.mutate({ equipamentoId, setorId });
  };

  const getOrigemBadge = (origem: string) => {
    if (origem === "cadastro") return <Badge variant="default" className="bg-green-600 text-xs">Cadastro</Badge>;
    if (origem.startsWith("grupo")) return <Badge variant="secondary" className="text-xs">Grupo</Badge>;
    if (origem === "nome") return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Inferido</Badge>;
    return <Badge variant="destructive" className="text-xs">Indefinido</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6" />
          Correspondências Equipamento → Setor
        </h1>
        <p className="text-muted-foreground mt-1">
          Revise e altere o setor destino de cada equipamento. Alterações propagam automaticamente para todos os cálculos de custo.
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.comCadastro}</div>
            <div className="text-xs text-muted-foreground">Setor Definido</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.porGrupo}</div>
            <div className="text-xs text-muted-foreground">Via Grupo</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.porNome}</div>
            <div className="text-xs text-muted-foreground">Inferido (Nome)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.naoDefinido}</div>
            <div className="text-xs text-muted-foreground">Não Definido</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-gray-500">{stats.excluidos}</div>
            <div className="text-xs text-muted-foreground">Excluídos</div>
          </CardContent>
        </Card>
      </div>

      {/* Legenda */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Badge variant="default" className="bg-green-600 text-xs">Cadastro</Badge>
              <span className="text-muted-foreground">= Setor definido diretamente no cadastro do equipamento</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">Grupo</Badge>
              <span className="text-muted-foreground">= Inferido pelo grupo do equipamento</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Inferido</Badge>
              <span className="text-muted-foreground">= Inferido pelo nome (fallback)</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="destructive" className="text-xs">Indefinido</Badge>
              <span className="text-muted-foreground">= Sem setor definido</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, tag, setor..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-1" />
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas origens</SelectItem>
            <SelectItem value="cadastro">Cadastro</SelectItem>
            <SelectItem value="grupo">Via Grupo</SelectItem>
            <SelectItem value="nome">Inferido (Nome)</SelectItem>
            <SelectItem value="nenhum">Não Definido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroSetor} onValueChange={setFiltroSetor}>
          <SelectTrigger className="w-[220px]">
            <Building2 className="w-4 h-4 mr-1" />
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos setores</SelectItem>
            {setoresUnicos.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contagem de resultados */}
      <div className="text-sm text-muted-foreground">
        Exibindo {equipFiltrados.length} de {equipamentos.length} equipamentos
      </div>

      {/* Tabela de correspondências */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Lista de Correspondências</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Equipamento</th>
                  <th className="text-left p-3 font-medium">Tag</th>
                  <th className="text-left p-3 font-medium">Tags Planilha</th>
                  <th className="text-left p-3 font-medium">Grupo</th>
                  <th className="text-left p-3 font-medium">Setor Atual</th>
                  <th className="text-left p-3 font-medium">Origem</th>
                  <th className="text-center p-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {equipFiltrados.map(equip => (
                  <tr
                    key={equip.id}
                    className={`border-b hover:bg-muted/30 transition-colors ${equip.excluidoCusto ? "opacity-50 bg-red-50/30" : ""} ${equip.setorNome === "NÃO DEFINIDO" ? "bg-amber-50/30" : ""}`}
                  >
                    <td className="p-3">
                      <div className="font-medium text-xs">{equip.nomeDoEquipamento}</div>
                      {equip.excluidoCusto && (
                        <Badge variant="destructive" className="text-[10px] mt-0.5">Excluído do custo</Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{equip.codigoTag || "—"}</code>
                    </td>
                    <td className="p-3">
                      {equip.tagsPlanilha.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {equip.tagsPlanilha.slice(0, 3).map(t => (
                            <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                          ))}
                          {equip.tagsPlanilha.length > 3 && (
                            <Badge variant="outline" className="text-[10px]">+{equip.tagsPlanilha.length - 3}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{equip.grupoNome || "—"}</td>
                    <td className="p-3">
                      {editando === equip.id ? (
                        <Select
                          value={equip.setorId?.toString() || "none"}
                          onValueChange={(val) => {
                            const newSetorId = val === "none" ? null : parseInt(val);
                            handleAlterarSetor(equip.id, newSetorId);
                          }}
                        >
                          <SelectTrigger className="w-[200px] h-8 text-xs">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Nenhum —</SelectItem>
                            {setores.map(s => (
                              <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          <span className={`text-xs font-medium ${equip.setorNome === "NÃO DEFINIDO" ? "text-red-600" : ""}`}>
                            {equip.setorNome}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">{getOrigemBadge(equip.origemSetor)}</td>
                    <td className="p-3 text-center">
                      {editando === equip.id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditando(null)}
                          className="text-xs h-7"
                        >
                          Cancelar
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditando(equip.id)}
                          className="text-xs h-7"
                          disabled={alterarSetor.isPending}
                        >
                          Alterar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Nota informativa */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-blue-800">
              <strong>Como funciona:</strong> Ao alterar o setor de um equipamento, o campo <code className="bg-blue-100 px-1 rounded">setorId</code> é 
              atualizado no cadastro. O cálculo de rateio MEM e todos os relatórios de custo utilizam esse campo como fonte primária 
              para determinar em qual setor as despesas do equipamento serão alocadas. Equipamentos sem setor definido no cadastro 
              usam fallback por grupo ou nome — ao definir o setor explicitamente, o fallback deixa de ser usado.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
