import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp, Calculator, Pencil, Filter, X, Package, RefreshCw, Clock, Timer, AlertTriangle, CheckCircle2, Copy, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExportButtons } from "@/components/ExportButtons";
import { formatters, type ExportColumn } from "@/lib/export-utils";
import { usePermissions } from "@/hooks/usePermissions";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface ItemServico {
  setorId: number;
  servicoId: number;
  quantidade: string;
  operadorMotoristaId: number;
}

interface TrocaPecaFormItem {
  pecaId: number;
  pecaNome: string;
  categoriaNome: string;
  quantidade: number;
  custoUnitario: string;
  observacoes: string;
}

interface TempoDescargaFormItem {
  horaInicio: string;
  horaFinal: string;
}

interface ParadaFormItem {
  horaInicial: string;
  horaFinal: string;
  tempoDecorrido: string; // calculado automaticamente
  motivoId: string;
}

export default function ParteDiaria() {
  const { canCreate, canDelete, canEdit } = usePermissions();
  
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [equipamentoId, setEquipamentoId] = useState("");
  const [turno, setTurno] = useState("");
  
  // Campos de Hora/Km (renomeados de horímetro)
  const [horaKmInicial, setHoraKmInicial] = useState("");
  const [horaKmFinal, setHoraKmFinal] = useState("");
  const [horaKmTrabalhados, setHoraKmTrabalhados] = useState("");
  
  // Campos de tempo
  const [tempoParadoLigado, setTempoParadoLigado] = useState("");
  const [tempoParadoDesligado, setTempoParadoDesligado] = useState("");
  const [tempoProdutivo, setTempoProdutivo] = useState("");
  
  // Campos de produção
  const [producaoLivre, setProducaoLivre] = useState("");
  const [qtdFuros, setQtdFuros] = useState("");
  const [profundidadeFuros, setProfundidadeFuros] = useState("");
  const [producaoPerfuracao, setProducaoPerfuracao] = useState("");
  
  // Campos de Produção Balança
  const [leituraInicialBalanca, setLeituraInicialBalanca] = useState("");
  const [leituraFinalBalanca, setLeituraFinalBalanca] = useState("");
  const [producaoBalanca, setProducaoBalanca] = useState("");
  
  const [observacoes, setObservacoes] = useState("");
  
  // Trocas de peças inline no formulário
  const [trocasPecasForm, setTrocasPecasForm] = useState<TrocaPecaFormItem[]>([]);
  const [showAddTrocaForm, setShowAddTrocaForm] = useState(false);
  const [novaTrocaPecaId, setNovaTrocaPecaId] = useState("");
  const [novaTrocaQtd, setNovaTrocaQtd] = useState("1");
  const [novaTrocaCusto, setNovaTrocaCusto] = useState("");
  const [novaTrocaObs, setNovaTrocaObs] = useState("");
  const [novaTrocaCategoria, setNovaTrocaCategoria] = useState("todas");

  // Tempos de descarga no formulário
  const [temposDescargaForm, setTemposDescargaForm] = useState<TempoDescargaFormItem[]>([{ horaInicio: "", horaFinal: "" }]);

  // Subgrupos de paradas
  const [paradasLigado, setParadasLigado] = useState<ParadaFormItem[]>([]);
  const [paradasDesligado, setParadasDesligado] = useState<ParadaFormItem[]>([]);
  const [totalParadoLigado, setTotalParadoLigado] = useState("0.00");
  const [totalParadoDesligado, setTotalParadoDesligado] = useState("0.00");
  const [totalTempoParado, setTotalTempoParado] = useState("0.00");
  
  const [showForm, setShowForm] = useState(false);
  const [editingParteId, setEditingParteId] = useState<number | null>(null);
  const [expandedParte, setExpandedParte] = useState<number | null>(null);

  // Filtros da listagem
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroEquipamentoId, setFiltroEquipamentoId] = useState("");
  const [filtroGrupoId, setFiltroGrupoId] = useState("");
  const [filtroSetorId, setFiltroSetorId] = useState("");
  const [filtroServicoId, setFiltroServicoId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const [itensServico, setItensServico] = useState<ItemServico[]>([
    { setorId: 0, servicoId: 0, quantidade: "", operadorMotoristaId: 0 }
  ]);

  const { data: partesDiarias, refetch } = trpc.parteDiaria.list.useQuery();
  const { data: equipamentos } = trpc.equipamentos.list.useQuery();
  const { data: setores } = trpc.setores.list.useQuery();
  const { data: servicos } = trpc.servicos.list.useQuery();
  const { data: operadoresMotoristas } = trpc.operadoresMotoristas.list.useQuery();
  const { data: gruposEquipamentos } = trpc.gruposDeEquipamentos.list.useQuery();
  const { data: pecasDesgaste } = trpc.pecasDesgaste.list.useQuery();
  const { data: categoriasPecas } = trpc.categoriasPecasDesgaste.list.useQuery();
  const { data: outrasParadasList } = trpc.outrasParadas.listAtivos.useQuery();

  // Feature flag: controle de tempos de descarga
  const { data: configTemposDescarga } = trpc.configSistema.get.useQuery({ chave: 'FEATURE_TEMPOS_DESCARGA' });
  const temposDescargaHabilitado = configTemposDescarga?.valor === 'true';

  // Estados para modal de Replicar para Equipamentos Agregados
  const [showReplicarModal, setShowReplicarModal] = useState(false);
  const [replicarParteDiariaId, setReplicarParteDiariaId] = useState<number | null>(null);
  const [replicarEquipamentoOriginalId, setReplicarEquipamentoOriginalId] = useState<number | null>(null);
  const [replicarEquipamentoOriginalNome, setReplicarEquipamentoOriginalNome] = useState("");
  const [replicarEquipamentoOriginalData, setReplicarEquipamentoOriginalData] = useState("");
  const [equipamentosSelecionados, setEquipamentosSelecionados] = useState<number[]>([]);
  const [buscaEquipamento, setBuscaEquipamento] = useState("");

  const replicarMutation = trpc.parteDiaria.replicarParaAgregados.useMutation({
    onSuccess: (result) => {
      if (result.criados > 0 && result.jaExistiam > 0) {
        toast.success(`${result.criados} lançamento(s) criado(s). ${result.jaExistiam} equipamento(s) já possuíam lançamento nesta data e foram ignorados.`);
      } else if (result.criados > 0) {
        toast.success(`${result.criados} lançamento(s) replicado(s) com sucesso!`);
      } else {
        toast.warning(`Todos os equipamentos selecionados já possuem lançamento nesta data.`);
      }
      setShowReplicarModal(false);
      setEquipamentosSelecionados([]);
      setBuscaEquipamento("");
      refetch();
    },
    onError: (err) => toast.error(`Erro ao replicar: ${err.message}`),
  });

  const abrirReplicarModal = (parte: { id: number; equipamentoId: number; data: string }) => {
    const equip = equipamentos?.find(e => e.id === parte.equipamentoId);
    setReplicarParteDiariaId(parte.id);
    setReplicarEquipamentoOriginalId(parte.equipamentoId);
    setReplicarEquipamentoOriginalNome(equip?.nomeDoEquipamento ?? `Equipamento #${parte.equipamentoId}`);
    setReplicarEquipamentoOriginalData(parte.data);
    setEquipamentosSelecionados([]);
    setBuscaEquipamento("");
    setShowReplicarModal(true);
  };

  const toggleEquipamentoSelecionado = (id: number) => {
    setEquipamentosSelecionados(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const equipamentosParaReplicar = useMemo(() => {
    if (!equipamentos) return [];
    return equipamentos.filter(e => {
      if (e.id === replicarEquipamentoOriginalId) return false; // excluir o original
      if (e.ativo !== 'sim') return false; // apenas ativos
      if (!buscaEquipamento) return true;
      const busca = buscaEquipamento.toLowerCase();
      return (
        e.nomeDoEquipamento?.toLowerCase().includes(busca) ||
        e.codigoTag?.toLowerCase().includes(busca)
      );
    });
  }, [equipamentos, replicarEquipamentoOriginalId, buscaEquipamento]);

  // Estado para trocas de peças
  const [showTrocaPecaDialog, setShowTrocaPecaDialog] = useState(false);
  const [trocaPecaParteDiariaId, setTrocaPecaParteDiariaId] = useState<number | null>(null);
  const [trocaPecaId, setTrocaPecaId] = useState("");
  const [trocaQuantidade, setTrocaQuantidade] = useState("1");
  const [trocaObservacoes, setTrocaObservacoes] = useState("");
  const [trocaFiltroCategoriaId, setTrocaFiltroCategoriaId] = useState("todas");
  const [trocaCustoUnitario, setTrocaCustoUnitario] = useState("");

  // Determinar o grupo do equipamento selecionado
  const equipamentoSelecionado = useMemo(() => {
    if (!equipamentoId || !equipamentos) return null;
    return equipamentos.find(e => e.id === Number(equipamentoId)) || null;
  }, [equipamentoId, equipamentos]);

  const grupoDoEquipamento = useMemo(() => {
    if (!equipamentoSelecionado || !gruposEquipamentos) return null;
    return gruposEquipamentos.find(g => g.id === equipamentoSelecionado.grupoId) || null;
  }, [equipamentoSelecionado, gruposEquipamentos]);

  const isCaminhaoEntrega = useMemo(() => {
    return grupoDoEquipamento?.nome?.toUpperCase().includes("CAMINH") && 
           grupoDoEquipamento?.nome?.toUpperCase().includes("ENTREGA");
  }, [grupoDoEquipamento]);

  // Verificar se o equipamento é de caminhões internos
  const isCaminhaoInterno = useMemo(() => {
    if (!grupoDoEquipamento?.nome) return false;
    const nomeGrupo = grupoDoEquipamento.nome.toUpperCase();
    return nomeGrupo.includes("CAMINH") && nomeGrupo.includes("INTERNO");
  }, [grupoDoEquipamento]);

  // Mostrar tempos de descarga: feature flag habilitada + equipamento é caminhão interno ou de entrega
  const showTemposDescarga = temposDescargaHabilitado && (isCaminhaoInterno || isCaminhaoEntrega);

  // Verificar se o equipamento selecionado é de perfuração
  // Grupos: PERFURATRIZES HIDRÁULICAS, PERFURATRIZES PNEUMÁTICAS, MARTELOS PERFURATRIZES HIDRÁULICAS
  const isPerfuratriz = useMemo(() => {
    if (!grupoDoEquipamento?.nome) return false;
    const nomeGrupo = grupoDoEquipamento.nome.toUpperCase();
    return (
      nomeGrupo.includes("PERFURATRIZ") ||
      nomeGrupo.includes("PERFURATRIZES") ||
      (nomeGrupo.includes("MARTELO") && nomeGrupo.includes("PERFURATRIZ"))
    );
  }, [grupoDoEquipamento]);

  // Verificar se o equipamento é britador ou transportadora de correia
  // Grupos: BRITADORES MANDÍBULA, BRITADORES CÔNICOS, BRITADORES IMPACTO, TRANSPORTADORAS DE CORREIA
  const isBritadorTransportadora = useMemo(() => {
    if (!grupoDoEquipamento?.nome) return false;
    const nomeGrupo = grupoDoEquipamento.nome.toUpperCase();
    return (
      (nomeGrupo.includes("BRITADOR") && (nomeGrupo.includes("MANDÍBULA") || nomeGrupo.includes("MANDIBULA") || nomeGrupo.includes("CÔNICO") || nomeGrupo.includes("CONICO") || nomeGrupo.includes("IMPACTO"))) ||
      (nomeGrupo.includes("TRANSPORTADORA") && nomeGrupo.includes("CORREIA"))
    );
  }, [grupoDoEquipamento]);

  // Verificar se o equipamento é Balança Integradora
  const isBalancaIntegradora = useMemo(() => {
    if (!grupoDoEquipamento?.nome) return false;
    const nomeGrupo = grupoDoEquipamento.nome.toUpperCase();
    return nomeGrupo.includes("BALAN") && (nomeGrupo.includes("INTEGR") || nomeGrupo.includes("ÇA") || nomeGrupo.includes("CA"));
  }, [grupoDoEquipamento]);

  // Estado para mensagem de validação do horaKmTrabalhados
  const [horaKmValidationMsg, setHoraKmValidationMsg] = useState("");

  // Cálculo automático de Hora/Km Trabalhados com validação
  useEffect(() => {
    const inicial = parseFloat(horaKmInicial) || 0;
    const finalVal = parseFloat(horaKmFinal) || 0;
    if (horaKmInicial && horaKmFinal) {
      const resultado = finalVal - inicial;
      setHoraKmTrabalhados(resultado.toFixed(2));
      
      // Validação
      if (resultado < 0) {
        setHoraKmValidationMsg("Reveja os horímetros ou Km lançados: não existe hora/km negativo");
      } else if (resultado > 24 && !isCaminhaoEntrega && !isBalancaIntegradora) {
        setHoraKmValidationMsg("Reveja os horímetros lançados: horas trabalhadas não pode ser maior que 24 horas");
      } else {
        setHoraKmValidationMsg("");
      }
    } else {
      setHoraKmValidationMsg("");
    }
   }, [horaKmInicial, horaKmFinal, isCaminhaoEntrega, isBalancaIntegradora]);
  // Função para calcular tempo decorrido entre HH:MM (suporta virada de meia-noite)
  function calcTempoDecorrido(inicio: string, fim: string): string {
    if (!inicio || !fim) return "0.00";
    const [h1, m1] = inicio.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "0.00";
    let minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (minutos < 0) minutos += 24 * 60; // virada de meia-noite
    return (minutos / 60).toFixed(2);
  }

  // Recalcular totais sempre que as listas de paradas mudarem
  useEffect(() => {
    const total = paradasLigado.reduce((acc, p) => acc + (parseFloat(p.tempoDecorrido) || 0), 0);
    const totalStr = total.toFixed(2);
    setTotalParadoLigado(totalStr);
    setTempoParadoLigado(totalStr);
  }, [paradasLigado]);

  useEffect(() => {
    const total = paradasDesligado.reduce((acc, p) => acc + (parseFloat(p.tempoDecorrido) || 0), 0);
    const totalStr = total.toFixed(2);
    setTotalParadoDesligado(totalStr);
    setTempoParadoDesligado(totalStr);
  }, [paradasDesligado]);

  useEffect(() => {
    const ligado = parseFloat(totalParadoLigado) || 0;
    const desligado = parseFloat(totalParadoDesligado) || 0;
    setTotalTempoParado((ligado + desligado).toFixed(2));
  }, [totalParadoLigado, totalParadoDesligado]);

  // Cálculo automático de Tempo Produtivo (agora usa total do subgrupo Ligado)
  useEffect(() => {
    const trabalhados = parseFloat(horaKmTrabalhados) || 0;
    const paradoLigado = parseFloat(totalParadoLigado) || 0;
    if (trabalhados > 0 && paradoLigado > 0) {
      setTempoProdutivo((trabalhados - paradoLigado).toFixed(2));
    } else if (trabalhados > 0 && paradoLigado === 0) {
      setTempoProdutivo(trabalhados.toFixed(2));
    } else {
      setTempoProdutivo("0.00");
    }
  }, [horaKmTrabalhados, totalParadoLigado]);

  // Cálculo automático de Produção Perfuração
  useEffect(() => {
    const furos = parseFloat(qtdFuros) || 0;
    const profundidade = parseFloat(profundidadeFuros) || 0;
    if (furos > 0 && profundidade > 0) {
      setProducaoPerfuracao((furos * profundidade).toFixed(2));
    }
  }, [qtdFuros, profundidadeFuros]);

  // Cálculo automático de Produção Balança
  // Para Balanças Integradoras: usa Hora/Km Final - Hora/Km Inicial
  // Para Britadores/Transportadoras: usa Leitura Final - Leitura Inicial Balança
  useEffect(() => {
    if (isBalancaIntegradora) {
      const ini = parseFloat(horaKmInicial) || 0;
      const fin = parseFloat(horaKmFinal) || 0;
      if (horaKmInicial && horaKmFinal) {
        setProducaoBalanca((fin - ini).toFixed(2));
      } else {
        setProducaoBalanca("");
      }
    } else {
      const inicial = parseFloat(leituraInicialBalanca) || 0;
      const final_ = parseFloat(leituraFinalBalanca) || 0;
      if (leituraInicialBalanca && leituraFinalBalanca) {
        setProducaoBalanca((final_ - inicial).toFixed(2));
      }
    }
  }, [isBalancaIntegradora, horaKmInicial, horaKmFinal, leituraInicialBalanca, leituraFinalBalanca]);

  // Carregar paradas existentes ao editar
  const { data: paradasExistentes } = trpc.parteDiariaParadas.listByParteDiaria.useQuery(
    { parteDiariaId: editingParteId! },
    { enabled: !!editingParteId && showForm }
  );

  useEffect(() => {
    if (editingParteId && paradasExistentes) {
      const ligadas = paradasExistentes
        .filter((p: any) => p.tipo === "ligado")
        .map((p: any) => ({
          horaInicial: p.horaInicial || "",
          horaFinal: p.horaFinal || "",
          tempoDecorrido: p.tempoDecorrido ? String(p.tempoDecorrido) : "0.00",
          motivoId: p.motivoId ? String(p.motivoId) : "",
        }));
      const desligadas = paradasExistentes
        .filter((p: any) => p.tipo === "desligado")
        .map((p: any) => ({
          horaInicial: p.horaInicial || "",
          horaFinal: p.horaFinal || "",
          tempoDecorrido: p.tempoDecorrido ? String(p.tempoDecorrido) : "0.00",
          motivoId: p.motivoId ? String(p.motivoId) : "",
        }));
      setParadasLigado(ligadas);
      setParadasDesligado(desligadas);
    }
  }, [editingParteId, paradasExistentes]);

  // Carregar tempos de descarga ao editar
  const { data: temposDescargaExistentes } = trpc.temposDescarga.listByParteDiaria.useQuery(
    { parteDiariaId: editingParteId! },
    { enabled: !!editingParteId && showForm }
  );

  useEffect(() => {
    if (editingParteId && temposDescargaExistentes && temposDescargaExistentes.length > 0) {
      setTemposDescargaForm(
        temposDescargaExistentes.map(t => ({
          horaInicio: t.horaInicio,
          horaFinal: t.horaFinal,
        }))
      );
    }
  }, [editingParteId, temposDescargaExistentes]);

  // Mutations para salvar paradas
  const upsertParadasMutation = trpc.parteDiariaParadas.upsertMany.useMutation();

  const createMutation = trpc.parteDiaria.create.useMutation({
    onSuccess: async (result: any) => {
      // Salvar paradas dos subgrupos
      const parteDiariaId = result?.id;
      if (parteDiariaId) {
        const paradasLigadoValidas = paradasLigado.filter(p => p.horaInicial && p.horaFinal);
        const paradasDesligadoValidas = paradasDesligado.filter(p => p.horaInicial && p.horaFinal);
        await Promise.all([
          upsertParadasMutation.mutateAsync({ parteDiariaId, tipo: "ligado", paradas: paradasLigadoValidas.map(p => ({ horaInicial: p.horaInicial, horaFinal: p.horaFinal, tempoDecorrido: p.tempoDecorrido, motivoId: p.motivoId ? Number(p.motivoId) : null })) }),
          upsertParadasMutation.mutateAsync({ parteDiariaId, tipo: "desligado", paradas: paradasDesligadoValidas.map(p => ({ horaInicial: p.horaInicial, horaFinal: p.horaFinal, tempoDecorrido: p.tempoDecorrido, motivoId: p.motivoId ? Number(p.motivoId) : null })) }),
        ]);
      }
      toast.success("Parte diária registrada com sucesso!");
      refetch();
      limparFormulario();
      setShowForm(false);
    },
    onError: (error) => {
      toast.error(`Erro ao registrar: ${error.message}`);
    },
  });

  const updateMutation = trpc.parteDiaria.update.useMutation({
    onSuccess: async () => {
      // Salvar paradas dos subgrupos
      if (editingParteId) {
        const paradasLigadoValidas = paradasLigado.filter(p => p.horaInicial && p.horaFinal);
        const paradasDesligadoValidas = paradasDesligado.filter(p => p.horaInicial && p.horaFinal);
        await Promise.all([
          upsertParadasMutation.mutateAsync({ parteDiariaId: editingParteId, tipo: "ligado", paradas: paradasLigadoValidas.map(p => ({ horaInicial: p.horaInicial, horaFinal: p.horaFinal, tempoDecorrido: p.tempoDecorrido, motivoId: p.motivoId ? Number(p.motivoId) : null })) }),
          upsertParadasMutation.mutateAsync({ parteDiariaId: editingParteId, tipo: "desligado", paradas: paradasDesligadoValidas.map(p => ({ horaInicial: p.horaInicial, horaFinal: p.horaFinal, tempoDecorrido: p.tempoDecorrido, motivoId: p.motivoId ? Number(p.motivoId) : null })) }),
        ]);
      }
      toast.success("Parte diária atualizada com sucesso!");
      refetch();
      limparFormulario();
      setShowForm(false);
      setEditingParteId(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteMutation = trpc.parteDiaria.delete.useMutation({
    onSuccess: () => {
      toast.success("Parte diária excluída!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  // Trocas de peças mutations
  const createTrocaPeca = trpc.trocasPecasParteDiaria.create.useMutation({
    onSuccess: () => {
      toast.success("Troca de peça registrada!");
      setShowTrocaPecaDialog(false);
      setTrocaPecaId("");
      setTrocaQuantidade("1");
      setTrocaCustoUnitario("");
      setTrocaObservacoes("");
      setTrocaFiltroCategoriaId("todas");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTrocaPeca = trpc.trocasPecasParteDiaria.delete.useMutation({
    onSuccess: () => {
      toast.success("Troca de peça removida!");
    },
    onError: (err) => toast.error(err.message),
  });

  function abrirTrocaPecaDialog(parteDiariaId: number) {
    setTrocaPecaParteDiariaId(parteDiariaId);
    setTrocaPecaId("");
    setTrocaQuantidade("1");
    setTrocaCustoUnitario("");
    setTrocaObservacoes("");
    setTrocaFiltroCategoriaId("todas");
    setShowTrocaPecaDialog(true);
  }

  function salvarTrocaPeca() {
    if (!trocaPecaParteDiariaId || !trocaPecaId) {
      toast.error("Selecione uma peça");
      return;
    }
    createTrocaPeca.mutate({
      parteDiariaId: trocaPecaParteDiariaId,
      pecaId: Number(trocaPecaId),
      quantidade: Number(trocaQuantidade) || 1,
      custoUnitario: trocaCustoUnitario || undefined,
      observacoes: trocaObservacoes || undefined,
    });
  }

  // Peças filtradas por categoria no dialog de troca
  const pecasFiltradas = useMemo(() => {
    if (!pecasDesgaste) return [];
    if (trocaFiltroCategoriaId === "todas") return pecasDesgaste;
    return pecasDesgaste.filter((p: any) => String(p.categoriaId) === trocaFiltroCategoriaId);
  }, [pecasDesgaste, trocaFiltroCategoriaId]);

  // Peças filtradas para o formulário inline de trocas
  const pecasFiltradasForm = useMemo(() => {
    if (!pecasDesgaste) return [];
    if (novaTrocaCategoria === "todas") return pecasDesgaste;
    return pecasDesgaste.filter((p: any) => String(p.categoriaId) === novaTrocaCategoria);
  }, [pecasDesgaste, novaTrocaCategoria]);

  const adicionarTrocaPecaForm = () => {
    if (!novaTrocaPecaId) {
      toast.error("Selecione uma peça");
      return;
    }
    const peca = pecasDesgaste?.find((p: any) => p.id === Number(novaTrocaPecaId));
    if (!peca) return;
    const categoria = categoriasPecas?.find((c: any) => c.id === peca.categoriaId);
    
    setTrocasPecasForm([...trocasPecasForm, {
      pecaId: peca.id,
      pecaNome: peca.nome,
      categoriaNome: categoria?.nome || "",
      quantidade: Number(novaTrocaQtd) || 1,
      custoUnitario: novaTrocaCusto,
      observacoes: novaTrocaObs,
    }]);
    
    setNovaTrocaPecaId("");
    setNovaTrocaQtd("1");
    setNovaTrocaCusto("");
    setNovaTrocaObs("");
    setNovaTrocaCategoria("todas");
    setShowAddTrocaForm(false);
  };

  const removerTrocaPecaForm = (index: number) => {
    setTrocasPecasForm(trocasPecasForm.filter((_, i) => i !== index));
  };

  const adicionarLinha = () => {
    setItensServico([...itensServico, { setorId: 0, servicoId: 0, quantidade: "", operadorMotoristaId: 0 }]);
  };

  const removerLinha = (index: number) => {
    if (itensServico.length > 1) {
      setItensServico(itensServico.filter((_, i) => i !== index));
    }
  };

  const atualizarItem = (index: number, campo: keyof ItemServico, valor: any) => {
    const novosItens = [...itensServico];
    novosItens[index] = { ...novosItens[index], [campo]: valor };
    setItensServico(novosItens);
  };

  const limparFormulario = () => {
    setData(new Date().toISOString().split("T")[0]);
    setEquipamentoId("");
    setTurno("");
    setHoraKmInicial("");
    setHoraKmFinal("");
    setHoraKmTrabalhados("");
    setTempoParadoLigado("");
    setTempoParadoDesligado("");
    setTempoProdutivo("");
    setProducaoLivre("");
    setQtdFuros("");
    setProfundidadeFuros("");
    setProducaoPerfuracao("");
    setLeituraInicialBalanca("");
    setLeituraFinalBalanca("");
    setProducaoBalanca("");
    setObservacoes("");
    setItensServico([{ setorId: 0, servicoId: 0, quantidade: "", operadorMotoristaId: 0 }]);
    setTrocasPecasForm([]);
    setTemposDescargaForm([{ horaInicio: "", horaFinal: "" }]);
    setParadasLigado([]);
    setParadasDesligado([]);
    setTotalParadoLigado("0.00");
    setTotalParadoDesligado("0.00");
    setTotalTempoParado("0.00");
    setShowAddTrocaForm(false);
    setNovaTrocaPecaId("");
    setNovaTrocaQtd("1");
    setNovaTrocaCusto("");
    setNovaTrocaObs("");
    setNovaTrocaCategoria("todas");
    setEditingParteId(null);
    setHoraKmValidationMsg("");
  };

  const preencherFormularioParaEdicao = (parte: any) => {
    const dataStr = typeof parte.data === 'string' ? parte.data.split('T')[0] : new Date(parte.data).toISOString().split('T')[0];  // Already uses UTC via toISOString
    setData(dataStr);
    setEquipamentoId(String(parte.equipamentoId));
    setTurno(parte.turno || "");
    setHoraKmInicial(parte.horaKmInicial || "");
    setHoraKmFinal(parte.horaKmFinal || "");
    setHoraKmTrabalhados(parte.horaKmTrabalhados || "");
    setTempoParadoLigado(parte.tempoParadoLigado || "");
    setTempoParadoDesligado(parte.tempoParadoDesligado || "");
    setTempoProdutivo(parte.tempoProdutivo || "");
    setProducaoLivre(parte.producaoLivre || "");
    setQtdFuros(parte.qtdFuros || "");
    setProfundidadeFuros(parte.profundidadeFuros || "");
    setProducaoPerfuracao(parte.producaoPerfuracao || "");
    setLeituraInicialBalanca(parte.leituraInicialBalanca || "");
    setLeituraFinalBalanca(parte.leituraFinalBalanca || "");
    setProducaoBalanca(parte.producaoBalanca || "");
    setObservacoes(parte.observacoes || "");
    
    if (parte.itens && parte.itens.length > 0) {
      setItensServico(parte.itens.map((item: any) => ({
        setorId: item.setorId,
        servicoId: item.servicoId,
        quantidade: String(item.quantidade),
        operadorMotoristaId: item.operadorMotoristaId || 0,
      })));
    } else {
      setItensServico([{ setorId: 0, servicoId: 0, quantidade: "", operadorMotoristaId: 0 }]);
    }
    
    // Carregar tempos de descarga existentes (via query separada)
    // Resetar tempos de descarga - serão carregados via useEffect
    setTemposDescargaForm([{ horaInicio: "", horaFinal: "" }]);
    
    setEditingParteId(parte.id);
    setShowForm(true);
    setExpandedParte(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!equipamentoId) {
      toast.error("Selecione um equipamento");
      return;
    }

    // Validação de Hora/Km Trabalhados
    const horaKmTrab = parseFloat(horaKmTrabalhados) || 0;
    if (horaKmTrab < 0) {
      toast.error("Reveja os horímetros ou Km lançados: não existe hora/km negativo");
      return;
    }
    if (horaKmTrab > 24 && !isCaminhaoEntrega && !isBalancaIntegradora) {
      toast.error("Reveja os horímetros lançados: horas trabalhadas não pode ser maior que 24 horas");
      return;
    }

    const itensValidos = itensServico
      .filter(item => item.setorId > 0 && item.servicoId > 0)
      .map(item => ({
        setorId: item.setorId,
        servicoId: item.servicoId,
        quantidade: item.quantidade || "0",
        operadorMotoristaId: item.operadorMotoristaId > 0 ? item.operadorMotoristaId : undefined,
      }));

    if (itensValidos.length === 0 && !isBalancaIntegradora) {
      toast.error("Adicione pelo menos um serviço");
      return;
    }

    if (editingParteId) {
      updateMutation.mutate({
        id: editingParteId,
        data,
        equipamentoId: Number(equipamentoId),
        turno,
        horaKmInicial,
        horaKmFinal,
        horaKmTrabalhados,
        tempoParadoLigado,
        tempoParadoDesligado,
        tempoProdutivo,
        producaoLivre,
        qtdFuros,
        profundidadeFuros,
        producaoPerfuracao,
        leituraInicialBalanca,
        leituraFinalBalanca,
        producaoBalanca,
        observacoes,
        itens: itensValidos,
        temposDescarga: showTemposDescarga && temposDescargaForm.some(t => t.horaInicio && t.horaFinal)
          ? temposDescargaForm
              .filter(t => t.horaInicio && t.horaFinal)
              .map((t, i) => ({
                numeroViagem: i + 1,
                horaInicio: t.horaInicio,
                horaFinal: t.horaFinal,
              }))
          : undefined,
      });
    } else {
      createMutation.mutate({
        data,
        equipamentoId: Number(equipamentoId),
        turno,
        horaKmInicial,
        horaKmFinal,
        horaKmTrabalhados,
        tempoParadoLigado,
        tempoParadoDesligado,
        tempoProdutivo,
        producaoLivre,
        qtdFuros,
        profundidadeFuros,
        producaoPerfuracao,
        leituraInicialBalanca,
        leituraFinalBalanca,
        producaoBalanca,
        observacoes,
        itens: itensValidos,
        trocasPecas: trocasPecasForm.length > 0 ? trocasPecasForm.map(t => ({
          pecaId: t.pecaId,
          quantidade: t.quantidade,
          custoUnitario: t.custoUnitario || undefined,
          observacoes: t.observacoes || undefined,
        })) : undefined,
        temposDescarga: showTemposDescarga && temposDescargaForm.some(t => t.horaInicio && t.horaFinal)
          ? temposDescargaForm
              .filter(t => t.horaInicio && t.horaFinal)
              .map((t, i) => ({
                numeroViagem: i + 1,
                horaInicio: t.horaInicio,
                horaFinal: t.horaFinal,
              }))
          : undefined,
      });
    }
  };

  // Opções memoizadas para SearchableSelect
  const equipamentoOptions = useMemo(() => 
    equipamentos?.map(eq => ({
      value: String(eq.id),
      label: `${eq.nomeDoEquipamento}${eq.codigoTag ? ` [${eq.codigoTag}]` : ''}${eq.modelo ? ` - ${eq.modelo}` : ''}${eq.capacidade ? ` (Cap: ${eq.capacidade} ton)` : ''}`
    })) || []
  , [equipamentos]);

  const setorOptions = useMemo(() => 
    setores?.map(s => ({ value: String(s.id), label: s.nome })) || []
  , [setores]);

  const servicoOptions = useMemo(() => 
    servicos?.map(s => ({ value: String(s.id), label: s.nome })) || []
  , [servicos]);

  const operadorOptions = useMemo(() => 
    operadoresMotoristas?.filter(op => op.ativo === "sim").map(op => ({
      value: String(op.id),
      label: op.nome
    })) || []
  , [operadoresMotoristas]);

  const grupoOptions = useMemo(() => 
    gruposEquipamentos?.map(g => ({ value: String(g.id), label: g.nome })) || []
  , [gruposEquipamentos]);

  // Filtragem dos registros
  const partesFiltradas = useMemo(() => {
    if (!partesDiarias) return [];
    return partesDiarias.filter(parte => {
      // Filtro por data início
      if (filtroDataInicio) {
        const dataStr = parte.data instanceof Date ? parte.data.toISOString().split('T')[0] : String(parte.data).includes('T') ? String(parte.data).split('T')[0] : String(parte.data).slice(0, 10);
        if (dataStr < filtroDataInicio) return false;
      }
      // Filtro por data fim
      if (filtroDataFim) {
        const dataStr = parte.data instanceof Date ? parte.data.toISOString().split('T')[0] : String(parte.data).includes('T') ? String(parte.data).split('T')[0] : String(parte.data).slice(0, 10);
        if (dataStr > filtroDataFim) return false;
      }
      // Filtro por equipamento
      if (filtroEquipamentoId && parte.equipamentoId !== Number(filtroEquipamentoId)) return false;
      // Filtro por grupo de equipamento
      if (filtroGrupoId) {
        const equip = equipamentos?.find(e => e.id === parte.equipamentoId);
        if (!equip || equip.grupoId !== Number(filtroGrupoId)) return false;
      }
      // Filtro por setor (verifica se algum item tem o setor)
      if (filtroSetorId) {
        const temSetor = parte.itens?.some(item => item.setorId === Number(filtroSetorId));
        if (!temSetor) return false;
      }
      // Filtro por serviço (verifica se algum item tem o serviço)
      if (filtroServicoId) {
        const temServico = parte.itens?.some(item => item.servicoId === Number(filtroServicoId));
        if (!temServico) return false;
      }
      return true;
    });
  }, [partesDiarias, filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroSetorId, filtroServicoId, equipamentos]);

  const limparFiltros = () => {
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroEquipamentoId("");
    setFiltroGrupoId("");
    setFiltroSetorId("");
    setFiltroServicoId("");
  };

  const filtrosAtivos = [filtroDataInicio, filtroDataFim, filtroEquipamentoId, filtroGrupoId, filtroSetorId, filtroServicoId].filter(Boolean).length;

  const capacidade = equipamentoSelecionado?.capacidade ? parseFloat(equipamentoSelecionado.capacidade) : 0;

  // Calcular produção total do formulário
  const producaoTotalForm = itensServico.reduce((total, item) => {
    const qtd = parseFloat(item.quantidade) || 0;
    return total + qtd * capacidade;
  }, 0);

  // Calcular produção de um item
  const calcularProducao = (quantidade: string, cap: number) => {
    const qtd = parseFloat(quantidade) || 0;
    return qtd * cap;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Parte Diária</h1>
          <p className="text-muted-foreground">
            Registre as atividades diárias dos equipamentos com múltiplos serviços
          </p>
        </div>
        {canCreate("parteDiaria") && (
          <Button onClick={() => { if (editingParteId) { limparFormulario(); } setShowForm(!showForm); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Parte Diária
          </Button>
        )}
      </div>

      {/* Formulário de Cadastro */}
      {showForm && (canCreate("parteDiaria") || editingParteId) && (
        <Card className={editingParteId ? "border-amber-500" : "border-primary/50"}>
          <CardHeader>
            <CardTitle>{editingParteId ? "Editar Registro" : "Novo Registro"}</CardTitle>
            <CardDescription>
              {editingParteId 
                ? "Altere os dados necessários e salve as alterações" 
                : "Preencha os dados do equipamento e adicione os serviços realizados"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados principais */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="equipamento">Equipamento *</Label>
                  <SearchableSelect
                    options={equipamentoOptions}
                    value={equipamentoId}
                    onValueChange={setEquipamentoId}
                    placeholder="Selecione o equipamento"
                    searchPlaceholder="Buscar equipamento..."
                    emptyMessage="Nenhum equipamento encontrado."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="turno">Turno</Label>
                  <Select value={turno} onValueChange={setTurno}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manhã">Manhã</SelectItem>
                      <SelectItem value="Tarde">Tarde</SelectItem>
                      <SelectItem value="Noite">Noite</SelectItem>
                      <SelectItem value="Integral">Integral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campos de Hora/Km */}
              <Card className="bg-slate-50 dark:bg-slate-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {isBalancaIntegradora ? "Leituras da Balança" : "Hora/Km do Equipamento"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="horaKmInicial">
                        {isBalancaIntegradora ? "Leitura Inicial" : "Hora/Km Inicial"}
                      </Label>
                      <Input
                        id="horaKmInicial"
                        type="number"
                        step="0.01"
                        value={horaKmInicial}
                        onChange={(e) => setHoraKmInicial(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="horaKmFinal">
                        {isBalancaIntegradora ? "Leitura Final" : "Hora/Km Final"}
                      </Label>
                      <Input
                        id="horaKmFinal"
                        type="number"
                        step="0.01"
                        value={horaKmFinal}
                        onChange={(e) => setHoraKmFinal(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    {isBalancaIntegradora ? (
                      <div className="space-y-2">
                        <Label htmlFor="producaoBalancaDisplay">Produção Balança</Label>
                        <div className="h-10 px-3 py-2 bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded-md flex items-center font-semibold text-amber-700 dark:text-amber-300">
                          {producaoBalanca || "0.00"}
                        </div>
                        <p className="text-xs text-muted-foreground">= Leitura Final − Leitura Inicial</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="horaKmTrabalhados">Hora/Km Trabalhados</Label>
                        <div className={`h-10 px-3 py-2 border rounded-md flex items-center font-semibold ${
                          horaKmValidationMsg 
                            ? 'bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300' 
                            : 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        }`}>
                          {horaKmTrabalhados || "0.00"}
                        </div>
                        {horaKmValidationMsg && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <span className="text-red-500">⚠</span> {horaKmValidationMsg}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Controle de Tempo - Subgrupos - oculto para Balanças Integradoras */}
              {!isBalancaIntegradora && <Card className="bg-amber-50 dark:bg-amber-950">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Controle de Tempo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Subgrupo: Tempo Parado Ligado */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-200">Tempo Parado Ligado</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setParadasLigado([...paradasLigado, { horaInicial: "", horaFinal: "", tempoDecorrido: "0.00", motivoId: "" }])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Adicionar Parada
                      </Button>
                    </div>

                    {paradasLigado.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhuma parada ligado registrada. Clique em "+ Adicionar Parada" para iniciar.</p>
                    )}

                    {paradasLigado.map((parada, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white dark:bg-slate-800 rounded-md p-3 border">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Hora Inicial</Label>
                          <Input
                            type="time"
                            value={parada.horaInicial}
                            onChange={(e) => {
                              const novo = [...paradasLigado];
                              novo[idx].horaInicial = e.target.value;
                              novo[idx].tempoDecorrido = calcTempoDecorrido(e.target.value, novo[idx].horaFinal);
                              setParadasLigado(novo);
                            }}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Hora Final</Label>
                          <Input
                            type="time"
                            value={parada.horaFinal}
                            onChange={(e) => {
                              const novo = [...paradasLigado];
                              novo[idx].horaFinal = e.target.value;
                              novo[idx].tempoDecorrido = calcTempoDecorrido(novo[idx].horaInicial, e.target.value);
                              setParadasLigado(novo);
                            }}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Tempo (h)</Label>
                          <div className="h-10 px-2 py-2 bg-amber-100 dark:bg-amber-900 border border-amber-300 rounded-md flex items-center text-sm font-semibold text-amber-800 dark:text-amber-200">
                            {parada.tempoDecorrido || "0.00"}
                          </div>
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Motivo</Label>
                          <SearchableSelect
                            options={(outrasParadasList || []).map((op: any) => ({ value: String(op.id), label: op.descricao }))}
                            value={parada.motivoId || ""}
                            onValueChange={(val) => {
                              const novo = [...paradasLigado];
                              novo[idx].motivoId = val;
                              setParadasLigado(novo);
                            }}
                            placeholder="Selecione o motivo"
                            searchPlaceholder="Pesquisar motivo..."
                            emptyMessage="Nenhum motivo encontrado."
                            className="h-10"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setParadasLigado(paradasLigado.filter((_, i) => i !== idx))}
                            className="text-destructive hover:text-destructive h-10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {paradasLigado.length > 0 && (
                      <div className="flex justify-end">
                        <div className="bg-amber-200 dark:bg-amber-800 rounded-md px-4 py-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                          Total Parado Ligado: <span className="text-base">{totalParadoLigado} h</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subgrupo: Tempo Parado Desligado */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Tempo Parado Desligado</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setParadasDesligado([...paradasDesligado, { horaInicial: "", horaFinal: "", tempoDecorrido: "0.00", motivoId: "" }])}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Adicionar Parada
                      </Button>
                    </div>

                    {paradasDesligado.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Nenhuma parada desligado registrada. Clique em "+ Adicionar Parada" para iniciar.</p>
                    )}

                    {paradasDesligado.map((parada, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-white dark:bg-slate-800 rounded-md p-3 border">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Hora Inicial</Label>
                          <Input
                            type="time"
                            value={parada.horaInicial}
                            onChange={(e) => {
                              const novo = [...paradasDesligado];
                              novo[idx].horaInicial = e.target.value;
                              novo[idx].tempoDecorrido = calcTempoDecorrido(e.target.value, novo[idx].horaFinal);
                              setParadasDesligado(novo);
                            }}
                          />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Hora Final</Label>
                          <Input
                            type="time"
                            value={parada.horaFinal}
                            onChange={(e) => {
                              const novo = [...paradasDesligado];
                              novo[idx].horaFinal = e.target.value;
                              novo[idx].tempoDecorrido = calcTempoDecorrido(novo[idx].horaInicial, e.target.value);
                              setParadasDesligado(novo);
                            }}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Tempo (h)</Label>
                          <div className="h-10 px-2 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 rounded-md flex items-center text-sm font-semibold">
                            {parada.tempoDecorrido || "0.00"}
                          </div>
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Motivo</Label>
                          <SearchableSelect
                            options={(outrasParadasList || []).map((op: any) => ({ value: String(op.id), label: op.descricao }))}
                            value={parada.motivoId || ""}
                            onValueChange={(val) => {
                              const novo = [...paradasDesligado];
                              novo[idx].motivoId = val;
                              setParadasDesligado(novo);
                            }}
                            placeholder="Selecione o motivo"
                            searchPlaceholder="Pesquisar motivo..."
                            emptyMessage="Nenhum motivo encontrado."
                            className="h-10"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setParadasDesligado(paradasDesligado.filter((_, i) => i !== idx))}
                            className="text-destructive hover:text-destructive h-10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {paradasDesligado.length > 0 && (
                      <div className="flex justify-end">
                        <div className="bg-slate-200 dark:bg-slate-700 rounded-md px-4 py-2 text-sm font-semibold">
                          Total Parado Desligado: <span className="text-base">{totalParadoDesligado} h</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Totalizadores finais */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Total Tempo Parado (h)</Label>
                      <div className="h-10 px-3 py-2 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-md flex items-center font-semibold text-red-700 dark:text-red-300">
                        {totalTempoParado}
                      </div>
                      <p className="text-xs text-muted-foreground">= Ligado + Desligado</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tempo Produtivo (h)</Label>
                      <div className="h-10 px-3 py-2 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-md flex items-center font-semibold text-green-700 dark:text-green-300">
                        {tempoProdutivo || "0.00"}
                      </div>
                      <p className="text-xs text-muted-foreground">= Hora/Km Trabalhados - Total Parado Ligado</p>
                    </div>
                  </div>

                </CardContent>
              </Card>}

              {/* Informação da capacidade do equipamento - oculto para Balanças Integradoras */}
              {!isBalancaIntegradora && equipamentoId && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <Calculator className="h-5 w-5" />
                    <span className="font-semibold">
                      Capacidade do Equipamento: {capacidade > 0 ? `${capacidade} toneladas` : "Não definida"}
                    </span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    A produção é calculada automaticamente: Quantidade × Capacidade
                  </p>
                </div>
              )}

              {/* Múltiplas linhas de serviço - oculto para Balanças Integradoras */}
              {!isBalancaIntegradora && <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Serviços Realizados</Label>
                  <Button type="button" onClick={adicionarLinha} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Serviço
                  </Button>
                </div>

                <div className="space-y-4">
                  {itensServico.map((item, index) => (
                    <Card key={index} className="bg-muted/30">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium">Serviço #{index + 1}</span>
                          {itensServico.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removerLinha(index)}
                              className="ml-auto text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Linha 1: Setor e Serviço lado a lado */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2 overflow-hidden">
                            <Label>Setor *</Label>
                            <SearchableSelect
                              options={setorOptions}
                              value={item.setorId > 0 ? String(item.setorId) : ""}
                              onValueChange={(val) => atualizarItem(index, "setorId", Number(val))}
                              placeholder="Selecione o setor"
                              searchPlaceholder="Buscar setor..."
                              emptyMessage="Nenhum setor encontrado."
                            />
                          </div>

                          <div className="space-y-2 overflow-hidden">
                            <Label>Serviço *</Label>
                            <SearchableSelect
                              options={servicoOptions}
                              value={item.servicoId > 0 ? String(item.servicoId) : ""}
                              onValueChange={(val) => atualizarItem(index, "servicoId", Number(val))}
                              placeholder="Selecione o serviço"
                              searchPlaceholder="Buscar serviço..."
                              emptyMessage="Nenhum serviço encontrado."
                            />
                          </div>
                        </div>

                        {/* Linha 2: Quantidade, Produção e Operador */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Qtd (viagens/ciclos)</Label>
                            <Input
                              type="number"
                              step="1"
                              min="0"
                              value={item.quantidade}
                              onChange={(e) => atualizarItem(index, "quantidade", e.target.value)}
                              placeholder="0"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Produção (ton)</Label>
                            <div className="h-10 px-3 py-2 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-md flex items-center font-semibold text-green-700 dark:text-green-300">
                              {calcularProducao(item.quantidade, capacidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="space-y-2 overflow-hidden">
                            <Label>Oper/Mot</Label>
                            <SearchableSelect
                              options={operadorOptions}
                              value={item.operadorMotoristaId > 0 ? String(item.operadorMotoristaId) : ""}
                              onValueChange={(val) => atualizarItem(index, "operadorMotoristaId", Number(val))}
                              placeholder="Selecione"
                              searchPlaceholder="Buscar operador..."
                              emptyMessage="Nenhum operador encontrado."
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Resumo da produção */}
                {capacidade > 0 && itensServico.some(i => i.quantidade) && (
                  <Card className="bg-green-50 dark:bg-green-950 border-green-300 dark:border-green-700">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-green-700 dark:text-green-300 font-semibold">
                            Produção Total do Registro:
                          </span>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {itensServico.filter(i => i.quantidade).length} serviço(s) registrado(s)
                          </p>
                        </div>
                        <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                          {producaoTotalForm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>}

              {/* Produção Livre - oculto para Balanças Integradoras */}
              {!isBalancaIntegradora && <>
              <Card className="bg-indigo-50 dark:bg-indigo-950">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Produção Livre</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="producaoLivre">Produção Livre</Label>
                    <Input
                      id="producaoLivre"
                      type="number"
                      step="0.01"
                      value={producaoLivre}
                      onChange={(e) => setProducaoLivre(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Campos de Perfuração - somente para perfuratrizes */}
              {isPerfuratriz && (
                <Card className="bg-purple-50 dark:bg-purple-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Produção de Perfuração</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="qtdFuros">Qtd Furos</Label>
                        <Input
                          id="qtdFuros"
                          type="number"
                          step="1"
                          value={qtdFuros}
                          onChange={(e) => setQtdFuros(e.target.value)}
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="profundidadeFuros">Profundidade Furos (m)</Label>
                        <Input
                          id="profundidadeFuros"
                          type="number"
                          step="0.01"
                          value={profundidadeFuros}
                          onChange={(e) => setProfundidadeFuros(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="producaoPerfuracao">Produção Perfuração (m)</Label>
                        <div className="h-10 px-3 py-2 bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700 rounded-md flex items-center font-semibold text-purple-700 dark:text-purple-300">
                          {producaoPerfuracao || "0.00"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          = Qtd Furos × Profundidade
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Campos de Produção Balança - somente para britadores e transportadoras de correia */}
              {isBritadorTransportadora && (
                <Card className="bg-amber-50 dark:bg-amber-950">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Produção Balança</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="leituraInicialBalanca">Leitura Inicial Balança</Label>
                        <Input
                          id="leituraInicialBalanca"
                          type="number"
                          step="0.01"
                          value={leituraInicialBalanca}
                          onChange={(e) => setLeituraInicialBalanca(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="leituraFinalBalanca">Leitura Final Balança</Label>
                        <Input
                          id="leituraFinalBalanca"
                          type="number"
                          step="0.01"
                          value={leituraFinalBalanca}
                          onChange={(e) => setLeituraFinalBalanca(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="producaoBalanca">Produção Balança</Label>
                        <div className="h-10 px-3 py-2 bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700 rounded-md flex items-center font-semibold text-amber-700 dark:text-amber-300">
                          {producaoBalanca || "0.00"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          = Leitura Final - Leitura Inicial
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              </>
              }

              {/* Seção de Trocas de Peças de Desgaste */}
              {!isBalancaIntegradora && <Card className="bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-orange-600" />
                      <CardTitle className="text-base text-orange-700 dark:text-orange-300">Trocas de Peças de Desgaste</CardTitle>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-orange-100 dark:bg-orange-900 border-orange-400 text-orange-700 dark:text-orange-300 hover:bg-orange-200"
                      onClick={() => setShowAddTrocaForm(!showAddTrocaForm)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Troca
                    </Button>
                  </div>
                  <CardDescription className="text-orange-600 dark:text-orange-400">
                    Registre as peças trocadas durante esta operação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Formulário para adicionar nova troca */}
                  {showAddTrocaForm && (
                    <Card className="bg-white dark:bg-gray-900 border-orange-200 dark:border-orange-800">
                      <CardContent className="pt-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-sm">Filtrar por Categoria</Label>
                            <Select value={novaTrocaCategoria} onValueChange={setNovaTrocaCategoria}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todas">Todas as categorias</SelectItem>
                                {categoriasPecas?.map((cat: any) => (
                                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Peça *</Label>
                            <Select value={novaTrocaPecaId} onValueChange={setNovaTrocaPecaId}>
                              <SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger>
                              <SelectContent>
                                {pecasFiltradasForm.map((p: any) => (
                                  <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-sm">Quantidade</Label>
                            <Input
                              type="number"
                              min="1"
                              value={novaTrocaQtd}
                              onChange={(e) => setNovaTrocaQtd(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Custo Unitário (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={novaTrocaCusto}
                              onChange={(e) => setNovaTrocaCusto(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Custo Total</Label>
                            <div className="h-10 px-3 py-2 bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 rounded-md flex items-center font-semibold text-orange-700 dark:text-orange-300 text-sm">
                              R$ {((parseFloat(novaTrocaCusto) || 0) * (parseInt(novaTrocaQtd) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Observações</Label>
                          <Input
                            placeholder="Motivo da troca, estado da peça antiga..."
                            value={novaTrocaObs}
                            onChange={(e) => setNovaTrocaObs(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddTrocaForm(false)}>Cancelar</Button>
                          <Button type="button" size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={adicionarTrocaPecaForm}>
                            <Plus className="h-4 w-4 mr-1" /> Adicionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Lista de trocas adicionadas */}
                  {trocasPecasForm.length > 0 ? (
                    <div className="space-y-2">
                      {trocasPecasForm.map((troca, index) => (
                        <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{troca.pecaNome}</span>
                              <span className="text-xs text-muted-foreground bg-orange-100 dark:bg-orange-900 px-2 py-0.5 rounded">{troca.categoriaNome}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>Qtd: {troca.quantidade}</span>
                              {troca.custoUnitario && <span>Custo Unit.: R$ {parseFloat(troca.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                              {troca.custoUnitario && <span className="font-semibold text-orange-700 dark:text-orange-300">Total: R$ {(parseFloat(troca.custoUnitario) * troca.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                              {troca.observacoes && <span className="italic">{troca.observacoes}</span>}
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removerTrocaPecaForm(index)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {trocasPecasForm.some(t => t.custoUnitario) && (
                        <div className="text-right text-sm font-semibold text-orange-700 dark:text-orange-300 pr-2">
                          Total Geral: R$ {trocasPecasForm.reduce((acc, t) => acc + (parseFloat(t.custoUnitario) || 0) * t.quantidade, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">Nenhuma troca de peça registrada para este lançamento.</p>
                  )}
                </CardContent>
              </Card>}

              {/* Seção de Tempos de Descarga - só para CAMINHÕES INTERNOS e CAMINHÕES DA ENTREGA DE MATERIAL */}
              {showTemposDescarga && (() => {
                // Calcular produção dos tempos de descarga para conferência
                const viagensValidasConf = temposDescargaForm.filter(t => t.horaInicio && t.horaFinal);
                const producaoTemposDescarga = viagensValidasConf.length * capacidade;
                const temDivergencia = viagensValidasConf.length > 0 && producaoTotalForm > 0 && Math.abs(producaoTemposDescarga - producaoTotalForm) > 0.01;
                const producaoConfere = viagensValidasConf.length > 0 && producaoTotalForm > 0 && Math.abs(producaoTemposDescarga - producaoTotalForm) <= 0.01;

                return (
                <Card className={`border-2 ${temDivergencia ? 'bg-red-50 dark:bg-red-950 border-red-400 dark:border-red-700' : 'bg-cyan-50 dark:bg-cyan-950 border-cyan-300 dark:border-cyan-700'}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-cyan-600" />
                      <CardTitle className="text-base text-cyan-700 dark:text-cyan-300">Tempos de Descarga (Produtividade Britador)</CardTitle>
                    </div>
                    <CardDescription className="text-cyan-600 dark:text-cyan-400">
                      Registre o horário de início e final de cada descarga no britador
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {temposDescargaForm.map((tempo, index) => {
                      // Calcular tempo da viagem
                      let tempoViagem = "";
                      let tempoMinutos = 0;
                      if (tempo.horaInicio && tempo.horaFinal) {
                        const [hi, mi] = tempo.horaInicio.split(':').map(Number);
                        const [hf, mf] = tempo.horaFinal.split(':').map(Number);
                        let inicioMin = hi * 60 + mi;
                        let finalMin = hf * 60 + mf;
                        if (finalMin < inicioMin) finalMin += 24 * 60;
                        tempoMinutos = finalMin - inicioMin;
                        const h = Math.floor(tempoMinutos / 60);
                        const m = tempoMinutos % 60;
                        tempoViagem = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      }
                      return (
                        <div key={index} className="flex items-center gap-3 bg-white dark:bg-gray-900 border border-cyan-200 dark:border-cyan-800 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 font-bold text-sm shrink-0">
                            {index + 1}
                          </div>
                          <div className="grid grid-cols-3 gap-3 flex-1">
                            <div className="space-y-1">
                              <Label className="text-xs">Início</Label>
                              <Input
                                type="time"
                                value={tempo.horaInicio}
                                onChange={(e) => {
                                  const novos = [...temposDescargaForm];
                                  novos[index] = { ...novos[index], horaInicio: e.target.value };
                                  setTemposDescargaForm(novos);
                                }}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Final</Label>
                              <Input
                                type="time"
                                value={tempo.horaFinal}
                                onChange={(e) => {
                                  const novos = [...temposDescargaForm];
                                  novos[index] = { ...novos[index], horaFinal: e.target.value };
                                  setTemposDescargaForm(novos);
                                }}
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Tempo</Label>
                              <div className="h-9 px-3 py-1 bg-cyan-100 dark:bg-cyan-900 border border-cyan-300 dark:border-cyan-700 rounded-md flex items-center font-semibold text-cyan-700 dark:text-cyan-300 text-sm">
                                {tempoViagem || "--:--"}
                              </div>
                            </div>
                          </div>
                          {temposDescargaForm.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setTemposDescargaForm(temposDescargaForm.filter((_, i) => i !== index))}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}

                    {/* Botão Nova Viagem - sempre após os lançamentos */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full bg-cyan-100 dark:bg-cyan-900 border-cyan-400 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-200 border-dashed"
                      onClick={() => setTemposDescargaForm([...temposDescargaForm, { horaInicio: "", horaFinal: "" }])}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Viagem
                    </Button>

                    {/* Resumo dos tempos */}
                    {viagensValidasConf.length > 0 && (() => {
                      const totalMinutos = viagensValidasConf.reduce((acc, t) => {
                        const [hi, mi] = t.horaInicio.split(':').map(Number);
                        const [hf, mf] = t.horaFinal.split(':').map(Number);
                        let inicioMin = hi * 60 + mi;
                        let finalMin = hf * 60 + mf;
                        if (finalMin < inicioMin) finalMin += 24 * 60;
                        return acc + (finalMin - inicioMin);
                      }, 0);
                      const mediaMinutos = viagensValidasConf.length > 0 ? totalMinutos / viagensValidasConf.length : 0;
                      const mediaH = Math.floor(mediaMinutos / 60);
                      const mediaM = Math.round(mediaMinutos % 60);

                      return (
                        <Card className="bg-cyan-100 dark:bg-cyan-900 border-cyan-300 dark:border-cyan-700">
                          <CardContent className="py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                              <div>
                                <p className="text-xs text-cyan-600 dark:text-cyan-400">Viagens</p>
                                <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{viagensValidasConf.length}</p>
                              </div>
                              <div>
                                <p className="text-xs text-cyan-600 dark:text-cyan-400">Média/Viagem</p>
                                <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{String(mediaH).padStart(2, '0')}:{String(mediaM).padStart(2, '0')}</p>
                              </div>
                              <div>
                                <p className="text-xs text-cyan-600 dark:text-cyan-400">Capacidade</p>
                                <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{capacidade > 0 ? `${capacidade} t` : "N/D"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-cyan-600 dark:text-cyan-400">Produção</p>
                                <p className="text-lg font-bold text-cyan-700 dark:text-cyan-300">{producaoTemposDescarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}

                    {/* Conferência de Produção: Serviços vs Tempos de Descarga */}
                    {viagensValidasConf.length > 0 && producaoTotalForm > 0 && (
                      <Card className={`border ${temDivergencia ? 'bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-700' : 'bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-700'}`}>
                        <CardContent className="py-3">
                          <div className="flex items-center gap-3">
                            {temDivergencia ? (
                              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className={`font-semibold text-sm ${temDivergencia ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                {temDivergencia ? 'DIVERGÊNCIA DE PRODUÇÃO DETECTADA' : 'Produção conferida - valores coincidem'}
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 text-xs">
                                <div className={`rounded px-2 py-1 ${temDivergencia ? 'bg-red-200 dark:bg-red-800' : 'bg-green-200 dark:bg-green-800'}`}>
                                  <span className="text-muted-foreground">Serviços Realizados:</span>
                                  <span className={`ml-1 font-bold ${temDivergencia ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                    {producaoTotalForm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                                  </span>
                                </div>
                                <div className={`rounded px-2 py-1 ${temDivergencia ? 'bg-red-200 dark:bg-red-800' : 'bg-green-200 dark:bg-green-800'}`}>
                                  <span className="text-muted-foreground">Tempos de Descarga:</span>
                                  <span className={`ml-1 font-bold ${temDivergencia ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'}`}>
                                    {producaoTemposDescarga.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                                  </span>
                                </div>
                                {temDivergencia && (
                                  <div className="rounded px-2 py-1 bg-red-300 dark:bg-red-700">
                                    <span className="text-muted-foreground">Diferença:</span>
                                    <span className="ml-1 font-bold text-red-800 dark:text-red-200">
                                      {Math.abs(producaoTemposDescarga - producaoTotalForm).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t
                                    </span>
                                  </div>
                                )}
                              </div>
                              {temDivergencia && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                  Verifique a quantidade de viagens nos serviços realizados e nos tempos de descarga. Ambos devem resultar na mesma produção.
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </Card>
                );
              })()}

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={editingParteId ? updateMutation.isPending : createMutation.isPending}
                  className={editingParteId ? "bg-amber-600 hover:bg-amber-700" : ""}
                >
                  {(editingParteId ? updateMutation.isPending : createMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingParteId ? "Salvar Alterações" : "Registrar Parte Diária"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { limparFormulario(); setShowForm(false); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Listagem */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Registros</CardTitle>
              <CardDescription>
                {filtrosAtivos > 0 
                  ? `${partesFiltradas.length} de ${partesDiarias?.length || 0} registros (${filtrosAtivos} filtro${filtrosAtivos > 1 ? 's' : ''} ativo${filtrosAtivos > 1 ? 's' : ''})`
                  : `Histórico de partes diárias registradas`
                }
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros
                {filtrosAtivos > 0 && (
                  <span className="ml-1 bg-white text-primary rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">
                    {filtrosAtivos}
                  </span>
                )}
              </Button>
              <ExportButtons
              options={{
                title: "Relatório de Partes Diárias",
                subtitle: `Total: ${partesFiltradas?.length || 0} registros${filtrosAtivos > 0 ? ' (filtrado)' : ''}`,
                filename: `partes-diarias-${new Date().toISOString().split("T")[0]}`,
                columns: [
                  { header: "Data", key: "data", width: 12, format: formatters.date },
                  { header: "Turno", key: "turno", width: 8 },
                  { header: "Equipamento", key: "equipamentoNome", width: 22 },
                  { header: "Hora/Km Inicial", key: "horaKmInicial", width: 14 },
                  { header: "Hora/Km Final", key: "horaKmFinal", width: 14 },
                  { header: "Hora/Km Trab.", key: "horaKmTrabalhados", width: 14 },
                  { header: "Tempo Parado Lig.", key: "tempoParadoLigado", width: 14 },
                  { header: "Tempo Parado Desl.", key: "tempoParadoDesligado", width: 14 },
                  { header: "Tempo Produtivo", key: "tempoProdutivo", width: 14 },
                  { header: "Produção (ton)", key: "producaoTotal", width: 14, format: formatters.decimal },
                  { header: "Qtd Furos", key: "qtdFuros", width: 10 },
                  { header: "Prof. Furos", key: "profundidadeFuros", width: 10 },
                  { header: "Prod. Perfuração", key: "producaoPerfuracao", width: 14 },
                  { header: "Leit. Ini. Balança", key: "leituraInicialBalanca", width: 14 },
                  { header: "Leit. Fin. Balança", key: "leituraFinalBalanca", width: 14 },
                  { header: "Prod. Balança", key: "producaoBalanca", width: 14 },
                  { header: "Observações", key: "observacoes", width: 30 },
                ],
                data: (partesFiltradas || []).map((p) => {
                  const equip = equipamentos?.find((e) => e.id === p.equipamentoId);
                  const producaoTotal = p.itens?.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0) || 0;
                  return {
                    ...p,
                    equipamentoNome: equip?.nomeDoEquipamento || equip?.codigoTag || "",
                    producaoTotal,
                  };
                }),
              }}
            />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Painel de Filtros */}
          {showFilters && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Filtros Avançados</h4>
                {filtrosAtivos > 0 && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros}>
                    <X className="h-4 w-4 mr-1" /> Limpar filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Data Início</Label>
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Fim</Label>
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grupo de Equipamentos</Label>
                  <SearchableSelect
                    options={grupoOptions}
                    value={filtroGrupoId}
                    onValueChange={(val) => { setFiltroGrupoId(val); setFiltroEquipamentoId(""); }}
                    placeholder="Todos os grupos"
                    searchPlaceholder="Buscar grupo..."
                    emptyMessage="Nenhum grupo encontrado."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Equipamento</Label>
                  <SearchableSelect
                    options={filtroGrupoId 
                      ? equipamentoOptions.filter(opt => {
                          const equip = equipamentos?.find(e => String(e.id) === opt.value);
                          return equip?.grupoId === Number(filtroGrupoId);
                        })
                      : equipamentoOptions
                    }
                    value={filtroEquipamentoId}
                    onValueChange={setFiltroEquipamentoId}
                    placeholder="Todos os equipamentos"
                    searchPlaceholder="Buscar equipamento..."
                    emptyMessage="Nenhum equipamento encontrado."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Setor</Label>
                  <SearchableSelect
                    options={setorOptions}
                    value={filtroSetorId}
                    onValueChange={setFiltroSetorId}
                    placeholder="Todos os setores"
                    searchPlaceholder="Buscar setor..."
                    emptyMessage="Nenhum setor encontrado."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Serviço</Label>
                  <SearchableSelect
                    options={servicoOptions}
                    value={filtroServicoId}
                    onValueChange={setFiltroServicoId}
                    placeholder="Todos os serviços"
                    searchPlaceholder="Buscar serviço..."
                    emptyMessage="Nenhum serviço encontrado."
                  />
                </div>
              </div>
            </div>
          )}

          {partesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filtrosAtivos > 0 ? "Nenhum registro encontrado com os filtros selecionados." : "Nenhuma parte diária registrada ainda."}
            </div>
          ) : (
            <div className="space-y-4">
              {partesFiltradas.map((parte) => {
                const equipamento = equipamentos?.find((e) => e.id === parte.equipamentoId);
                const capacidadeEquip = equipamento?.capacidade ? parseFloat(equipamento.capacidade) : 0;
                const producaoTotalParte = parte.itens?.reduce((acc, item) => acc + parseFloat(item.producao || '0'), 0) || 0;
                const isExpanded = expandedParte === parte.id;
                
                return (
                  <Card key={parte.id} className="overflow-hidden">
                    <div 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedParte(isExpanded ? null : parte.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-lg">
                              {new Date(parte.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                              {parte.turno && <span className="text-muted-foreground ml-2">({parte.turno})</span>}
                            </div>
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">Equipamento:</span>{" "}
                            {equipamento?.nomeDoEquipamento || equipamento?.codigoTag || parte.equipamentoId}
                            {capacidadeEquip > 0 && ` (Cap: ${capacidadeEquip} ton)`}
                          </div>
                          <div className="text-sm mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            <span className="text-muted-foreground">{parte.itens?.length || 0} serviço(s)</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              Produção: {producaoTotalParte.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ton
                            </span>
                            {parte.horaKmTrabalhados && (
                              <span className="text-blue-600 dark:text-blue-400">
                                Hora/Km: {parte.horaKmTrabalhados}
                              </span>
                            )}
                            {parte.tempoProdutivo && (
                              <span className="text-amber-600 dark:text-amber-400">
                                Tempo Produtivo: {parte.tempoProdutivo}h
                              </span>
                            )}
                            {parte.producaoPerfuracao && parseFloat(parte.producaoPerfuracao) > 0 && (
                              <span className="text-purple-600 dark:text-purple-400">
                                Perfuração: {parte.producaoPerfuracao}m
                              </span>
                            )}
                            {parte.producaoBalanca && parseFloat(parte.producaoBalanca) > 0 && (
                              <span className="text-amber-600 dark:text-amber-400">
                                Balança: {parseFloat(parte.producaoBalanca).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {canEdit("parteDiaria") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                preencherFormularioParaEdicao(parte);
                              }}
                              title="Editar registro"
                            >
                              <Pencil className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-orange-50 dark:bg-orange-950 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900 text-orange-700 dark:text-orange-300 gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirTrocaPecaDialog(parte.id);
                            }}
                            title="Registrar troca de peça de desgaste"
                          >
                            <Package className="h-4 w-4" />
                            <span className="hidden sm:inline text-xs">Peças</span>
                          </Button>
                          {canCreate("parteDiaria") && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirReplicarModal({ id: parte.id, equipamentoId: parte.equipamentoId, data: typeof parte.data === 'string' ? parte.data : new Date(parte.data).toISOString().split('T')[0] });
                              }}
                              title="Replicar para equipamentos agregados"
                            >
                              <Copy className="h-4 w-4" />
                              <span className="hidden sm:inline text-xs">Replicar</span>
                            </Button>
                          )}
                          {canDelete("parteDiaria") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Deseja realmente excluir esta parte diária?")) {
                                  deleteMutation.mutate({ id: parte.id });
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/30 p-4">
                        {/* Informações de Hora/Km e Tempo */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                          <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                            <div className="text-xs text-muted-foreground">Hora/Km Inicial</div>
                            <div className="font-semibold">{parte.horaKmInicial || '-'}</div>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                            <div className="text-xs text-muted-foreground">Hora/Km Final</div>
                            <div className="font-semibold">{parte.horaKmFinal || '-'}</div>
                          </div>
                          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded">
                            <div className="text-xs text-muted-foreground">Hora/Km Trabalhados</div>
                            <div className="font-semibold text-blue-700 dark:text-blue-300">{parte.horaKmTrabalhados || '-'}</div>
                          </div>
                          <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded">
                            <div className="text-xs text-muted-foreground">Parado Ligado</div>
                            <div className="font-semibold">{parte.tempoParadoLigado || '-'}</div>
                          </div>
                          <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded">
                            <div className="text-xs text-muted-foreground">Parado Desligado</div>
                            <div className="font-semibold">{parte.tempoParadoDesligado || '-'}</div>
                          </div>
                          <div className="bg-green-100 dark:bg-green-900 p-2 rounded">
                            <div className="text-xs text-muted-foreground">Tempo Produtivo</div>
                            <div className="font-semibold text-green-700 dark:text-green-300">{parte.tempoProdutivo || '-'}</div>
                          </div>
                        </div>

                        {/* Informações de Perfuração */}
                        {/* Produção Livre */}
                        {parte.producaoLivre && (
                          <div className="grid grid-cols-1 gap-4 mb-4">
                            <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded">
                              <div className="text-xs text-muted-foreground">Produção Livre</div>
                              <div className="font-semibold">{parte.producaoLivre}</div>
                            </div>
                          </div>
                        )}

                        {/* Informações de Perfuração */}
                        {(parte.qtdFuros || parte.profundidadeFuros || parte.producaoPerfuracao) && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded">
                              <div className="text-xs text-muted-foreground">Qtd Furos</div>
                              <div className="font-semibold">{parte.qtdFuros || '-'}</div>
                            </div>
                            <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded">
                              <div className="text-xs text-muted-foreground">Profundidade Furos</div>
                              <div className="font-semibold">{parte.profundidadeFuros || '-'}</div>
                            </div>
                            <div className="bg-purple-200 dark:bg-purple-800 p-2 rounded">
                              <div className="text-xs text-muted-foreground">Produção Perfuração</div>
                              <div className="font-semibold text-purple-700 dark:text-purple-300">{parte.producaoPerfuracao || '-'}</div>
                            </div>
                          </div>
                        )}

                        {/* Informações de Produção Balança */}
                        {(parte.leituraInicialBalanca || parte.leituraFinalBalanca || parte.producaoBalanca) && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded">
                              <div className="text-xs text-muted-foreground">Leitura Inicial Balança</div>
                              <div className="font-semibold">{parte.leituraInicialBalanca || '-'}</div>
                            </div>
                            <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded">
                              <div className="text-xs text-muted-foreground">Leitura Final Balança</div>
                              <div className="font-semibold">{parte.leituraFinalBalanca || '-'}</div>
                            </div>
                            <div className="bg-amber-200 dark:bg-amber-800 p-2 rounded">
                              <div className="text-xs text-muted-foreground">Produção Balança</div>
                              <div className="font-semibold text-amber-700 dark:text-amber-300">{parte.producaoBalanca || '-'}</div>
                            </div>
                          </div>
                        )}

                        {/* Tabela de Serviços */}
                        {parte.itens && parte.itens.length > 0 && (
                          <>
                            <div className="text-sm font-semibold mb-3">Detalhamento dos Serviços:</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2 px-3">#</th>
                                    <th className="text-left py-2 px-3">Setor</th>
                                    <th className="text-left py-2 px-3">Serviço</th>
                                    <th className="text-left py-2 px-3">Oper/Mot</th>
                                    <th className="text-right py-2 px-3">Quantidade</th>
                                    <th className="text-right py-2 px-3">Produção (ton)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parte.itens.map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-0">
                                      <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                                      <td className="py-2 px-3">
                                        {setores?.find((s) => s.id === item.setorId)?.nome || '-'}
                                      </td>
                                      <td className="py-2 px-3">
                                        {servicos?.find((s) => s.id === item.servicoId)?.nome || '-'}
                                      </td>
                                      <td className="py-2 px-3">
                                        {item.operadorMotoristaId 
                                          ? operadoresMotoristas?.find((op) => op.id === item.operadorMotoristaId)?.nome || '-'
                                          : item.operadorMotorista || '-'}
                                      </td>
                                      <td className="py-2 px-3 text-right font-medium">
                                        {parseFloat(item.quantidade).toLocaleString('pt-BR')}
                                      </td>
                                      <td className="py-2 px-3 text-right font-semibold text-green-600 dark:text-green-400">
                                        {parseFloat(item.producao || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-green-100 dark:bg-green-900">
                                    <td colSpan={4} className="py-2 px-3 font-semibold">Total</td>
                                    <td className="py-2 px-3 text-right font-semibold">
                                      {parte.itens.reduce((acc, item) => acc + parseFloat(item.quantidade), 0).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="py-2 px-3 text-right font-bold text-green-700 dark:text-green-300">
                                      {producaoTotalParte.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </>
                        )}
                        
                        {/* Tempos de Descarga - Feature Flag + Filtro por Grupo */}
                        {temposDescargaHabilitado && parte.itens && parte.itens.length > 0 && (() => {
                          const grupoEquip = gruposEquipamentos?.find(g => g.id === equipamento?.grupoId);
                          const nomeGrupo = grupoEquip?.nome?.toUpperCase() || '';
                          const isCaminhaoGrupo = (nomeGrupo.includes('CAMINH') && nomeGrupo.includes('INTERNO')) || 
                                                   (nomeGrupo.includes('CAMINH') && nomeGrupo.includes('ENTREGA'));
                          return isCaminhaoGrupo;
                        })() && (
                          <TemposDescargaSection 
                            parteDiariaId={parte.id} 
                            itens={parte.itens}
                            equipamento={equipamento}
                            servicos={servicos}
                            setores={setores}
                          />
                        )}

                        {/* Trocas de Peças de Desgaste */}
                        <TrocasPecasSection parteDiariaId={parte.id} />

                        {parte.observacoes && (
                          <div className="mt-3 text-sm text-muted-foreground border-t pt-3">
                            <strong>Observações:</strong> {parte.observacoes}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Troca de Peça */}
      <Dialog open={showTrocaPecaDialog} onOpenChange={setShowTrocaPecaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              Registrar Troca de Peça de Desgaste
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Filtrar por Categoria</Label>
              <Select value={trocaFiltroCategoriaId} onValueChange={setTrocaFiltroCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {categoriasPecas?.map((cat: any) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Peça *</Label>
              <Select value={trocaPecaId} onValueChange={setTrocaPecaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a peça" />
                </SelectTrigger>
                <SelectContent>
                  {pecasFiltradas?.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.codigo ? `${p.codigo} - ` : ''}{p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={trocaQuantidade}
                  onChange={(e) => setTrocaQuantidade(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Custo Unitário (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={trocaCustoUnitario}
                  onChange={(e) => setTrocaCustoUnitario(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            {trocaCustoUnitario && Number(trocaCustoUnitario) > 0 && (
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-md p-3">
                <div className="text-sm text-muted-foreground">Custo Total</div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  R$ {(Number(trocaCustoUnitario) * (Number(trocaQuantidade) || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={trocaObservacoes}
                onChange={(e) => setTrocaObservacoes(e.target.value)}
                placeholder="Motivo da troca, estado da peça antiga..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrocaPecaDialog(false)}>Cancelar</Button>
            <Button onClick={salvarTrocaPeca} disabled={createTrocaPeca.isPending} className="bg-orange-600 hover:bg-orange-700">
              {createTrocaPeca.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Troca
            </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* MODAL: REPLICAR PARA EQUIPAMENTOS AGREGADOS                  */}
      {/* ============================================================ */}
      <Dialog open={showReplicarModal} onOpenChange={(open) => {
        if (!open) {
          setShowReplicarModal(false);
          setEquipamentosSelecionados([]);
          setBuscaEquipamento("");
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-600" />
              Replicar para Equipamentos Agregados
            </DialogTitle>
            <DialogDescription>
              Selecione os equipamentos que devem receber uma cópia do lançamento de{" "}
              <strong>{replicarEquipamentoOriginalNome}</strong>{" "}
              do dia <strong>{replicarEquipamentoOriginalData}</strong>.
              Todos os campos (horímetro, turnos, tempos, serviços) serão copiados.
            </DialogDescription>
          </DialogHeader>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={buscaEquipamento}
              onChange={(e) => setBuscaEquipamento(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Seleção rápida */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {equipamentosSelecionados.length} de {equipamentosParaReplicar.length} selecionado(s)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-blue-600 hover:underline text-xs"
                onClick={() => setEquipamentosSelecionados(equipamentosParaReplicar.map(e => e.id))}
              >
                Selecionar todos
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                className="text-muted-foreground hover:underline text-xs"
                onClick={() => setEquipamentosSelecionados([])}
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Lista de equipamentos */}
          <ScrollArea className="h-64 border rounded-md">
            {equipamentosParaReplicar.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground text-sm">
                <Search className="h-8 w-8 mb-2 opacity-40" />
                {buscaEquipamento
                  ? "Nenhum equipamento encontrado para esta busca."
                  : "Nenhum outro equipamento ativo disponível."}
              </div>
            ) : (
              <div className="divide-y">
                {equipamentosParaReplicar.map((equip) => {
                  const selecionado = equipamentosSelecionados.includes(equip.id);
                  const grupoNome = equip.grupoNome ?? "";
                  return (
                    <div
                      key={equip.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selecionado ? "bg-blue-50 dark:bg-blue-950/30" : ""
                      }`}
                      onClick={() => toggleEquipamentoSelecionado(equip.id)}
                    >
                      <Checkbox
                        checked={selecionado}
                        onCheckedChange={() => toggleEquipamentoSelecionado(equip.id)}
                        className="pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{equip.nomeDoEquipamento}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {equip.codigoTag && <span className="font-mono">{equip.codigoTag}</span>}
                          {grupoNome && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0">
                              {grupoNome}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selecionado && (
                        <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowReplicarModal(false);
                setEquipamentosSelecionados([]);
                setBuscaEquipamento("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!replicarParteDiariaId || equipamentosSelecionados.length === 0) return;
                replicarMutation.mutate({
                  parteDiariaId: replicarParteDiariaId,
                  equipamentosIds: equipamentosSelecionados,
                });
              }}
              disabled={equipamentosSelecionados.length === 0 || replicarMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              {replicarMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Replicando...</>
              ) : (
                <><Copy className="h-4 w-4" /> Replicar para {equipamentosSelecionados.length} equipamento(s)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// Componente para controle de tempos de descarga por viagem
function TemposDescargaSection({ parteDiariaId, itens, equipamento, servicos, setores }: {
  parteDiariaId: number;
  itens: any[];
  equipamento: any;
  servicos: any[] | undefined;
  setores: any[] | undefined;
}) {
  const { data: temposData, refetch } = trpc.temposDescarga.listByParteDiaria.useQuery({ parteDiariaId });
  const saveAll = trpc.temposDescarga.saveAll.useMutation({
    onSuccess: () => {
      toast.success("Tempos de descarga salvos!");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [temposForm, setTemposForm] = useState<{ horaInicio: string; horaFinal: string }[]>([]);

  const capacidadeEquip = equipamento?.capacidade ? parseFloat(equipamento.capacidade) : 0;

  // Agrupar tempos por item
  const temposPorItem = useMemo(() => {
    const map: Record<number, any[]> = {};
    if (temposData) {
      temposData.forEach((t: any) => {
        if (!map[t.parteDiariaItemId]) map[t.parteDiariaItemId] = [];
        map[t.parteDiariaItemId].push(t);
      });
    }
    return map;
  }, [temposData]);

  const iniciarEdicao = (itemId: number) => {
    const existentes = temposPorItem[itemId] || [];
    if (existentes.length > 0) {
      setTemposForm(existentes.map((t: any) => ({ horaInicio: t.horaInicio, horaFinal: t.horaFinal })));
    } else {
      setTemposForm([{ horaInicio: "", horaFinal: "" }]);
    }
    setEditingItemId(itemId);
  };

  const adicionarLinha = () => {
    setTemposForm([...temposForm, { horaInicio: "", horaFinal: "" }]);
  };

  const removerLinha = (idx: number) => {
    if (temposForm.length > 1) {
      setTemposForm(temposForm.filter((_, i) => i !== idx));
    }
  };

  const atualizarTempo = (idx: number, campo: 'horaInicio' | 'horaFinal', valor: string) => {
    const novos = [...temposForm];
    novos[idx] = { ...novos[idx], [campo]: valor };
    setTemposForm(novos);
  };

  const calcularTempoStr = (inicio: string, final: string): string => {
    if (!inicio || !final) return "-";
    const [hi, mi] = inicio.split(":").map(Number);
    const [hf, mf] = final.split(":").map(Number);
    let inicioMin = hi * 60 + mi;
    let finalMin = hf * 60 + mf;
    if (finalMin < inicioMin) finalMin += 24 * 60;
    const diff = finalMin - inicioMin;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  };

  const salvarTempos = (itemId: number) => {
    const temposValidos = temposForm
      .filter(t => t.horaInicio && t.horaFinal)
      .map((t, idx) => ({
        numeroViagem: idx + 1,
        horaInicio: t.horaInicio,
        horaFinal: t.horaFinal,
      }));

    saveAll.mutate({
      parteDiariaItemId: itemId,
      parteDiariaId,
      tempos: temposValidos,
    });
    setEditingItemId(null);
  };

  // Verificar se algum item tem tempos registrados
  const temAlgumTempo = temposData && temposData.length > 0;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Timer className="h-4 w-4 text-blue-600" />
        Controle de Tempos de Descarga (Produtividade Britador)
      </div>

      {itens.map((item: any, itemIdx: number) => {
        const servico = servicos?.find((s: any) => s.id === item.servicoId);
        const setor = setores?.find((s: any) => s.id === item.setorId);
        const temposDoItem = temposPorItem[item.id] || [];
        const isEditing = editingItemId === item.id;
        const qtdViagens = temposDoItem.length;
        const producaoItem = qtdViagens * capacidadeEquip;

        // Calcular média por viagem
        const totalMinutos = temposDoItem.reduce((acc: number, t: any) => acc + (t.tempoMinutos || 0), 0);
        const mediaMinutos = qtdViagens > 0 ? totalMinutos / qtdViagens : 0;
        const mediaH = Math.floor(mediaMinutos / 60);
        const mediaM = Math.round(mediaMinutos % 60);
        const mediaStr = qtdViagens > 0 ? `${String(mediaH).padStart(2, '0')}:${String(mediaM).padStart(2, '0')}` : '-';

        return (
          <div key={item.id} className="mb-4 bg-blue-50 dark:bg-blue-950 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm">
                <span className="font-medium">{setor?.nome || '-'}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="font-medium">{servico?.nome || '-'}</span>
                {item.operadorMotoristaId && (
                  <span className="text-muted-foreground ml-2">({item.operadorMotorista || '-'})</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"
                onClick={() => isEditing ? setEditingItemId(null) : iniciarEdicao(item.id)}
              >
                <Clock className="h-3 w-3" />
                {isEditing ? 'Cancelar' : temposDoItem.length > 0 ? 'Editar Tempos' : 'Registrar Tempos'}
              </Button>
            </div>

            {/* Resumo quando não está editando */}
            {!isEditing && temposDoItem.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <div className="bg-white dark:bg-slate-900 p-2 rounded text-center">
                  <div className="text-xs text-muted-foreground">Viagens</div>
                  <div className="font-bold text-lg">{qtdViagens}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded text-center">
                  <div className="text-xs text-muted-foreground">Média/Viagem</div>
                  <div className="font-bold text-lg text-blue-600 dark:text-blue-400">{mediaStr}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded text-center">
                  <div className="text-xs text-muted-foreground">Peso (ton)</div>
                  <div className="font-bold text-lg">{capacidadeEquip.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded text-center">
                  <div className="text-xs text-muted-foreground">Produção (ton)</div>
                  <div className="font-bold text-lg text-green-600 dark:text-green-400">{producaoItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            )}

            {/* Tabela de tempos existentes (somente leitura) */}
            {!isEditing && temposDoItem.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-blue-100 dark:bg-blue-900">
                      <th className="text-center py-1 px-2 w-12">#</th>
                      <th className="text-center py-1 px-2">Início</th>
                      <th className="text-center py-1 px-2">Final</th>
                      <th className="text-center py-1 px-2">Tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {temposDoItem.map((t: any, idx: number) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-1 px-2 text-center text-muted-foreground">{idx + 1}</td>
                        <td className="py-1 px-2 text-center font-mono">{t.horaInicio}</td>
                        <td className="py-1 px-2 text-center font-mono">{t.horaFinal}</td>
                        <td className="py-1 px-2 text-center font-mono font-medium">
                          {calcularTempoStr(t.horaInicio, t.horaFinal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Formulário de edição */}
            {isEditing && (
              <div className="space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-blue-100 dark:bg-blue-900">
                        <th className="text-center py-1 px-2 w-12">#</th>
                        <th className="text-center py-1 px-2">Início</th>
                        <th className="text-center py-1 px-2">Final</th>
                        <th className="text-center py-1 px-2">Tempo</th>
                        <th className="text-center py-1 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {temposForm.map((t, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="py-1 px-2 text-center text-muted-foreground">{idx + 1}</td>
                          <td className="py-1 px-2">
                            <Input
                              type="time"
                              value={t.horaInicio}
                              onChange={(e) => atualizarTempo(idx, 'horaInicio', e.target.value)}
                              className="h-8 text-center font-mono"
                            />
                          </td>
                          <td className="py-1 px-2">
                            <Input
                              type="time"
                              value={t.horaFinal}
                              onChange={(e) => atualizarTempo(idx, 'horaFinal', e.target.value)}
                              className="h-8 text-center font-mono"
                            />
                          </td>
                          <td className="py-1 px-2 text-center font-mono font-medium text-blue-600 dark:text-blue-400">
                            {calcularTempoStr(t.horaInicio, t.horaFinal)}
                          </td>
                          <td className="py-1 px-2 text-center">
                            {temposForm.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removerLinha(idx)} className="h-6 w-6 p-0">
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={adicionarLinha} className="gap-1">
                    <Plus className="h-3 w-3" /> Adicionar Viagem
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => salvarTempos(item.id)}
                    disabled={saveAll.isPending}
                    className="gap-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {saveAll.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                    Salvar Tempos
                  </Button>
                </div>
              </div>
            )}

            {/* Mensagem quando não há tempos */}
            {!isEditing && temposDoItem.length === 0 && (
              <div className="text-xs text-muted-foreground italic">Nenhum tempo de descarga registrado para este serviço.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Componente para exibir trocas de peças nos detalhes expandidos
function TrocasPecasSection({ parteDiariaId }: { parteDiariaId: number }) {
  const { data: trocas, refetch } = trpc.trocasPecasParteDiaria.listByParteDiaria.useQuery({ parteDiariaId });
  const deleteTroca = trpc.trocasPecasParteDiaria.delete.useMutation({
    onSuccess: () => {
      toast.success("Troca removida!");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!trocas || trocas.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Package className="h-4 w-4 text-orange-600" />
        Trocas de Peças de Desgaste ({trocas.length})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-orange-50 dark:bg-orange-950">
              <th className="text-left py-2 px-3">Peça</th>
              <th className="text-left py-2 px-3">Categoria</th>
              <th className="text-right py-2 px-3">Qtd</th>
              <th className="text-right py-2 px-3">Custo Unit.</th>
              <th className="text-right py-2 px-3">Custo Total</th>
              <th className="text-left py-2 px-3">Observações</th>
              <th className="text-center py-2 px-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {trocas.map((troca: any) => (
              <tr key={troca.id} className="border-b last:border-0">
                <td className="py-2 px-3">
                  {troca.pecaCodigo ? <span className="text-muted-foreground mr-1">{troca.pecaCodigo}</span> : null}
                  {troca.pecaNome}
                </td>
                <td className="py-2 px-3 text-muted-foreground">{troca.categoriaNome}</td>
                <td className="py-2 px-3 text-right font-medium">{troca.quantidade}</td>
                <td className="py-2 px-3 text-right">
                  {troca.custoUnitario ? `R$ ${parseFloat(troca.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </td>
                <td className="py-2 px-3 text-right font-semibold text-orange-700 dark:text-orange-300">
                  {troca.custoTotal ? `R$ ${parseFloat(troca.custoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </td>
                <td className="py-2 px-3 text-muted-foreground">{troca.observacoes || '-'}</td>
                <td className="py-2 px-3 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Remover esta troca de peça?")) {
                        deleteTroca.mutate({ id: troca.id });
                      }
                    }}
                    disabled={deleteTroca.isPending}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {trocas.some((t: any) => t.custoTotal && parseFloat(t.custoTotal) > 0) && (
            <tfoot>
              <tr className="bg-orange-100 dark:bg-orange-900">
                <td colSpan={4} className="py-2 px-3 font-semibold">Total Custo Trocas</td>
                <td className="py-2 px-3 text-right font-bold text-orange-700 dark:text-orange-300">
                  R$ {trocas.reduce((acc: number, t: any) => acc + (t.custoTotal ? parseFloat(t.custoTotal) : 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
