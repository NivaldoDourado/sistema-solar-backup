import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardExportMenu } from "@/components/DashboardExportMenu";
import { Trophy, ChevronRight, ChevronDown, ArrowLeft, Package, Wrench, Cog, Settings2 } from "lucide-react";
import type { ExportColumn } from "@/lib/export-utils";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const CLASSIFICACAO_COLORS: Record<string, string> = {
  lubrificantes: "bg-yellow-50 border-yellow-200 text-yellow-800",
  pecas_desgaste: "bg-orange-50 border-orange-200 text-orange-800",
  pecas_reposicao: "bg-blue-50 border-blue-200 text-blue-800",
  outras_despesas: "bg-purple-50 border-purple-200 text-purple-800",
};

const CLASSIFICACAO_ICONS: Record<string, typeof Package> = {
  lubrificantes: Package,
  pecas_desgaste: Wrench,
  pecas_reposicao: Cog,
  outras_despesas: Settings2,
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(v: number) {
  return v.toFixed(1) + "%";
}

export default function RankingEquipamentos() {
  const { data: periodos } = trpc.periodoCusto.list.useQuery();
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [expandedEquip, setExpandedEquip] = useState<string | null>(null);
  const [expandedClassif, setExpandedClassif] = useState<{ tag: string; classif: string } | null>(null);

  // Auto-select the latest period
  const periodoAtual = useMemo(() => {
    if (!periodos?.length) return null;
    if (selectedPeriodoId) return periodos.find((p: any) => p.id === selectedPeriodoId) || null;
    const sorted = [...periodos].sort((a: any, b: any) => b.id - a.id);
    return sorted[0] || null;
  }, [periodos, selectedPeriodoId]);

  const periodoId = periodoAtual?.id || selectedPeriodoId;

  const { data: ranking, isLoading } = trpc.rankingEquipamentos.ranking.useQuery(
    { periodoCustoId: periodoId! },
    { enabled: !!periodoId }
  );

  const { data: classificacoes } = trpc.rankingEquipamentos.classificacoesEquipamento.useQuery(
    { periodoCustoId: periodoId!, equipamentoTag: expandedEquip! },
    { enabled: !!periodoId && !!expandedEquip }
  );

  const { data: itensDetalhados } = trpc.rankingEquipamentos.itensClassificacao.useQuery(
    { periodoCustoId: periodoId!, equipamentoTag: expandedClassif?.tag!, classificacao: expandedClassif?.classif! },
    { enabled: !!periodoId && !!expandedClassif }
  );

  const { data: dadosExport } = trpc.rankingEquipamentos.dadosExportacao.useQuery(
    { periodoCustoId: periodoId! },
    { enabled: !!periodoId }
  );

  // WhatsApp destinatários
  const { data: destinatariosWpp } = trpc.destinatariosWhatsapp.list.useQuery();
  const destinatariosAtivos = useMemo(
    () => (destinatariosWpp || []).filter((d: any) => d.ativo === "sim").map((d: any) => d.telefone),
    [destinatariosWpp]
  );

  const periodoLabel = periodoAtual
    ? `${MESES[(periodoAtual.mes ?? 1) - 1]}/${periodoAtual.ano}`
    : "";

  // WhatsApp message
  const whatsappMessage = useMemo(() => {
    if (!ranking?.equipamentos?.length) return undefined;
    let msg = `🏆 *Ranking de Equipamentos por Gastos — ${periodoLabel}*\n`;
    msg += `Total: ${fmtBRL(ranking.totalGeral)} | ${ranking.totalEquipamentos} equipamentos\n\n`;
    const top10 = ranking.equipamentos.slice(0, 10);
    for (const e of top10) {
      msg += `${e.posicao}º ${e.nomeEquipamento}: ${fmtBRL(e.totalCusto)} (${fmtPct(e.percentual)})\n`;
    }
    if (ranking.equipamentos.length > 10) {
      msg += `\n... e mais ${ranking.equipamentos.length - 10} equipamentos`;
    }
    return msg;
  }, [ranking, periodoLabel]);

  // Export data (TOP 10 only with items + note)
  const exportOptions = useMemo(() => {
    if (!dadosExport?.equipamentos?.length) return null;
    const columns: ExportColumn[] = [
      { header: "#", key: "posicao", width: 5 },
      { header: "Equipamento", key: "equipamento", width: 35 },
      { header: "Classificação", key: "classificacao", width: 30 },
      { header: "Seq", key: "sequencia", width: 8 },
      { header: "Data", key: "data", width: 10 },
      { header: "Produto", key: "produto", width: 40 },
      { header: "Valor", key: "valor", width: 15, format: (v: any) => typeof v === "number" ? fmtBRL(v) : v },
      { header: "", key: "tipo", width: 0 },
    ];

    // Limitar a apenas os 10 primeiros equipamentos
    const top10 = dadosExport.equipamentos.slice(0, 10);
    const data: Record<string, any>[] = [];
    for (const equip of top10) {
      for (const classif of equip.classificacoes) {
        // Itens da classificação
        for (const item of classif.itens) {
          data.push({
            posicao: equip.posicao,
            equipamento: equip.descricao,
            classificacao: classif.label,
            sequencia: item.sequencia || "",
            data: item.data || "",
            produto: item.produto,
            valor: item.custo,
            tipo: "",
          });
        }
        // Subtotal da classificação (estilo azul como subtotal de setor)
        data.push({
          posicao: "",
          equipamento: "",
          classificacao: "",
          sequencia: "",
          data: "",
          produto: `SUBTOTAL ${classif.label.toUpperCase()}`,
          valor: classif.totalCusto,
          tipo: "SUBTOTAL SETOR",
          _isSubtotal: true,
        });
      }
      // Total do equipamento (estilo vermelho como total de grupo)
      data.push({
        posicao: "",
        equipamento: `TOTAL: ${equip.descricao}`,
        classificacao: "",
        sequencia: "",
        data: "",
        produto: "",
        valor: equip.totalCusto,
        tipo: "TOTAL GRUPO",
        _isTotal: true,
      });
    }
    // Total geral (dos 10 primeiros)
    const totalTop10 = top10.reduce((sum: number, e: any) => sum + (e.totalCusto || 0), 0);
    data.push({
      posicao: "",
      equipamento: `TOTAL DOS 10 PRIMEIROS EQUIPAMENTOS`,
      classificacao: "",
      sequencia: "",
      data: "",
      produto: "",
      valor: totalTop10,
      tipo: "TOTAL GRUPO",
      _isTotal: true,
    });
    // Linha em branco
    data.push({
      posicao: "",
      equipamento: "",
      classificacao: "",
      sequencia: "",
      data: "",
      produto: "",
      valor: "",
      tipo: "",
    });
    // NOTA DE DESTAQUE
    data.push({
      posicao: "NOTA",
      equipamento: "Este relatorio apresenta apenas os 10 equipamentos com maiores gastos.",
      classificacao: `Ranking completo (${dadosExport.equipamentos.length} equip.): Sistema GEM > Apuracao de Custo > Ranking Equipamentos`,
      sequencia: "",
      data: "",
      produto: "",
      valor: "",
      tipo: "",
      _isNota: true,
    });

    return { columns, data };
  }, [dadosExport]);

  const toggleEquip = (tag: string) => {
    if (expandedEquip === tag) {
      setExpandedEquip(null);
      setExpandedClassif(null);
    } else {
      setExpandedEquip(tag);
      setExpandedClassif(null);
    }
  };

  const toggleClassif = (tag: string, classif: string) => {
    if (expandedClassif?.tag === tag && expandedClassif?.classif === classif) {
      setExpandedClassif(null);
    } else {
      setExpandedClassif({ tag, classif });
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold">Ranking de Equipamentos</h1>
            <p className="text-sm text-muted-foreground">Gastos por equipamento (Lub. + Desg. + Rep. + Outras)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={periodoId?.toString() || ""}
            onValueChange={(v) => {
              setSelectedPeriodoId(Number(v));
              setExpandedEquip(null);
              setExpandedClassif(null);
            }}
          >
            <SelectTrigger className="w-[180px]">
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
          {exportOptions && (
            <DashboardExportMenu
              title={`Ranking de Equipamentos por Gastos`}
              subtitle={`Período: ${periodoLabel}`}
              filename={`ranking-equipamentos-${periodoLabel.replace("/", "-")}`}
              exportOptions={exportOptions}
              whatsappMessage={whatsappMessage}
              whatsappDestinatarios={destinatariosAtivos}
            />
          )}
        </div>
      </div>

      {/* Summary Card */}
      {ranking && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <p className="text-sm text-amber-700 font-medium">Total Geral</p>
              <p className="text-2xl font-bold text-amber-900">{fmtBRL(ranking.totalGeral)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Equipamentos</p>
              <p className="text-2xl font-bold">{ranking.totalEquipamentos}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Média por Equipamento</p>
              <p className="text-2xl font-bold">
                {ranking.totalEquipamentos > 0 ? fmtBRL(ranking.totalGeral / ranking.totalEquipamentos) : "—"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking Table */}
      {isLoading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Carregando ranking...
          </CardContent>
        </Card>
      )}

      {ranking && ranking.equipamentos.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum dado encontrado para o período selecionado.
          </CardContent>
        </Card>
      )}

      {ranking && ranking.equipamentos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Equipamentos por Gasto Total (decrescente)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {ranking.equipamentos.map((equip) => (
                <div key={equip.equipamentoTag}>
                  {/* Equipamento row */}
                  <button
                    onClick={() => toggleEquip(equip.equipamentoTag)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center">
                      {equip.posicao}
                    </span>
                    {expandedEquip === equip.equipamentoTag ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{equip.nomeEquipamento}</p>
                      <p className="text-xs text-muted-foreground">{equip.setor} • {equip.totalItens} itens</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-sm">{fmtBRL(equip.totalCusto)}</p>
                      <p className="text-xs text-muted-foreground">{fmtPct(equip.percentual)}</p>
                    </div>
                    {/* Progress bar */}
                    <div className="hidden md:block w-24 h-2 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${Math.min(equip.percentual * 2, 100)}%` }}
                      />
                    </div>
                  </button>

                  {/* Drill-down: Classificações */}
                  {expandedEquip === equip.equipamentoTag && classificacoes && (
                    <div className="bg-muted/30 border-t">
                      <div className="px-6 py-3 space-y-2">
                        {classificacoes.classificacoes.map((classif, idx) => {
                          const Icon = CLASSIFICACAO_ICONS[classif.classificacao] || Package;
                          const colorClass = CLASSIFICACAO_COLORS[classif.classificacao] || "bg-gray-50 border-gray-200 text-gray-800";
                          const isExpanded = expandedClassif?.tag === equip.equipamentoTag && expandedClassif?.classif === classif.classificacao;

                          return (
                            <div key={classif.classificacao}>
                              {/* Separador entre classificações */}
                              {idx > 0 && (
                                <div className="border-t border-dashed border-gray-300 my-2" />
                              )}
                              <button
                                onClick={() => toggleClassif(equip.equipamentoTag, classif.classificacao)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border ${colorClass} hover:opacity-80 transition-opacity text-left`}
                              >
                                <Icon className="h-4 w-4 flex-shrink-0" />
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                                )}
                                <span className="flex-1 text-sm font-medium">{classif.label}</span>
                                <span className="text-xs text-muted-foreground">{classif.totalItens} itens</span>
                                <span className="font-semibold text-sm">{fmtBRL(classif.totalCusto)}</span>
                                <span className="text-xs">({fmtPct(classif.percentual)})</span>
                              </button>

                              {/* Drill-down: Itens detalhados */}
                              {isExpanded && itensDetalhados && (
                                <div className="mt-2 ml-4 mr-2 rounded-lg border bg-white overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-50 sticky top-0">
                                      <tr>
                                        <th className="text-left px-3 py-2 font-medium text-gray-600">Seq</th>
                                        <th className="text-left px-3 py-2 font-medium text-gray-600">Data</th>
                                        <th className="text-left px-3 py-2 font-medium text-gray-600">Produto</th>
                                        <th className="text-right px-3 py-2 font-medium text-gray-600">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {itensDetalhados.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                          <td className="px-3 py-1.5 text-gray-500">{item.sequencia}</td>
                                          <td className="px-3 py-1.5 text-gray-500">{item.data}</td>
                                          <td className="px-3 py-1.5 max-w-[300px] truncate" title={item.produto}>{item.produto}</td>
                                          <td className="px-3 py-1.5 text-right font-medium">{fmtBRL(item.custo)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-semibold">
                                      <tr>
                                        <td colSpan={3} className="px-3 py-2 text-right">Subtotal {classif.label}:</td>
                                        <td className="px-3 py-2 text-right">{fmtBRL(classif.totalCusto)}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {/* Total do equipamento */}
                        <div className="border-t-2 border-gray-400 mt-3 pt-2 flex justify-between items-center px-4">
                          <span className="font-bold text-sm">Total do Equipamento:</span>
                          <span className="font-bold text-sm">{fmtBRL(classificacoes.totalEquipamento)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
