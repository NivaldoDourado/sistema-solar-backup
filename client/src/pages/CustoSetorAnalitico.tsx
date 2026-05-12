import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Factory, Wrench, DollarSign, BarChart3, Zap, Bomb, X, Filter, ArrowLeft, Search, XIcon } from "lucide-react";
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
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ─── Mapeamento: campo do equipamento → label legível ────────────────────────
export const CONTA_CAMPO_LABEL: Record<string, string> = {
  salOperEncOper: "Sal.Oper./Enc. Oper.",
  depreciacao: "Depreciação",
  combustivel: "Combustível",
  lubrificantes: "Lubrificantes",
  pecasDesgaste: "Peças de Desgaste",
  pecasReposicao: "Peças de Reposição / Itens de Consumo",
  outrasDespesas: "Outras Despesas",
};

// Mapeamento: campo do equipamento → classificação no itemDespesaImportado
const CAMPO_PARA_CLASSIFICACAO: Record<string, string> = {
  combustivel: "combustivel",
  lubrificantes: "lubrificantes",
  pecasDesgaste: "pecas_desgaste",
  pecasReposicao: "pecas_reposicao",
  outrasDespesas: "outras_despesas",
};

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

// ─── Drill-down state ───────────────────────────────────────────────────────
type DrillDownState = {
  tipo: "equipamento_conta" | "despesa_setor";
  // Para equipamento_conta: drill nas contas de um equipamento específico
  equipamentoNome?: string;
  equipamentoTag?: string; // tag extraída do nome (antes do " - ")
  contaCampo?: string; // campo: combustivel, lubrificantes, etc.
  contaLabel?: string; // label legível
  classificacao?: string; // classificação no itemDespesaImportado
  contaValor?: number;
  subsetorNome?: string;
  grupoNome?: string;
  nivel: 1 | 2; // 1 = lista de itens por equipamento+classificação, 2 = itens detalhados
  // Para despesa_setor: drill na despesa específica (Energia Elétrica, etc.)
  despesaDescricao?: string;
  despesaValor?: number;
};

// ─── Extrair tag do nome do equipamento ─────────────────────────────────────
function extrairTag(equipamentoNome: string): string {
  // O nome vem no formato "TAG - DESCRIÇÃO" ou apenas "DESCRIÇÃO"
  const idx = equipamentoNome.indexOf(" - ");
  if (idx > 0) return equipamentoNome.substring(0, idx).trim();
  return equipamentoNome.trim();
}

