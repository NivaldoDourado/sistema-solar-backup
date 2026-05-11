import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Calculator, Clock, AlertTriangle, TrendingUp, Weight } from "lucide-react";
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
const fmtHoras = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " hr";
const fmtTon = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " t";
const fmtCustoTon = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }) + "/t";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ─── Paleta de cores por grupo ───────────────────────────────────────────────
const GRUPO_PALETA: Record<string, { bg: string; border: string; header: string; badge: string; dot: string }> = {
  "DESMONTE DE ROCHA":    { bg: "bg-amber-50",  border: "border-amber-200",  header: "bg-amber-100 text-amber-800",  badge: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-500" },
  "PEDRA PARA BRITADOR":  { bg: "bg-blue-50",   border: "border-blue-200",   header: "bg-blue-100 text-blue-800",    badge: "bg-blue-100 text-blue-700 border-blue-200",    dot: "bg-blue-500" },
  "BRITAGEM":             { bg: "bg-green-50",  border: "border-green-200",  header: "bg-green-100 text-green-800",  badge: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500" },
  "EXPEDIÇÃO":            { bg: "bg-purple-50", border: "border-purple-200", header: "bg-purple-100 text-purple-800", badge: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  "SERVIÇOS AUXILIARES":  { bg: "bg-orange-50", border: "border-orange-200", header: "bg-orange-100 text-orange-800", badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  "ADMINISTRAÇÃO":        { bg: "bg-gray-50",   border: "border-gray-200",   header: "bg-gray-100 text-gray-800",    badge: "bg-gray-100 text-gray-700 border-gray-200",    dot: "bg-gray-500" },
};

const DEFAULT_PALETA = { bg: "bg-slate-50", border: "border-slate-200", header: "bg-slate-100 text-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" };

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface DespesasEquipamento {
  salOperEncOper: number;
  combustivel: number;
  lubrificantes: number;
  pecasDesgaste: number;
  pecasReposicao: number;
  outrasDespesas: number;
  total: number;
}

interface EquipamentoRateado {
  equipamentoId: number;
  equipamentoNome: string;
  equipamentoTag: string;
  horasTotal: number;
  horasNoSetor: number;
  percentual: number;
  despesas: DespesasEquipamento;
}

interface SubsetorMem {
  subsetorNome: string;
  grupoNome: string;
  equipamentos: EquipamentoRateado[];
  totalSubsetor: number;
  totalHoras: number;
}

interface ProducaoSubsetor {
  subsetorNome: string;
  grupoNome: string;
  toneladas: number;
}

// ─── Componente de linha de equipamento ─────────────────────────────────────
function EquipamentoRow({
  equip,
  totalSubsetor,
}: {
  equip: EquipamentoRateado;
  totalSubsetor: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const d = equip.despesas;
  const pctDoSubsetor = totalSubsetor > 0 ? (d.total / totalSubsetor) * 100 : 0;

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
        <TableCell className="text-right text-xs text-muted-foreground font-mono">
          {fmtHoras(equip.horasNoSetor)}
        </TableCell>
        <TableCell className="text-right text-xs text-muted-foreground font-mono">
          {fmtPct(equip.percentual)}
        </TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(d.salOperEncOper)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(d.combustivel)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(d.lubrificantes)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(d.pecasDesgaste)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(d.pecasReposicao)}</TableCell>
        <TableCell className="text-right text-sm font-mono">{fmtBRLShort(d.outrasDespesas)}</TableCell>
        <TableCell className="text-right text-sm font-semibold font-mono">{fmtBRL(d.total)}</TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">{fmtPct(pctDoSubsetor)}</TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={12} className="py-2 px-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Distribuição de Horas</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="font-mono">{fmtHoras(equip.horasNoSetor)}</span>
                  <span className="text-muted-foreground">de</span>
                  <span className="font-mono">{fmtHoras(equip.horasTotal)}</span>
                  <Badge variant="outline" className="text-xs">
                    {fmtPct(equip.percentual)}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Despesas Rateadas</p>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { label: "Sal.Oper./Enc. Oper.", valor: d.salOperEncOper },
                      { label: "Combustível", valor: d.combustivel },
                      { label: "Lubrificantes", valor: d.lubrificantes },
                      { label: "Peças de Desgaste", valor: d.pecasDesgaste },
                      { label: "Peças de Reposição", valor: d.pecasReposicao },
                      { label: "Outras Despesas", valor: d.outrasDespesas },
                    ]
                      .filter(item => item.valor > 0)
                      .map((item) => (
                        <tr key={item.label}>
                          <td className="py-0.5 text-muted-foreground">{item.label}</td>
                          <td className="py-0.5 font-mono text-right">{fmtBRL(item.valor)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Componente de subsetor ──────────────────────────────────────────────────
function SubsetorCard({
  subsetor,
  totalGeral,
  producao,
}: {
  subsetor: SubsetorMem;
  totalGeral: number;
  producao?: ProducaoSubsetor;
}) {
  const [expanded, setExpanded] = useState(true);
  const paleta = GRUPO_PALETA[subsetor.grupoNome] || DEFAULT_PALETA;
  const pctDoTotal = totalGeral > 0 ? (subsetor.totalSubsetor / totalGeral) * 100 : 0;
  const custoTon = producao && producao.toneladas > 0
    ? subsetor.totalSubsetor / producao.toneladas
    : null;

  return (
    <Card className={`${paleta.border} border overflow-hidden`}>
      <CardHeader
        className={`${paleta.header} py-3 px-4 cursor-pointer`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <div>
              <CardTitle className="text-base font-semibold">{subsetor.subsetorNome}</CardTitle>
              <p className="text-xs opacity-70 mt-0.5">{subsetor.grupoNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`${paleta.badge} text-xs`}>
              {subsetor.equipamentos.length} equip.
            </Badge>
            <Badge variant="outline" className={`${paleta.badge} text-xs`}>
              {fmtHoras(subsetor.totalHoras)}
            </Badge>
            {producao && producao.toneladas > 0 && (
              <Badge variant="outline" className={`${paleta.badge} text-xs`}>
                {fmtTon(producao.toneladas)}
              </Badge>
            )}
            {custoTon !== null && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs font-bold">
                {fmtCustoTon(custoTon)}
              </Badge>
            )}
            <div className="text-right">
              <p className="font-bold font-mono text-sm">{fmtBRL(subsetor.totalSubsetor)}</p>
              <p className="text-xs opacity-70">{fmtPct(pctDoTotal)} do total</p>
            </div>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead className="text-right">Horas Setor</TableHead>
                  <TableHead className="text-right">% Horas</TableHead>
                  <TableHead className="text-right">Sal.Oper.</TableHead>
                  <TableHead className="text-right">Combust.</TableHead>
                  <TableHead className="text-right">Lubrif.</TableHead>
                  <TableHead className="text-right">P.Desg.</TableHead>
                  <TableHead className="text-right">P.Repos.</TableHead>
                  <TableHead className="text-right">Outras</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Part.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subsetor.equipamentos.map((equip) => (
                  <EquipamentoRow
                    key={equip.equipamentoId}
                    equip={equip}
                    totalSubsetor={subsetor.totalSubsetor}
                  />
                ))}
                {/* Linha de total do subsetor */}
                <TableRow className="bg-muted/30 font-semibold border-t-2">
                  <TableCell></TableCell>
                  <TableCell className="text-sm">Total {subsetor.subsetorNome}</TableCell>
                  <TableCell className="text-right text-xs font-mono">{fmtHoras(subsetor.totalHoras)}</TableCell>
                  <TableCell className="text-right text-xs">100%</TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {fmtBRLShort(subsetor.equipamentos.reduce((s, e) => s + e.despesas.salOperEncOper, 0))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {fmtBRLShort(subsetor.equipamentos.reduce((s, e) => s + e.despesas.combustivel, 0))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {fmtBRLShort(subsetor.equipamentos.reduce((s, e) => s + e.despesas.lubrificantes, 0))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {fmtBRLShort(subsetor.equipamentos.reduce((s, e) => s + e.despesas.pecasDesgaste, 0))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {fmtBRLShort(subsetor.equipamentos.reduce((s, e) => s + e.despesas.pecasReposicao, 0))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {fmtBRLShort(subsetor.equipamentos.reduce((s, e) => s + e.despesas.outrasDespesas, 0))}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono font-bold">
                    {fmtBRL(subsetor.totalSubsetor)}
                  </TableCell>
                  <TableCell className="text-right text-xs">{fmtPct(pctDoTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function RateioMem() {
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);

  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const { data: rateio, isLoading } = trpc.rateioMem.calcularRateio.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );
  const { data: producaoSubsetores } = trpc.rateioMem.producaoPorSubsetor.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );

  const periodoAtual = useMemo(
    () => periodos?.find((p: any) => p.id === selectedPeriodoId) ?? null,
    [periodos, selectedPeriodoId]
  );

  useEffect(() => {
    if (periodos && periodos.length > 0 && !selectedPeriodoId) {
      // Selecionar o período mais recente por padrão
      setSelectedPeriodoId(periodos[0].id);
    }
  }, [periodos, selectedPeriodoId]);

  const periodoLabel = periodoAtual
    ? `${MESES[(periodoAtual.mes ?? 1) - 1]}/${periodoAtual.ano}`
    : "";

  // Mapa de produção por subsetor para lookup rápido
  const producaoMap = useMemo(() => {
    const map = new Map<string, ProducaoSubsetor>();
    if (producaoSubsetores) {
      for (const p of producaoSubsetores) {
        map.set(p.subsetorNome, p);
      }
    }
    return map;
  }, [producaoSubsetores]);

  // Produção total
  const producaoTotal = useMemo(() => {
    if (!producaoSubsetores) return 0;
    return producaoSubsetores.reduce((s, p) => s + p.toneladas, 0);
  }, [producaoSubsetores]);

  // Custo/t geral
  const custoTonGeral = useMemo(() => {
    if (!rateio || producaoTotal <= 0) return null;
    return rateio.totalGeral / producaoTotal;
  }, [rateio, producaoTotal]);

  // Dados para exportação
  const exportData = useMemo(() => {
    if (!rateio?.subsetores?.length) return null;
    const rows: Record<string, any>[] = [];
    for (const sub of rateio.subsetores) {
      const prod = producaoMap.get(sub.subsetorNome);
      const custoT = prod && prod.toneladas > 0 ? (sub.totalSubsetor / prod.toneladas).toFixed(2) : "";
      rows.push({
        grupo: sub.grupoNome,
        subsetor: sub.subsetorNome,
        tipo: "SUBSETOR",
        equipamento: "",
        horasSetor: "",
        pctHoras: "",
        salOper: "",
        combustivel: "",
        lubrificantes: "",
        pecasDesgaste: "",
        pecasReposicao: "",
        outrasDespesas: "",
        total: fmtBRL(sub.totalSubsetor),
        producao: prod ? prod.toneladas.toFixed(0) : "",
        custoTon: custoT,
      });
      for (const equip of sub.equipamentos) {
        rows.push({
          grupo: sub.grupoNome,
          subsetor: sub.subsetorNome,
          tipo: "EQUIPAMENTO",
          equipamento: equip.equipamentoNome,
          horasSetor: equip.horasNoSetor.toFixed(1),
          pctHoras: fmtPct(equip.percentual),
          salOper: equip.despesas.salOperEncOper.toFixed(2),
          combustivel: equip.despesas.combustivel.toFixed(2),
          lubrificantes: equip.despesas.lubrificantes.toFixed(2),
          pecasDesgaste: equip.despesas.pecasDesgaste.toFixed(2),
          pecasReposicao: equip.despesas.pecasReposicao.toFixed(2),
          outrasDespesas: equip.despesas.outrasDespesas.toFixed(2),
          total: equip.despesas.total.toFixed(2),
          producao: "",
          custoTon: "",
        });
      }
    }
    return {
      title: `Rateio MEM - ${periodoLabel}`,
      columns: [
        { key: "grupo", label: "Grupo" },
        { key: "subsetor", label: "Subsetor" },
        { key: "tipo", label: "Tipo" },
        { key: "equipamento", label: "Equipamento" },
        { key: "horasSetor", label: "Horas no Setor" },
        { key: "pctHoras", label: "% Horas" },
        { key: "salOper", label: "Sal.Oper./Enc." },
        { key: "combustivel", label: "Combustível" },
        { key: "lubrificantes", label: "Lubrificantes" },
        { key: "pecasDesgaste", label: "Peças Desgaste" },
        { key: "pecasReposicao", label: "Peças Reposição" },
        { key: "outrasDespesas", label: "Outras Despesas" },
        { key: "total", label: "Total" },
        { key: "producao", label: "Produção (t)" },
        { key: "custoTon", label: "Custo/t (R$)" },
      ],
      rows,
    };
  }, [rateio, periodoLabel, producaoMap]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Rateio MEM — Equipamentos por Setor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Distribuição das despesas dos equipamentos pelos setores com base nas horas trabalhadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {exportData && (
            <DashboardExportMenu
              title={exportData.title}
              filename={`rateio-mem-${periodoLabel.replace('/', '-')}`}
              exportOptions={{
                columns: exportData.columns.map(c => ({ key: c.key, header: c.label })),
                data: exportData.rows,
              }}
            />
          )}
          <Select
            value={selectedPeriodoId?.toString() ?? ""}
            onValueChange={(v) => setSelectedPeriodoId(Number(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              {periodos?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {MESES[(p.mes ?? 1) - 1]}/{p.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Calculando rateio...</span>
        </div>
      )}

      {/* Resumo */}
      {rateio && !isLoading && (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Total Rateado
                </div>
                <p className="text-xl font-bold font-mono">{fmtBRL(rateio.totalGeral)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Calculator className="h-3.5 w-3.5" />
                  Subsetores
                </div>
                <p className="text-xl font-bold">{rateio.subsetores.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  Equipamentos Rateados
                </div>
                <p className="text-xl font-bold">
                  {rateio.subsetores.reduce((s: number, sub: SubsetorMem) => s + sub.equipamentos.length, 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Weight className="h-3.5 w-3.5" />
                  Produção Total
                </div>
                <p className="text-xl font-bold font-mono">
                  {producaoTotal > 0 ? fmtTon(producaoTotal) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card className={custoTonGeral !== null ? "border-red-200 bg-red-50/30" : ""}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                  Custo MEM/t
                </div>
                <p className="text-xl font-bold font-mono text-red-700">
                  {custoTonGeral !== null ? fmtCustoTon(custoTonGeral) : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Subsetores */}
          <div className="space-y-4">
            {rateio.subsetores.map((sub: SubsetorMem) => (
              <SubsetorCard
                key={sub.subsetorNome}
                subsetor={sub}
                totalGeral={rateio.totalGeral}
                producao={producaoMap.get(sub.subsetorNome)}
              />
            ))}
          </div>

          {/* Equipamentos sem rateio */}
          {rateio.equipamentosSemRateio && rateio.equipamentosSemRateio.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50/50">
              <CardHeader className="py-3 px-4 bg-yellow-100/50">
                <CardTitle className="text-base font-semibold text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Equipamentos sem Rateio ({rateio.equipamentosSemRateio.length})
                </CardTitle>
                <p className="text-xs text-yellow-700 mt-1">
                  Equipamentos com despesas mas sem distribuição de horas por setor nas partes diárias
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead className="text-right">Despesa Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateio.equipamentosSemRateio.map((equip: any) => (
                      <TableRow key={equip.id}>
                        <TableCell className="text-sm">{equip.nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{equip.tag}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtBRL(equip.despesaTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Tags sem correspondência */}
          {rateio.equipamentosSemCorrespondencia && rateio.equipamentosSemCorrespondencia.length > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="py-3 px-4 bg-red-100/50">
                <CardTitle className="text-base font-semibold text-red-800 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Tags sem Correspondência ({rateio.equipamentosSemCorrespondencia.length})
                </CardTitle>
                <p className="text-xs text-red-700 mt-1">
                  Tags de despesas importadas que não foram mapeadas para nenhum equipamento do sistema
                </p>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {rateio.equipamentosSemCorrespondencia.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-red-700 border-red-300 bg-red-50">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Estado vazio */}
      {!isLoading && !rateio && selectedPeriodoId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum dado de rateio disponível para este período.</p>
            <p className="text-sm mt-2">
              Verifique se há partes diárias lançadas e despesas importadas.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
