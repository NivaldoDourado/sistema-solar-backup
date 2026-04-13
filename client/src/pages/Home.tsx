import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  FileText, 
  Fuel, 
  BarChart3, 
  DollarSign, 
  Truck, 
  Wrench,
  TrendingUp,
  Factory,
  Layers,
  Settings2,
  Calendar,
  Filter,
  Mountain,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Package,
  PackageX,
  Scale,
  ClipboardList,
  CheckCircle2,
  Clock,
  Circle,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { DashboardExportMenu } from "@/components/DashboardExportMenu";
import { WhatsAppReportModal, type CardDisponivel } from "@/components/WhatsAppReportModal";
import { formatters } from "@/lib/export-utils";
import { CardSkeletonSimple, CardSkeletonTable, CardSkeletonBars, CardSkeletonKpi } from "@/components/CardSkeleton";

// Helper defensivo para formatar números — protege contra undefined/null/NaN
function fmtNum(value: number | undefined | null, decimals = 2): string {
  const n = Number(value);
  if (isNaN(n) || value === undefined || value === null) return '0,' + '0'.repeat(decimals);
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtPct(value: number | undefined | null): string {
  const n = Number(value);
  if (isNaN(n) || value === undefined || value === null) return '0,0';
  return n.toFixed(1);
}

// Helper para formatar data para exibição
function formatDateBR(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// Helper para obter primeiro e último dia do mês atual
function getMesAtual(): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return {
    dataInicio: primeiroDia.toISOString().split("T")[0],
    dataFim: ultimoDia.toISOString().split("T")[0],
  };
}

// Helper para obter datas de períodos rápidos
function getQuickPeriod(period: string): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const dataFim = hoje.toISOString().split("T")[0];
  
  const calcInicio = (dias: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - dias);
    return d.toISOString().split("T")[0];
  };

  switch (period) {
    case "semana":
      return { dataInicio: calcInicio(7), dataFim };
    case "mes":
      return { dataInicio: calcInicio(30), dataFim };
    case "trimestre":
      return { dataInicio: calcInicio(90), dataFim };
    case "semestre":
      return { dataInicio: calcInicio(180), dataFim };
    case "ano":
      return { dataInicio: calcInicio(365), dataFim };
    default:
      return { dataInicio: "", dataFim: "" };
  }
}

