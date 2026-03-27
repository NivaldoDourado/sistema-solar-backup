import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
  Search,
  FileDown,
  Layers,
  Box,
  ClipboardList,
} from "lucide-react";

export default function PecasDesgaste() {
  const [activeTab, setActiveTab] = useState("estoque");

  // ============================================================================
  // CATEGORIAS
  // ============================================================================
  const [showCategoriaDialog, setShowCategoriaDialog] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<any>(null);
  const [categoriaNome, setCategoriaNome] = useState("");
  const [categoriaDescricao, setCategoriaDescricao] = useState("");

  const categoriasQuery = trpc.categoriasPecasDesgaste.list.useQuery();
  const createCategoria = trpc.categoriasPecasDesgaste.create.useMutation({
    onSuccess: () => {
      categoriasQuery.refetch();
      pecasQuery.refetch();
      setShowCategoriaDialog(false);
      toast.success("Categoria criada com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateCategoria = trpc.categoriasPecasDesgaste.update.useMutation({
    onSuccess: () => {
      categoriasQuery.refetch();
      pecasQuery.refetch();
      setShowCategoriaDialog(false);
      toast.success("Categoria atualizada!");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteCategoria = trpc.categoriasPecasDesgaste.delete.useMutation({
    onSuccess: () => {
      categoriasQuery.refetch();
      toast.success("Categoria excluída!");
    },
    onError: (err) => toast.error(err.message),
  });

  function abrirCategoriaDialog(cat?: any) {
    if (cat) {
      setEditingCategoria(cat);
      setCategoriaNome(cat.nome);
      setCategoriaDescricao(cat.descricao || "");
    } else {
      setEditingCategoria(null);
      setCategoriaNome("");
      setCategoriaDescricao("");
    }
    setShowCategoriaDialog(true);
  }

  function salvarCategoria() {
    if (!categoriaNome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (editingCategoria) {
      updateCategoria.mutate({ id: editingCategoria.id, nome: categoriaNome, descricao: categoriaDescricao || undefined });
    } else {
      createCategoria.mutate({ nome: categoriaNome, descricao: categoriaDescricao || undefined });
    }
  }

  // ============================================================================
  // PEÇAS
  // ============================================================================
  const [showPecaDialog, setShowPecaDialog] = useState(false);
  const [editingPeca, setEditingPeca] = useState<any>(null);
  const [pecaNome, setPecaNome] = useState("");
  const [pecaCodigo, setPecaCodigo] = useState("");
  const [pecaCategoriaId, setPecaCategoriaId] = useState("");
  const [pecaUnidade, setPecaUnidade] = useState("un");
  const [pecaVidaUtil, setPecaVidaUtil] = useState("");
  const [pecaEstoqueMinimo, setPecaEstoqueMinimo] = useState("");
  const [pecaObservacoes, setPecaObservacoes] = useState("");
  const [filtroPecaCategoria, setFiltroPecaCategoria] = useState("todas");
  const [buscaPeca, setBuscaPeca] = useState("");

  const pecasQuery = trpc.pecasDesgaste.list.useQuery();
  const createPeca = trpc.pecasDesgaste.create.useMutation({
    onSuccess: () => {
      pecasQuery.refetch();
      resumoEstoqueQuery.refetch();
      setShowPecaDialog(false);
      toast.success("Peça cadastrada com sucesso!");
    },
    onError: (err) => toast.error(err.message),
  });
  const updatePeca = trpc.pecasDesgaste.update.useMutation({
    onSuccess: () => {
      pecasQuery.refetch();
      resumoEstoqueQuery.refetch();
      setShowPecaDialog(false);
      toast.success("Peça atualizada!");
    },
    onError: (err) => toast.error(err.message),
  });
  const deletePeca = trpc.pecasDesgaste.delete.useMutation({
    onSuccess: () => {
      pecasQuery.refetch();
      resumoEstoqueQuery.refetch();
      toast.success("Peça excluída!");
    },
    onError: (err) => toast.error(err.message),
  });

  function abrirPecaDialog(peca?: any) {
    if (peca) {
      setEditingPeca(peca);
      setPecaNome(peca.nome);
      setPecaCodigo(peca.codigo || "");
      setPecaCategoriaId(String(peca.categoriaId));
      setPecaUnidade(peca.unidade || "un");
      setPecaVidaUtil(peca.vidaUtilEstimada || "");
      setPecaEstoqueMinimo(String(peca.estoqueMinimo || 0));
      setPecaObservacoes(peca.observacoes || "");
    } else {
      setEditingPeca(null);
      setPecaNome("");
      setPecaCodigo("");
      setPecaCategoriaId("");
      setPecaUnidade("un");
      setPecaVidaUtil("");
      setPecaEstoqueMinimo("");
      setPecaObservacoes("");
    }
    setShowPecaDialog(true);
  }

  function salvarPeca() {
    if (!pecaNome.trim() || !pecaCategoriaId) {
      toast.error("Nome e Categoria são obrigatórios");
      return;
    }
    const data = {
      nome: pecaNome,
      codigo: pecaCodigo || undefined,
      categoriaId: Number(pecaCategoriaId),
      unidade: pecaUnidade || "un",
      vidaUtilEstimada: pecaVidaUtil || undefined,
      estoqueMinimo: pecaEstoqueMinimo ? Number(pecaEstoqueMinimo) : undefined,
      observacoes: pecaObservacoes || undefined,
    };
    if (editingPeca) {
      updatePeca.mutate({ id: editingPeca.id, ...data });
    } else {
      createPeca.mutate(data);
    }
  }

  const pecasFiltradas = useMemo(() => {
    if (!pecasQuery.data) return [];
    let lista = pecasQuery.data;
    if (filtroPecaCategoria !== "todas") {
      lista = lista.filter((p: any) => String(p.categoriaId) === filtroPecaCategoria);
    }
    if (buscaPeca.trim()) {
      const busca = buscaPeca.toLowerCase();
      lista = lista.filter((p: any) =>
        p.nome.toLowerCase().includes(busca) ||
        (p.codigo && p.codigo.toLowerCase().includes(busca))
      );
    }
    return lista;
  }, [pecasQuery.data, filtroPecaCategoria, buscaPeca]);

  // ============================================================================
  // MOVIMENTAÇÕES
  // ============================================================================
  const [showMovDialog, setShowMovDialog] = useState(false);
  const [editingMov, setEditingMov] = useState<any>(null);
  const [movData, setMovData] = useState("");
  const [movPecaId, setMovPecaId] = useState("");
  const [movTipo, setMovTipo] = useState<"entrada" | "saida" | "troca">("entrada");
  const [movQuantidade, setMovQuantidade] = useState("");
  const [movEquipamentoId, setMovEquipamentoId] = useState("");
  const [movNotaFiscal, setMovNotaFiscal] = useState("");
  const [movFornecedor, setMovFornecedor] = useState("");
  const [movValorUnitario, setMovValorUnitario] = useState("");
  const [movObservacoes, setMovObservacoes] = useState("");
  const [filtroMovCategoria, setFiltroMovCategoria] = useState("todas");
  const [filtroMovTipo, setFiltroMovTipo] = useState("todos");
  const [filtroMovDataInicio, setFiltroMovDataInicio] = useState("");
  const [filtroMovDataFim, setFiltroMovDataFim] = useState("");

  const equipamentosQuery = trpc.equipamentos.list.useQuery();
  const movsQuery = trpc.movimentacoesPecas.list.useQuery(
    {
      categoriaId: filtroMovCategoria !== "todas" ? Number(filtroMovCategoria) : undefined,
      tipo: filtroMovTipo !== "todos" ? (filtroMovTipo as "entrada" | "saida" | "troca") : undefined,
      dataInicio: filtroMovDataInicio || undefined,
      dataFim: filtroMovDataFim || undefined,
    }
  );
  const resumoEstoqueQuery = trpc.movimentacoesPecas.resumoEstoque.useQuery();

  const createMov = trpc.movimentacoesPecas.create.useMutation({
    onSuccess: () => {
      movsQuery.refetch();
      pecasQuery.refetch();
      resumoEstoqueQuery.refetch();
      setShowMovDialog(false);
      toast.success("Movimentação registrada!");
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMov = trpc.movimentacoesPecas.update.useMutation({
    onSuccess: () => {
      movsQuery.refetch();
      pecasQuery.refetch();
      resumoEstoqueQuery.refetch();
      setShowMovDialog(false);
      toast.success("Movimentação atualizada!");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMov = trpc.movimentacoesPecas.delete.useMutation({
    onSuccess: () => {
      movsQuery.refetch();
      pecasQuery.refetch();
      resumoEstoqueQuery.refetch();
      toast.success("Movimentação excluída!");
    },
    onError: (err) => toast.error(err.message),
  });

  function abrirMovDialog(mov?: any) {
    if (mov) {
      setEditingMov(mov);
      const d = mov.data instanceof Date ? mov.data.toISOString().split("T")[0] : String(mov.data).split("T")[0];
      setMovData(d);
      setMovPecaId(String(mov.pecaId));
      setMovTipo(mov.tipo);
      setMovQuantidade(String(mov.quantidade));
      setMovEquipamentoId(mov.equipamentoId ? String(mov.equipamentoId) : "");
      setMovNotaFiscal(mov.notaFiscal || "");
      setMovFornecedor(mov.fornecedor || "");
      setMovValorUnitario(mov.valorUnitario || "");
      setMovObservacoes(mov.observacoes || "");
    } else {
      setEditingMov(null);
      setMovData(new Date().toISOString().split("T")[0]);
      setMovPecaId("");
      setMovTipo("entrada");
      setMovQuantidade("");
      setMovEquipamentoId("");
      setMovNotaFiscal("");
      setMovFornecedor("");
      setMovValorUnitario("");
      setMovObservacoes("");
    }
    setShowMovDialog(true);
  }

  function salvarMov() {
    if (!movData || !movPecaId || !movQuantidade) {
      toast.error("Data, Peça e Quantidade são obrigatórios");
      return;
    }
    const valorUnit = movValorUnitario ? parseFloat(movValorUnitario) : 0;
    const qtd = Number(movQuantidade);
    const valorTotal = valorUnit * qtd;
    const data = {
      data: movData,
      pecaId: Number(movPecaId),
      tipo: movTipo,
      quantidade: qtd,
      equipamentoId: movEquipamentoId ? Number(movEquipamentoId) : undefined,
      notaFiscal: movNotaFiscal || undefined,
      fornecedor: movFornecedor || undefined,
      valorUnitario: movValorUnitario || undefined,
      valorTotal: valorTotal > 0 ? String(valorTotal.toFixed(2)) : undefined,
      observacoes: movObservacoes || undefined,
    };
    if (editingMov) {
      updateMov.mutate({ id: editingMov.id, ...data });
    } else {
      createMov.mutate(data);
    }
  }

  // ============================================================================
  // EXPORTAR RELATÓRIO
  // ============================================================================
  function exportarRelatorio() {
    const resumo = resumoEstoqueQuery.data || [];
    if (resumo.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const headers = ["Código", "Peça", "Categoria", "Unidade", "Vida Útil", "Estoque Mín.", "Entradas", "Saídas", "Trocas", "Estoque Atual", "Status"];
    const rows = resumo.map((r: any) => [
      r.codigo || "-",
      r.nome,
      r.categoriaNome,
      r.unidade,
      r.vidaUtilEstimada || "-",
      r.estoqueMinimo,
      r.entradas,
      r.saidas,
      r.trocas,
      r.estoqueAtual,
      r.abaixoMinimo ? "ABAIXO DO MÍNIMO" : "OK",
    ]);
    const csv = [headers.join(";"), ...rows.map((r: any) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pecas_desgaste_estoque_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  const tipoLabel = (tipo: string) => {
    if (tipo === "entrada") return { label: "Entrada", icon: <ArrowDownCircle className="h-4 w-4 text-green-500" />, bg: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" };
    if (tipo === "saida") return { label: "Saída", icon: <ArrowUpCircle className="h-4 w-4 text-red-500" />, bg: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" };
    return { label: "Troca", icon: <RefreshCw className="h-4 w-4 text-amber-500" />, bg: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Peças de Desgaste</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Controle de estoque de peças de desgaste e materiais</p>
          </div>
        </div>
        <Button onClick={exportarRelatorio} variant="outline" className="gap-2">
          <FileDown className="h-4 w-4" /> Exportar Estoque
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="estoque" className="gap-2 text-xs sm:text-sm">
            <ClipboardList className="h-4 w-4" /> Estoque
          </TabsTrigger>
          <TabsTrigger value="categorias" className="gap-2 text-xs sm:text-sm">
            <Layers className="h-4 w-4" /> Categorias
          </TabsTrigger>
          <TabsTrigger value="pecas" className="gap-2 text-xs sm:text-sm">
            <Box className="h-4 w-4" /> Peças
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-2 text-xs sm:text-sm">
            <RefreshCw className="h-4 w-4" /> Movimentações
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* ABA ESTOQUE (RESUMO) */}
        {/* ================================================================ */}
        <TabsContent value="estoque" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Resumo de Estoque</h2>
            <Button onClick={() => { setActiveTab("movimentacoes"); setTimeout(() => abrirMovDialog(), 100); }} className="gap-2 bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4" /> Nova Movimentação
            </Button>
          </div>

          {/* Cards de resumo */}
          {resumoEstoqueQuery.data && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Total de Peças Cadastradas</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{resumoEstoqueQuery.data.length}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Itens em Estoque</div>
                <div className="text-2xl font-bold text-green-600">{resumoEstoqueQuery.data.reduce((acc: number, r: any) => acc + Math.max(0, r.estoqueAtual), 0)}</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">Abaixo do Mínimo</div>
                <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
                  {resumoEstoqueQuery.data.filter((r: any) => r.abaixoMinimo).length}
                  {resumoEstoqueQuery.data.filter((r: any) => r.abaixoMinimo).length > 0 && <AlertTriangle className="h-5 w-5" />}
                </div>
              </div>
            </div>
          )}

          {/* Tabela de estoque */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Código</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Peça</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Categoria</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Un.</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Entradas</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Saídas</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Trocas</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Estoque</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Mín.</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {resumoEstoqueQuery.data?.map((r: any) => (
                    <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${r.abaixoMinimo ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                      <td className="p-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{r.codigo || "-"}</td>
                      <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{r.nome}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{r.categoriaNome}</td>
                      <td className="p-3 text-center text-gray-500 dark:text-gray-400">{r.unidade}</td>
                      <td className="p-3 text-center text-green-600 font-medium">{r.entradas}</td>
                      <td className="p-3 text-center text-red-600 font-medium">{r.saidas}</td>
                      <td className="p-3 text-center text-amber-600 font-medium">{r.trocas}</td>
                      <td className="p-3 text-center font-bold text-gray-900 dark:text-gray-100">{r.estoqueAtual}</td>
                      <td className="p-3 text-center text-gray-500 dark:text-gray-400">{r.estoqueMinimo}</td>
                      <td className="p-3 text-center">
                        {r.abaixoMinimo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <AlertTriangle className="h-3 w-3" /> Baixo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!resumoEstoqueQuery.data || resumoEstoqueQuery.data.length === 0) && (
                    <tr><td colSpan={10} className="p-8 text-center text-gray-400">Nenhuma peça cadastrada. Comece cadastrando categorias e peças.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/* ABA CATEGORIAS */}
        {/* ================================================================ */}
        <TabsContent value="categorias" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Categorias de Peças</h2>
            <Button onClick={() => abrirCategoriaDialog()} className="gap-2 bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4" /> Nova Categoria
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoriasQuery.data?.map((cat: any) => (
              <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Layers className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{cat.nome}</h3>
                      {cat.descricao && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{cat.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirCategoriaDialog(cat)}>
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                      if (confirm("Excluir esta categoria?")) deleteCategoria.mutate({ id: cat.id });
                    }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {(!categoriasQuery.data || categoriasQuery.data.length === 0) && (
              <div className="col-span-full text-center py-12 text-gray-400">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma categoria cadastrada.</p>
                <p className="text-sm mt-1">Crie categorias como: Mandíbulas, Revestimentos, Telas de Peneiras, etc.</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/* ABA PEÇAS */}
        {/* ================================================================ */}
        <TabsContent value="pecas" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Catálogo de Peças</h2>
            <Button onClick={() => abrirPecaDialog()} className="gap-2 bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4" /> Nova Peça
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={buscaPeca}
                onChange={(e) => setBuscaPeca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroPecaCategoria} onValueChange={setFiltroPecaCategoria}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Categorias</SelectItem>
                {categoriasQuery.data?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabela de peças */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Código</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Nome</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Categoria</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Unidade</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Vida Útil</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Est. Mín.</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Est. Atual</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {pecasFiltradas.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="p-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{p.codigo || "-"}</td>
                      <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{p.nome}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-300">{p.categoriaNome}</td>
                      <td className="p-3 text-center text-gray-500 dark:text-gray-400">{p.unidade}</td>
                      <td className="p-3 text-gray-500 dark:text-gray-400">{p.vidaUtilEstimada || "-"}</td>
                      <td className="p-3 text-center text-gray-500 dark:text-gray-400">{p.estoqueMinimo || 0}</td>
                      <td className="p-3 text-center font-bold text-gray-900 dark:text-gray-100">{p.estoqueAtual}</td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirPecaDialog(p)}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                            if (confirm("Excluir esta peça?")) deletePeca.mutate({ id: p.id });
                          }}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pecasFiltradas.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-gray-400">
                      <Box className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      Nenhuma peça encontrada.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/* ABA MOVIMENTAÇÕES */}
        {/* ================================================================ */}
        <TabsContent value="movimentacoes" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Movimentações</h2>
            <Button onClick={() => abrirMovDialog()} className="gap-2 bg-orange-600 hover:bg-orange-700">
              <Plus className="h-4 w-4" /> Nova Movimentação
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={filtroMovCategoria} onValueChange={setFiltroMovCategoria}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Categorias</SelectItem>
                {categoriasQuery.data?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroMovTipo} onValueChange={setFiltroMovTipo}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
                <SelectItem value="troca">Troca</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filtroMovDataInicio} onChange={(e) => setFiltroMovDataInicio(e.target.value)} className="w-full sm:w-[160px]" />
            <Input type="date" value={filtroMovDataFim} onChange={(e) => setFiltroMovDataFim(e.target.value)} className="w-full sm:w-[160px]" />
          </div>

          {/* Tabela de movimentações */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Data</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Tipo</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Peça</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Categoria</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Qtd</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Equipamento</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">Fornecedor</th>
                    <th className="text-left p-3 font-medium text-gray-600 dark:text-gray-300">NF</th>
                    <th className="text-right p-3 font-medium text-gray-600 dark:text-gray-300">Valor Unit.</th>
                    <th className="text-center p-3 font-medium text-gray-600 dark:text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {movsQuery.data?.map((m: any) => {
                    const t = tipoLabel(m.tipo);
                    const dataStr = m.data instanceof Date ? m.data.toLocaleDateString("pt-BR") : new Date(m.data).toLocaleDateString("pt-BR");
                    return (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="p-3 text-gray-600 dark:text-gray-300">{dataStr}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${t.bg}`}>
                            {t.icon} {t.label}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{m.pecaNome}</td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">{m.categoriaNome}</td>
                        <td className="p-3 text-center font-bold text-gray-900 dark:text-gray-100">{m.quantidade}</td>
                        <td className="p-3 text-gray-600 dark:text-gray-300">{m.equipamentoNome || "-"}</td>
                        <td className="p-3 text-gray-500 dark:text-gray-400">{m.fornecedor || "-"}</td>
                        <td className="p-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{m.notaFiscal || "-"}</td>
                        <td className="p-3 text-right text-gray-600 dark:text-gray-300">{m.valorUnitario ? `R$ ${Number(m.valorUnitario).toFixed(2)}` : "-"}</td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirMovDialog(m)}>
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                              if (confirm("Excluir esta movimentação?")) deleteMov.mutate({ id: m.id });
                            }}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!movsQuery.data || movsQuery.data.length === 0) && (
                    <tr><td colSpan={10} className="p-8 text-center text-gray-400">
                      <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      Nenhuma movimentação registrada.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================================================================ */}
      {/* DIALOG CATEGORIA */}
      {/* ================================================================ */}
      <Dialog open={showCategoriaDialog} onOpenChange={setShowCategoriaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategoria ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={categoriaNome} onChange={(e) => setCategoriaNome(e.target.value)} placeholder="Ex: Mandíbulas" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={categoriaDescricao} onChange={(e) => setCategoriaDescricao(e.target.value)} placeholder="Descrição opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoriaDialog(false)}>Cancelar</Button>
            <Button onClick={salvarCategoria} className="bg-orange-600 hover:bg-orange-700">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* DIALOG PEÇA */}
      {/* ================================================================ */}
      <Dialog open={showPecaDialog} onOpenChange={setShowPecaDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPeca ? "Editar Peça" : "Nova Peça"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome *</Label>
                <Input value={pecaNome} onChange={(e) => setPecaNome(e.target.value)} placeholder="Ex: Mandíbula fixa 600x900" />
              </div>
              <div>
                <Label>Código</Label>
                <Input value={pecaCodigo} onChange={(e) => setPecaCodigo(e.target.value)} placeholder="Ex: MDF-001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria *</Label>
                <Select value={pecaCategoriaId} onValueChange={setPecaCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriasQuery.data?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={pecaUnidade} onValueChange={setPecaUnidade}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">Unidade (un)</SelectItem>
                    <SelectItem value="pç">Peça (pç)</SelectItem>
                    <SelectItem value="jg">Jogo (jg)</SelectItem>
                    <SelectItem value="m">Metro (m)</SelectItem>
                    <SelectItem value="kg">Quilograma (kg)</SelectItem>
                    <SelectItem value="cx">Caixa (cx)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vida Útil Estimada</Label>
                <Input value={pecaVidaUtil} onChange={(e) => setPecaVidaUtil(e.target.value)} placeholder="Ex: 2000 horas" />
              </div>
              <div>
                <Label>Estoque Mínimo</Label>
                <Input type="number" value={pecaEstoqueMinimo} onChange={(e) => setPecaEstoqueMinimo(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={pecaObservacoes} onChange={(e) => setPecaObservacoes(e.target.value)} placeholder="Observações opcionais" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPecaDialog(false)}>Cancelar</Button>
            <Button onClick={salvarPeca} className="bg-orange-600 hover:bg-orange-700">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* DIALOG MOVIMENTAÇÃO */}
      {/* ================================================================ */}
      <Dialog open={showMovDialog} onOpenChange={setShowMovDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMov ? "Editar Movimentação" : "Nova Movimentação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={movData} onChange={(e) => setMovData(e.target.value)} />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={movTipo} onValueChange={(v) => setMovTipo(v as "entrada" | "saida" | "troca")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="troca">Troca</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Peça *</Label>
                <Select value={movPecaId} onValueChange={setMovPecaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a peça" />
                  </SelectTrigger>
                  <SelectContent>
                    {pecasQuery.data?.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}{p.codigo ? ` (${p.codigo})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade *</Label>
                <Input type="number" min="1" value={movQuantidade} onChange={(e) => setMovQuantidade(e.target.value)} placeholder="1" />
              </div>
            </div>
            {(movTipo === "saida" || movTipo === "troca") && (
              <div>
                <Label>Equipamento</Label>
                <Select value={movEquipamentoId} onValueChange={setMovEquipamentoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {equipamentosQuery.data?.map((e: any) => (
                      <SelectItem key={e.id} value={String(e.id)}>{e.codigoTag || e.nomeDoEquipamento}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {movTipo === "entrada" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fornecedor</Label>
                  <Input value={movFornecedor} onChange={(e) => setMovFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
                </div>
                <div>
                  <Label>Nota Fiscal</Label>
                  <Input value={movNotaFiscal} onChange={(e) => setMovNotaFiscal(e.target.value)} placeholder="Nº da NF" />
                </div>
              </div>
            )}
            {movTipo === "entrada" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor Unitário (R$)</Label>
                  <Input type="number" step="0.01" value={movValorUnitario} onChange={(e) => setMovValorUnitario(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <Label>Valor Total (R$)</Label>
                  <Input
                    readOnly
                    value={movValorUnitario && movQuantidade ? (parseFloat(movValorUnitario) * Number(movQuantidade)).toFixed(2) : ""}
                    className="bg-gray-50 dark:bg-gray-700"
                    placeholder="Calculado automaticamente"
                  />
                </div>
              </div>
            )}
            <div>
              <Label>Observações</Label>
              <Input value={movObservacoes} onChange={(e) => setMovObservacoes(e.target.value)} placeholder="Observações opcionais" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovDialog(false)}>Cancelar</Button>
            <Button onClick={salvarMov} className="bg-orange-600 hover:bg-orange-700">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
