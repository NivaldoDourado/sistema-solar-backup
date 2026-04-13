import React from "react";
import { cn } from "@/lib/utils";

// Bloco de skeleton base com animação pulse
function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-muted/60 dark:bg-muted/40",
        className
      )}
      style={style}
    />
  );
}

// ============================================================
// Variante: card simples com 1 valor grande (Custos, Combustível)
// ============================================================
export function CardSkeletonSimple() {
  return (
    <div className="p-4 space-y-3">
      {/* Header: título + ícone */}
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-32" />
        <Bone className="h-6 w-6 rounded-full" />
      </div>
      {/* Valor principal */}
      <Bone className="h-8 w-40" />
      {/* Subtítulo */}
      <Bone className="h-3 w-24" />
    </div>
  );
}

// ============================================================
// Variante: card com tabela de linhas (Produção Caminhões, Motoristas)
// ============================================================
export function CardSkeletonTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-40" />
        <Bone className="h-6 w-16" />
      </div>
      {/* Valor total */}
      <Bone className="h-7 w-32" />
      {/* Separador */}
      <div className="border-t border-muted/40 pt-2 space-y-2">
        {/* Cabeçalho da tabela */}
        <div className="flex gap-2">
          <Bone className="h-3 flex-1" />
          <Bone className="h-3 w-12" />
          <Bone className="h-3 w-14" />
          <Bone className="h-3 w-14" />
          <Bone className="h-3 w-8" />
        </div>
        {/* Linhas */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Bone className="h-3 flex-1" style={{ opacity: 1 - i * 0.15 }} />
            <Bone className="h-3 w-12" style={{ opacity: 1 - i * 0.15 }} />
            <Bone className="h-3 w-14" style={{ opacity: 1 - i * 0.15 }} />
            <Bone className="h-3 w-14" style={{ opacity: 1 - i * 0.15 }} />
            <Bone className="h-3 w-8" style={{ opacity: 1 - i * 0.15 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Variante: card com barras de progresso (Setor, Serviço, Equipamento)
// ============================================================
export function CardSkeletonBars({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-36" />
        <Bone className="h-6 w-16" />
      </div>
      {/* Valor total */}
      <Bone className="h-7 w-32" />
      {/* Barras */}
      <div className="space-y-2 pt-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between">
              <Bone className="h-3 w-28" style={{ opacity: 1 - i * 0.15 }} />
              <Bone className="h-3 w-16" style={{ opacity: 1 - i * 0.15 }} />
            </div>
            <Bone
              className="h-2 rounded-full"
              style={{ width: `${85 - i * 18}%`, opacity: 1 - i * 0.15 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Variante: card de KPI com meta/progresso (Produção Último Dia)
// ============================================================
export function CardSkeletonKpi() {
  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Bone className="h-4 w-40" />
        <Bone className="h-6 w-16" />
      </div>
      {/* Valor principal */}
      <Bone className="h-8 w-36" />
      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <Bone className="h-3 w-20" />
          <Bone className="h-3 w-12" />
        </div>
        <Bone className="h-3 w-full rounded-full" />
      </div>
      {/* 2 linhas de detalhe */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Bone className="h-10 rounded-lg" />
        <Bone className="h-10 rounded-lg" />
      </div>
    </div>
  );
}

// ============================================================
// Variante mobile: card compacto para o dashboard mobile
// ============================================================
export function CardSkeletonMobile({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Bone className="h-3 w-28" />
        <Bone className="h-5 w-12 rounded" />
      </div>
      <Bone className="h-6 w-24" />
      <div className="space-y-1.5 pt-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Bone className="h-2.5 flex-1" style={{ opacity: 1 - i * 0.2 }} />
            <Bone className="h-2.5 w-12" style={{ opacity: 1 - i * 0.2 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