export default function Home() {
  const { user } = useAuth();
  const { hasModuleAccess } = usePermissions();
  
  // Mês atual como filtro padrão
  const [mesAtualDefault] = useState(() => getMesAtual());
  
  // Estado do filtro de período - inicializa com mês atual
  const [dataInicio, setDataInicio] = useState(() => getMesAtual().dataInicio);
  const [dataFim, setDataFim] = useState(() => getMesAtual().dataFim);
  const [periodoAtivo, setPeriodoAtivo] = useState<string>("mesAtual");

  // Parâmetros de filtro para as queries - sempre envia filtro (mês atual ou selecionado)
  const filtroParams = useMemo(() => {
    return { dataInicio: dataInicio || undefined, dataFim: dataFim || undefined };
  }, [dataInicio, dataFim]);

  const { data: equipamentos } = trpc.equipamentos.list.useQuery(undefined, { enabled: hasModuleAccess("equipamentos") });
  const { data: parteDiaria } = trpc.parteDiaria.list.useQuery(undefined, { enabled: hasModuleAccess("parteDiaria") });
  const dashboardFiltro = useMemo(() => ({ dataInicio: dataInicio || undefined, dataFim: dataFim || undefined }), [dataInicio, dataFim]);
  // Usar queries de agregação dedicadas para o Dashboard (sem paginação)
  const { data: abastecimentoTotais, isLoading: loadingAbastecimento } = trpc.abastecimento.totais.useQuery(dashboardFiltro, { enabled: hasModuleAccess("abastecimento") });
  const { data: custoTotais, isLoading: loadingCustos } = trpc.custos.totais.useQuery(dashboardFiltro, { enabled: hasModuleAccess("custos") });
  const { data: manutencaoTotais } = trpc.manutencao.totais.useQuery(dashboardFiltro, { enabled: hasModuleAccess("manutencao") });
  
  // Dados de produção agregados com filtro de período
  const { data: producaoPorSetor, isLoading: loadingSetor } = trpc.parteDiaria.producaoPorSetor.useQuery(filtroParams, { enabled: hasModuleAccess("parteDiaria") });
  const { data: producaoPorServico, isLoading: loadingServico } = trpc.parteDiaria.producaoPorServico.useQuery(filtroParams, { enabled: hasModuleAccess("parteDiaria") });
  const { data: producaoPorEquipamento, isLoading: loadingEquipamento } = trpc.parteDiaria.producaoPorEquipamento.useQuery(filtroParams, { enabled: hasModuleAccess("parteDiaria") });
  const { data: producaoMetodoCaminhoes, isLoading: loadingCaminhoes } = trpc.parteDiaria.producaoMetodoCaminhoes.useQuery(filtroParams, { enabled: hasModuleAccess("parteDiaria") });
  const { data: producaoPerfuracao, isLoading: loadingPerfuracao } = trpc.parteDiaria.producaoPerfuracao.useQuery(filtroParams, { enabled: hasModuleAccess("parteDiaria") });
  const { data: medicaoPilhasData, isLoading: loadingPilhas } = trpc.medicaoPilhas.producaoPorProduto.useQuery(filtroParams, { enabled: hasModuleAccess("medicaoPilhas") });
  const { data: producaoMotoristasData, isLoading: loadingMotoristas } = trpc.parteDiaria.producaoMotoristas.useQuery(filtroParams, { enabled: hasModuleAccess("parteDiaria") });
  const { data: revisoesPreventivas } = trpc.manutencao.revisoesPreventivas.useQuery(undefined, { enabled: hasModuleAccess("manutencao") });
  const { data: vendasData, isLoading: loadingVendas } = trpc.vendas.vendasList.useQuery(undefined, { enabled: hasModuleAccess("vendas") });
  const { data: producaoUltimoDia, isLoading: loadingUltimoDia } = trpc.parteDiaria.producaoUltimoDia.useQuery(undefined, { enabled: hasModuleAccess("parteDiaria") });
  const { data: metaDiariaConfig } = trpc.configuracoes.get.useQuery({ chave: "meta_diaria_caminhoes" });
  const utils = trpc.useUtils();
  const setConfigMutation = trpc.configuracoes.set.useMutation({
    onSuccess: () => {
      utils.configuracoes.get.invalidate({ chave: "meta_diaria_caminhoes" });
      toast.success("Meta diária salva com sucesso!");
    },
  });
  const [metaDiariaLocal, setMetaDiariaLocal] = useState("");
  const [metaEditando, setMetaEditando] = useState(false);
  const { data: estoqueMinimoPecas } = trpc.pecasDesgaste.estoqueMinimoDashboard.useQuery(undefined, { enabled: hasModuleAccess("pecasDesgaste") });
  const { data: producaoBalancasData } = trpc.parteDiaria.producaoBalancasIntegradoras.useQuery(filtroParams, { enabled: hasModuleAccess("parteDiaria") });
  const { data: destinatariosWpp } = trpc.destinatariosWhatsapp.list.useQuery();
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);
  const [wppModalOpen, setWppModalOpen] = useState(false);

  // Rotinas Diárias
  const { data: rotinasStatus, refetch: refetchRotinas } = trpc.rotinas.statusHoje.useQuery();
  const atualizarStatusMutation = trpc.rotinas.marcarStatus.useMutation({
    onSuccess: () => { refetchRotinas(); },
    onError: () => toast.error("Erro ao atualizar status da rotina."),
  });
  const { userRole } = usePermissions();

  // Meta Produção Método Caminhões
  const { data: metaCaminhoesConfig } = trpc.configuracoes.get.useQuery({ chave: "meta_producao_caminhoes" });
  const setMetaCaminhoesMutation = trpc.configuracoes.set.useMutation({
    onSuccess: () => {
      utils.configuracoes.get.invalidate({ chave: "meta_producao_caminhoes" });
      toast.success("Meta salva com sucesso!");
    },
  });
  const [metaCaminhoesLocal, setMetaCaminhoesLocal] = useState("");
  const [metaCaminhoesEditando, setMetaCaminhoesEditando] = useState(false);
  const [expandSetor, setExpandSetor] = useState(false);
  const [expandServico, setExpandServico] = useState(false);
  const [expandEquipamento, setExpandEquipamento] = useState(false);

  useEffect(() => {
    if (metaDiariaConfig?.valor) {
      setMetaDiariaLocal(metaDiariaConfig.valor);
    }
  }, [metaDiariaConfig]);

  useEffect(() => {
    if (metaCaminhoesConfig?.valor) {
      setMetaCaminhoesLocal(metaCaminhoesConfig.valor);
    }
  }, [metaCaminhoesConfig]);

  const equipamentosAtivos = equipamentos?.filter(e => e.ativo === "sim").length || 0;
  
  // Filtrar custos e abastecimentos por período no frontend
  // Valores agregados do Dashboard via queries de totais
  const totalCustosAgg = Number(custoTotais?.totalValor ?? 0);
  const totalAbastecimentosAgg = Number(abastecimentoTotais?.totalQuantidade ?? 0);
  const totalRegistrosCustos = custoTotais?.totalRegistros ?? 0;
  const totalRegistrosAbastecimentos = abastecimentoTotais?.totalRegistros ?? 0;
  const totalRegistrosManutencoes = manutencaoTotais?.totalRegistros ?? 0;

  const parteDiariaFiltrada = useMemo(() => {
    if (!parteDiaria) return [];
    return parteDiaria.filter(p => {
      const d = typeof (p.data as any) === "string" ? (p.data as any).split("T")[0] : new Date(p.data).toISOString().split("T")[0];
      if (dataInicio && d < dataInicio) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    });
  }, [parteDiaria, dataInicio, dataFim]);

  const totalCustos = totalCustosAgg;
  const totalProducaoCaminhoes = producaoMetodoCaminhoes?.total || 0;
  const totalAbastecimentos = totalAbastecimentosAgg;
  const totalPerfuracao = producaoPerfuracao?.total || 0;
  const totalFuros = producaoPerfuracao?.totalFuros || 0;
  const totalMetrosPerfurados = producaoPerfuracao?.totalMetros || 0;

  // Filtrar vendas por período
  const vendasFiltradas = useMemo(() => {
    if (!vendasData) return [];
    return vendasData.filter((v: any) => {
      const d = typeof v.data === "string" ? v.data.split("T")[0] : new Date(v.data).toISOString().split("T")[0];
      if (dataInicio && d < dataInicio) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    });
  }, [vendasData, dataInicio, dataFim]);

  const totalVendasValor = vendasFiltradas.reduce((s: number, v: any) => s + parseFloat(String(v.valorTotal || "0")), 0);
  const totalVendasQtd = vendasFiltradas.length;
  const totalVendasPeso = vendasFiltradas.reduce((s: number, v: any) => s + parseFloat(String(v.pesoTotal || "0")), 0);

  // Resumo por tipo de venda
  const vendasPorTipo = useMemo(() => {
    const r = {
      venda: { totalM3: 0, totalTon: 0, valor: 0 },
      amortizacao: { totalM3: 0, totalTon: 0, valor: 0 },
      doacao: { totalM3: 0, totalTon: 0, valor: 0 },
    };
    vendasFiltradas.forEach((v: any) => {
      const tipo = (v.tipo || "venda") as keyof typeof r;
      if (r[tipo]) {
        // pesoTotal é a quantidade em m³
        const qtdM3 = parseFloat(String(v.pesoTotal || "0"));
        r[tipo].totalM3 += qtdM3;
        r[tipo].valor += parseFloat(String(v.valorTotal || "0"));
        // Calcular toneladas a partir dos itens usando densidade do produto
        if (v.itens && Array.isArray(v.itens)) {
          v.itens.forEach((item: any) => {
            const qtdItem = parseFloat(String(item.quantidade || "0"));
            const densidade = item.produto?.densidade ? parseFloat(String(item.produto.densidade)) : 0;
            r[tipo].totalTon += qtdItem * densidade;
          });
        }
      }
    });
    return r;
  }, [vendasFiltradas]);

  // Calcular a maior produção para normalizar as barras
  const maxProducaoSetor = Math.max(...(producaoPorSetor?.map(s => s.producaoTotal) || [1]));
  const maxProducaoServico = Math.max(...(producaoPorServico?.map(s => s.producaoTotal) || [1]));
  const maxProducaoEquipamento = Math.max(...(producaoPorEquipamento?.map(e => e.producaoTotal) || [1]));

  const handleQuickPeriod = (period: string) => {
    if (periodoAtivo === period) {
      // Se clicar no mesmo período, volta para mês atual
      const mesAtual = getMesAtual();
      setDataInicio(mesAtual.dataInicio);
      setDataFim(mesAtual.dataFim);
      setPeriodoAtivo("mesAtual");
    } else {
      const { dataInicio: di, dataFim: df } = getQuickPeriod(period);
      setDataInicio(di);
      setDataFim(df);
      setPeriodoAtivo(period);
    }
  };

  const handleClearFilter = () => {
    // Ao limpar, volta para o mês atual
    const mesAtual = getMesAtual();
    setDataInicio(mesAtual.dataInicio);
    setDataFim(mesAtual.dataFim);
    setPeriodoAtivo("mesAtual");
  };

  // Verifica se o filtro atual é o mês padrão
  const isFiltroMesAtual = periodoAtivo === "mesAtual";

  const handleDateChange = (field: "inicio" | "fim", value: string) => {
    setPeriodoAtivo(""); // Limpa período rápido ao editar manualmente
    if (field === "inicio") setDataInicio(value);
    else setDataFim(value);
  };

  // Montar lista de cards para o modal com mensagens pré-formatadas
  const cardsParaModal = useMemo((): CardDisponivel[] => {
    const fmt = (n: number, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const fmtInt = (n: number) => n.toLocaleString('pt-BR');

    return [
      {
        id: 'equipamentos_ativos',
        label: 'Equipamentos Ativos',
        temDados: (equipamentos?.length || 0) > 0,
        mensagem: equipamentos ? `🚛 *Equipamentos Ativos*\n${equipamentosAtivos} de ${equipamentos.length} cadastrados\n` : undefined,
      },
      {
        id: 'combustivel',
        label: 'Combustível (L)',
        temDados: totalAbastecimentos > 0,
        mensagem: `⛽ *Combustível*\nTotal: ${fmt(totalAbastecimentos)} L\n${fmtInt(totalRegistrosAbastecimentos)} abastecimentos\n`,
      },
      {
        id: 'custos_totais',
        label: 'Custos Totais',
        temDados: totalCustos > 0,
        mensagem: `💰 *Custos Totais*\nR$ ${fmt(totalCustos)}\n${fmtInt(totalRegistrosCustos)} lançamentos\n`,
      },
      {
        id: 'custo_combustivel',
        label: 'Custo Combustível',
        temDados: (abastecimentoTotais?.totalValor || 0) > 0,
        mensagem: `💵 *Custo Combustível*\nR$ ${fmt(Number(abastecimentoTotais?.totalValor || 0))}\n`,
      },
      {
        id: 'estoque_minimo',
        label: 'Estoque Mínimo de Peças',
        temDados: (estoqueMinimoPecas?.length || 0) > 0,
        mensagem: estoqueMinimoPecas && estoqueMinimoPecas.length > 0
          ? `📦 *Estoque Mínimo de Peças*\n${estoqueMinimoPecas.filter((p: any) => p.estoqueAtual <= p.estoqueMinimo).length} peça(s) abaixo do mínimo\n`
          : undefined,
      },
      {
        id: 'vendas',
        label: 'Vendas',
        temDados: vendasPorTipo.venda.totalM3 > 0,
        mensagem: vendasPorTipo.venda.totalM3 > 0
          ? `🛍️ *Vendas*\n${fmt(vendasPorTipo.venda.totalM3)} m³ | R$ ${fmt(vendasPorTipo.venda.valor)}\n`
          : undefined,
      },
      {
        id: 'amortizacoes',
        label: 'Amortizações',
        temDados: vendasPorTipo.amortizacao.totalM3 > 0,
        mensagem: vendasPorTipo.amortizacao.totalM3 > 0
          ? `🔄 *Amortizações*\n${fmt(vendasPorTipo.amortizacao.totalM3)} m³ | R$ ${fmt(vendasPorTipo.amortizacao.valor)}\n`
          : undefined,
      },
      {
        id: 'doacoes',
        label: 'Doações',
        temDados: vendasPorTipo.doacao.totalM3 > 0,
        mensagem: vendasPorTipo.doacao.totalM3 > 0
          ? `🎁 *Doações*\n${fmt(vendasPorTipo.doacao.totalM3)} m³ | R$ ${fmt(vendasPorTipo.doacao.valor)}\n`
          : undefined,
      },
      {
        id: 'producao_caminhoes',
        label: 'Produção Método Caminhões',
        temDados: totalProducaoCaminhoes > 0,
        mensagem: (() => {
          if (!producaoMetodoCaminhoes || totalProducaoCaminhoes === 0) return undefined;
          let m = `🚛 *Produção Método Caminhões*\nTotal: ${fmt(totalProducaoCaminhoes)} ton\n`;
          const metaCamVal = parseFloat(metaCaminhoesLocal || '0');
          if (metaCamVal > 0) {
            const perc = (totalProducaoCaminhoes / metaCamVal) * 100;
            m += `Meta: ${fmt(metaCamVal)} ton | Produzido: ${perc.toFixed(1)}%\n`;
            if (totalProducaoCaminhoes >= metaCamVal) m += `✅ Meta atingida!\n`;
            else m += `A produzir: ${fmt(metaCamVal - totalProducaoCaminhoes)} ton\n`;
          }
          if (producaoMetodoCaminhoes.britagemFixa?.caminhoes?.length > 0) {
            m += `\n🏭 Britagem Fixa: ${fmt(producaoMetodoCaminhoes.britagemFixa.total)} ton\n`;
            producaoMetodoCaminhoes.britagemFixa.caminhoes.forEach((c: any) => {
              m += `  ${c.placa}: ${fmt(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`;
            });
          }
          if (producaoMetodoCaminhoes.britagemMovel?.caminhoes?.length > 0) {
            m += `\n🚚 Britagem Móvel: ${fmt(producaoMetodoCaminhoes.britagemMovel.total)} ton\n`;
            producaoMetodoCaminhoes.britagemMovel.caminhoes.forEach((c: any) => {
              m += `  ${c.placa}: ${fmt(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`;
            });
          }
          return m;
        })(),
      },
      {
        id: 'medicao_pilhas',
        label: 'Medição das Pilhas',
        temDados: (medicaoPilhasData as any)?.total > 0,
        mensagem: (medicaoPilhasData as any)?.total > 0
          ? `⛰️ *Medição das Pilhas*\nTotal: ${fmt((medicaoPilhasData as any).total)} ton\n${((medicaoPilhasData as any).produtos || []).map((p: any) => `  ${p.produtoNome}: ${fmt(p.totalProduzido)} ton (${p.percentual.toFixed(1)}%)`).join('\n')}\n`
          : undefined,
      },
      {
        id: 'producao_balancas',
        label: 'Produção Balanças Integradoras',
        temDados: (producaoBalancasData?.equipamentos?.length || 0) > 0,
        mensagem: producaoBalancasData && producaoBalancasData.equipamentos.length > 0
          ? `⚖️ *Produção Balanças Integradoras*\n${producaoBalancasData.equipamentos.map((e: any) => `  ${e.nome}: ${fmt(e.producaoBalanca)} ton${e.divergencia ? ' ⚠️' : ''}`).join('\n')}\n`
          : undefined,
      },
      {
        id: 'producao_ultimo_dia',
        label: 'Produção Último Dia Caminhões',
        temDados: (producaoUltimoDia?.total || 0) > 0,
        mensagem: producaoUltimoDia && producaoUltimoDia.total > 0
          ? (() => {
              let m = `📊 *Produção Último Dia* (${producaoUltimoDia.dataReferencia ? formatDateBR(producaoUltimoDia.dataReferencia) : '-'})\nTotal: ${fmt(producaoUltimoDia.total)} ton\n`;
              const metaVal = parseFloat(metaDiariaLocal || '0');
              if (metaVal > 0) {
                const perc = (producaoUltimoDia.total / metaVal) * 100;
                m += `Meta diária: ${fmt(metaVal)} ton | ${perc.toFixed(1)}%\n`;
              }
              return m;
            })()
          : undefined,
      },
      {
        id: 'producao_perfuracao',
        label: 'Produção de Perfuração',
        temDados: totalPerfuracao > 0,
        mensagem: totalPerfuracao > 0
          ? `⛏️ *Produção de Perfuração*\nTotal: ${fmt(totalPerfuracao)} m\nFuros: ${fmtInt(totalFuros)} | Metros: ${fmt(totalMetrosPerfurados)} m\n`
          : undefined,
      },
      {
        id: 'revisoes_preventivas',
        label: 'Revisões Preventivas',
        temDados: (revisoesPreventivas?.length || 0) > 0,
        mensagem: (() => {
          if (!revisoesPreventivas || revisoesPreventivas.length === 0) return undefined;
          const vencidas = revisoesPreventivas.filter(r => r.faltam <= 0);
          const proximas = revisoesPreventivas.filter(r => r.faltam > 0 && r.faltam <= 25);
          if (vencidas.length === 0 && proximas.length === 0) return undefined;
          let m = `🔧 *Revisões Preventivas*\n`;
          if (vencidas.length > 0) m += `⚠️ Vencidas (${vencidas.length}): ${vencidas.map(r => r.equipamentoTag).join(', ')}\n`;
          if (proximas.length > 0) m += `⏰ Próximas (${proximas.length}): ${proximas.map(r => r.equipamentoTag).join(', ')}\n`;
          return m;
        })(),
      },
      {
        id: 'producao_motoristas',
        label: 'Produção dos Motoristas',
        temDados: (producaoMotoristasData?.motoristas?.length || 0) > 0,
        mensagem: (() => {
          if (!producaoMotoristasData || producaoMotoristasData.motoristas.length === 0) return undefined;
          let m = `🚛 *Produção dos Motoristas*\nTotal: ${fmt(producaoMotoristasData.totalProducao)} ton | ${fmtInt(producaoMotoristasData.totalViagens)} viagens\n`;
          producaoMotoristasData.motoristas.forEach((mot: any) => {
            m += `\n  *${mot.motoristaNome}*: ${fmt(mot.totalProducao)} ton | ${fmtInt(mot.totalViagens)} viag. (${mot.percentual.toFixed(1)}%)\n`;
            if (mot.servicos && mot.servicos.length > 0) {
              mot.servicos.forEach((s: any) => {
                m += `    - ${s.servicoNome}: ${fmtInt(s.viagens)} viag. | ${fmt(s.producao)} ton\n`;
              });
            }
          });
          return m;
        })(),
      },
      {
        id: 'producao_setor',
        label: 'Produção por Setor',
        temDados: (producaoPorSetor?.length || 0) > 0,
        mensagem: producaoPorSetor && producaoPorSetor.length > 0
          ? `🏭 *Produção por Setor*\n${producaoPorSetor.map((s: any) => `  ${s.setorNome}: ${fmt(s.producaoTotal)} ton`).join('\n')}\n`
          : undefined,
      },
      {
        id: 'producao_servico',
        label: 'Produção por Serviço',
        temDados: (producaoPorServico?.length || 0) > 0,
        mensagem: producaoPorServico && producaoPorServico.length > 0
          ? `⚙️ *Produção por Serviço*\n${producaoPorServico.map((s: any) => `  ${s.servicoNome}: ${fmt(s.producaoTotal)} ton`).join('\n')}\n`
          : undefined,
      },
      {
        id: 'producao_equipamento',
        label: 'Produção por Equipamento',
        temDados: (producaoPorEquipamento?.length || 0) > 0,
        mensagem: producaoPorEquipamento && producaoPorEquipamento.length > 0
          ? `🚜 *Produção por Equipamento (Caminhões Internos)*\n${producaoPorEquipamento.map((e: any) => `  ${e.equipamentoTag || e.equipamentoNome}: ${fmt(e.producaoTotal)} ton`).join('\n')}\n`
          : undefined,
      },
    ];
  }, [
    equipamentos, equipamentosAtivos, totalAbastecimentos, totalRegistrosAbastecimentos,
    totalCustos, totalRegistrosCustos, abastecimentoTotais, estoqueMinimoPecas,
    vendasPorTipo, totalProducaoCaminhoes, producaoMetodoCaminhoes, metaCaminhoesLocal,
    medicaoPilhasData, producaoBalancasData, producaoUltimoDia, metaDiariaLocal,
    totalPerfuracao, totalFuros, totalMetrosPerfurados, revisoesPreventivas,
    producaoMotoristasData, producaoPorSetor, producaoPorServico, producaoPorEquipamento,
  ]);

  const enviarWhatsapp = () => {
    if (!destinatariosWpp) return;
    const ativos = destinatariosWpp.filter(d => d.ativo === "sim");
    if (ativos.length === 0) {
      toast.error("Nenhum destinatário ativo cadastrado");
      return;
    }
    setEnviandoWhatsapp(true);

    // Montar mensagem com dados dos cards
    let msg = "\u2699\ufe0f *RELAT\u00d3RIO - PEDREIRA SOUZA E OLIVEIRA*\n";
    msg += `\ud83d\udcc5 ${new Date().toLocaleDateString('pt-BR')}\n\n`;

    // Produ\u00e7\u00e3o M\u00e9todo Caminh\u00f5es
    if (producaoMetodoCaminhoes) {
      msg += `\ud83d\ude9a *Produ\u00e7\u00e3o M\u00e9todo Caminh\u00f5es*\n`;
      msg += `Total: ${fmtNum(totalProducaoCaminhoes)} ton\n`;
      const metaCamVal = parseFloat(metaCaminhoesLocal || "0");
      if (metaCamVal > 0) {
        const aProduzir = metaCamVal - totalProducaoCaminhoes;
        const percProduzido = (totalProducaoCaminhoes / metaCamVal) * 100;
        msg += `Meta: ${fmtNum(metaCamVal)} ton\n`;
        msg += `Produzido: ${fmtPct(percProduzido)}% da meta\n`;
        if (aProduzir <= 0) {
          msg += `\u2705 Meta atingida!\n`;
        } else {
          msg += `A Produzir: ${fmtNum(aProduzir)} ton (${((aProduzir / metaCamVal) * 100).toFixed(1)}%)\n`;
        }
      }
      // Britagem Fixa
      if (producaoMetodoCaminhoes.britagemFixa?.caminhoes?.length > 0) {
        msg += `\n🏭 *Britagem Fixa*: ${fmtNum(producaoMetodoCaminhoes.britagemFixa.total)} ton\n`;
        msg += `Viagens: ${producaoMetodoCaminhoes.britagemFixa.totalViagens?.toLocaleString('pt-BR') || '0'}\n`;
        msg += `Caminhão | Viag. | Peso(t) | Prod.(ton) | %\n`;
        producaoMetodoCaminhoes.britagemFixa.caminhoes.forEach((c: any) => {
          msg += `  ${c.placa}: ${c.totalViagens?.toLocaleString('pt-BR') || '0'} viag. | ${c.capacidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}t | ${fmtNum(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`;
        });
      }
      // Britagem Móvel
      if (producaoMetodoCaminhoes.britagemMovel?.caminhoes?.length > 0) {
        msg += `\n🚚 *Britagem Móvel*: ${fmtNum(producaoMetodoCaminhoes.britagemMovel.total)} ton\n`;
        msg += `Viagens: ${producaoMetodoCaminhoes.britagemMovel.totalViagens?.toLocaleString('pt-BR') || '0'}\n`;
        msg += `Caminhão | Viag. | Peso(t) | Prod.(ton) | %\n`;
        producaoMetodoCaminhoes.britagemMovel.caminhoes.forEach((c: any) => {
          msg += `  ${c.placa}: ${c.totalViagens?.toLocaleString('pt-BR') || '0'} viag. | ${c.capacidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}t | ${fmtNum(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`;
        });
      }
      msg += `\nViagens total: ${producaoMetodoCaminhoes.totalViagens?.toLocaleString('pt-BR') || '0'}\n`;
      msg += "\n";
    }

    // Produção Último Dia
    if (producaoUltimoDia && producaoUltimoDia.total > 0) {
      msg += `\ud83d\udcca *Produ\u00e7\u00e3o \u00daltimo Dia Caminh\u00f5es* (${producaoUltimoDia.dataReferencia ? formatDateBR(producaoUltimoDia.dataReferencia) : '-'})\n`;
      msg += `Total: ${fmtNum(producaoUltimoDia.total)} ton\n`;
      const metaVal = parseFloat(metaDiariaLocal || "0");
      if (metaVal > 0) {
        const percProduzido = (producaoUltimoDia.total / metaVal) * 100;
        const aProduzir = metaVal - producaoUltimoDia.total;
        const percAProduzir = (aProduzir / metaVal) * 100;
        msg += `Meta Di\u00e1ria: ${fmtNum(metaVal)} ton\n`;
        msg += `Produzido: ${fmtPct(percProduzido)}% da meta\n`;
        if (aProduzir <= 0) {
          msg += `\u2705 Meta di\u00e1ria atingida!\n`;
        } else {
          msg += `A Produzir: ${fmtNum(aProduzir)} ton (${fmtPct(percAProduzir)}%)\n`;
        }
      }
      if (producaoUltimoDia.caminhoes) {
        producaoUltimoDia.caminhoes.forEach(c => {
          msg += `  ${c.placa}: ${fmtNum(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`;
        });
      }
      msg += "\n";
    }
    // Medi\u00e7\u00e3o das Pilhas
    if (medicaoPilhasData && (medicaoPilhasData as any).total > 0) {
      msg += `⛰️ *Medição das Pilhas*\n`;
      msg += `Total: ${fmtNum((medicaoPilhasData as any).total)} ton\n`;
      if ((medicaoPilhasData as any).produtos) {
        (medicaoPilhasData as any).produtos.forEach((p: any) => {
          msg += `  ${p.produtoNome}: ${fmtNum(p.totalProduzido)} ton (${p.percentual.toFixed(1)}%)\n`;
        });
      }
      msg += "\n";
    }

    // Perfura\u00e7\u00e3o
    if (totalPerfuracao > 0) {
      msg += `\u26cf\ufe0f *Produ\u00e7\u00e3o de Perfura\u00e7\u00e3o*\n`;
      msg += `Total: ${fmtNum(totalPerfuracao)} m\n`;
      msg += `Furos: ${fmtNum(totalFuros, 0)} | Metros: ${fmtNum(totalMetrosPerfurados)} m\n\n`;
    }

       // Vendas de Material
    if (vendasFiltradas.length > 0) {
      msg += `🛍️ *Vendas de Material*\n`;
      msg += `Total Faturado: R$ ${fmtNum(totalVendasValor)}\n`;
      msg += `Notas Fiscais: ${totalVendasQtd}\n`;
      msg += `Quantidade: ${fmtNum(totalVendasPeso)}\n`;
      if (totalVendasQtd > 0) {
        msg += `Ticket Médio: R$ ${fmtNum(totalVendasQtd > 0 ? totalVendasValor / totalVendasQtd : 0)}\n`;
      }
      msg += "\n";
    }

    // Revisões Preventivas vencidas
    if (revisoesPreventivas) {
      const vencidas = revisoesPreventivas.filter(r => r.faltam <= 0);
      if (vencidas.length > 0) {
        msg += `\u26a0\ufe0f *Revis\u00f5es Preventivas Vencidas (${vencidas.length})*\n`;
        vencidas.forEach(r => {
          msg += `  ${r.equipamentoTag}: Faltam ${r.faltam.toFixed(1)}\n`;
        });
        msg += "\n";
      }
    }

    msg += `_Enviado pelo Sistema de Gest\u00e3o - Pedreira Souza e Oliveira Ltda_`;

    // Abrir WhatsApp para cada destinat\u00e1rio
    const encodedMsg = encodeURIComponent(msg);
    let count = 0;
    ativos.forEach((dest, idx) => {
      const telefone = dest.telefone.replace(/\D/g, '');
      const url = `https://wa.me/${telefone}?text=${encodedMsg}`;
      setTimeout(() => {
        window.open(url, '_blank');
        count++;
        if (count === ativos.length) {
          setEnviandoWhatsapp(false);
          toast.success(`WhatsApp aberto para ${ativos.length} destinat\u00e1rio(s)`);
        }
      }, idx * 1000); // Intervalo de 1s entre cada abertura
    });
  };

  // temFiltro indica se há um filtro diferente do mês atual
  const temFiltro = periodoAtivo !== "mesAtual";

  const allModulosRapidos = [
    {
      titulo: "Parte Diária",
      descricao: "Registrar operações diárias",
      icone: FileText,
      cor: "text-blue-500",
      link: "/parte-diaria",
      total: parteDiariaFiltrada.length,
    },
    {
      titulo: "Abastecimento",
      descricao: "Controle de combustível",
      icone: Fuel,
      cor: "text-green-500",
      link: "/abastecimento",
      total: totalRegistrosAbastecimentos,
    },
    {
      titulo: "Produção",
      descricao: "Registrar produção diária",
      icone: BarChart3,
      cor: "text-purple-500",
      link: "/producao",
      total: parteDiariaFiltrada.length,
    },
    {
      titulo: "Custos",
      descricao: "Gerenciar custos operacionais",
      icone: DollarSign,
      cor: "text-orange-500",
      link: "/custos",
      total: totalRegistrosCustos,
    },
    {
      titulo: "Equipamentos",
      descricao: "Gerenciar frota",
      icone: Truck,
      cor: "text-indigo-500",
      link: "/equipamentos",
      total: equipamentos?.length || 0,
    },
    {
      titulo: "Manutenção",
      descricao: "Controle de manutenções",
      icone: Wrench,
      cor: "text-red-500",
      link: "/manutencao",
      total: totalRegistrosManutencoes,
    },
  ];

  // Filtrar módulos baseado nas permissões
  const modulosRapidos = allModulosRapidos.filter(modulo => {
    if (modulo.link === "/custos") {
      return hasModuleAccess("custos");
    }
    return true;
  });

  const periodos = [
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
    { key: "trimestre", label: "Trimestre" },
    { key: "semestre", label: "Semestre" },
    { key: "ano", label: "Ano" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Bem-vindo, {user?.name || "usuário"}!
          </h1>
          <p className="text-muted-foreground mt-2">
            Pedreira Souza e Oliveira Ltda
          </p>
        </div>
        {destinatariosWpp && destinatariosWpp.filter(d => d.ativo === "sim").length > 0 && (
          <Button
            onClick={() => setWppModalOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            Relatório WhatsApp
          </Button>
        )}
      </div>

      {/* Alerta de Revisões Preventivas Vencidas */}
      {revisoesPreventivas && revisoesPreventivas.filter(r => r.faltam <= 0).length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0 animate-pulse" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800 dark:text-red-300 text-sm">
              Atenção: {revisoesPreventivas.filter(r => r.faltam <= 0).length} equipamento(s) com revisão preventiva vencida!
            </h3>
            <p className="text-red-700 dark:text-red-400 text-xs mt-1">
              {revisoesPreventivas.filter(r => r.faltam <= 0).map(r => `${r.equipamentoTag} (${r.faltam.toFixed(1)})`).join(" • ")}
            </p>
          </div>
        </div>
      )}

      {/* Controle de Período */}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Filtro de Período</CardTitle>
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${temFiltro ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {temFiltro ? 'Filtro personalizado' : `Mês atual (${formatDateBR(dataInicio)} - ${formatDateBR(dataFim)})`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Períodos rápidos */}
          <div className="flex flex-wrap gap-2">
            {periodos.map(p => (
              <Button
                key={p.key}
                variant={periodoAtivo === p.key ? "default" : "outline"}
                size="sm"
                onClick={() => handleQuickPeriod(p.key)}
                className="text-xs"
              >
                {p.label}
              </Button>
            ))}
            {temFiltro && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilter}
                className="text-xs text-destructive hover:text-destructive"
              >
                Voltar ao mês atual
              </Button>
            )}
          </div>
          {/* Seleção manual de datas */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Início</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => handleDateChange("inicio", e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data Fim</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => handleDateChange("fim", e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
            {temFiltro && (
              <p className="text-xs text-muted-foreground pb-1">
                Exibindo dados de {dataInicio ? formatDateBR(dataInicio) : "início"} até {dataFim ? formatDateBR(dataFim) : "hoje"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card Status dos Lançamentos - substitui Equipamentos Ativos */}
        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Status dos Lançamentos
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </CardHeader>
          <CardContent>
            {(!rotinasStatus || rotinasStatus.length === 0) ? (
              <p className="text-sm text-muted-foreground italic">Nenhuma rotina cadastrada. Acesse "Rotinas Diárias" para configurar.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rotinasStatus.map((rotina) => {
                  const isUsuario = userRole === 'usuario';
                  const status = rotina.status;
                  return (
                    <div
                      key={rotina.id}
                      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                        status === 'concluido'
                          ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                          : status === 'pendente'
                          ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
                          : 'border-border bg-background'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {status === 'concluido' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : status === 'pendente' ? (
                          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{rotina.nome}</p>
                          {rotina.descricao && (
                            <p className="text-xs text-muted-foreground truncate">{rotina.descricao}</p>
                          )}
                        </div>
                      </div>
                      {isUsuario && (
                        <div className="flex gap-1 shrink-0 ml-2">
                          <button
                            onClick={() => atualizarStatusMutation.mutate({ rotinaId: rotina.id, status: 'concluido' })}
                            disabled={atualizarStatusMutation.isPending}
                            title="Concluído"
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              status === 'concluido'
                                ? 'bg-green-600 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-green-100 hover:text-green-700'
                            }`}
                          >
                            ✓ Concluído
                          </button>
                          <button
                            onClick={() => atualizarStatusMutation.mutate({ rotinaId: rotina.id, status: 'pendente' })}
                            disabled={atualizarStatusMutation.isPending}
                            title="Pendente"
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              status === 'pendente'
                                ? 'bg-amber-500 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700'
                            }`}
                          >
                            ⏳ Pendente
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          {loadingCustos ? <CardSkeletonSimple /> : (<>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Custos Totais
            </CardTitle>
            <div className="flex items-center gap-1">
              <DashboardExportMenu
                title="Custos Totais"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="custos-totais"
                exportOptions={{
                  columns: [
                    { header: 'Indicador', key: 'indicador', width: 25 },
                    { header: 'Valor', key: 'valor', width: 20 },
                  ],
                  data: [
                    { indicador: 'Total de Custos', valor: `R$ ${fmtNum(totalCustos)}` },
                    { indicador: 'Lançamentos', valor: String(totalRegistrosCustos) },
                  ],
                }}
              />
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {fmtNum(totalCustos)}</div>
            <p className="text-xs text-muted-foreground">
              {totalRegistrosCustos} lançamentos
            </p>
          </CardContent>
          </>)}
        </Card>

        <Card>
          {loadingAbastecimento ? <CardSkeletonSimple /> : (<>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Combustível (L)
            </CardTitle>
            <div className="flex items-center gap-1">
              <DashboardExportMenu
                title="Combustível"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="combustivel"
                exportOptions={{
                  columns: [
                    { header: 'Indicador', key: 'indicador', width: 25 },
                    { header: 'Valor', key: 'valor', width: 20 },
                  ],
                  data: [
                    { indicador: 'Total Abastecido (L)', valor: fmtNum(totalAbastecimentos) },
                    { indicador: 'Abastecimentos', valor: String(totalRegistrosAbastecimentos) },
                  ],
                }}
              />
              <Fuel className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtNum(totalAbastecimentos)}</div>
            <p className="text-xs text-muted-foreground">
              {totalRegistrosAbastecimentos} abastecimentos
            </p>
          </CardContent>
          </>)}
        </Card>

        {/* Card Estoque Mínimo de Peças */}
        {hasModuleAccess("pecasDesgaste") && estoqueMinimoPecas && estoqueMinimoPecas.length > 0 && (() => {
          const abaixoMinimo = estoqueMinimoPecas.filter(p => p.abaixoMinimo);
          return (
            <Card className={abaixoMinimo.length > 0 ? "border-orange-400 dark:border-orange-600 border-2" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estoque Mínimo de Peças</CardTitle>
                <div className="flex items-center gap-1">
                  <DashboardExportMenu
                    title="Estoque Mínimo de Peças"
                    filename="estoque-minimo-pecas"
                    exportOptions={{
                      columns: [
                        { header: 'Peça', key: 'nome', width: 30 },
                        { header: 'Estoque Atual', key: 'estoqueAtual', width: 15 },
                        { header: 'Estoque Mínimo', key: 'estoqueMinimo', width: 15 },
                        { header: 'Unidade', key: 'unidade', width: 10 },
                        { header: 'Status', key: 'status', width: 15 },
                      ],
                      data: (estoqueMinimoPecas || []).map(p => ({ nome: p.nome, estoqueAtual: p.estoqueAtual, estoqueMinimo: p.estoqueMinimo, unidade: p.unidade, status: p.abaixoMinimo ? 'Abaixo do Mínimo' : 'OK' })),
                    }}
                  />
                  {abaixoMinimo.length > 0
                    ? <PackageX className="h-4 w-4 text-orange-500" />
                    : <Package className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {abaixoMinimo.length > 0 && (
                  <div className="flex items-center gap-1 mb-3 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-semibold">{abaixoMinimo.length} peça{abaixoMinimo.length > 1 ? 's' : ''} abaixo do mínimo</span>
                  </div>
                )}
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {estoqueMinimoPecas.map(peca => (
                    <div
                      key={peca.id}
                      className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                        peca.abaixoMinimo
                          ? 'bg-orange-50 dark:bg-orange-950 border border-orange-300 dark:border-orange-700'
                          : 'bg-muted/40'
                      }`}
                    >
                      <span className={`truncate max-w-[55%] font-medium ${
                        peca.abaixoMinimo ? 'text-orange-700 dark:text-orange-300' : 'text-foreground'
                      }`}>{peca.nome}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {peca.abaixoMinimo && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                        <span className={`font-bold ${
                          peca.abaixoMinimo ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'
                        }`}>{peca.estoqueAtual}</span>
                        <span className="text-muted-foreground">{peca.unidade}</span>
                        {peca.estoqueMinimo > 0 && (
                          <span className="text-muted-foreground">(mín: {peca.estoqueMinimo})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Cards de Vendas por Tipo */}
      {hasModuleAccess("vendas") && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card Vendas */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-500">
            {loadingVendas ? <CardSkeletonSimple /> : (<>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Vendas
              </CardTitle>
              <div className="flex items-center gap-1">
                <DashboardExportMenu
                  title="Vendas"
                  subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                  filename="vendas"
                  exportOptions={{
                    columns: [
                      { header: 'Indicador', key: 'indicador', width: 25 },
                      { header: 'Valor', key: 'valor', width: 20 },
                    ],
                    data: [
                      { indicador: 'Quantidade (m³)', valor: fmtNum(vendasPorTipo.venda.totalM3) },
                      { indicador: 'Valor Total', valor: `R$ ${fmtNum(vendasPorTipo.venda.valor)}` },
                      { indicador: 'Toneladas', valor: fmtNum(vendasPorTipo.venda.totalTon) },
                    ],
                  }}
                />
                <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Qtd Total (m³)</p>
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{fmtNum(vendasPorTipo.venda.totalM3)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-600 dark:text-blue-400">Valor Total</p>
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                      R$ {fmtNum(vendasPorTipo.venda.valor)}
                    </div>
                  </div>
                </div>
                <div className="border-t border-blue-200 dark:border-blue-800 pt-2">
                  <p className="text-xs text-blue-600 dark:text-blue-400">Conversão para Toneladas</p>
                  <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                    {fmtNum(vendasPorTipo.venda.totalM3)} m³ = {fmtNum(vendasPorTipo.venda.totalTon)} ton
                  </div>
                </div>
              </div>
            </CardContent>
            </>)}
          </Card>

          {/* Card Amortizações */}
          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 border-l-4 border-l-amber-500">
            {loadingVendas ? <CardSkeletonSimple /> : (<>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Amortizações
              </CardTitle>
              <div className="flex items-center gap-1">
                <DashboardExportMenu
                  title="Amortizações"
                  subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                  filename="amortizacoes"
                  exportOptions={{
                    columns: [
                      { header: 'Indicador', key: 'indicador', width: 25 },
                      { header: 'Valor', key: 'valor', width: 20 },
                    ],
                    data: [
                      { indicador: 'Quantidade (m³)', valor: fmtNum(vendasPorTipo.amortizacao.totalM3) },
                      { indicador: 'Valor Total', valor: `R$ ${fmtNum(vendasPorTipo.amortizacao.valor)}` },
                      { indicador: 'Toneladas', valor: fmtNum(vendasPorTipo.amortizacao.totalTon) },
                    ],
                  }}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Qtd Total (m³)</p>
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{fmtNum(vendasPorTipo.amortizacao.totalM3)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-600 dark:text-amber-400">Valor Total</p>
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      R$ {fmtNum(vendasPorTipo.amortizacao.valor)}
                    </div>
                  </div>
                </div>
                <div className="border-t border-amber-200 dark:border-amber-800 pt-2">
                  <p className="text-xs text-amber-600 dark:text-amber-400">Conversão para Toneladas</p>
                  <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {fmtNum(vendasPorTipo.amortizacao.totalM3)} m³ = {fmtNum(vendasPorTipo.amortizacao.totalTon)} ton
                  </div>
                </div>
              </div>
            </CardContent>
            </>)}
          </Card>

          {/* Card Doações */}
          <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 border-l-4 border-l-green-500">
            {loadingVendas ? <CardSkeletonSimple /> : (<>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
                Doações
              </CardTitle>
              <div className="flex items-center gap-1">
                <DashboardExportMenu
                  title="Doações"
                  subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                  filename="doacoes"
                  exportOptions={{
                    columns: [
                      { header: 'Indicador', key: 'indicador', width: 25 },
                      { header: 'Valor', key: 'valor', width: 20 },
                    ],
                    data: [
                      { indicador: 'Quantidade (m³)', valor: fmtNum(vendasPorTipo.doacao.totalM3) },
                      { indicador: 'Valor Total', valor: `R$ ${fmtNum(vendasPorTipo.doacao.valor)}` },
                      { indicador: 'Toneladas', valor: fmtNum(vendasPorTipo.doacao.totalTon) },
                    ],
                  }}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600 dark:text-green-400"><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400">Qtd Total (m³)</p>
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{fmtNum(vendasPorTipo.doacao.totalM3)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-green-600 dark:text-green-400">Valor Total</p>
                    <div className="text-lg font-bold text-green-700 dark:text-green-300">
                      R$ {fmtNum(vendasPorTipo.doacao.valor)}
                    </div>
                  </div>
                </div>
                <div className="border-t border-green-200 dark:border-green-800 pt-2">
                  <p className="text-xs text-green-600 dark:text-green-400">Conversão para Toneladas</p>
                  <div className="text-sm font-semibold text-green-700 dark:text-green-300">
                    {fmtNum(vendasPorTipo.doacao.totalM3)} m³ = {fmtNum(vendasPorTipo.doacao.totalTon)} ton
                  </div>
                </div>
              </div>
            </CardContent>
            </>)}
          </Card>
        </div>
      )}

      {/* Card Medição das Pilhas - ao lado do Produção Método Caminhões */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          {loadingCaminhoes ? <CardSkeletonTable rows={5} /> : (<>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Produção Método Caminhões
            </CardTitle>
            <div className="flex items-center gap-1">
              <DashboardExportMenu
                title="Produção Método Caminhões"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="producao-metodo-caminhoes"
                exportOptions={{
                  columns: [
                    { header: 'Caminhão', key: 'placa', width: 20 },
                    { header: 'Britagem', key: 'britagem', width: 15 },
                    { header: 'Viagens', key: 'viagens', width: 10 },
                    { header: 'Peso (t)', key: 'peso', width: 12, format: formatters.decimal },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                    { header: '%', key: 'percentual', width: 8 },
                  ],
                  data: [
                    ...((producaoMetodoCaminhoes?.britagemFixa?.caminhoes || []).map((c: any) => ({ placa: c.placa, britagem: 'Fixa', viagens: c.totalViagens || 0, peso: c.capacidade || 0, producao: c.totalProduzido, percentual: `${fmtPct(c.percentual)}%` }))),
                    ...((producaoMetodoCaminhoes?.britagemMovel?.caminhoes || []).map((c: any) => ({ placa: c.placa, britagem: 'Móvel', viagens: c.totalViagens || 0, peso: c.capacidade || 0, producao: c.totalProduzido, percentual: `${fmtPct(c.percentual)}%` }))),
                  ],
                }}
                whatsappMessage={(() => {
                  if (!producaoMetodoCaminhoes) return undefined;
                  let msg = `🚚 *Produção Método Caminhões*\nPeríodo: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}\nTotal: ${fmtNum(totalProducaoCaminhoes)} ton\n`;
                  (producaoMetodoCaminhoes?.britagemFixa?.caminhoes || []).forEach((c: any) => { msg += `  ${c.placa} (Fixa): ${fmtNum(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`; });
                  (producaoMetodoCaminhoes?.britagemMovel?.caminhoes || []).forEach((c: any) => { msg += `  ${c.placa} (Móvel): ${fmtNum(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {fmtNum(totalProducaoCaminhoes)} ton
            </div>

            {/* Meta, A Produzir e Percentuais */}
            {(() => {
              const metaVal = parseFloat(metaCaminhoesLocal || "0");
              const aProduzir = metaVal > 0 ? metaVal - totalProducaoCaminhoes : 0;
              const percProduzido = metaVal > 0 ? (totalProducaoCaminhoes / metaVal) * 100 : 0;
              const percAProduzir = metaVal > 0 ? (aProduzir / metaVal) * 100 : 0;
              return (
                <div className="mt-3 space-y-2">
                  {/* Meta editável */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600 dark:text-green-400 font-semibold">Meta:</span>
                    {metaCaminhoesEditando ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={metaCaminhoesLocal}
                          onChange={(e) => setMetaCaminhoesLocal(e.target.value)}
                          className="h-6 w-28 text-xs"
                          placeholder="0,00"
                        />
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            setMetaCaminhoesMutation.mutate({
                              chave: "meta_producao_caminhoes",
                              valor: metaCaminhoesLocal || "0",
                              descricao: "Meta de produção método caminhões (ton)",
                            });
                            setMetaCaminhoesEditando(false);
                          }}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            setMetaCaminhoesLocal(metaCaminhoesConfig?.valor || "");
                            setMetaCaminhoesEditando(false);
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-green-800 dark:text-green-200">
                          {metaVal > 0 ? fmtNum(metaVal) : "Não definida"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1 text-[10px] text-green-600"
                          onClick={() => setMetaCaminhoesEditando(true)}
                        >
                          ✏️
                        </Button>
                      </div>
                    )}
                  </div>

                  {metaVal > 0 && (
                    <>
                      {/* Total Produzido vs Meta */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-600 dark:text-green-400">Produzido:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-700 dark:text-green-300">
                            {fmtNum(totalProducaoCaminhoes)} ton
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            percProduzido >= 100
                              ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                              : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                          }`}>
                            {fmtPct(percProduzido)}%
                          </span>
                        </div>
                      </div>

                      {/* A Produzir */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-600 dark:text-green-400">A Produzir:</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${
                            aProduzir <= 0
                              ? "text-green-700 dark:text-green-300"
                              : "text-orange-600 dark:text-orange-400"
                          }`}>
                            {aProduzir <= 0 ? "Meta atingida!" : `${fmtNum(aProduzir)} ton`}
                          </span>
                          {aProduzir > 0 && (
                            <span className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {fmtPct(percAProduzir)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            percProduzido >= 100 ? "bg-green-600" : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(percProduzido, 100)}%` }}
                        />
                      </div>
                    </>
                  )}

                  {/* Separador */}
                  {((producaoMetodoCaminhoes?.britagemFixa?.caminhoes?.length || 0) > 0 || (producaoMetodoCaminhoes?.britagemMovel?.caminhoes?.length || 0) > 0) && (
                    <div className="border-t border-green-200 dark:border-green-800 pt-2 mt-2" />
                  )}
                </div>
              );
            })()}

            {/* Tabela Produção Britagem Fixa */}
            {producaoMetodoCaminhoes?.britagemFixa?.caminhoes && producaoMetodoCaminhoes.britagemFixa.caminhoes.length > 0 && (
              <div className="space-y-1 mt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-green-700 dark:text-green-300">🏭 Produção Britagem Fixa</p>
                  <span className="text-xs font-bold text-green-700 dark:text-green-300">
                    {fmtNum(producaoMetodoCaminhoes.britagemFixa.total)} ton
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_52px_56px_72px_40px] text-[10px] text-green-500 dark:text-green-400 font-medium border-b border-green-200 dark:border-green-800 pb-1 mb-1">
                  <span>Caminhão</span>
                  <span className="text-right">Viagens</span>
                  <span className="text-right">Peso (t)</span>
                  <span className="text-right">Produção</span>
                  <span className="text-right">%</span>
                </div>
                {producaoMetodoCaminhoes.britagemFixa.caminhoes.map((c: any, idx: number) => (
                  <div key={`${c.equipamentoId}-${c.capacidade}-${idx}`} className="grid grid-cols-[minmax(0,1fr)_52px_56px_72px_40px] text-xs items-center py-0.5">
                    <span className="text-green-600 dark:text-green-400 truncate leading-tight pr-1" title={`${c.placa} | Peso: ${c.capacidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t`}>
                      {c.placa}
                    </span>
                    <span className="text-right text-green-600 dark:text-green-400 tabular-nums">
                      {c.totalViagens?.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) || '0'}
                    </span>
                    <span className="text-right text-green-600 dark:text-green-400 tabular-nums">
                      {c.capacidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </span>
                    <span className="text-right font-semibold text-green-700 dark:text-green-300 tabular-nums">
                      {fmtNum(c.totalProduzido)}
                    </span>
                    <span className="text-right text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900 px-1 py-0.5 rounded text-[10px] font-medium tabular-nums">
                      {fmtPct(c.percentual)}%
                    </span>
                  </div>
                ))}
                {/* Totalizador Britagem Fixa */}
                <div className="grid grid-cols-[minmax(0,1fr)_52px_56px_72px_40px] text-xs items-center border-t border-green-200 dark:border-green-800 pt-1 mt-1 font-semibold">
                  <span className="text-green-700 dark:text-green-300">Subtotal</span>
                  <span className="text-right text-green-700 dark:text-green-300 tabular-nums">
                    {producaoMetodoCaminhoes.britagemFixa.totalViagens?.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) || '0'}
                  </span>
                  <span className="text-right text-green-600 dark:text-green-400">—</span>
                  <span className="text-right text-green-700 dark:text-green-300 tabular-nums">
                    {fmtNum(producaoMetodoCaminhoes.britagemFixa.total)}
                  </span>
                  <span className="text-right text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900 px-1 py-0.5 rounded text-[10px] font-medium tabular-nums">
                    {producaoMetodoCaminhoes.total > 0 ? ((producaoMetodoCaminhoes.britagemFixa.total / producaoMetodoCaminhoes.total) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
            )}

            {/* Tabela Produção Britagem Móvel */}
            {producaoMetodoCaminhoes?.britagemMovel?.caminhoes && producaoMetodoCaminhoes.britagemMovel.caminhoes.length > 0 && (
              <div className="space-y-1 mt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">🚚 Produção Britagem Móvel</p>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {fmtNum(producaoMetodoCaminhoes.britagemMovel.total)} ton
                  </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_52px_56px_72px_40px] text-[10px] text-emerald-500 dark:text-emerald-400 font-medium border-b border-emerald-200 dark:border-emerald-800 pb-1 mb-1">
                  <span>Caminhão</span>
                  <span className="text-right">Viagens</span>
                  <span className="text-right">Peso (t)</span>
                  <span className="text-right">Produção</span>
                  <span className="text-right">%</span>
                </div>
                {producaoMetodoCaminhoes.britagemMovel.caminhoes.map((c: any, idx: number) => (
                  <div key={`${c.equipamentoId}-${c.capacidade}-${idx}`} className="grid grid-cols-[minmax(0,1fr)_52px_56px_72px_40px] text-xs items-center py-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 truncate leading-tight pr-1" title={`${c.placa} | Peso: ${c.capacidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} t`}>
                      {c.placa}
                    </span>
                    <span className="text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {c.totalViagens?.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) || '0'}
                    </span>
                    <span className="text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {c.capacidade?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                    </span>
                    <span className="text-right font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {fmtNum(c.totalProduzido)}
                    </span>
                    <span className="text-right text-emerald-500 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900 px-1 py-0.5 rounded text-[10px] font-medium tabular-nums">
                      {fmtPct(c.percentual)}%
                    </span>
                  </div>
                ))}
                {/* Totalizador Britagem Móvel */}
                <div className="grid grid-cols-[minmax(0,1fr)_52px_56px_72px_40px] text-xs items-center border-t border-emerald-200 dark:border-emerald-800 pt-1 mt-1 font-semibold">
                  <span className="text-emerald-700 dark:text-emerald-300">Subtotal</span>
                  <span className="text-right text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {producaoMetodoCaminhoes.britagemMovel.totalViagens?.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) || '0'}
                  </span>
                  <span className="text-right text-emerald-600 dark:text-emerald-400">—</span>
                  <span className="text-right text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {fmtNum(producaoMetodoCaminhoes.britagemMovel.total)}
                  </span>
                  <span className="text-right text-emerald-500 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900 px-1 py-0.5 rounded text-[10px] font-medium tabular-nums">
                    {producaoMetodoCaminhoes.total > 0 ? ((producaoMetodoCaminhoes.britagemMovel.total / producaoMetodoCaminhoes.total) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
            )}

            {/* Total Geral */}
            {((producaoMetodoCaminhoes?.britagemFixa?.caminhoes?.length || 0) > 0 && (producaoMetodoCaminhoes?.britagemMovel?.caminhoes?.length || 0) > 0) && (
              <div className="mt-3 pt-2 border-t-2 border-green-300 dark:border-green-700">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-green-800 dark:text-green-200">📊 Total Geral (Fixa + Móvel)</span>
                  <span className="text-green-800 dark:text-green-200">
                    {fmtNum(producaoMetodoCaminhoes?.total)} ton
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                  <span>Viagens totais: {producaoMetodoCaminhoes?.totalViagens?.toLocaleString('pt-BR') || '0'}</span>
                </div>
              </div>
            )}

            {(!producaoMetodoCaminhoes?.britagemFixa?.caminhoes?.length && !producaoMetodoCaminhoes?.britagemMovel?.caminhoes?.length) && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {parteDiariaFiltrada.length} partes diárias
              </p>
            )}
          </CardContent>
          </>)}
        </Card>

        <Card className="bg-violet-50 dark:bg-violet-950 border-violet-200 dark:border-violet-800">
          {loadingPilhas ? <CardSkeletonBars rows={4} /> : (<>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-300">
              Medição das Pilhas
            </CardTitle>
            <div className="flex items-center gap-1">
              <DashboardExportMenu
                title="Medição das Pilhas"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="medicao-pilhas"
                exportOptions={{
                  columns: [
                    { header: 'Produto', key: 'produto', width: 30 },
                    { header: 'Total (ton)', key: 'total', width: 15 },
                    { header: '%', key: 'percentual', width: 10 },
                  ],
                  data: ((medicaoPilhasData as any)?.produtos || []).map((p: any) => ({ produto: p.produtoNome, total: p.totalProduzido, percentual: `${p.percentual.toFixed(1)}%` })),
                }}
                whatsappMessage={(() => {
                  const total = (medicaoPilhasData as any)?.total || 0;
                  if (!total) return undefined;
                  let msg = `⛰️ *Medição das Pilhas*\nTotal: ${fmtNum(total)} ton\n`;
                  ((medicaoPilhasData as any)?.produtos || []).forEach((p: any) => { msg += `  ${p.produtoNome}: ${fmtNum(p.totalProduzido)} ton (${p.percentual.toFixed(1)}%)\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
              <Mountain className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-700 dark:text-violet-300">
              {fmtNum((medicaoPilhasData as any)?.total)} ton
            </div>
            {medicaoPilhasData && 'produtos' in medicaoPilhasData && (medicaoPilhasData as any).produtos?.length > 0 ? (
              <div className="mt-3 space-y-2">
                {(medicaoPilhasData as any).produtos.map((p: any) => (
                  <div key={p.produtoId} className="flex items-center justify-between text-xs">
                    <span className="text-violet-600 dark:text-violet-400 truncate max-w-[140px]" title={p.produtoNome}>
                      {p.produtoNome}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-violet-700 dark:text-violet-300">
                        {fmtNum(p.totalProduzido)}
                      </span>
                      <span className="text-violet-500 dark:text-violet-400 bg-violet-100 dark:bg-violet-900 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        {p.percentual.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">Nenhuma medição registrada</p>
            )}
          </CardContent>
          </>)}
        </Card>
      </div>

      {/* Card Produção Balanças Integradoras */}
      {producaoBalancasData && producaoBalancasData.equipamentos.length > 0 && (
        <Card className="bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-teal-700 dark:text-teal-300">
                Produção Balanças Integradoras
              </CardTitle>
              <CardDescription className="text-teal-600 dark:text-teal-400 text-xs mt-1">
                {producaoBalancasData.equipamentos.some(e => e.divergencia) && (
                  <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    Divergência detectada em {producaoBalancasData.equipamentos.filter(e => e.divergencia).length} equipamento(s)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <DashboardExportMenu
                title="Produção Balanças Integradoras"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="producao-balancas"
                exportOptions={{
                  columns: [
                    { header: 'Equipamento', key: 'equipamento', width: 25 },
                    { header: 'Leit. Inicial', key: 'leitInicial', width: 15 },
                    { header: 'Leit. Final', key: 'leitFinal', width: 15 },
                    { header: 'Produção', key: 'producao', width: 15 },
                    { header: 'Divergência', key: 'divergencia', width: 12 },
                  ],
                  data: producaoBalancasData.equipamentos.map(e => ({ equipamento: e.nome, leitInicial: e.leituraInicial, leitFinal: e.leituraFinal, producao: e.producaoBalanca, divergencia: e.divergencia ? 'SIM' : 'Não' })),
                }}
                whatsappMessage={(() => {
                  const total = producaoBalancasData.equipamentos.reduce((acc, e) => acc + e.producaoBalanca, 0);
                  let msg = `⚖️ *Produção Balanças Integradoras*\nTotal: ${fmtNum(total)} ton\n`;
                  producaoBalancasData.equipamentos.forEach(e => { msg += `  ${e.nome}: ${fmtNum(e.producaoBalanca)} ton${e.divergencia ? ' ⚠️' : ''}\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
              <Scale className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Cabeçalho da tabela */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-[10px] text-teal-500 dark:text-teal-400 font-medium border-b border-teal-200 dark:border-teal-800 pb-1">
                <span>Equipamento</span>
                <span className="text-right">Leit. Inicial</span>
                <span className="text-right">Leit. Final</span>
                <span className="text-right">Produção</span>
              </div>
              {producaoBalancasData.equipamentos.map((eq) => (
                <div key={eq.equipamentoId}>
                  <div className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-xs items-center ${
                    eq.divergencia ? 'text-orange-700 dark:text-orange-300' : 'text-teal-700 dark:text-teal-300'
                  }`}>
                    <div className="flex items-center gap-1 truncate">
                      {eq.divergencia && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                      <span className="truncate" title={eq.nome}>{eq.nome}</span>
                    </div>
                    <span className="text-right font-mono text-[11px]">
                      {fmtNum(eq.leituraInicial)}
                    </span>
                    <span className="text-right font-mono text-[11px]">
                      {fmtNum(eq.leituraFinal)}
                    </span>
                    <span className="text-right font-semibold">
                      {fmtNum(eq.producaoBalanca)}
                    </span>
                  </div>
                  {eq.divergencia && (
                    <div className="mt-1 ml-4 text-[10px] text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded px-2 py-1">
                      ⚠ Divergência: soma das subtrações ({fmtNum(eq.producaoBalanca)}) ≠ leit. final − leit. inicial ({fmtNum(eq.producaoConferencia)}). Revise os lançamentos.
                    </div>
                  )}
                </div>
              ))}

            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Produção Último Dia Caminhões */}
      <Card className="bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
        {loadingUltimoDia ? <CardSkeletonKpi /> : (<>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
              Produção Último Dia Caminhões
            </CardTitle>
            {producaoUltimoDia?.dataReferencia && (
              <CardDescription className="text-cyan-600 dark:text-cyan-400 text-xs mt-1">
                Referência: {formatDateBR(producaoUltimoDia.dataReferencia)}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1">
            <DashboardExportMenu
              title="Produção Último Dia Caminhões"
              subtitle={producaoUltimoDia?.dataReferencia ? `Data: ${formatDateBR(producaoUltimoDia.dataReferencia)}` : undefined}
              filename="producao-ultimo-dia"
              exportOptions={{
                columns: [
                  { header: 'Caminhão', key: 'placa', width: 20 },
                  { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  { header: '%', key: 'percentual', width: 8 },
                ],
                data: (producaoUltimoDia?.caminhoes || []).map(c => ({ placa: c.placa, producao: c.totalProduzido, percentual: `${fmtPct(c.percentual)}%` })),
              }}
              whatsappMessage={(() => {
                if (!producaoUltimoDia?.total) return undefined;
                let msg = `📅 *Produção Último Dia Caminhões*\n`;
                if (producaoUltimoDia.dataReferencia) msg += `Data: ${formatDateBR(producaoUltimoDia.dataReferencia)}\n`;
                msg += `Total: ${fmtNum(producaoUltimoDia.total)} ton\n`;
                producaoUltimoDia.caminhoes.forEach(c => { msg += `  ${c.placa}: ${fmtNum(c.totalProduzido)} ton (${fmtPct(c.percentual)}%)\n`; });
                return msg;
              })()}
              whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
            />
            <Truck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
            {fmtNum(producaoUltimoDia?.total)} ton
          </div>

          {/* Meta Diária e Diferença */}
          <div className="mt-3 p-3 bg-white/60 dark:bg-cyan-900/40 rounded-lg border border-cyan-200 dark:border-cyan-700">
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 whitespace-nowrap">Meta Diária:</Label>
              {metaEditando ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={metaDiariaLocal}
                    onChange={(e) => setMetaDiariaLocal(e.target.value)}
                    className="h-7 text-xs w-24 bg-white dark:bg-cyan-900"
                    placeholder="0,00"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-cyan-700 dark:text-cyan-300 px-2"
                    onClick={() => {
                      setConfigMutation.mutate({
                        chave: "meta_diaria_caminhoes",
                        valor: metaDiariaLocal || "0",
                        descricao: "Meta diária de produção dos caminhões (ton)",
                      });
                      setMetaEditando(false);
                    }}
                  >
                    Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground px-2"
                    onClick={() => {
                      setMetaDiariaLocal(metaDiariaConfig?.valor || "");
                      setMetaEditando(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-sm font-bold text-cyan-800 dark:text-cyan-200">
                    {fmtNum(parseFloat(metaDiariaLocal || '0'))} ton
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] text-cyan-600 dark:text-cyan-400 px-2"
                    onClick={() => setMetaEditando(true)}
                  >
                    Editar
                  </Button>
                </div>
              )}
            </div>
            {(() => {
              const metaVal = parseFloat(metaDiariaLocal || "0");
              const totalUltimoDia = producaoUltimoDia?.total || 0;
              const aProduzir = metaVal - totalUltimoDia;
              const percProduzido = metaVal > 0 ? (totalUltimoDia / metaVal) * 100 : 0;
              const percAProduzir = metaVal > 0 ? (aProduzir / metaVal) * 100 : 0;
              const metaAtingida = totalUltimoDia >= metaVal && metaVal > 0;
              return (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cyan-600 dark:text-cyan-400">Produzido:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-cyan-800 dark:text-cyan-200">
                        {fmtNum(totalUltimoDia)} ton
                      </span>
                      {metaVal > 0 && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${metaAtingida ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300'}`}>
                          {fmtPct(percProduzido)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-cyan-600 dark:text-cyan-400">A Produzir:</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${metaAtingida ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {metaAtingida ? 'Meta atingida!' : `${fmtNum(aProduzir)} ton`}
                      </span>
                      {metaVal > 0 && !metaAtingida && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                          {fmtPct(percAProduzir)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {metaVal > 0 && (
                    <div className="w-full bg-cyan-200 dark:bg-cyan-800 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${metaAtingida ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                        style={{ width: `${Math.min(percProduzido, 100)}%` }}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Lista de caminhões */}
          {producaoUltimoDia?.caminhoes && producaoUltimoDia.caminhoes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {producaoUltimoDia.caminhoes.map((c, idx) => (
                <div key={`ultimo-${idx}`} className="flex items-center justify-between text-xs">
                  <span className="text-cyan-600 dark:text-cyan-400 truncate max-w-[140px]" title={c.placa}>
                    {c.placa}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                      {fmtNum(c.totalProduzido)}
                    </span>
                    <span className="text-cyan-500 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      {fmtPct(c.percentual)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Nenhuma produção registrada</p>
          )}
        </CardContent>
        </>)}
      </Card>

      {/* Cards Perfuração e Revisões Preventivas lado a lado */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card de Produção de Perfuração (diminuido) */}
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          {loadingPerfuracao ? <CardSkeletonBars rows={3} /> : (<>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Produção de Perfuração
            </CardTitle>
            <div className="flex items-center gap-1">
              <DashboardExportMenu
                title="Produção de Perfuração"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="producao-perfuracao"
                exportOptions={{
                  columns: [
                    { header: 'Indicador', key: 'indicador', width: 25 },
                    { header: 'Valor', key: 'valor', width: 20 },
                  ],
                  data: [
                    { indicador: 'Total (m)', valor: fmtNum(totalPerfuracao) },
                    { indicador: 'Furos', valor: fmtNum(totalFuros, 0) },
                    { indicador: 'Metros Perfurados', valor: fmtNum(totalMetrosPerfurados) },
                  ],
                }}
                whatsappMessage={totalPerfuracao > 0 ? `⛏️ *Produção de Perfuração*\nTotal: ${fmtNum(totalPerfuracao)} m\nFuros: ${fmtNum(totalFuros, 0)} | Metros: ${fmtNum(totalMetrosPerfurados)} m` : undefined}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
              <Settings2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {fmtNum(totalPerfuracao)} m
            </div>
            <div className="flex gap-4 mt-1">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {fmtNum(totalFuros, 0)} furos
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {fmtNum(totalMetrosPerfurados)} m perfurados
              </p>
            </div>
          </CardContent>
          </>)}
        </Card>

        {/* Card Revisões Preventivas */}
        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revisões Preventivas
            </CardTitle>
            <div className="flex items-center gap-1">
              <DashboardExportMenu
                title="Revisões Preventivas"
                filename="revisoes-preventivas"
                exportOptions={{
                  columns: [
                    { header: 'Equipamento', key: 'equipamento', width: 20 },
                    { header: 'Data Últ. Revisão', key: 'dataRevisao', width: 18 },
                    { header: 'Hor/Km Revisão', key: 'horKmRevisao', width: 15 },
                    { header: 'Próx. Revisão', key: 'proximaRevisao', width: 15 },
                    { header: 'Faltam', key: 'faltam', width: 10 },
                    { header: 'Status', key: 'status', width: 12 },
                  ],
                  data: (revisoesPreventivas || []).map(r => ({ equipamento: r.equipamentoTag, dataRevisao: new Date(r.dataUltimaRevisao).toLocaleDateString('pt-BR'), horKmRevisao: r.horKmRevisao, proximaRevisao: r.horKmProximaRevisao, faltam: r.faltam, status: r.faltam <= 0 ? 'VENCIDA' : r.faltam < 50 ? 'Próximo' : 'OK' })),
                }}
                whatsappMessage={(() => {
                  const vencidas = (revisoesPreventivas || []).filter(r => r.faltam <= 0);
                  if (!vencidas.length) return undefined;
                  let msg = `⚠️ *Revisões Preventivas Vencidas (${vencidas.length})*\n`;
                  vencidas.forEach(r => { msg += `  ${r.equipamentoTag}: Faltam ${r.faltam.toFixed(1)}\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
              <ShieldCheck className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent>
            {revisoesPreventivas && revisoesPreventivas.length > 0 ? (
              <div className="space-y-0">
                {/* Cabeçalho da tabela */}
                <div className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-1 text-[10px] font-semibold text-muted-foreground border-b pb-1 mb-1">
                  <span>Equip.</span>
                  <span className="text-right">Data Rev.</span>
                  <span className="text-right">Hor/Km Rev.</span>
                  <span className="text-right">Próx. Rev.</span>
                  <span className="text-right">Faltam</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                  {revisoesPreventivas.map((rev, idx) => {
                    // Escala de cores degradê para o campo "Faltam"
                    // 100+ → branco/preto, 0 → branco/laranja negrito, -25 → vermelho claro/vermelho escuro negrito
                    const faltam = rev.faltam;
                    let bgColor = 'transparent';
                    let textColor = 'inherit';
                    let fontWeight = 'normal';
                    
                    if (faltam >= 100) {
                      // Branco com texto preto
                      bgColor = 'transparent';
                      textColor = '#000000';
                      fontWeight = 'normal';
                    } else if (faltam >= 0) {
                      // Degradê de 100→0: branco→branco, preto→laranja, normal→negrito
                      const t = 1 - (faltam / 100); // 0 quando faltam=100, 1 quando faltam=0
                      const r = Math.round(255);
                      const g = Math.round(255 - (255 - 165) * t); // 255 → 165
                      const b = Math.round(255 - 255 * t); // 255 → 0
                      bgColor = `rgba(${r}, ${g}, ${b}, ${0.1 * t})`;
                      // Texto: preto → laranja
                      const tr = Math.round(0 + 255 * t); // 0 → 255
                      const tg = Math.round(0 + 140 * t); // 0 → 140
                      const tb = Math.round(0); // 0 → 0
                      textColor = `rgb(${tr}, ${tg}, ${tb})`;
                      fontWeight = t > 0.5 ? 'bold' : 'normal';
                    } else {
                      // Degradê de 0→-25: branco→vermelho claro bg, laranja→vermelho escuro texto
                      const t = Math.min(Math.abs(faltam) / 25, 1); // 0 quando faltam=0, 1 quando faltam=-25
                      const r = Math.round(255);
                      const g = Math.round(235 - 135 * t); // 235 → 100
                      const b = Math.round(235 - 135 * t); // 235 → 100
                      bgColor = `rgba(${r}, ${g}, ${b}, ${0.15 + 0.35 * t})`;
                      // Texto: laranja → vermelho escuro
                      const tr2 = Math.round(255 - 75 * t); // 255 → 180
                      const tg2 = Math.round(140 - 120 * t); // 140 → 20
                      const tb2 = Math.round(0 + 20 * t); // 0 → 20
                      textColor = `rgb(${tr2}, ${tg2}, ${tb2})`;
                      fontWeight = 'bold';
                    }
                    
                    return (
                      <div key={`rev-${idx}`} className="grid grid-cols-[1fr_70px_70px_70px_70px] gap-1 text-xs py-1 border-b border-slate-100 dark:border-slate-800 items-center">
                        <span className="truncate font-medium" title={rev.equipamentoTag}>
                          {rev.equipamentoTag}
                        </span>
                        <span className="text-right text-muted-foreground text-[10px]">
                          {new Date(rev.dataUltimaRevisao).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-right text-[10px]">
                          {fmtNum(Number(rev.horKmRevisao), 0)}
                        </span>
                        <span className="text-right text-[10px]">
                          {fmtNum(Number(rev.horKmProximaRevisao), 0)}
                        </span>
                        <span 
                          className="text-right text-[11px] px-1 py-0.5 rounded"
                          style={{ 
                            backgroundColor: bgColor, 
                            color: textColor, 
                            fontWeight: fontWeight as any 
                          }}
                        >
                          {fmtNum(faltam, 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhuma revisão preventiva cadastrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Card Produção dos Motoristas */}
      <Card className="bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
        {loadingMotoristas ? <CardSkeletonTable rows={5} /> : (<>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-300">
            Produção dos Motoristas
          </CardTitle>
          <div className="flex items-center gap-1">
            <DashboardExportMenu
              title="Produção dos Motoristas (Caminhões Internos)"
              subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
              filename="producao-motoristas"
              exportOptions={{
                columns: [
                  { header: 'Motorista', key: 'motorista', width: 25 },
                  { header: 'Serviço', key: 'servico', width: 25 },
                  { header: 'Viagens', key: 'viagens', width: 10 },
                  { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  { header: '%', key: 'percentual', width: 8 },
                ],
                data: (producaoMotoristasData?.motoristas || []).flatMap(m =>
                  m.servicos.length > 0
                    ? m.servicos.map(s => ({ motorista: m.motoristaNome, servico: s.servicoNome, viagens: s.viagens, producao: s.producao, percentual: `${((s.producao / (producaoMotoristasData?.totalProducao || 1)) * 100).toFixed(1)}%` }))
                    : [{ motorista: m.motoristaNome, servico: '-', viagens: m.totalViagens, producao: m.totalProducao, percentual: `${fmtPct(m.percentual)}%` }]
                ),
              }}
              whatsappMessage={(() => {
                if (!producaoMotoristasData?.motoristas?.length) return undefined;
                let msg = `🚚 *Produção dos Motoristas*\nTotal: ${fmtNum(producaoMotoristasData.totalProducao)} ton | ${producaoMotoristasData.totalViagens || 0} viagens\n`;
                producaoMotoristasData.motoristas.forEach(m => { msg += `  ${m.motoristaNome}: ${fmtNum(m.totalProducao)} ton (${fmtPct(m.percentual)}%)\n`; });
                return msg;
              })()}
              whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
            />
            <Truck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
                {fmtNum(producaoMotoristasData?.totalProducao)} ton
              </div>
              <p className="text-xs text-cyan-600 dark:text-cyan-400">
                {fmtNum(producaoMotoristasData?.totalViagens, 0)} viagens no total
              </p>
            </div>
          </div>
          {producaoMotoristasData?.motoristas && producaoMotoristasData.motoristas.length > 0 ? (
            <div className="mt-4 space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {producaoMotoristasData.motoristas.map((m, idx) => (
                <div key={`motorista-${idx}`} className="border border-cyan-200 dark:border-cyan-800 rounded-lg p-3 bg-white/50 dark:bg-cyan-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-cyan-800 dark:text-cyan-200" title={m.motoristaNome}>
                      {m.motoristaNome}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyan-600 dark:text-cyan-400">
                        {fmtNum(m.totalViagens, 0)} viag.
                      </span>
                      <span className="font-bold text-sm text-cyan-700 dark:text-cyan-300">
                        {fmtNum(m.totalProducao)}
                      </span>
                      <span className="text-cyan-500 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900 px-1.5 py-0.5 rounded text-[10px] font-medium">
                        {fmtPct(m.percentual)}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 pl-2 border-l-2 border-cyan-200 dark:border-cyan-700">
                    {m.servicos.map((s, sIdx) => (
                      <div key={sIdx} className="flex items-start justify-between text-xs gap-2">
                        <span className="text-cyan-600 dark:text-cyan-400 break-words leading-tight" title={s.servicoNome}>
                          {s.servicoNome}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                          <span className="text-cyan-500 dark:text-cyan-400">
                            {fmtNum(s.viagens, 0)} viag.
                          </span>
                          <span className="font-medium text-cyan-700 dark:text-cyan-300">
                            {fmtNum(s.producao)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-cyan-500 dark:text-cyan-400 mt-2">Nenhum registro de produção de motoristas</p>
          )}
        </CardContent>
        </>)}
      </Card>

      {/* Gráficos de Produção */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Produção por Setor */}
        <Card>
          {loadingSetor ? <CardSkeletonBars rows={5} /> : (<>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">Produção por Setor</CardTitle>
              </div>
              <DashboardExportMenu
                title="Produção por Setor"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="producao-por-setor"
                exportOptions={{
                  columns: [
                    { header: 'Setor', key: 'setor', width: 30 },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  ],
                  data: (producaoPorSetor || []).map(s => ({ setor: s.setorNome, producao: s.producaoTotal })),
                }}
                whatsappMessage={(() => {
                  if (!producaoPorSetor?.length) return undefined;
                  let msg = `🏭 *Produção por Setor*\n`;
                  producaoPorSetor.forEach(s => { msg += `  ${s.setorNome}: ${fmtNum(s.producaoTotal, 0)} ton\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
            </div>
            <CardDescription>Toneladas produzidas por setor</CardDescription>
          </CardHeader>
          <CardContent>
            {producaoPorSetor && producaoPorSetor.length > 0 ? (
              <div className="space-y-3">
                {(producaoPorSetor.length <= 10 ? producaoPorSetor : expandSetor ? producaoPorSetor : producaoPorSetor.slice(0, 10)).map((item) => (
                  <div key={item.setorId} className="space-y-1">
                    <div className="flex items-start justify-between text-sm gap-2">
                      <span className="break-words leading-tight" title={item.setorNome}>
                        {item.setorNome}
                      </span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 shrink-0 whitespace-nowrap">
                        {fmtNum(item.producaoTotal, 0)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${(item.producaoTotal / maxProducaoSetor) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {producaoPorSetor.length > 10 && (
                  <button
                    onClick={() => setExpandSetor(!expandSetor)}
                    className="flex items-center justify-center gap-1 w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 pt-2 transition-colors"
                  >
                    {expandSetor ? (
                      <><ChevronUp className="h-3 w-3" /> Recolher</>
                    ) : (
                      <><ChevronDown className="h-3 w-3" /> Ver mais {producaoPorSetor.length - 10} setores</>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum dado de produção disponível
              </div>
            )}
          </CardContent>
          </>)}
        </Card>

        {/* Produção por Serviço */}
        <Card>
          {loadingServico ? <CardSkeletonBars rows={5} /> : (<>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-purple-500" />
                <CardTitle className="text-lg">Produção por Serviço</CardTitle>
              </div>
              <DashboardExportMenu
                title="Produção por Serviço"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="producao-por-servico"
                exportOptions={{
                  columns: [
                    { header: 'Serviço', key: 'servico', width: 30 },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  ],
                  data: (producaoPorServico || []).map(s => ({ servico: s.servicoNome, producao: s.producaoTotal })),
                }}
                whatsappMessage={(() => {
                  if (!producaoPorServico?.length) return undefined;
                  let msg = `⚙️ *Produção por Serviço*\n`;
                  producaoPorServico.forEach(s => { msg += `  ${s.servicoNome}: ${fmtNum(s.producaoTotal, 0)} ton\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
            </div>
            <CardDescription>Toneladas produzidas por serviço</CardDescription>
          </CardHeader>
          <CardContent>
            {producaoPorServico && producaoPorServico.length > 0 ? (
              <div className="space-y-3">
                {(producaoPorServico.length <= 10 ? producaoPorServico : expandServico ? producaoPorServico : producaoPorServico.slice(0, 10)).map((item) => (
                  <div key={item.servicoId} className="space-y-1">
                    <div className="flex items-start justify-between text-sm gap-2">
                      <span className="break-words leading-tight" title={item.servicoNome}>
                        {item.servicoNome}
                      </span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400 shrink-0 whitespace-nowrap">
                        {fmtNum(item.producaoTotal, 0)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${(item.producaoTotal / maxProducaoServico) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {producaoPorServico.length > 10 && (
                  <button
                    onClick={() => setExpandServico(!expandServico)}
                    className="flex items-center justify-center gap-1 w-full text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 pt-2 transition-colors"
                  >
                    {expandServico ? (
                      <><ChevronUp className="h-3 w-3" /> Recolher</>
                    ) : (
                      <><ChevronDown className="h-3 w-3" /> Ver mais {producaoPorServico.length - 10} serviços</>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum dado de produção disponível
              </div>
            )}
          </CardContent>
          </>)}
        </Card>

        {/* Produção por Equipamento */}
        <Card>
          {loadingEquipamento ? <CardSkeletonBars rows={5} /> : (<>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-green-500" />
                <CardTitle className="text-lg">Produção por Equipamento</CardTitle>
              </div>
              <DashboardExportMenu
                title="Produção por Equipamento (Caminhões Internos)"
                subtitle={`Período: ${dataInicio ? formatDateBR(dataInicio) : 'início'} a ${dataFim ? formatDateBR(dataFim) : 'hoje'}`}
                filename="producao-por-equipamento"
                exportOptions={{
                  columns: [
                    { header: 'Equipamento', key: 'equipamento', width: 25 },
                    { header: 'Produção (ton)', key: 'producao', width: 15, format: formatters.decimal },
                  ],
                  data: (producaoPorEquipamento || []).map(e => ({ equipamento: e.equipamentoTag || e.equipamentoNome, producao: e.producaoTotal })),
                }}
                whatsappMessage={(() => {
                  if (!producaoPorEquipamento?.length) return undefined;
                  let msg = `🚚 *Produção por Equipamento*\n`;
                  producaoPorEquipamento.forEach(e => { msg += `  ${e.equipamentoTag || e.equipamentoNome}: ${e.producaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} ton\n`; });
                  return msg;
                })()}
                whatsappDestinatarios={(destinatariosWpp || []).filter(d => d.ativo === 'sim').map(d => d.telefone)}
              />
            </div>
            <CardDescription>Toneladas produzidas por equipamento</CardDescription>
          </CardHeader>
          <CardContent>
            {producaoPorEquipamento && producaoPorEquipamento.length > 0 ? (
              <div className="space-y-3">
                {(producaoPorEquipamento.length <= 10 ? producaoPorEquipamento : expandEquipamento ? producaoPorEquipamento : producaoPorEquipamento.slice(0, 10)).map((item) => (
                  <div key={item.equipamentoId} className="space-y-1">
                    <div className="flex items-start justify-between text-sm gap-2">
                      <span className="break-words leading-tight" title={item.equipamentoTag || item.equipamentoNome}>
                        {item.equipamentoTag || item.equipamentoNome}
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400 shrink-0 whitespace-nowrap">
                        {fmtNum(item.producaoTotal, 0)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${(item.producaoTotal / maxProducaoEquipamento) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {producaoPorEquipamento.length > 10 && (
                  <button
                    onClick={() => setExpandEquipamento(!expandEquipamento)}
                    className="flex items-center justify-center gap-1 w-full text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 pt-2 transition-colors"
                  >
                    {expandEquipamento ? (
                      <><ChevronUp className="h-3 w-3" /> Recolher</>
                    ) : (
                      <><ChevronDown className="h-3 w-3" /> Ver mais {producaoPorEquipamento.length - 10} equipamentos</>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum dado de produção disponível
              </div>
            )}
          </CardContent>
          </>)}
        </Card>
      </div>

      {/* Módulos Rápidos */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Acesso Rápido aos Módulos</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modulosRapidos.map((modulo) => {
            const Icone = modulo.icone;
            return (
              <Link key={modulo.titulo} href={modulo.link}>
                <Card className="cursor-pointer hover:bg-accent transition-colors">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{modulo.titulo}</CardTitle>
                      <Icone className={`h-6 w-6 ${modulo.cor}`} />
                    </div>
                    <CardDescription>{modulo.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {modulo.total} registro(s)
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Visão Geral */}
      <Card>
        <CardHeader>
          <CardTitle>Visão Geral do Sistema</CardTitle>
          <CardDescription>
            Acesse os módulos através do menu lateral ou pelos atalhos acima
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Módulos Principais</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Parte Diária e Abastecimento - Rotinas diárias de operação</li>
              <li>Produção e Custos - Análise financeira e produtiva</li>
              <li>Manutenção - Controle preventivo e preditivo</li>
              <li>Cadastros - Equipamentos, setores, serviços e produtos</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Seu Perfil</h3>
            <p className="text-sm text-muted-foreground">
              Perfil de acesso: <span className="font-semibold text-foreground capitalize">{user?.role || "Usuário"}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Relatório WhatsApp */}
      {destinatariosWpp && (
        <WhatsAppReportModal
          open={wppModalOpen}
          onClose={() => setWppModalOpen(false)}
          destinatarios={destinatariosWpp as any}
          cards={cardsParaModal}
          periodoLabel={
            periodoAtivo === 'mesAtual'
              ? `Mês atual (${formatDateBR(dataInicio)} - ${formatDateBR(dataFim)})`
              : dataInicio && dataFim
              ? `${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`
              : 'Período selecionado'
          }
        />
      )}
    </div>
  );
}
