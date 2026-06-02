import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Building2, ArrowRightLeft, AlertTriangle, Filter, Plus, Pencil, Trash2, Tag } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ===== ABA 1: CORRESPONDÊNCIAS EQUIPAMENTO → SETOR =====
function TabEquipamentoSetor() {
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todos");
  const [filtroSetor, setFiltroSetor] = useState<string>("todos");
  const [editando, setEditando] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.itensDespesa.listarCorrespondenciasSetor.useQuery();

  const alterarSetor = trpc.itensDespesa.alterarSetorEquipamento.useMutation({
    onSuccess: () => {
      toast.success("Setor alterado com sucesso!");
      refetch();
      setEditando(null);
    },
    onError: (err: any) => toast.error(`Erro ao alterar setor: ${err.message}`),
  });

  const equipamentos = data?.equipamentos || [];
  const setores = data?.setores || [];

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

  const stats = useMemo(() => {
    const total = equipamentos.length;
    const comCadastro = equipamentos.filter(e => e.origemSetor === "cadastro").length;
    const porGrupo = equipamentos.filter(e => e.origemSetor.startsWith("grupo")).length;
    const porNome = equipamentos.filter(e => e.origemSetor === "nome").length;
    const naoDefinido = equipamentos.filter(e => e.setorNome === "NÃO DEFINIDO").length;
    const excluidos = equipamentos.filter(e => e.excluidoCusto).length;
    return { total, comCadastro, porGrupo, porNome, naoDefinido, excluidos };
  }, [equipamentos]);

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
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.comCadastro}</div><div className="text-xs text-muted-foreground">Setor Definido</div></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-blue-600">{stats.porGrupo}</div><div className="text-xs text-muted-foreground">Via Grupo</div></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-amber-600">{stats.porNome}</div><div className="text-xs text-muted-foreground">Inferido (Nome)</div></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-red-600">{stats.naoDefinido}</div><div className="text-xs text-muted-foreground">Não Definido</div></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-gray-500">{stats.excluidos}</div><div className="text-xs text-muted-foreground">Excluídos</div></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, tag, setor..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
          <SelectTrigger className="w-[180px]"><Filter className="w-4 h-4 mr-1" /><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas origens</SelectItem>
            <SelectItem value="cadastro">Cadastro</SelectItem>
            <SelectItem value="grupo">Via Grupo</SelectItem>
            <SelectItem value="nome">Inferido (Nome)</SelectItem>
            <SelectItem value="nenhum">Não Definido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroSetor} onValueChange={setFiltroSetor}>
          <SelectTrigger className="w-[220px]"><Building2 className="w-4 h-4 mr-1" /><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos setores</SelectItem>
            {setoresUnicos.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">Exibindo {equipFiltrados.length} de {equipamentos.length} equipamentos</div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Equipamento</th>
                  <th className="text-left p-3 font-medium">Tag</th>
                  <th className="text-left p-3 font-medium">Grupo</th>
                  <th className="text-left p-3 font-medium">Setor Atual</th>
                  <th className="text-left p-3 font-medium">Origem</th>
                  <th className="text-center p-3 font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {equipFiltrados.map(equip => (
                  <tr key={equip.id} className={`border-b hover:bg-muted/30 transition-colors ${equip.excluidoCusto ? "opacity-50 bg-red-50/30" : ""} ${equip.setorNome === "NÃO DEFINIDO" ? "bg-amber-50/30" : ""}`}>
                    <td className="p-3">
                      <div className="font-medium text-xs">{equip.nomeDoEquipamento}</div>
                      {equip.excluidoCusto && <Badge variant="destructive" className="text-[10px] mt-0.5">Excluído</Badge>}
                    </td>
                    <td className="p-3"><code className="text-xs bg-muted px-1 py-0.5 rounded">{equip.codigoTag || "—"}</code></td>
                    <td className="p-3 text-xs text-muted-foreground">{equip.grupoNome || "—"}</td>
                    <td className="p-3">
                      {editando === equip.id ? (
                        <Select onValueChange={(val) => handleAlterarSetor(equip.id, val === "none" ? null : parseInt(val))}>
                          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Nenhum —</SelectItem>
                            {setores.map(s => (<SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs font-medium ${equip.setorNome === "NÃO DEFINIDO" ? "text-red-600" : ""}`}>{equip.setorNome}</span>
                      )}
                    </td>
                    <td className="p-3">{getOrigemBadge(equip.origemSetor)}</td>
                    <td className="p-3 text-center">
                      {editando === equip.id ? (
                        <Button variant="ghost" size="sm" onClick={() => setEditando(null)} className="text-xs h-7">Cancelar</Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setEditando(equip.id)} className="text-xs h-7" disabled={alterarSetor.isPending}>Alterar</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== ABA 2: CORRESPONDÊNCIAS DE TAGS (CENTROS DE CUSTO NOVOS) =====
function TabCorrespondenciasTags() {
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoItem, setEditandoItem] = useState<any | null>(null);

  // Form state
  const [formTag, setFormTag] = useState("");
  const [formTipo, setFormTipo] = useState<string>("equipamento");
  const [formEquipId, setFormEquipId] = useState<string>("");
  const [formSetorDestino, setFormSetorDestino] = useState("");
  const [formDescricao, setFormDescricao] = useState("");

  const { data, isLoading, refetch } = trpc.itensDespesa.listarCorrespondenciasTags.useQuery();
  const criar = trpc.itensDespesa.criarCorrespondenciaTag.useMutation({
    onSuccess: () => { toast.success("Correspondência criada!"); refetch(); fecharModal(); },
    onError: (err: any) => toast.error(err.message),
  });
  const editar = trpc.itensDespesa.editarCorrespondenciaTag.useMutation({
    onSuccess: () => { toast.success("Correspondência atualizada!"); refetch(); fecharModal(); },
    onError: (err: any) => toast.error(err.message),
  });
  const excluir = trpc.itensDespesa.excluirCorrespondenciaTag.useMutation({
    onSuccess: () => { toast.success("Correspondência removida!"); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const correspondencias = data?.correspondencias || [];
  const equipamentosList = data?.equipamentos || [];
  const setoresList = data?.setores || [];

  const filtradas = useMemo(() => {
    if (!busca) return correspondencias;
    const b = busca.toUpperCase();
    return correspondencias.filter(c =>
      c.tag.toUpperCase().includes(b) ||
      (c.setorDestino && c.setorDestino.toUpperCase().includes(b)) ||
      (c.descricao && c.descricao.toUpperCase().includes(b))
    );
  }, [correspondencias, busca]);

  function abrirCriar() {
    setEditandoItem(null);
    setFormTag("");
    setFormTipo("equipamento");
    setFormEquipId("");
    setFormSetorDestino("");
    setFormDescricao("");
    setModalAberto(true);
  }

  function abrirEditar(item: any) {
    setEditandoItem(item);
    setFormTag(item.tag);
    setFormTipo(item.tipo);
    setFormEquipId(item.equipamentoId ? item.equipamentoId.toString() : "");
    setFormSetorDestino(item.setorDestino || "");
    setFormDescricao(item.descricao || "");
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setEditandoItem(null);
  }

  function salvar() {
    if (!formTag.trim()) { toast.error("Informe a tag/centro de custo"); return; }
    if (formTipo === "equipamento" && !formEquipId) { toast.error("Selecione o equipamento destino"); return; }
    if (formTipo === "setor" && !formSetorDestino) { toast.error("Informe o setor destino"); return; }

    const payload = {
      tag: formTag.trim(),
      tipo: formTipo as any,
      equipamentoId: formTipo === "equipamento" ? parseInt(formEquipId) : null,
      setorDestino: formTipo === "setor" ? formSetorDestino : null,
      descricao: formDescricao || null,
    };

    if (editandoItem) {
      editar.mutate({ id: editandoItem.id, ...payload });
    } else {
      criar.mutate(payload);
    }
  }

  function getEquipNome(id: number | null) {
    if (!id) return "—";
    const e = equipamentosList.find(eq => eq.id === id);
    return e ? e.nome : `ID ${id}`;
  }

  function getTipoBadge(tipo: string) {
    switch (tipo) {
      case "equipamento": return <Badge className="bg-blue-600 text-xs">Equipamento</Badge>;
      case "setor": return <Badge className="bg-purple-600 text-xs">Desp. Setor</Badge>;
      case "explosivos": return <Badge className="bg-orange-600 text-xs">Explosivos</Badge>;
      case "excluir": return <Badge variant="destructive" className="text-xs">Excluir</Badge>;
      case "nao_lancar": return <Badge variant="secondary" className="text-xs">Não Lançar</Badge>;
      default: return <Badge variant="outline" className="text-xs">{tipo}</Badge>;
    }
  }

  function getDestinoLabel(item: any) {
    if (item.tipo === "equipamento") return getEquipNome(item.equipamentoId);
    if (item.tipo === "setor") return `Outras Desp. Setor → ${item.setorDestino}`;
    if (item.tipo === "explosivos") return "Explosivos e Acessórios";
    if (item.tipo === "excluir") return "Excluído da importação";
    if (item.tipo === "nao_lancar") return "Não lançar";
    return "—";
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-4">
      {/* Explicação */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-blue-800">
              <strong>Correspondências de Centros de Custo:</strong> Quando um novo centro de custo (tag) aparecer na planilha de despesas
              e o sistema não souber onde alocar, cadastre aqui a correspondência. Na próxima importação, o sistema usará esta tabela
              para direcionar automaticamente as despesas ao equipamento ou setor correto.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por tag, setor, descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={abrirCriar} className="gap-1">
          <Plus className="w-4 h-4" /> Nova Correspondência
        </Button>
      </div>

      {/* Contagem */}
      <div className="text-sm text-muted-foreground">
        {filtradas.length} correspondência{filtradas.length !== 1 ? "s" : ""} cadastrada{filtradas.length !== 1 ? "s" : ""}
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Tag / Centro de Custo</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Destino</th>
                  <th className="text-left p-3 font-medium">Descrição</th>
                  <th className="text-center p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {correspondencias.length === 0 ? "Nenhuma correspondência cadastrada. Clique em \"Nova Correspondência\" para adicionar." : "Nenhum resultado para a busca."}
                  </td></tr>
                ) : (
                  filtradas.map(item => (
                    <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{item.tag}</code>
                      </td>
                      <td className="p-3">{getTipoBadge(item.tipo)}</td>
                      <td className="p-3 text-xs">{getDestinoLabel(item)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{item.descricao || "—"}</td>
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditar(item)} className="h-7 w-7 p-0">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Remover correspondência "${item.tag}"?`)) excluir.mutate({ id: item.id }); }} className="h-7 w-7 p-0 text-red-600 hover:text-red-700">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Criar/Editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editandoItem ? "Editar Correspondência" : "Nova Correspondência"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Tag / Centro de Custo (como aparece na planilha)</label>
              <Input value={formTag} onChange={e => setFormTag(e.target.value)} placeholder="Ex: PERFURATRIZ 02, TC12 — TRANSPORTADOR..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo de Destino</label>
              <Select value={formTipo} onValueChange={setFormTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipamento">Equipamento (alocar despesas no equipamento)</SelectItem>
                  <SelectItem value="setor">Outras Desp. Setor (alocar no setor)</SelectItem>
                  <SelectItem value="explosivos">Explosivos e Acessórios (conta específica)</SelectItem>
                  <SelectItem value="excluir">Excluir da importação</SelectItem>
                  <SelectItem value="nao_lancar">Não lançar (ignorar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formTipo === "equipamento" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Equipamento Destino</label>
                <Select value={formEquipId} onValueChange={setFormEquipId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o equipamento..." /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {equipamentosList.map(e => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.nome} {e.tag ? `(${e.tag})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formTipo === "setor" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Setor Destino</label>
                <Select value={formSetorDestino} onValueChange={setFormSetorDestino}>
                  <SelectTrigger><SelectValue placeholder="Selecione o setor..." /></SelectTrigger>
                  <SelectContent>
                    {setoresList.map(s => (
                      <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                    ))}
                    <SelectItem value="ADMINISTRAÇÃO">ADMINISTRAÇÃO</SelectItem>
                    <SelectItem value="OUTROS SERVIÇOS">OUTROS SERVIÇOS</SelectItem>
                    <SelectItem value="ALMOXARIFADO">ALMOXARIFADO</SelectItem>
                    <SelectItem value="REFEITÓRIO">REFEITÓRIO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">Descrição / Motivo (opcional)</label>
              <Input value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Ex: Novo centro de custo adicionado em Maio/2026" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={salvar} disabled={criar.isPending || editar.isPending}>
              {editandoItem ? "Salvar Alterações" : "Criar Correspondência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== PÁGINA PRINCIPAL =====
export default function RevisaoCorrespondencias() {
  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowRightLeft className="w-6 h-6" />
          Revisão de Correspondências
        </h1>
        <p className="text-muted-foreground mt-1">
          Gerencie as correspondências entre centros de custo da planilha e os equipamentos/setores do sistema.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tags" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="tags" className="gap-1">
            <Tag className="w-4 h-4" /> Tags → Destino
          </TabsTrigger>
          <TabsTrigger value="setores" className="gap-1">
            <Building2 className="w-4 h-4" /> Equipamento → Setor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tags" className="mt-4">
          <TabCorrespondenciasTags />
        </TabsContent>

        <TabsContent value="setores" className="mt-4">
          <TabEquipamentoSetor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