// ─── Componente de linha de equipamento (com drill-down) ────────────────────
function EquipamentoRow({
  equip,
  totalSubsetor,
  filtroContaCampo,
  subsetorNome,
  onDrillDown,
}: {
  equip: Equipamento;
  totalSubsetor: number;
  filtroContaCampo?: string;
  subsetorNome?: string;
  onDrillDown: (campo: string, label: string, valor: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const sal    = parseFloat(equip.salOperEncOper ?? "0");
  const comb   = parseFloat(equip.combustivel ?? "0");
  const lubr   = parseFloat(equip.lubrificantes ?? "0");
  const pDesg  = parseFloat(equip.pecasDesgaste ?? "0");
  const pRep   = parseFloat(equip.pecasReposicao ?? "0");
  const outras = parseFloat(equip.outrasDespesas ?? "0");
  const total  = parseFloat(equip.totalDespesasEquipamento ?? "0");
  const pct    = totalSubsetor > 0 ? (total / totalSubsetor) * 100 : 0;

  // Destacar a célula da conta filtrada
  const highlight = (campo: string) =>
      filtroContaCampo === campo ? "bg-yellow-100 font-bold text-yellow-900 border-l-2 border-yellow-400" : "";

  const contasDetalhadas = useMemo(() => [
    { label: subsetorNome === "ADMINISTRAÇÃO" ? "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos" : "Salários com Encargos", valor: sal, show: sal > 0, campo: "salOperEncOper", drillable: false },
    { label: "Combustível", valor: comb, show: comb > 0, campo: "combustivel", drillable: true },
    { label: "Lubrificantes", valor: lubr, show: lubr > 0, campo: "lubrificantes", drillable: true },
    { label: "Peças de Desgaste", valor: pDesg, show: pDesg > 0, campo: "pecasDesgaste", drillable: true },
    { label: "Peças de Reposição/Item de Consumo", valor: pRep, show: pRep > 0, campo: "pecasReposicao", drillable: true },
    { label: "Outras Despesas", valor: outras, show: outras > 0, campo: "outrasDespesas", drillable: true },
    ...(equip.horasTrabalhadas && parseFloat(equip.horasTrabalhadas) > 0
      ? [{ label: "Horas Trabalhadas", valor: null as number | null, show: true, text: `${parseFloat(equip.horasTrabalhadas).toLocaleString("pt-BR")} hr`, campo: "", drillable: false }]
      : []),
    ...(equip.producaoTotal && parseFloat(equip.producaoTotal) > 0
      ? [{ label: "Produção", valor: null as number | null, show: true, text: `${parseFloat(equip.producaoTotal).toLocaleString("pt-BR")} ${equip.unidadeProducao}`, campo: "", drillable: false }]
      : []),
  ], [sal, comb, lubr, pDesg, pRep, outras, equip.horasTrabalhadas, equip.producaoTotal, equip.unidadeProducao, subsetorNome]);

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 transition-colors ${filtroContaCampo && parseFloat((equip as any)[filtroContaCampo] ?? "0") === 0 ? "opacity-40" : ""}`}
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
        <TableCell className={`text-right text-sm font-mono ${highlight("salOperEncOper")}`}>{fmtBRLShort(sal)}</TableCell>
        <TableCell className={`text-right text-sm font-mono ${highlight("lubrificantes")}`}>{fmtBRLShort(lubr)}</TableCell>
        <TableCell className={`text-right text-sm font-mono ${highlight("pecasDesgaste")}`}>{fmtBRLShort(pDesg)}</TableCell>
        <TableCell className={`text-right text-sm font-mono ${highlight("pecasReposicao")}`}>{fmtBRLShort(pRep)}</TableCell>
        <TableCell className={`text-right text-sm font-mono ${highlight("outrasDespesas")}`}>{fmtBRLShort(outras)}</TableCell>
        <TableCell className="text-right text-sm font-semibold font-mono">{fmtBRL(total)}</TableCell>
        <TableCell className="text-right text-xs text-muted-foreground">{fmtPct(pct)}</TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={9} className="py-2 px-6">
            <table className="w-full text-sm">
              <tbody>
                {contasDetalhadas
                  .filter(d => d.show)
                  .map((d, i) => (
                    <tr
                      key={d.label}
                      className={`${i % 2 === 0 ? "bg-background/60" : ""} ${filtroContaCampo === d.campo ? "bg-yellow-50" : ""} ${d.drillable && d.valor && d.valor > 0 ? "cursor-pointer hover:bg-blue-50 group" : ""}`}
                      onClick={(e) => {
                        if (d.drillable && d.valor && d.valor > 0) {
                          e.stopPropagation();
                          onDrillDown(d.campo, d.label, d.valor);
                        }
                      }}
                    >
                      <td className={`py-1.5 pl-2 pr-4 w-64 ${filtroContaCampo === d.campo ? "text-yellow-700 font-semibold" : "text-muted-foreground"} ${d.drillable && d.valor && d.valor > 0 ? "group-hover:text-blue-700" : ""}`}>
                        <span className="flex items-center gap-1.5">
                          {d.label}
                          {d.drillable && d.valor && d.valor > 0 && (
                            <Search className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                          )}
                        </span>
                      </td>
                      <td className={`py-1.5 font-semibold font-mono ${filtroContaCampo === d.campo ? "text-yellow-900" : "text-foreground"} ${d.drillable && d.valor && d.valor > 0 ? "group-hover:text-blue-700" : ""}`}>
                        {(d as any).text ?? fmtBRL(d.valor!)}
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
function SubsetorCard({
  subsetor,
  totalGeral,
  paleta,
  filtroContaCampo,
  isDestaque,
  setRef,
  onDrillDownEquip,
  onDrillDownDespesa,
}: {
  subsetor: SubsetorData;
  totalGeral: number;
  paleta: typeof DEFAULT_PALETA;
  filtroContaCampo?: string;
  isDestaque?: boolean;
  setRef?: (el: HTMLDivElement | null) => void;
  onDrillDownEquip: (equip: Equipamento, campo: string, label: string, valor: number) => void;
  onDrillDownDespesa: (desp: DespesaEspecifica) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const pctTotal = totalGeral > 0 ? (subsetor.totalSubsetor / totalGeral) * 100 : 0;

  // Ordenar equipamentos por valor total decrescente
  const equipamentosOrdenados = useMemo(
    () => [...subsetor.equipamentos].sort(
      (a, b) => parseFloat(b.totalDespesasEquipamento ?? "0") - parseFloat(a.totalDespesasEquipamento ?? "0")
    ),
    [subsetor.equipamentos]
  );

  // Se há filtro de conta, ordenar pelo valor da conta filtrada
  const equipamentosExibidos = useMemo(() => {
    if (!filtroContaCampo) return equipamentosOrdenados;
    return [...equipamentosOrdenados].sort(
      (a, b) => parseFloat((b as any)[filtroContaCampo] ?? "0") - parseFloat((a as any)[filtroContaCampo] ?? "0")
    );
  }, [equipamentosOrdenados, filtroContaCampo]);

  return (
    <div
      ref={(el) => { if (setRef) setRef(el); }}
      className={`rounded-lg border ${isDestaque ? "border-yellow-400 ring-2 ring-yellow-300 shadow-lg" : paleta.border} ${paleta.bg} mb-4 transition-all`}
    >
      {/* Cabeçalho do subsetor */}
      <button
        className={`w-full flex items-center justify-between px-4 py-3 rounded-t-lg ${isDestaque ? "bg-yellow-100 text-yellow-900" : paleta.header} font-semibold text-sm`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Factory className="h-4 w-4" />
          <span>{subsetor.subsetorNome}</span>
          <Badge variant="outline" className={`text-xs ml-2 ${isDestaque ? "bg-yellow-50 text-yellow-700 border-yellow-300" : paleta.badge}`}>
            {subsetor.equipamentos.length} equip.
          </Badge>
          {isDestaque && (
            <Badge className="text-xs ml-1 bg-yellow-400 text-yellow-900 border-0">
              <Filter className="h-3 w-3 mr-1" /> Filtrado
            </Badge>
          )}
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
                {filtroContaCampo && (
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                    Ordenado por: {CONTA_CAMPO_LABEL[filtroContaCampo] ?? filtroContaCampo}
                  </Badge>
                )}
              </div>
              <div className="rounded-md border border-border bg-background overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs">Equipamento</TableHead>
                      <TableHead className={`text-right text-xs ${filtroContaCampo === "salOperEncOper" ? "bg-yellow-200 text-yellow-800 font-bold border-t-2 border-yellow-400" : ""}`}>Sal.Oper.</TableHead>
                      <TableHead className={`text-right text-xs ${filtroContaCampo === "lubrificantes" ? "bg-yellow-200 text-yellow-800 font-bold border-t-2 border-yellow-400" : ""}`}>Lubrif.</TableHead>
                      <TableHead className={`text-right text-xs ${filtroContaCampo === "pecasDesgaste" ? "bg-yellow-200 text-yellow-800 font-bold border-t-2 border-yellow-400" : ""}`}>Pç.Desgaste</TableHead>
                      <TableHead className={`text-right text-xs ${filtroContaCampo === "pecasReposicao" ? "bg-yellow-200 text-yellow-800 font-bold border-t-2 border-yellow-400" : ""}`}>Pç.Repos.</TableHead>
                      <TableHead className={`text-right text-xs ${filtroContaCampo === "outrasDespesas" ? "bg-yellow-200 text-yellow-800 font-bold border-t-2 border-yellow-400" : ""}`}>Outras</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Total Equip.</TableHead>
                      <TableHead className="text-right text-xs">% Setor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipamentosExibidos.map(equip => (
                      <EquipamentoRow
                        key={equip.id}
                        equip={equip}
                        totalSubsetor={subsetor.totalSubsetor}
                        filtroContaCampo={filtroContaCampo}
                        subsetorNome={subsetor.subsetorNome}
                        onDrillDown={(campo, label, valor) => onDrillDownEquip(equip, campo, label, valor)}
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

          {/* Despesas específicas do setor — tabela por conta */}
          {subsetor.despesasEspecificas.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Despesas Específicas do Setor</span>
                <Badge variant="secondary" className="text-xs">{fmtBRL(subsetor.totalDespesasEspecificas)}</Badge>
              </div>
              <div className="rounded-md border border-border bg-background overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Conta / Descrição</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Valor</TableHead>
                      <TableHead className="text-right text-xs">% Setor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subsetor.despesasEspecificas.map((desp, idx) => {
                      const valor = parseFloat(desp.valor ?? "0");
                      const pct = subsetor.totalSubsetor > 0 ? (valor / subsetor.totalSubsetor) * 100 : 0;
                      const isSalAdm = desp.descricao === "Sal.Adm./Almox./Ofic./Serv.Aux./Encargos";
                      const labelExibido = isSalAdm && subsetor.subsetorNome !== "ADMINISTRAÇÃO"
                        ? "Salários com Encargos"
                        : desp.descricao;
                      const hasIcon = desp.descricao.includes("Energia") || desp.descricao.includes("Explosivos");
                      // Despesas com id negativo são virtuais (MSET/salários manuais) — podem ter drill-down
                      const isDrillable = valor > 0;
                      return (
                        <TableRow
                          key={desp.id}
                          className={`${idx % 2 === 0 ? "" : "bg-muted/20"} ${isDrillable ? "cursor-pointer hover:bg-blue-50 group" : ""}`}
                          onClick={() => isDrillable && onDrillDownDespesa(desp)}
                        >
                          <TableCell className="text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                              {desp.descricao.includes("Energia") && <Zap className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                              {desp.descricao.includes("Explosivos") && <Bomb className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                              {!hasIcon && <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <span className={isDrillable ? "group-hover:text-blue-700" : ""}>{labelExibido}</span>
                              {isDrillable && (
                                <Search className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity shrink-0" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right text-sm font-semibold font-mono ${isDrillable ? "group-hover:text-blue-700" : ""}`}>{fmtBRL(valor)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{fmtPct(pct)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {/* Linha de subtotal */}
                    <TableRow className="bg-muted/30 font-semibold border-t-2">
                      <TableCell className="text-sm">Subtotal Despesas Específicas</TableCell>
                      <TableCell className="text-right text-sm font-semibold font-mono">{fmtBRL(subsetor.totalDespesasEspecificas)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {fmtPct(subsetor.totalSubsetor > 0 ? (subsetor.totalDespesasEspecificas / subsetor.totalSubsetor) * 100 : 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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
  const [location, setLocation] = useLocation();
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [expandedGrupos, setExpandedGrupos] = useState<Record<string, boolean>>({});
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  // Ler filtros da URL
  const searchParams = useMemo(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    return new URLSearchParams(search);
  }, [location]);

  const filtroSubsetor = searchParams.get("subsetor") ?? "";
  const filtroContaCampo = searchParams.get("conta") ?? "";
  const filtroGrupo = searchParams.get("grupo") ?? "";
  const filtroPeriodoId = searchParams.get("periodo") ? Number(searchParams.get("periodo")) : null;

  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const { data: relatorio, isLoading } = trpc.custoSetorRas.relatorioAnalitico.useQuery(
    { periodoCustoId: selectedPeriodoId! },
    { enabled: !!selectedPeriodoId }
  );

  // ─── Drill-down queries ───────────────────────────────────────────────────
  // Itens detalhados de um equipamento por classificação
  const { data: drillItens, isLoading: drillItensLoading } = trpc.itensDespesa.listarItensDetalhados.useQuery(
    {
      periodoCustoId: selectedPeriodoId!,
      equipamentoTag: drillDown?.equipamentoTag ?? "",
      classificacao: drillDown?.classificacao ?? "",
    },
    {
      enabled: !!selectedPeriodoId && drillDown?.tipo === "equipamento_conta" && !!drillDown?.equipamentoTag && !!drillDown?.classificacao,
    }
  );

  // Distribuição de uma despesa específica por subsetor
  const { data: drillDespesaSetor, isLoading: drillDespesaSetorLoading } = trpc.custoSetorRas.despesasPorDescricao.useQuery(
    {
      periodoCustoId: selectedPeriodoId!,
      descricao: drillDown?.despesaDescricao ?? "",
    },
    {
      enabled: !!selectedPeriodoId && drillDown?.tipo === "despesa_setor" && !!drillDown?.despesaDescricao,
    }
  );

  // ─── Drill-down export options ────────────────────────────────────────────
  const drillDownExportOptions = useMemo((): Omit<import("@/lib/export-utils").ExportOptions, "title" | "subtitle" | "filename"> => {
    if (!drillDown) return { columns: [], data: [] };
    const fmtVal = (v: any) => typeof v === "number" ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v ?? "");
    const fmtPctVal = (v: any) => typeof v === "number" ? v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%" : String(v ?? "");

    // Equipamento → itens detalhados
    if (drillDown.tipo === "equipamento_conta" && drillItens) {
      return {
        columns: [
          { header: "Data", key: "data" },
          { header: "Produto", key: "produto" },
          { header: "Grupo", key: "grupo" },
          { header: "Qtd", key: "qtd", format: fmtVal },
          { header: "Valor (R$)", key: "valor", format: fmtVal },
        ],
        data: drillItens.map(i => ({
          data: i.data || "",
          produto: i.produto,
          grupo: i.grupoProduto || "",
          qtd: i.quantidade,
          valor: i.custo,
        })),
      };
    }

    // Despesa específica → distribuição por subsetor
    if (drillDown.tipo === "despesa_setor" && drillDespesaSetor) {
      const total = drillDespesaSetor.total;
      return {
        columns: [
          { header: "Subsetor", key: "subsetor" },
          { header: "Grupo", key: "grupo" },
          { header: "Valor (R$)", key: "valor", format: fmtVal },
          { header: "%", key: "pct", format: fmtPctVal },
        ],
        data: drillDespesaSetor.subsetores.map(s => ({
          subsetor: s.subsetorNome,
          grupo: s.grupoNome,
          valor: s.valor,
          pct: total > 0 ? (s.valor / total) * 100 : 0,
        })),
      };
    }

    return { columns: [], data: [] };
  }, [drillDown, drillItens, drillDespesaSetor]);

  const periodoAtual = useMemo(
    () => periodos?.find((p) => p.id === selectedPeriodoId) ?? null,
    [periodos, selectedPeriodoId]
  );

  useEffect(() => {
    if (periodos && periodos.length > 0 && !selectedPeriodoId) {
      // Se vier parâmetro periodo na URL, usar esse; senão usar o mais recente
      const periodoUrl = filtroPeriodoId && periodos.find((p: any) => p.id === filtroPeriodoId);
      setSelectedPeriodoId(periodoUrl ? filtroPeriodoId : periodos[0].id);
    }
  }, [periodos, selectedPeriodoId, filtroPeriodoId]);

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

  const limparFiltros = () => {
    setLocation("/custo-setor-analitico");
  };

  const periodoLabel = periodoAtual
    ? `${MESES[(periodoAtual.mes ?? 1) - 1]}/${periodoAtual.ano}`
    : "";

  const totalGeral = relatorio?.totalGeral ?? 0;

  // Ordenar grupos por totalGrupo decrescente
  const grupos: GrupoData[] = useMemo(() => {
    const gs = relatorio?.grupos ?? [];
    return [...gs].sort((a, b) => b.totalGrupo - a.totalGrupo);
  }, [relatorio]);

  // Refs para scroll automático até o subsetor filtrado
  const subsetorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setSubsetorRef = (nome: string) => (el: HTMLDivElement | null) => {
    subsetorRefs.current[nome] = el;
  };

  // Scroll automático quando filtro de subsetor é aplicado e dados carregados
  useEffect(() => {
    if (!filtroSubsetor || !relatorio) return;
    const timer = setTimeout(() => {
      const el = subsetorRefs.current[filtroSubsetor];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filtroSubsetor, relatorio]);

  // ─── Handlers de drill-down ───────────────────────────────────────────────
  const handleDrillDownEquip = (equip: Equipamento, campo: string, label: string, valor: number) => {
    const classificacao = CAMPO_PARA_CLASSIFICACAO[campo];
    if (!classificacao) return; // salOperEncOper não tem drill-down por itens
    const tag = extrairTag(equip.equipamentoNome);
    setDrillDown({
      tipo: "equipamento_conta",
      equipamentoNome: equip.equipamentoNome,
      equipamentoTag: tag,
      contaCampo: campo,
      contaLabel: label,
      classificacao,
      contaValor: valor,
      nivel: 1,
    });
  };

  const handleDrillDownDespesa = (desp: DespesaEspecifica) => {
    const valor = parseFloat(desp.valor ?? "0");
    if (valor <= 0) return;
    setDrillDown({
      tipo: "despesa_setor",
      despesaDescricao: desp.descricao,
      despesaValor: valor,
      nivel: 1,
    });
  };

  // Dados para exportação
  const exportOptions = useMemo(() => {
    if (!grupos.length) return null;
    const rows: Record<string, any>[] = [];
    for (const grupo of grupos) {
      for (const sub of grupo.subsetores) {
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
        const equipsOrdenados = [...sub.equipamentos].sort(
          (a, b) => parseFloat(b.totalDespesasEquipamento ?? "0") - parseFloat(a.totalDespesasEquipamento ?? "0")
        );
        for (const equip of equipsOrdenados) {
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

  const temFiltro = !!filtroSubsetor || !!filtroContaCampo || !!filtroGrupo;

  // ─── Drill-down dialog title ──────────────────────────────────────────────
  const drillTitle = useMemo(() => {
    if (!drillDown) return "";
    if (drillDown.tipo === "equipamento_conta") {
      return `${drillDown.equipamentoNome} — ${drillDown.contaLabel}`;
    }
    if (drillDown.tipo === "despesa_setor") {
      return `${drillDown.despesaDescricao} — Distribuição por Subsetor`;
    }
    return "";
  }, [drillDown]);

  const drillExportTitle = useMemo(() => {
    if (!drillDown) return "";
    if (drillDown.tipo === "equipamento_conta") {
      return `${drillDown.contaLabel} - ${drillDown.equipamentoNome}`;
    }
    if (drillDown.tipo === "despesa_setor") {
      return `${drillDown.despesaDescricao} - Distribuição por Subsetor`;
    }
    return "";
  }, [drillDown]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatório Analítico por Setor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detalhamento de custos por equipamento e despesas específicas de cada setor.
            <span className="ml-1 text-blue-600">Clique nas contas para ver os itens detalhados.</span>
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

      {/* Banner de filtro ativo */}
      {temFiltro && (
        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-lg">
          <Filter className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-yellow-800">
            {filtroGrupo && (
              <span>Grupo: <strong>{filtroGrupo}</strong></span>
            )}
            {filtroGrupo && filtroSubsetor && <span className="mx-2">·</span>}
            {filtroSubsetor && (
              <span>Setor: <strong>{filtroSubsetor}</strong></span>
            )}
            {(filtroGrupo || filtroSubsetor) && filtroContaCampo && <span className="mx-2">·</span>}
            {filtroContaCampo && (
              <span>Conta destacada: <strong>{CONTA_CAMPO_LABEL[filtroContaCampo] ?? filtroContaCampo}</strong></span>
            )}
          </div>
          <Link
            href="/custo-setor"
            className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 rounded px-2 py-1 transition-colors border border-yellow-300 hover:border-yellow-400"
          >
            <ArrowLeft className="h-3 w-3" />
            {filtroContaCampo && !filtroGrupo && !filtroSubsetor ? "Apuração de Custo" : "Custo por Setor"}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 h-7 px-2"
            onClick={limparFiltros}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar filtro
          </Button>
        </div>
      )}

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
      {!isLoading && grupos
        .filter((grupo: GrupoData) => !filtroGrupo || grupo.grupoNome === filtroGrupo)
        .map((grupo: GrupoData) => {
        const paleta = GRUPO_PALETA[grupo.grupoNome] ?? DEFAULT_PALETA;
        const pct = totalGeral > 0 ? (grupo.totalGrupo / totalGeral) * 100 : 0;
        const isExpanded = expandedGrupos[grupo.grupoNome] ?? true;

        // Ordenar subsetores por totalSubsetor decrescente
        const subsetoresOrdenados = [...grupo.subsetores].sort(
          (a, b) => b.totalSubsetor - a.totalSubsetor
        );

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
                {subsetoresOrdenados
                  .filter((sub: SubsetorData) => !filtroSubsetor || sub.subsetorNome === filtroSubsetor)
                  .map((sub: SubsetorData) => {
                  const isDestaque = !!filtroSubsetor && sub.subsetorNome === filtroSubsetor;
                  return (
                    <SubsetorCard
                      key={sub.subsetorNome}
                      subsetor={sub}
                      totalGeral={totalGeral}
                      paleta={paleta}
                      filtroContaCampo={filtroContaCampo || undefined}
                      isDestaque={isDestaque}
                      setRef={isDestaque ? setSubsetorRef(sub.subsetorNome) : undefined}
                      onDrillDownEquip={handleDrillDownEquip}
                      onDrillDownDespesa={handleDrillDownDespesa}
                    />
                  );
                })}

                {/* Barra de Total do Grupo - destaque vermelho com separador */}
                <div className="mt-3 border-t-4 border-red-600 pt-3">
                  <div className="flex items-center justify-between bg-red-50 border border-red-300 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-600"></div>
                      <span className="text-sm font-bold text-red-800">TOTAL DO GRUPO: {grupo.grupoNome}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-red-600 font-medium">{fmtPct(pct)} do total geral</span>
                      <span className="text-lg font-bold font-mono text-red-700">{fmtBRL(grupo.totalGrupo)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* ─── Modal de Drill-Down ─────────────────────────────────────────────── */}
      <Dialog open={!!drillDown} onOpenChange={(open) => { if (!open) setDrillDown(null); }}>
        <DialogContent showCloseButton={false} className="!max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Fixed header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b bg-background shrink-0">
            <div className="flex flex-col gap-1 pr-10 min-w-0">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 flex-wrap">
                {drillDown?.tipo === "equipamento_conta" && (
                  <>
                    <Search className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="truncate">{drillDown.equipamentoNome}</span>
                    <span className="text-muted-foreground">›</span>
                    <span className="text-blue-700">{drillDown.contaLabel}</span>
                  </>
                )}
                {drillDown?.tipo === "despesa_setor" && (
                  <>
                    <DollarSign className="h-4 w-4 text-green-600 shrink-0" />
                    <span>{drillDown.despesaDescricao}</span>
                    <span className="text-muted-foreground">›</span>
                    <span className="text-green-700">Distribuição por Subsetor</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {drillDown?.tipo === "equipamento_conta" && (
                  <>
                    Valor da conta: <span className="font-mono font-semibold">R$ {fmt(drillDown.contaValor ?? 0)}</span>
                    {periodoAtual && <span className="ml-2">| {MESES[(periodoAtual.mes ?? 1) - 1]}/{periodoAtual.ano}</span>}
                  </>
                )}
                {drillDown?.tipo === "despesa_setor" && (
                  <>
                    Valor total: <span className="font-mono font-semibold">R$ {fmt(drillDown.despesaValor ?? 0)}</span>
                    {periodoAtual && <span className="ml-2">| {MESES[(periodoAtual.mes ?? 1) - 1]}/{periodoAtual.ano}</span>}
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <DashboardExportMenu
                title={drillExportTitle}
                subtitle={periodoAtual ? `Período: ${MESES[(periodoAtual.mes ?? 1) - 1]}/${periodoAtual.ano}` : undefined}
                filename={`drilldown-${(drillDown?.equipamentoTag || drillDown?.despesaDescricao || "dados").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`}
                exportOptions={drillDownExportOptions}
              />
              <button onClick={() => setDrillDown(null)} className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto overflow-x-auto px-6 py-4 flex-1 min-h-0">
            {/* ─── Drill-down: Itens detalhados de equipamento por classificação ── */}
            {drillDown?.tipo === "equipamento_conta" && (
              <div>
                {drillItensLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                    Carregando itens detalhados...
                  </div>
                ) : drillItens && drillItens.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{drillItens.length} itens encontrados</span>
                      <span className="font-mono font-semibold">Total: R$ {fmt(drillItens.reduce((s, i) => s + i.custo, 0))}</span>
                    </div>
                    <div className="rounded-md border border-border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-8 text-xs">#</TableHead>
                            <TableHead className="w-24 text-xs">Data</TableHead>
                            <TableHead className="text-xs">Produto</TableHead>
                            <TableHead className="text-xs">Grupo</TableHead>
                            <TableHead className="text-right w-20 text-xs">Qtd</TableHead>
                            <TableHead className="text-right w-32 text-xs">Valor (R$)</TableHead>
                            <TableHead className="text-right w-20 text-xs">%</TableHead>
                            {drillDown.classificacao === "combustivel" && (
                              <TableHead className="text-right w-24 text-xs">Horímetro</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {drillItens.map((item, idx) => {
                            const totalItens = drillItens.reduce((s, i) => s + i.custo, 0);
                            const pctItem = totalItens > 0 ? (item.custo / totalItens) * 100 : 0;
                            return (
                              <TableRow key={item.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                                <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                <TableCell className="text-xs font-mono">{item.data || "—"}</TableCell>
                                <TableCell className="text-sm">
                                  <span className="font-medium">{item.produto}</span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{item.grupoProduto || "—"}</TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {item.quantidade > 0 ? item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium text-sm">{fmtBRL(item.custo)}</TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmtPct(pctItem)}</TableCell>
                                {drillDown.classificacao === "combustivel" && (
                                  <TableCell className="text-right font-mono text-xs">{item.hodometro ?? "—"}</TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                          <TableRow className="font-semibold bg-muted/40 border-t-2">
                            <TableCell></TableCell>
                            <TableCell colSpan={drillDown.classificacao === "combustivel" ? 4 : 3} className="text-sm">
                              Total ({drillItens.length} itens)
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmtBRL(drillItens.reduce((s, i) => s + i.custo, 0))}</TableCell>
                            <TableCell className="text-right font-mono text-xs">100,0%</TableCell>
                            {drillDown.classificacao === "combustivel" && <TableCell></TableCell>}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">Nenhum item detalhado encontrado</p>
                    <p className="text-xs">
                      Importe a planilha de despesas de equipamentos para ver os itens individuais.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Drill-down: Despesa específica — distribuição por subsetor ──── */}
            {drillDown?.tipo === "despesa_setor" && (
              <div>
                {drillDespesaSetorLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                    Carregando distribuição por subsetor...
                  </div>
                ) : drillDespesaSetor && drillDespesaSetor.subsetores.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{drillDespesaSetor.subsetores.length} subsetores</span>
                      <span className="font-mono font-semibold">Total: R$ {fmt(drillDespesaSetor.total)}</span>
                    </div>
                    <div className="rounded-md border border-border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="w-8 text-xs">#</TableHead>
                            <TableHead className="text-xs">Subsetor</TableHead>
                            <TableHead className="text-xs">Grupo</TableHead>
                            <TableHead className="text-right w-40 text-xs">Valor (R$)</TableHead>
                            <TableHead className="text-right w-24 text-xs">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...drillDespesaSetor.subsetores]
                            .sort((a, b) => b.valor - a.valor)
                            .map((sub, idx) => {
                              const pctSub = drillDespesaSetor.total > 0 ? (sub.valor / drillDespesaSetor.total) * 100 : 0;
                              return (
                                <TableRow key={`${sub.grupoNome}-${sub.subsetorNome}`} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                                  <TableCell className="font-medium text-sm">{sub.subsetorNome}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{sub.grupoNome}</TableCell>
                                  <TableCell className="text-right font-mono font-medium text-sm">{fmtBRL(sub.valor)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs text-muted-foreground">{fmtPct(pctSub)}</TableCell>
                                </TableRow>
                              );
                            })}
                          <TableRow className="font-semibold bg-muted/40 border-t-2">
                            <TableCell></TableCell>
                            <TableCell colSpan={2} className="text-sm">Total ({drillDespesaSetor.subsetores.length} subsetores)</TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmtBRL(drillDespesaSetor.total)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">100,0%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">Nenhum dado de distribuição encontrado</p>
                    <p className="text-xs">
                      Esta despesa pode não ter dados importados de distribuição por subsetor (MSET) para este período.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
