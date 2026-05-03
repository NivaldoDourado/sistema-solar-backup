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

  // Colunas da tabela
  const headerRow = wsData.length;
  wsData.push(["Grupo / Conta", "Conta de Custo", "Divisor", "Valor (R$)", "Custo/t (R$)"]);

  // Seções
  for (const secao of secoes) {
    // Título da seção
    const secaoRow = wsData.length;
    wsData.push([secao.titulo, "", "", "", ""]);
    merges.push({ s: { r: secaoRow, c: 0 }, e: { r: secaoRow, c: COL_COUNT - 1 } });

    for (const linha of secao.linhas) {
      wsData.push([
        linha.isSubtotal || linha.isTotal ? linha.conta : "",
        linha.isSubtotal || linha.isTotal ? "" : linha.conta,
        linha.divisor ?? "",
        linha.valor,
        linha.custoPorTon ?? "",
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 18 }];
  ws["!merges"] = merges;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
}

// ── PDF ───────────────────────────────────────────────────────────────────────
export async function exportRelatorioToPDF(opts: RelatorioExportOptions) {
  const { titulo, periodo, empresa, kpis, secoes, filename } = opts;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Logo
  const logoBase64 = await loadImageAsBase64(LOGO_CDN_URL);
  const logoW = 28, logoH = 30;
  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", pageWidth - logoW - 10, 6, logoW, logoH);
  }

  // Cabeçalho textual
  let curY = 12;
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 80, 160);
  doc.text(SYSTEM_NAME_LINE1, 14, curY); curY += 6;

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.text(empresa ?? SYSTEM_NAME_LINE2, 14, curY); curY += 5;

  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
  doc.text(titulo, 14, curY); curY += 6;

  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.text(`Período: ${periodo}`, 14, curY); curY += 5;

  doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 14, curY);
  curY += 7;

  // KPIs em linha horizontal
  if (kpis.length > 0) {
    const kpiW = (pageWidth - 28) / kpis.length;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
    kpis.forEach((kpi, i) => {
      const x = 14 + i * kpiW;
      doc.setFillColor(240, 245, 255);
      doc.roundedRect(x, curY, kpiW - 3, 10, 2, 2, "F");
      doc.setFontSize(7); doc.setTextColor(100, 100, 100);
      doc.text(kpi.label, x + 2, curY + 3.5);
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 80, 160);
      doc.text(kpi.value, x + 2, curY + 8);
      doc.setFont("helvetica", "normal");
    });
    curY += 14;
  }

  // Tabela principal com seções
  const tableBody: any[] = [];
  const sectionHeaderRows: number[] = [];

  for (const secao of secoes) {
    sectionHeaderRows.push(tableBody.length);
    tableBody.push([{ content: secao.titulo, colSpan: 5, styles: { fillColor: secao.corCabecalho ?? [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 8 } }]);

    for (const linha of secao.linhas) {
      const isSpecial = linha.isSubtotal || linha.isTotal;
      tableBody.push([
        { content: isSpecial ? linha.conta : "", styles: isSpecial ? { fontStyle: "bold" } : {} },
        { content: isSpecial ? "" : linha.conta },
        { content: linha.divisor ?? "" },
        { content: linha.valor, styles: { halign: "right", fontStyle: isSpecial ? "bold" : "normal" } },
        { content: linha.custoPorTon ?? "", styles: { halign: "right" } },
      ]);
    }
  }

  autoTable(doc, {
    head: [["Grupo", "Conta de Custo", "Divisor", "Valor (R$)", "Custo/t (R$)"]],
    body: tableBody,
    startY: curY,
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 50, 120], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 60 },
      2: { cellWidth: 20 },
      3: { cellWidth: 35, halign: "right" },
      4: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      const pc = doc.getNumberOfPages();
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150);
      doc.text(`Página ${data.pageNumber} de ${pc}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 8);
      doc.text(SYSTEM_NAME_LINE1, 14, doc.internal.pageSize.getHeight() - 8);
    },
  });

  doc.save(`${filename}.pdf`);
}
