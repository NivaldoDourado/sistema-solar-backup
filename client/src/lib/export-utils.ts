import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: (value: any) => string;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  filename: string;
}

const LOGO_CDN_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663227720411/Us3Q3oBA5LqqATDWwyHq5k/LogoDouradoGestao_005e6bc5.png";

const SYSTEM_NAME_LINE1 = "GEM - Gestão Estratégica em Mineração";
const SYSTEM_NAME_LINE2 = "SOLAR PEDREIRA";

function formatValue(value: any, col: ExportColumn): string {
  if (value === null || value === undefined) return "";
  if (col.format) return col.format(value);
  return String(value);
}

function formatDateBR(dateStr: string): string {
  if (!dateStr) return "";
  const s = String(dateStr);
  // Handle ISO format
  const d = s.includes("T") ? s.split("T")[0] : s;
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return s;
}

export function exportToExcel(options: ExportOptions) {
  const { title, subtitle, columns, data, filename } = options;

  // Create header rows
  const headerRow = columns.map((col) => col.header);

  // Create data rows
  const dataRows = data.map((row) =>
    columns.map((col) => {
      const raw = row[col.key];
      if (col.format) return col.format(raw);
      return raw ?? "";
    })
  );

  // Build worksheet data
  const wsData: any[][] = [];
  wsData.push([SYSTEM_NAME_LINE1]);
  wsData.push([SYSTEM_NAME_LINE2]);
  wsData.push([title]);
  if (subtitle) wsData.push([subtitle]);
  wsData.push([]); // empty row
  wsData.push(headerRow);
  wsData.push(...dataRows);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = columns.map((col) => ({ wch: col.width || 18 }));

  // Merge header rows across all columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: columns.length - 1 } },
  ];
  if (subtitle) {
    ws["!merges"].push({
      s: { r: 3, c: 0 },
      e: { r: 3, c: columns.length - 1 },
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `${filename}.xlsx`);
}

/**
 * Load an image from URL as base64 for use in jsPDF.
 * Returns null if loading fails.
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportToPDF(options: ExportOptions) {
  const { title, subtitle, columns, data, filename } = options;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Load logo
  const logoBase64 = await loadImageAsBase64(LOGO_CDN_URL);

  // ── Logo (top-right) ─────────────────────────────────────────────────────
  // Original logo is roughly square (428×470 px). We render at ~28mm wide.
  const logoW = 28;
  const logoH = 30; // keep aspect ratio close to original
  const logoX = pageWidth - logoW - 10;
  const logoY = 6;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", logoX, logoY, logoW, logoH);
  }

  // ── System name (top-left, green area) ───────────────────────────────────
  let curY = 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 80, 160); // blue
  doc.text(SYSTEM_NAME_LINE1, 14, curY);
  curY += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(SYSTEM_NAME_LINE2, 14, curY);
  curY += 7;

  // ── Report title ─────────────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, curY);
  curY += 6;

  // ── Subtitle ─────────────────────────────────────────────────────────────
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, curY);
    curY += 6;
  }

  // ── Generation timestamp ─────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  const now = new Date();
  doc.text(
    `Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`,
    14,
    curY
  );
  curY += 6;

  // ── Table ─────────────────────────────────────────────────────────────────
  const headers = columns.map((col) => col.header);
  const body = data.map((row) =>
    columns.map((col) => formatValue(row[col.key], col))
  );

  // Identificar linhas de "TOTAL GRUPO" para destaque vermelho
  const totalGrupoRowIndices = new Set<number>();
  const tipoColIndex = columns.findIndex(c => c.key === "tipo");
  if (tipoColIndex >= 0) {
    data.forEach((row, idx) => {
      if (row["tipo"] === "TOTAL GRUPO") {
        totalGrupoRowIndices.add(idx);
      }
    });
  }

  autoTable(doc, {
    head: [headers],
    body: body,
    startY: curY,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { left: 14, right: 14 },
    didParseCell: (hookData: any) => {
      if (hookData.section === "body" && totalGrupoRowIndices.has(hookData.row.index)) {
        hookData.cell.styles.fillColor = [254, 226, 226]; // red-100
        hookData.cell.styles.textColor = [153, 27, 27]; // red-800
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    didDrawCell: (hookData: any) => {
      // Desenhar borda inferior vermelha grossa nas linhas de TOTAL GRUPO
      if (hookData.section === "body" && totalGrupoRowIndices.has(hookData.row.index)) {
        const cell = hookData.cell;
        doc.setDrawColor(185, 28, 28); // red-700
        doc.setLineWidth(0.8);
        doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
      }
    },
    didDrawPage: (data: any) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        doc.internal.pageSize.getWidth() - 30,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

// Helper formatters
export const formatters = {
  date: (value: any) => formatDateBR(String(value || "")),
  decimal: (value: any) =>
    value
      ? parseFloat(value).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0,00",
  currency: (value: any) =>
    value
      ? `R$ ${parseFloat(value).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "R$ 0,00",
  integer: (value: any) => (value ? parseInt(value).toString() : "0"),
  boolean: (value: any) => (value === "sim" || value === true ? "Sim" : "Não"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Exportação de Relatório de Custo (multi-seção: KPIs + tabela + resumo)
// ─────────────────────────────────────────────────────────────────────────────

export interface RelatorioKPI {
  label: string;
  value: string;
}

export interface RelatorioSecao {
  /** Título da seção (ex: "Custo Variável") */
  titulo: string;
  /** Cor de fundo do cabeçalho da seção no PDF (RGB) */
  corCabecalho?: [number, number, number];
  /** Linhas da tabela */
  linhas: Array<{
    conta: string;
    divisor?: string;
    totalCusto?: string;
    totalDespesa?: string;
    valor: string;
    custoPorTon?: string;
    percentual?: string;
    isSubtotal?: boolean;
    isTotal?: boolean;
  }>;
}

