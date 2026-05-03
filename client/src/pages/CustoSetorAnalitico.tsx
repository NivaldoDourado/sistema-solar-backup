import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Factory, Wrench, DollarSign, BarChart3, Zap, Bomb } from "lucide-react";
import { DashboardExportMenu } from "@/components/DashboardExportMenu";

// ─── Formatadores ────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtBRLShort = (v: number) => {
  if (v === 0) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
};
const fmtPct = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ─── Paleta de cores por grupo ───────────────────────────────────────────────
const GRUPO_PALETA: Record<string, { bg: string; border: string; header: string; badge: string; dot: string }> = {
  "DESMONTE DE ROCHA":    { bg: "bg-amber-50",  border: "border-amber-200",  header: "bg-amber-100 text-amber-800",  badge: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500" },
  "CARGA E TRANSPORTE":   { bg: "bg-blue-50",   border: "border-blue-200",   header: "bg-blue-100 text-blue-800",    badge: "bg-blue-100 text-blue-700 border-blue-200",    dot: "bg-blue-500" },
  "BRITAGEM":             { bg: "bg-green-50",  border: "border-green-200",  header: "bg-green-100 text-green-800",  badge: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500" },
  "EXPEDIÇÃO":            { bg: "bg-purple-50", border: "border-purple-200", header: "bg-purple-100 text-purple-800", badge: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  "SERVIÇOS AUXILIARES":  { bg: "bg-orange-50", border: "border-orange-200", header: "bg-orange-100 text-orange-800", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  "ADMINISTRAÇÃO":        { bg: "bg-gray-50",   border: "border-gray-200",   header: "bg-gray-100 text-gray-800",    badge: "bg-gray-100 text-gray-700 border-gray-200",    dot: "bg-gray-500" },
};

const DEFAULT_PALETA = { bg: "bg-slate-50", border: "border-slate-200", header: "bg-slate-100 text-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" };

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Equipamento = {
  id: number;
  equipamentoNome: string;
  salOperEncOper: string | null;
  depreciacao: string | null;
  combustivel: string | null;
  lubrificantes: string | null;
  pecasDesgaste: string | null;
  pecasReposicao: string | null;
  outrasDespesas: string | null;
  totalDespesasEquipamento: string | null;
  horasTrabalhadas: string | null;
  producaoTotal: string | null;
  unidadeProducao: string | null;
};

type DespesaEspecifica = {
  id: number;
  descricao: string;
  valor: string | null;
};

type SubsetorData = {
  subsetorNome: string;
  grupoNome: string;
  equipamentos: Equipamento[];
  despesasEspecificas: DespesaEspecifica[];
  totalEquipamentos: number;
  totalDespesasEspecificas: number;
  totalSubsetor: number;
};

type GrupoData = {
  grupoNome: string;
  subsetores: SubsetorData[];
  totalGrupo: number;
};

// ─── Componente de linha de equipamento ─────────────────────────────────────
function EquipamentoRow({ equip, totalSubsetor }: { equip: Equipamento; totalSubsetor: number }) {
  const [expanded, setExpanded] = useState(false);

  const sal    = parseFloat(equip.salOperEncOper ?? "0");
  const dep    = parseFloat(equip.depreciacao ?? "0");
  const comb   = parseFloat(equip.combustivel ?? "0");
  const lubr   = parseFloat(equip.lubrificantes ?? "0");
  const pDesg  = parseFloat(equip.pecasDesgaste ?? "0");
  const pRep   = parseFloat(equip.pecasReposicao ?? "0");
  const outras = parseFloat(equip.outrasDespesas ?? "0");
  const total  = parseFloat(equip.totalDespesasEquipamento ?? "0");
  const pct    = totalSubsetor > 0 ? (total / totalSubsetor) * 100 : 0;

  const despesas = [
    { label: "Sal.Oper./Enc. Oper.", valor: sal },
    { label: "Depreciação", valor: dep },
    { label: "Combustível", valor: comb },
    { label: "Lubrificantes", valor: lubr },
    { label: "Peças de Desgaste", valor: pDesg },
    { label: "Peças de Reposição/Item de Consumo", valor: pRep },
    { label: "Outras Despesas", valor: outras },
  ].filter(d => d.valor > 0);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium text-sm">{equip.equipamentoNome}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(sal)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(lubr)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(pDesg)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(pRep)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(outras)}</TableCell>
        <TableCell className="text-right text-sm font-semibold font-mono">{fmtBRL(total)}</TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">{fmtPct(pct)}</TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={9} className="py-2 px-6">
            <table className="w-full text-sm">
              <tbody>
                {[
                  { label: "Sal.Oper./Enc. Oper.", valor: sal, show: sal > 0 },
                  { label: "Combustível", valor: comb, show: comb > 0 },
                  { label: "Lubrificantes", valor: lubr, show: lubr > 0 },
                  { label: "Peças de Desgaste", valor: pDesg, show: pDesg > 0 },
                  { label: "Peças de Reposição/Item de Consumo", valor: pRep, show: pRep > 0 },
                  { label: "Outras Despesas", valor: outras, show: outras > 0 },
                  ...(equip.horasTrabalhadas && parseFloat(equip.horasTrabalhadas) > 0
                    ? [{ label: "Horas Trabalhadas", valor: null, show: true, text: `${parseFloat(equip.horasTrabalhadas).toLocaleString("pt-BR")} hr` }]
                    : []),
                  ...(equip.producaoTotal && parseFloat(equip.producaoTotal) > 0
                    ? [{ label: "Produção", valor: null, show: true, text: `${parseFloat(equip.producaoTotal).toLocaleString("pt-BR")} ${equip.unidadeProducao}` }]
                    : []),
                ]
                  .filter(d => d.show)
                  .map((d, i) => (
                    <tr key={d.label} className={i % 2 === 0 ? "bg-background/60" : ""}>
                      <td className="py-1.5 pl-2 pr-4 text-muted-foreground w-64">{d.label}</td>
                      <td className="py-1.5 font-semibold font-mono text-foreground">
                        {d.text ?? fmtBRL(d.valor!)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Componente de subsetor ──────────────────────────────────────────────────
function SubsetorCard({ subsetor, totalGeral, paleta }: {
  subsetor: SubsetorData;
  totalGeral: number;
  paleta: typeof DEFAULT_PALETA;
}) {
  const [expanded, setExpanded] = useState(true);
  const pctTotal = totalGeral > 0 ? (subsetor.totalSubsetor / totalGeral) * 100 : 0;

  return (
    <div className={`rounded-lg border ${paleta.border} ${paleta.bg} mb-4`}>
      {/* Cabeçalho do subsetor */}
      <button
        className={`w-full flex items-center justify-between px-4 py-3 rounded-t-lg ${paleta.header} font-semibold text-sm`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Factory className="h-4 w-4" />
          <span>{subsetor.subsetorNome}</span>
          <Badge variant="outline" className={`text-xs ml-2 ${paleta.badge}`}>
            {subsetor.equipamentos.length} equip.
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs opacity-75">{fmtPct(pctTotal)} do total</span>
          <span className="font-mono text-base">{fmtBRL(subsetor.totalSubsetor)}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Tabela de equipamentos */}
          {subsetor.equipamentos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Equipamentos / Centros de Custo</span>
                <Badge variant="secondary" className="text-xs">{fmtBRL(subsetor.totalEquipamentos)}</Badge>
              </div>
              <div className="rounded-md border border-border bg-background overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs">Equipamento</TableHead>
                      <TableHead className="text-right text-xs">Sal.Oper.</TableHead>
                      <TableHead className="text-right text-xs">Lubrif.</TableHead>
                      <TableHead className="text-right text-xs">Pç.Desgaste</TableHead>
                      <TableHead className="text-right text-xs">Pç.Repos.</TableHead>
                      <TableHead className="text-right text-xs">Outras</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Total Equip.</TableHead>
                      <TableHead className="text-right text-xs">% Setor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subsetor.equipamentos.map(equip => (
                      <EquipamentoRow
                        key={equip.id}
                        equip={equip}
                        totalSubsetor={subsetor.totalSubsetor}
                      />
                    ))}
                    {/* Linha de subtotal dos equipamentos */}
                    <TableRow className="bg-muted/30 font-semibold border-t-2">
                      <TableCell></TableCell>
                      <TableCell className="text-sm">Subtotal Equipamentos</TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {fmtBRL(subsetor.equipamentos.reduce((s, e) => s + parseFloat(e.salOperEncOper ?? "0"), 0))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {fmtBRL(subsetor.equipamentos.reduce((s, e) => s + parseFloat(e.lubrificantes ?? "0"), 0))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {fmtBRL(subsetor.equipamentos.reduce((s, e) => s + parseFloat(e.pecasDesgaste ?? "0"), 0))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {fmtBRL(subsetor.equipamentos.reduce((s, e) => s + parseFloat(e.pecasReposicao ?? "0"), 0))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono">
                        {fmtBRL(subsetor.equipamentos.reduce((s, e) => s + parseFloat(e.outrasDespesas ?? "0"), 0))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold font-mono">
                        {fmtBRL(subsetor.totalEquipamentos)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Despesas específicas do setor */}
          {subsetor.despesasEspecificas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Despesas Específicas do Setor</span>
                <Badge variant="secondary" className="text-xs">{fmtBRL(subsetor.totalDespesasEspecificas)}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {subsetor.despesasEspecificas.map(desp => {
                  const valor = parseFloat(desp.valor ?? "0");
                  const isDestaque = desp.descricao.includes("Energia") || desp.descricao.includes("Explosivos");
                  return (
                    <div
                      key={desp.id}
                      className={`rounded-md border px-3 py-2 ${isDestaque ? "bg-yellow-50 border-yellow-200" : "bg-background border-border"}`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        {desp.descricao.includes("Energia") && <Zap className="h-3 w-3 text-yellow-500" />}
                        {desp.descricao.includes("Explosivos") && <Bomb className="h-3 w-3 text-red-500" />}
                        <p className="text-xs text-muted-foreground truncate">{desp.descricao}</p>
                      </div>
                      <p className="text-sm font-semibold font-mono">{fmtBRL(valor)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resumo do subsetor */}
          <div className={`rounded-md border ${paleta.border} px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Total do Setor: {subsetor.subsetorNome}</span>
            </div>
            <div className="flex items-center gap-4">
              {subsetor.totalEquipamentos > 0 && (
                <span className="text-xs text-muted-foreground">
                  Equip.: {fmtBRL(subsetor.totalEquipamentos)}
                </span>
              )}
              {subsetor.totalDespesasEspecificas > 0 && (
                <span className="text-xs text-muted-foreground">
                  Desp.: {fmtBRL(subsetor.totalDespesasEspecificas)}
                </span>
              )}
              <span className="text-base font-bold font-mono">{fmtBRL(subsetor.totalSubsetor)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function CustoSetorAnalitico() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [expandedGrupos, setExpandedGrupos] = useState<Record<string, boolean>>({});

  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const { data: relatorio, isLoading } = trpc.custoSetorRas.relatorioAnalitico.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );

  const periodoAtual = useMemo(
    () => periodos?.find((p) => p.id === selectedPeriodoId) ?? null,
    [periodos, selectedPeriodoId]
  );

  useEffect(() => {
    if (periodos && periodos.length > 0 && !selectedPeriodoId) {
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  // Inicializar grupos expandidos quando o relatório carregar
  useEffect(() => {
    if (relatorio?.grupos) {
      const initial: Record<string, boolean> = {};
      relatorio.grupos.forEach((g: GrupoData) => {
        initial[g.grupoNome] = true;
      });
      setExpandedGrupos(initial);
    }
  }, [relatorio]);

  const toggleGrupo = (grupoNome: string) => {
    setExpandedGrupos(prev => ({ ...prev, [grupoNome]: !prev[grupoNome] }));
  };

  const periodoLabel = periodoAtual
    ? `${MESES[(periodoAtual.mes ?? 1) - 1]}/${periodoAtual.ano}`
    : "";

  const totalGeral = relatorio?.totalGeral ?? 0;
  const grupos: GrupoData[] = relatorio?.grupos ?? [];

  // Dados para exportação
  const exportOptions = useMemo(() => {
    if (!grupos.length) return null;
    const rows: Record<string, any>[] = [];
    for (const grupo of grupos) {
      for (const sub of grupo.subsetores) {
        // Linha de cabeçalho do subsetor
        rows.push({
          grupo: grupo.grupoNome,
          subsetor: sub.subsetorNome,
          tipo: "SUBSETOR",
          equipamento: "",
          salOper: "",
          lubrif: "",
          pecasDesgaste: "",
          pecasReposicao: "",
          outras: "",
          total: fmtBRL(sub.totalSubsetor),
        });
        // Linhas de equipamentos
        for (const equip of sub.equipamentos) {
          rows.push({
            grupo: grupo.grupoNome,
            subsetor: sub.subsetorNome,
            tipo: "EQUIPAMENTO",
            equipamento: equip.equipamentoNome,
            salOper: fmtBRL(parseFloat(equip.salOperEncOper ?? "0")),
            lubrif: fmtBRL(parseFloat(equip.lubrificantes ?? "0")),
            pecasDesgaste: fmtBRL(parseFloat(equip.pecasDesgaste ?? "0")),
            pecasReposicao: fmtBRL(parseFloat(equip.pecasReposicao ?? "0")),
            outras: fmtBRL(parseFloat(equip.outrasDespesas ?? "0")),
            total: fmtBRL(parseFloat(equip.totalDespesasEquipamento ?? "0")),
          });
        }
        // Linhas de despesas específicas
        for (const desp of sub.despesasEspecificas) {
          rows.push({
            grupo: grupo.grupoNome,
            subsetor: sub.subsetorNome,
            tipo: "DESPESA ESPECÍFICA",
            equipamento: desp.descricao,
            salOper: "",
            lubrif: "",
            pecasDesgaste: "",
            pecasReposicao: "",
            outras: "",
            total: fmtBRL(parseFloat(desp.valor ?? "0")),
          });
        }
      }
      // Linha de total do grupo
      rows.push({
        grupo: grupo.grupoNome,
        subsetor: "TOTAL DO GRUPO",
        tipo: "TOTAL GRUPO",
        equipamento: "",
        salOper: "",
        lubrif: "",
        pecasDesgaste: "",
        pecasReposicao: "",
        outras: "",
        total: fmtBRL(grupo.totalGrupo),
      });
    }
    return {
      columns: [
        { key: "grupo", header: "Grupo" },
        { key: "subsetor", header: "Subsetor" },
        { key: "tipo", header: "Tipo" },
        { key: "equipamento", header: "Equipamento / Despesa" },
        { key: "salOper", header: "Sal.Oper./Enc." },
        { key: "lubrif", header: "Lubrificantes" },
        { key: "pecasDesgaste", header: "Peças Desgaste" },
        { key: "pecasReposicao", header: "Peças Repos." },
        { key: "outras", header: "Outras Desp." },
        { key: "total", header: "Total" },
      ],
      data: rows,
    };
  }, [grupos]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatório Analítico por Setor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detalhamento de custos por equipamento e despesas específicas de cada setor
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Seletor de período */}
          <Select
            value={selectedPeriodoId?.toString() ?? ""}
            onValueChange={(v) => setSelectedPeriodoId(Number(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Selecionar período..." />
            </SelectTrigger>
            <SelectContent>
              {(periodos ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {MESES[(p.mes ?? 1) - 1]}/{p.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {exportOptions && (
            <DashboardExportMenu
              title={`Relatório Analítico por Setor — ${periodoLabel}`}
              subtitle={`Total Geral: ${fmtBRL(totalGeral)}`}
              filename={`relatorio-analitico-setor-${periodoLabel.replace("/", "-")}`}
              exportOptions={exportOptions}
            />
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      {relatorio && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {grupos.map((grupo: GrupoData) => {
            const paleta = GRUPO_PALETA[grupo.grupoNome] ?? DEFAULT_PALETA;
            const pct = totalGeral > 0 ? (grupo.totalGrupo / totalGeral) * 100 : 0;
            return (
              <Card key={grupo.grupoNome} className={`border ${paleta.border} ${paleta.bg} cursor-pointer`} onClick={() => toggleGrupo(grupo.grupoNome)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${paleta.dot}`}></div>
                    <p className="text-xs font-medium text-muted-foreground leading-tight">{grupo.grupoNome}</p>
                  </div>
                  <p className="text-sm font-bold font-mono">{fmtBRL(grupo.totalGrupo)}</p>
                  <p className="text-xs text-muted-foreground">{fmtPct(pct)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Card de total geral */}
      {relatorio && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Total Geral de Custos — {periodoLabel}</span>
            </div>
            <span className="text-xl font-bold font-mono text-primary">{fmtBRL(totalGeral)}</span>
          </CardContent>
        </Card>
      )}

      {/* Estado de carregamento */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-2">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-muted-foreground">Carregando relatório...</p>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!isLoading && relatorio && grupos.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nenhum dado encontrado para este período.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Importe a planilha CUSTOSOLAR para visualizar o relatório analítico.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grupos de setores */}
      {!isLoading && grupos.map((grupo: GrupoData) => {
        const paleta = GRUPO_PALETA[grupo.grupoNome] ?? DEFAULT_PALETA;
        const pct = totalGeral > 0 ? (grupo.totalGrupo / totalGeral) * 100 : 0;
        const isExpanded = expandedGrupos[grupo.grupoNome] ?? true;

        return (
          <Card key={grupo.grupoNome} className={`border-2 ${paleta.border}`}>
            {/* Cabeçalho do grupo */}
            <CardHeader
              className={`${paleta.header} rounded-t-lg cursor-pointer py-3`}
              onClick={() => toggleGrupo(grupo.grupoNome)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  <CardTitle className="text-base">{grupo.grupoNome}</CardTitle>
                  <Badge variant="outline" className={`text-xs ${paleta.badge}`}>
                    {grupo.subsetores.length} setor{grupo.subsetores.length !== 1 ? "es" : ""}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm opacity-75">{fmtPct(pct)} do total geral</span>
                  <span className="text-lg font-bold font-mono">{fmtBRL(grupo.totalGrupo)}</span>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="p-4 space-y-2">
                {grupo.subsetores.map((sub: SubsetorData) => (
                  <SubsetorCard
                    key={sub.subsetorNome}
                    subsetor={sub}
                    totalGeral={totalGeral}
                    paleta={paleta}
                  />
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
