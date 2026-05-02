import { useState, useCallback } from "react";
import { X, Maximize2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from "recharts";
import { Button } from "@/components/ui/button";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DonutSlice {
  /** Rótulo exibido na legenda e no modal */
  name: string;
  /** Valor numérico (R$, R$/t, etc.) */
  value: number;
  /** Percentual já calculado (0–100) */
  pct: number;
  /** Cor hex da fatia */
  fill: string;
  /** Texto secundário exibido entre o nome e a participação (ex: "R$ 30,74/t") */
  subtitle?: string;
  /** Linhas extras de detalhe exibidas no painel lateral ao clicar */
  details?: Array<{ label: string; value: string }>;
}

interface DonutChartModalProps {
  /** Título exibido no cabeçalho do modal */
  title: string;
  /** Dados das fatias */
  data: DonutSlice[];
  /** Texto exibido no centro do anel (linha 1) */
  centerLabel?: string;
  /** Valor formatado exibido no centro do anel (linha 2) */
  centerValue?: string;
  /** Função de formatação de valor para tooltip e legenda */
  formatValue?: (v: number) => string;
  /** Função de formatação de percentual */
  formatPct?: (v: number) => string;
}

// ─── Fatia ativa (efeito de destaque) ─────────────────────────────────────────

const renderActiveShape = (props: any) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent,
  } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
      />
      {/* Anel externo de destaque */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 14}
        outerRadius={outerRadius + 18}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.5}
      />
    </g>
  );
};

// ─── Tooltip customizado ───────────────────────────────────────────────────────

const CustomTooltip = ({
  active,
  payload,
  formatValue,
  formatPct,
}: any) => {
  if (!active || !payload?.length) return null;
  const d: DonutSlice = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-xl p-3 text-sm min-w-[180px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
        <span className="font-semibold text-foreground">{d.name}</span>
      </div>
      <div className="space-y-1 text-muted-foreground">
        <div className="flex justify-between gap-4">
          <span>Valor</span>
          <span className="font-medium text-foreground">{formatValue ? formatValue(d.value) : d.value}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Participação</span>
          <span className="font-medium text-foreground">{formatPct ? formatPct(d.pct) : `${d.pct.toFixed(1)}%`}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Componente principal ──────────────────────────────────────────────────────

export function DonutChartModal({
  title,
  data,
  centerLabel = "Total",
  centerValue,
  formatValue,
  formatPct,
}: DonutChartModalProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const fmtVal = formatValue ?? ((v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const fmtPct = formatPct ?? ((v: number) => `${v.toFixed(1)}%`);

  const handleSliceClick = useCallback((_: any, index: number) => {
    setActiveIndex((prev) => (prev === index ? null : index));
  }, []);

  const activeSlice = activeIndex !== null ? data[activeIndex] : null;

  return (
    <>
      {/* Botão de expansão — ícone discreto no canto do card */}
      <button
        onClick={() => { setOpen(true); setActiveIndex(null); }}
        className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors z-10"
        title="Expandir gráfico"
        aria-label="Expandir gráfico"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>

      {/* Modal tela cheia */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo */}
            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
              {/* Gráfico grande */}
              <div className="flex-1 flex items-center justify-center p-6 min-h-[320px]">
                <div className="w-full h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={110}
                        outerRadius={175}
                        paddingAngle={2}
                        dataKey="value"
                        activeIndex={activeIndex ?? undefined}
                        activeShape={renderActiveShape}
                        onClick={handleSliceClick}
                        style={{ cursor: "pointer" }}
                      >
                        {data.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.fill}
                            stroke="white"
                            strokeWidth={2}
                            opacity={
                              activeIndex === null || activeIndex === index
                                ? 1
                                : 0.25
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={
                          <CustomTooltip
                            formatValue={fmtVal}
                            formatPct={fmtPct}
                          />
                        }
                      />
                      {/* Texto central */}
                      {activeSlice ? (
                        <>
                          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#6b7280">
                            {activeSlice.name.length > 18 ? activeSlice.name.slice(0, 18) + "…" : activeSlice.name}
                          </text>
                          <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontSize={15} fontWeight={700} fill={activeSlice.fill}>
                            {fmtPct(activeSlice.pct)}
                          </text>
                        </>
                      ) : (
                        <>
                          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#6b7280">
                            {centerLabel}
                          </text>
                          {centerValue && (
                            <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={700} fill="#1e293b">
                              {centerValue}
                            </text>
                          )}
                        </>
                      )}
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Painel lateral — legenda + detalhes */}
              <div className="lg:w-[320px] border-t lg:border-t-0 lg:border-l border-border flex flex-col overflow-y-auto">
                {/* Instrução */}
                <p className="text-xs text-muted-foreground px-4 pt-4 pb-2">
                  Clique em uma fatia para destacar e ver os detalhes.
                </p>

                {/* Lista de fatias */}
                <div className="flex-1 px-3 pb-4 space-y-1">
                  {data.map((d, index) => {
                    const isActive = activeIndex === index;
                    const isDimmed = activeIndex !== null && !isActive;
                    return (
                      <button
                        key={d.name}
                        onClick={() => handleSliceClick(null, index)}
                        className={`w-full text-left rounded-lg px-3 py-2.5 transition-all border ${
                          isActive
                            ? "border-current shadow-sm"
                            : isDimmed
                            ? "border-transparent opacity-40"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                        style={isActive ? { borderColor: d.fill, backgroundColor: `${d.fill}15` } : {}}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: d.fill }}
                          />
                          <span className="text-sm font-medium text-foreground leading-tight">{d.name}</span>
                        </div>
                        <div className="flex items-center justify-between pl-4 mb-1">
                          <span className="text-xs text-muted-foreground">{fmtVal(d.value)}</span>
                          {d.subtitle && (
                            <span className="text-xs text-muted-foreground font-medium">{d.subtitle}</span>
                          )}
                          <span
                            className="text-xs font-bold"
                            style={{ color: d.fill }}
                          >
                            {fmtPct(d.pct)}
                          </span>
                        </div>

                        {/* Barra de progresso */}
                        <div className="mt-1.5 pl-4 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${d.pct}%`, backgroundColor: d.fill }}
                          />
                        </div>

                        {/* Detalhes extras (quando ativo) */}
                        {isActive && d.details && d.details.length > 0 && (
                          <div className="mt-2 pl-4 space-y-0.5 border-t border-border/50 pt-2">
                            {d.details.map((det, i) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{det.label}</span>
                                <span className="font-medium text-foreground">{det.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