export interface RelatorioExportOptions {
  titulo: string;
  periodo: string;
  empresa?: string;
  kpis: RelatorioKPI[];
  secoes: RelatorioSecao[];
  filename: string;
}

// ── Excel ─────────────────────────────────────────────────────────────────────
export function exportRelatorioToExcel(opts: RelatorioExportOptions) {
  const { titulo, periodo, empresa, kpis, secoes, filename } = opts;
  const wsData: any[][] = [];
  const merges: any[] = [];

  // Cabeçalho
  wsData.push([SYSTEM_NAME_LINE1]);
  wsData.push([empresa ?? SYSTEM_NAME_LINE2]);
  wsData.push([titulo]);
  wsData.push([`Período: ${periodo}`]);
  wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`]);
  wsData.push([]); // linha em branco

  const COL_COUNT = 5;
  const startRow = wsData.length;
  for (let i = 0; i < startRow; i++) {
    merges.push({ s: { r: i, c: 0 }, e: { r: i, c: COL_COUNT - 1 } });
  }

  // KPIs
  wsData.push(["KPIs do Período", "", "", "", ""]);
  merges.push({ s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: COL_COUNT - 1 } });
  for (const kpi of kpis) {
    wsData.push([kpi.label, kpi.value, "", "", ""]);
  }
  wsData.push([]);

  // Colunas da tabela - detectar se usa totalCusto/totalDespesa
  const headerRow = wsData.length;
  const hasCD = secoes.some(s => s.linhas.some(l => l.totalCusto !== undefined));
  const COL_COUNT_ACTUAL = hasCD ? 7 : 6;
  if (hasCD) {
    wsData.push(["Grupo / Subtotal", "Setor/Processo", "Total Custo (R$)", "Total Despesa (R$)", "Total Geral (R$)", "Custo/t (R$)", "%"]);
  } else {
    wsData.push(["Grupo / Subtotal", "Setor/Processo", "Grupo", "Total Geral (R$)", "Custo/t (R$)", "%"]);
  }

  // Atualizar merges anteriores para colunas corretas
  for (let i = 0; i < headerRow; i++) {
    const m = merges.find((m: any) => m.s.r === i);
    if (m) m.e.c = COL_COUNT_ACTUAL - 1;
  }

  // Seções
  for (const secao of secoes) {
    // Título da seção
    const secaoRow = wsData.length;
    const emptyRow = Array(COL_COUNT_ACTUAL).fill("");
    emptyRow[0] = secao.titulo;
    wsData.push(emptyRow);
    merges.push({ s: { r: secaoRow, c: 0 }, e: { r: secaoRow, c: COL_COUNT_ACTUAL - 1 } });

    for (const linha of secao.linhas) {
      const isSpecial = linha.isSubtotal || linha.isTotal;
      if (hasCD) {
        wsData.push([
          isSpecial ? linha.conta : "",
          isSpecial ? "" : linha.conta,
          linha.totalCusto ?? "",
          linha.totalDespesa ?? "",
          linha.valor,
          linha.custoPorTon ?? "",
          linha.percentual ?? "",
        ]);
      } else {
        wsData.push([
          isSpecial ? linha.conta : "",
          isSpecial ? "" : linha.conta,
          linha.divisor ?? "",
          linha.valor,
          linha.custoPorTon ?? "",
          linha.percentual ?? "",
        ]);
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = hasCD
    ? [{ wch: 30 }, { wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 10 }]
    : [{ wch: 30 }, { wch: 35 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 10 }];
  ws["!merges"] = merges;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
}

// ── PDF ───────────────────────────────────────────────────────────────────────
export async function exportRelatorioToPDF(opts: RelatorioExportOptions) {
  const { titulo, periodo, empresa, kpis, secoes, filename } = opts;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm

  // Logo (compacto)
  const logoBase64 = await loadImageAsBase64(LOGO_CDN_URL);
  const logoW = 20, logoH = 22;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", pageWidth - logoW - 10, 5, logoW, logoH);
  }

  // Cabeçalho textual (compacto)
  let curY = 8;
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 80, 160);
  doc.text(SYSTEM_NAME_LINE1, 10, curY); curY += 4;

  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.text(empresa ?? SYSTEM_NAME_LINE2, 10, curY); curY += 3.5;

  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
  doc.text(titulo, 10, curY); curY += 4.5;

  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.text(`Período: ${periodo}`, 10, curY); curY += 3.5;

  doc.setFontSize(6.5); doc.setFont("helvetica", "italic"); doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 10, curY);
  curY += 4;

  // KPIs em grid compacto (3 na primeira linha, 3 na segunda)
  if (kpis.length > 0) {
    const kpiMargin = 10;
    const kpiGap = 1.5;
    const kpiCols = 3;
    const kpiAvailW = pageWidth - kpiMargin * 2;
    const kpiW = (kpiAvailW - kpiGap * (kpiCols - 1)) / kpiCols;
    const kpiH = 8;

    kpis.forEach((kpi, i) => {
      const row = Math.floor(i / kpiCols);
      const col = i % kpiCols;
      const x = kpiMargin + col * (kpiW + kpiGap);
      const y = curY + row * (kpiH + kpiGap);

      doc.setFillColor(240, 245, 255);
      doc.roundedRect(x, y, kpiW, kpiH, 1.2, 1.2, "F");
      doc.setFontSize(5.5); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, x + 1.5, y + 3);
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 80, 160);
      doc.text(kpi.value, x + 1.5, y + 6.5);
      doc.setFont("helvetica", "normal");
    });

    const totalRows = Math.ceil(kpis.length / kpiCols);
    curY += totalRows * (kpiH + kpiGap) + 1.5;
  }

  // Tabela única contínua (sem quebra de página) com todas as seções
  // Detectar se as seções usam totalCusto/totalDespesa (CustoSetor) ou não (ApuracaoCusto)
  const hasCustoDesp = secoes.some(s => s.linhas.some(l => l.totalCusto !== undefined));
  const tableHead = hasCustoDesp
    ? [["Grupo / Subtotal", "Setor/Processo", "Total Custo (R$)", "Total Despesa (R$)", "Total Geral (R$)", "Custo/t (R$)", "%"]]
    : [["Grupo / Subtotal", "Setor/Processo", "Grupo", "Total Geral (R$)", "Custo/t (R$)", "%"]];

  // Montar body com todas as seções concatenadas
  const fullBody: any[] = [];
  const numCols = hasCustoDesp ? 7 : 6;
  for (const secao of secoes) {
    fullBody.push(
      [{ content: secao.titulo, colSpan: numCols, styles: { fillColor: secao.corCabecalho ?? [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 6 } }]
    );
    for (const linha of secao.linhas) {
      const isSpecial = linha.isSubtotal || linha.isTotal;
      if (hasCustoDesp) {
        fullBody.push([
          { content: isSpecial ? linha.conta : "", styles: isSpecial ? { fontStyle: "bold" } : {} },
          { content: isSpecial ? "" : linha.conta },
          { content: linha.totalCusto ?? "", styles: { halign: "right", fontStyle: isSpecial ? "bold" : "normal" } },
          { content: linha.totalDespesa ?? "", styles: { halign: "right", fontStyle: isSpecial ? "bold" : "normal" } },
          { content: linha.valor, styles: { halign: "right", fontStyle: isSpecial ? "bold" : "normal" } },
          { content: linha.custoPorTon ?? "", styles: { halign: "right" } },
          { content: linha.percentual ?? "", styles: { halign: "right", fontStyle: isSpecial ? "bold" : "normal" } },
        ]);
      } else {
        fullBody.push([
          { content: isSpecial ? linha.conta : "", styles: isSpecial ? { fontStyle: "bold" } : {} },
          { content: isSpecial ? "" : linha.conta },
          { content: linha.divisor ?? "" },
          { content: linha.valor, styles: { halign: "right", fontStyle: isSpecial ? "bold" : "normal" } },
          { content: linha.custoPorTon ?? "", styles: { halign: "right" } },
          { content: linha.percentual ?? "", styles: { halign: "right", fontStyle: isSpecial ? "bold" : "normal" } },
        ]);
      }
    }
  }

  autoTable(doc, {
    head: tableHead,
    body: fullBody,
    startY: curY,
    styles: { fontSize: 6, cellPadding: 0.8, overflow: "ellipsize" as const },
    headStyles: { fillColor: [15, 50, 120] as [number, number, number], textColor: 255 as number, fontStyle: "bold" as const, fontSize: 6 },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    columnStyles: hasCustoDesp ? {
      0: { cellWidth: 26 },
      1: { cellWidth: 44 },
      2: { cellWidth: 24, halign: "right" as const },
      3: { cellWidth: 24, halign: "right" as const },
      4: { cellWidth: 26, halign: "right" as const },
      5: { cellWidth: 14, halign: "right" as const },
      6: { cellWidth: 10, halign: "right" as const },
    } : {
      0: { cellWidth: 28 },
      1: { cellWidth: 52 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28, halign: "right" as const },
      4: { cellWidth: 18, halign: "right" as const },
      5: { cellWidth: 12, halign: "right" as const },
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data: any) => {
      const pc = doc.getNumberOfPages();
      doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150);
      doc.text(`Página ${data.pageNumber} de ${pc}`, pageWidth - 28, doc.internal.pageSize.getHeight() - 7);
      doc.text(SYSTEM_NAME_LINE1, 12, doc.internal.pageSize.getHeight() - 7);
    },
  });

  doc.save(`${filename}.pdf`);
}
