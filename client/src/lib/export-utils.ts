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

// Pre-load logo at module level so export functions can be synchronous
let _cachedLogoBase64: string | null = null;
(async () => {
  try {
    const response = await fetch(LOGO_CDN_URL);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => { _cachedLogoBase64 = reader.result as string; };
    reader.readAsDataURL(blob);
  } catch { /* ignore */ }
})();

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

  // Filter out hidden columns (width === 0) for Excel
  const xlsColumns = columns.filter(c => c.width !== 0);

  // Create header rows
  const headerRow = xlsColumns.map((col) => col.header);

  // Create data rows
  const dataRows = data.map((row) =>
    xlsColumns.map((col) => {
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
  ws["!cols"] = xlsColumns.map((col) => ({ wch: col.width || 18 }));

  // Merge header rows across all columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: xlsColumns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: xlsColumns.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: xlsColumns.length - 1 } },
  ];
  if (subtitle) {
    ws["!merges"].push({
      s: { r: 3, c: 0 },
      e: { r: 3, c: xlsColumns.length - 1 },
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

export function exportToPDF(options: ExportOptions) {
  const { title, subtitle, columns, data, filename } = options;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  // Use cached logo
  const logoBase64 = _cachedLogoBase64;

  // ── Logo (top-right) ─────────────────────────────────────────────────────
  // Original logo is roughly square (428×470 px). Reduced to ~60% of original size.
  const logoW = 17;
  const logoH = 18; // keep aspect ratio close to original
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
  // Filter out hidden columns (width === 0) for PDF
  const pdfColumns = columns.filter(c => c.width !== 0);
  const headers = pdfColumns.map((col) => col.header);
  const body = data.map((row) =>
    pdfColumns.map((col) => formatValue(row[col.key], col))
  );

  // Identificar linhas de "TOTAL GRUPO", "SUBTOTAL SETOR" e "_isNota" para destaque
  const totalGrupoRowIndices = new Set<number>();
  const subtotalSetorRowIndices = new Set<number>();
  const notaRowIndices = new Set<number>();
  const tipoColIndex = columns.findIndex(c => c.key === "tipo");
  if (tipoColIndex >= 0) {
    data.forEach((row, idx) => {
      if (row["tipo"] === "TOTAL GRUPO") {
        totalGrupoRowIndices.add(idx);
      } else if (row["tipo"] === "SUBTOTAL SETOR") {
        subtotalSetorRowIndices.add(idx);
      }
    });
  }
  // Detectar linhas de nota (flag _isNota)
  data.forEach((row, idx) => {
    if (row._isNota) {
      notaRowIndices.add(idx);
    }
  });

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
      if (hookData.section === "body") {
        if (totalGrupoRowIndices.has(hookData.row.index)) {
          hookData.cell.styles.fillColor = [254, 226, 226]; // red-100
          hookData.cell.styles.textColor = [153, 27, 27]; // red-800
          hookData.cell.styles.fontStyle = "bold";
        } else if (subtotalSetorRowIndices.has(hookData.row.index)) {
          hookData.cell.styles.fillColor = [219, 234, 254]; // blue-100
          hookData.cell.styles.textColor = [30, 64, 175]; // blue-800
          hookData.cell.styles.fontStyle = "bold";
        } else if (notaRowIndices.has(hookData.row.index)) {
          hookData.cell.styles.fillColor = [254, 226, 226]; // red-100
          hookData.cell.styles.textColor = [153, 27, 27]; // red-800
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fontSize = 11;
        }
      }
    },
    didDrawCell: (hookData: any) => {
      if (hookData.section === "body") {
        // Desenhar borda inferior vermelha grossa nas linhas de TOTAL GRUPO
        if (totalGrupoRowIndices.has(hookData.row.index)) {
          const cell = hookData.cell;
          doc.setDrawColor(185, 28, 28); // red-700
          doc.setLineWidth(0.8);
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
        // Desenhar borda inferior azul nas linhas de SUBTOTAL SETOR (separador entre subsetores)
        if (subtotalSetorRowIndices.has(hookData.row.index)) {
          const cell = hookData.cell;
          doc.setDrawColor(37, 99, 235); // blue-600
          doc.setLineWidth(0.6);
          doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
        }
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

  const pdfDataUri = doc.output('datauristring', { filename: `${filename}.pdf` });
  const pdfLink = document.createElement('a');
  pdfLink.href = pdfDataUri;
  pdfLink.download = `${filename}.pdf`;
  document.body.appendChild(pdfLink);
  pdfLink.click();
  document.body.removeChild(pdfLink);
}
// Helper formatterss
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

export interface DonutChartItem {
  name: string;
  value: number;
  pct: number;
  custoPorTon: number;
  fill: string;
}

export interface RelatorioExportOptions {
  titulo: string;
  periodo: string;
  empresa?: string;
  kpis: RelatorioKPI[];
  secoes: RelatorioSecao[];
  filename: string;
  /** Dados opcionais para gráficos donut em páginas extras */
  graficosDonut?: {
    planoContas?: DonutChartItem[];
    subsetor?: DonutChartItem[];
  };
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
export function exportRelatorioToPDF(opts: RelatorioExportOptions) {
  const { titulo, periodo, empresa, kpis, secoes, filename } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  // Logo (compacto, ~60% do tamanho original)
  const logoW = 12, logoH = 13;
  if (_cachedLogoBase64) {
    doc.addImage(_cachedLogoBase64, "PNG", pageWidth - logoW - 10, 5, logoW, logoH);
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

  // ── Páginas extras com gráficos donut ──────────────────────────────────────
  if (opts.graficosDonut) {
    if (opts.graficosDonut.planoContas && opts.graficosDonut.planoContas.length > 0) {
      drawDonutPage(doc, opts.graficosDonut.planoContas, "Distribuição por Plano de Contas", opts.periodo);
    }
    if (opts.graficosDonut.subsetor && opts.graficosDonut.subsetor.length > 0) {
      drawDonutPage(doc, opts.graficosDonut.subsetor, "Distribuição por Subsetor", opts.periodo);
    }
  }

  // Atualizar rodapé com total de páginas correto
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(255, 255, 255);
    doc.rect(0, doc.internal.pageSize.getHeight() - 12, pageWidth, 12, "F");
    doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 28, doc.internal.pageSize.getHeight() - 7);
    doc.text(SYSTEM_NAME_LINE1, 12, doc.internal.pageSize.getHeight() - 7);
  }

  const pdfDataUri2 = doc.output('datauristring', { filename: `${filename}.pdf` });
  const pdfLink2 = document.createElement('a');
  pdfLink2.href = pdfDataUri2;
  pdfLink2.download = `${filename}.pdf`;
  document.body.appendChild(pdfLink2);
  pdfLink2.click();
  document.body.removeChild(pdfLink2);
}
// ── Função auxiliar: desenhar página de gráfico donut ──────────────────────────
function drawDonutPage(
  doc: jsPDF,
  data: DonutChartItem[],
  titulo: string,
  periodo: string
) {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const _pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // Cabeçalho
  let curY = 12;
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 80, 160);
  doc.text(SYSTEM_NAME_LINE1, 10, curY); curY += 4;
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.text(SYSTEM_NAME_LINE2, 10, curY); curY += 5;

  doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
  doc.text(titulo, pageWidth / 2, curY, { align: "center" }); curY += 4;
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
  doc.text(`Período: ${periodo}`, pageWidth / 2, curY, { align: "center" }); curY += 8;

  // Parâmetros do donut
  const centerX = pageWidth / 2;
  const centerY = curY + 50;
  const outerRadius = 42;
  const innerRadius = 20;

  // Calcular total
  const total = data.reduce((s, d) => s + d.value, 0);

  // Desenhar fatias usando lines() do jsPDF (aproximação poligonal)
  let startAngle = -Math.PI / 2; // começar do topo

  for (const item of data) {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    if (sliceAngle < 0.001) { startAngle += sliceAngle; continue; } // pular fatias minúsculas

    const color = hexToRgb(item.fill);
    doc.setFillColor(color.r, color.g, color.b);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);

    // Criar path da fatia (arco externo + arco interno reverso)
    const segments = Math.max(16, Math.ceil(Math.abs(sliceAngle) / (Math.PI / 40)));
    const points: [number, number][] = [];

    // Arco externo (sentido horário)
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (sliceAngle * i) / segments;
      points.push([
        centerX + outerRadius * Math.cos(angle),
        centerY + outerRadius * Math.sin(angle),
      ]);
    }
    // Arco interno (sentido anti-horário)
    for (let i = segments; i >= 0; i--) {
      const angle = startAngle + (sliceAngle * i) / segments;
      points.push([
        centerX + innerRadius * Math.cos(angle),
        centerY + innerRadius * Math.sin(angle),
      ]);
    }

    // Desenhar o polígono usando lines()
    if (points.length > 1) {
      const linesArr = points.slice(1).map((p, idx) => [
        p[0] - points[idx][0],
        p[1] - points[idx][1],
      ]);
      doc.lines(linesArr, points[0][0], points[0][1], [1, 1], "FD", true);
    }

    startAngle += sliceAngle;
  }

  // Centro branco (buraco do donut)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(255, 255, 255);
  doc.circle(centerX, centerY, innerRadius, "F");

  // Rótulos de percentual nas fatias maiores (> 8%)
  let labelAngle = -Math.PI / 2;
  for (const item of data) {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const pct = (item.value / total) * 100;
    if (pct >= 8) {
      const midAngle = labelAngle + sliceAngle / 2;
      const labelRadius = (outerRadius + innerRadius) / 2;
      const lx = centerX + labelRadius * Math.cos(midAngle);
      const ly = centerY + labelRadius * Math.sin(midAngle);
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
      doc.text(`${fmtBR(pct)}%`, lx, ly + 1, { align: "center" });
    }
    labelAngle += sliceAngle;
  }

  // Texto central
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
  doc.text("Total", centerX, centerY - 2, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
  doc.text(`R$ ${fmtBR(total)}`, centerX, centerY + 3, { align: "center" });

  // ── Tabela de legenda abaixo do gráfico ────────────────────────────────────
  const tableStartY = centerY + outerRadius + 10;

  // Colunas: cor, nome, valor, R$/t, %
  const colWidths = [8, 62, 35, 25, 18];
  const tableX = 10;
  const rowH = 5.2;

  // Header
  doc.setFillColor(15, 50, 120);
  doc.rect(tableX, tableStartY, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
  doc.setFontSize(5.8); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  let hx = tableX;
  doc.text("", hx + 2, tableStartY + 3.5); hx += colWidths[0];
  doc.text("Conta / Subsetor", hx + 2, tableStartY + 3.5); hx += colWidths[1];
  doc.text("Valor Total (R$)", hx + 2, tableStartY + 3.5); hx += colWidths[2];
  doc.text("R$/t", hx + 2, tableStartY + 3.5); hx += colWidths[3];
  doc.text("%", hx + 2, tableStartY + 3.5);

  // Linhas de dados
  let rowY = tableStartY + rowH;
  const maxRows = Math.min(data.length, 28); // limitar para caber na página
  for (let i = 0; i < maxRows; i++) {
    const item = data[i];
    const isAlt = i % 2 === 0;

    if (isAlt) {
      doc.setFillColor(248, 250, 252);
      doc.rect(tableX, rowY, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
    }

    // Quadrado de cor
    const color = hexToRgb(item.fill);
    doc.setFillColor(color.r, color.g, color.b);
    doc.rect(tableX + 2, rowY + 1.3, 3, 2.8, "F");

    // Textos
    doc.setFontSize(5.5); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 30, 30);
    let cx = tableX + colWidths[0];
    const nameText = item.name.length > 34 ? item.name.substring(0, 32) + "..." : item.name;
    doc.text(nameText, cx + 2, rowY + 3.5); cx += colWidths[1];
    doc.text(`R$ ${fmtBR(item.value)}`, cx + 2, rowY + 3.5); cx += colWidths[2];
    doc.text(item.custoPorTon > 0 ? `R$ ${fmtBR(item.custoPorTon)}` : "-", cx + 2, rowY + 3.5); cx += colWidths[3];
    doc.text(`${fmtBR(item.pct)}%`, cx + 2, rowY + 3.5);

    rowY += rowH;
  }

  // Linha de total
  doc.setFillColor(220, 230, 245);
  doc.rect(tableX, rowY, colWidths.reduce((a, b) => a + b, 0), rowH, "F");
  doc.setFontSize(5.8); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 50, 120);
  let tx = tableX + colWidths[0];
  doc.text("TOTAL", tx + 2, rowY + 3.5); tx += colWidths[1];
  doc.text(`R$ ${fmtBR(total)}`, tx + 2, rowY + 3.5); tx += colWidths[2];
  doc.text("", tx + 2, rowY + 3.5); tx += colWidths[3];
  doc.text("100,00%", tx + 2, rowY + 3.5);
}

// ── Helpers para gráficos donut ──────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 100, g: 100, b: 100 };
}

function fmtBR(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


// ─────────────────────────────────────────────────────────────────────────────
// Impressão (window.print) com cabeçalho padronizado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre uma janela de impressão com o mesmo formato dos relatórios exportados.
 * Usa ExportOptions (mesmo formato do Excel/PDF genérico).
 */
export function printData(options: ExportOptions) {
  const { title, subtitle, columns, data } = options;
  const now = new Date();
  const timestamp = `Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`;

  // Filter out hidden columns (width === 0) for print
  const visibleColumns = columns.filter(c => c.width !== 0);
  const rows = data
    .map(
      (row) =>
        `<tr>${visibleColumns
          .map((col) => {
            const val = col.format ? col.format(row[col.key]) : (row[col.key] ?? "");
            const isTotalGrupo = row["tipo"] === "TOTAL GRUPO";
            const isSubtotalSetor = row["tipo"] === "SUBTOTAL SETOR";
            const style = isTotalGrupo
              ? 'style="background:#fee2e2;color:#991b1b;font-weight:bold;border-bottom:2px solid #b91c1c"'
              : isSubtotalSetor
              ? 'style="background:#dbeafe;color:#1e40af;font-weight:bold;border-bottom:2px solid #2563eb"'
              : "";
            return `<td ${style}>${val}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .header-left { flex: 1; }
    .system-name { font-size: 12px; font-weight: bold; color: #1e50a0; }
    .empresa { font-size: 10px; color: #3c3c3c; margin-top: 2px; }
    .titulo { font-size: 16px; font-weight: bold; color: #000; margin-top: 4px; }
    .subtitulo { font-size: 11px; color: #333; margin-top: 2px; }
    .timestamp { font-size: 8px; color: #666; font-style: italic; margin-top: 2px; }
    .logo { width: 60px; height: auto; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #2980b3; color: #fff; font-weight: bold; font-size: 9px; padding: 4px 6px; text-align: left; }
    td { padding: 3px 6px; font-size: 9px; border-bottom: 1px solid #e5e5e5; }
    tr:nth-child(even) td { background: #f5f5f5; }
    .footer { margin-top: 8px; font-size: 8px; color: #666; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="system-name">${SYSTEM_NAME_LINE1}</div>
      <div class="empresa">${SYSTEM_NAME_LINE2}</div>
      <div class="titulo">${title}</div>
      ${subtitle ? `<div class="subtitulo">${subtitle}</div>` : ""}
      <div class="timestamp">${timestamp}</div>
    </div>
    <img src="${LOGO_CDN_URL}" class="logo" crossorigin="anonymous" />
  </div>
  <table>
    <thead><tr>${visibleColumns.map((c) => `<th>${c.header}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">${SYSTEM_NAME_LINE1}</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  // Wait for logo to load before printing
  const img = printWindow.document.querySelector("img");
  if (img && !img.complete) {
    img.onload = () => { printWindow.print(); };
    img.onerror = () => { printWindow.print(); };
  } else {
    setTimeout(() => printWindow.print(), 300);
  }
}

// ── Multi-table export (consolidated) ─────────────────────────────────────────

export interface MultiTableSection {
  title: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
}

export interface MultiTableExportOptions {
  reportTitle: string;
  subtitle?: string;
  filename: string;
  sections: MultiTableSection[];
  chartImageBase64?: string;
  chartTitle?: string;
}

export function exportMultiTableToExcel(opts: MultiTableExportOptions) {
  const { reportTitle, subtitle, filename, sections } = opts;
  const wsData: any[][] = [];
  const merges: any[] = [];

  // Find max columns across all sections for merging header
  const maxCols = Math.max(...sections.map(s => s.columns.length), 1);

  // Header
  wsData.push([SYSTEM_NAME_LINE1]);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } });
  wsData.push([SYSTEM_NAME_LINE2]);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } });
  wsData.push([reportTitle]);
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: maxCols - 1 } });
  if (subtitle) {
    wsData.push([subtitle]);
    merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: maxCols - 1 } });
  }
  wsData.push([`Gerado em: ${new Date().toLocaleDateString("pt-BR")} as ${new Date().toLocaleTimeString("pt-BR")}`]);
  merges.push({ s: { r: wsData.length - 1, c: 0 }, e: { r: wsData.length - 1, c: maxCols - 1 } });
  wsData.push([]); // blank

  for (const section of sections) {
    // Section title
    const titleRow = wsData.length;
    wsData.push([section.title]);
    merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: section.columns.length - 1 } });
    // Column headers
    wsData.push(section.columns.map(c => c.header));
    // Data rows
    for (const row of section.data) {
      wsData.push(section.columns.map(col => {
        const raw = row[col.key];
        if (col.format) return col.format(raw);
        return raw ?? "";
      }));
    }
    wsData.push([]); // blank between sections
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!merges"] = merges;
  ws["!cols"] = Array.from({ length: maxCols }, () => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Comparativo Consolidado");
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `${filename}.xlsx`);
}

export function exportMultiTableToPDF(opts: MultiTableExportOptions) {
  const { reportTitle, subtitle, filename, sections } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const logoW = 17, logoH = 18;
  if (_cachedLogoBase64) {
    doc.addImage(_cachedLogoBase64, "PNG", pageWidth - logoW - 10, 6, logoW, logoH);
  }

  let curY = 12;
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 80, 160);
  doc.text(SYSTEM_NAME_LINE1, 14, curY); curY += 6;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
  doc.text(SYSTEM_NAME_LINE2, 14, curY); curY += 7;
  doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
  doc.text(reportTitle, 14, curY); curY += 6;
  if (subtitle) {
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, curY); curY += 6;
  }
  doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(100, 100, 100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} as ${new Date().toLocaleTimeString("pt-BR")}`, 14, curY);
  curY += 8;

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];

    // Section title
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 60, 120);
    doc.text(section.title, 14, curY); curY += 5;

    const headers = section.columns.map(c => c.header);
    const body = section.data.map(row => section.columns.map(col => {
      const raw = row[col.key];
      if (col.format) return col.format(raw);
      return raw ?? "";
    }));

    autoTable(doc, {
      head: [headers],
      body,
      startY: curY,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
      didDrawPage: (data: any) => {
        const pc = doc.getNumberOfPages();
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
        doc.text(`Pagina ${data.pageNumber} de ${pc}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
      },
    });

    curY = (doc as any).lastAutoTable.finalY + 10;

    // If not last section and not enough space, add new page
    if (si < sections.length - 1 && curY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      curY = 20;
    }
  }

  // Add chart image if provided
  if (opts.chartImageBase64) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const chartW = pageWidth - 28;
    const chartH = 70;
    if (curY + chartH + 15 > pageHeight - 15) {
      doc.addPage();
      curY = 20;
    }
    if (opts.chartTitle) {
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 60, 120);
      doc.text(opts.chartTitle, 14, curY); curY += 6;
    }
    doc.addImage(opts.chartImageBase64, "PNG", 14, curY, chartW, chartH);
    curY += chartH + 10;
  }

  const pdfDataUri3 = doc.output('datauristring', { filename: `${filename}.pdf` });
  const pdfLink3 = document.createElement('a');
  pdfLink3.href = pdfDataUri3;
  pdfLink3.download = `${filename}.pdf`;
  document.body.appendChild(pdfLink3);
  pdfLink3.click();
  document.body.removeChild(pdfLink3);
}

export function printMultiTable(opts: MultiTableExportOptions) {
  const { reportTitle, subtitle, sections } = opts;
  const now = new Date();
  const timestamp = `Gerado em: ${now.toLocaleDateString("pt-BR")} as ${now.toLocaleTimeString("pt-BR")}`;

  const sectionsHtml = sections.map(section => {
    const headersHtml = section.columns.map(c => `<th>${c.header}</th>`).join("");
    const rowsHtml = section.data.map(row =>
      `<tr>${section.columns.map(col => {
        const raw = row[col.key];
        const val = col.format ? col.format(raw) : (raw ?? "");
        return `<td>${val}</td>`;
      }).join("")}</tr>`
    ).join("");
    return `
      <h3 style="margin-top:16px;margin-bottom:4px;color:#1e3c78;font-size:12px;">${section.title}</h3>
      <table>
        <thead><tr>${headersHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
  <style>
    @page { size: landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .header-left { flex: 1; }
    .system-name { font-size: 12px; font-weight: bold; color: #1e50a0; }
    .empresa { font-size: 10px; color: #3c3c3c; margin-top: 2px; }
    .titulo { font-size: 16px; font-weight: bold; color: #000; margin-top: 4px; }
    .subtitulo { font-size: 11px; color: #333; margin-top: 2px; }
    .timestamp { font-size: 8px; color: #666; font-style: italic; margin-top: 2px; }
    .logo { width: 60px; height: auto; }
    h3 { page-break-after: avoid; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 12px; }
    th { background: #2980b3; color: #fff; font-weight: bold; font-size: 9px; padding: 4px 6px; text-align: left; }
    td { padding: 3px 6px; font-size: 9px; border-bottom: 1px solid #e5e5e5; }
    tr:nth-child(even) td { background: #f5f5f5; }
    .footer { margin-top: 8px; font-size: 8px; color: #666; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="system-name">${SYSTEM_NAME_LINE1}</div>
      <div class="empresa">${SYSTEM_NAME_LINE2}</div>
      <div class="titulo">${reportTitle}</div>
      ${subtitle ? `<div class="subtitulo">${subtitle}</div>` : ""}
      <div class="timestamp">${timestamp}</div>
    </div>
    <img src="${LOGO_CDN_URL}" class="logo" crossorigin="anonymous" />
  </div>
  ${sectionsHtml}
  ${opts.chartImageBase64 ? `
    <h3 style="margin-top:16px;margin-bottom:4px;color:#1e3c78;font-size:12px;">${opts.chartTitle || "Gr\u00e1fico"}</h3>
    <img src="${opts.chartImageBase64}" style="width:100%;max-height:250px;object-fit:contain;" />
  ` : ""}
  <div class="footer">${SYSTEM_NAME_LINE1}</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  const img = printWindow.document.querySelector("img");
  if (img && !img.complete) {
    img.onload = () => { printWindow.print(); };
    img.onerror = () => { printWindow.print(); };
  } else {
    setTimeout(() => printWindow.print(), 300);
  }
}

/**
 * Impressão do relatório de Apuração de Custo (multi-seção com KPIs).
 * Usa RelatorioExportOptions (mesmo formato do PDF/Excel do relatório).
 */
export function printRelatorio(opts: RelatorioExportOptions) {
  const { titulo, periodo, empresa, kpis, secoes } = opts;
  const now = new Date();
  const timestamp = `Gerado em: ${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`;

  // Build KPI cards HTML
  const kpiHtml = kpis
    .map(
      (k) =>
        `<div class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div>`
    )
    .join("");

  // Build sections HTML
  const secoesHtml = secoes
    .map((secao) => {
      const cor = secao.corCabecalho || [41, 128, 185];
      const linhasHtml = secao.linhas
        .map((l) => {
          const isHighlight = l.isSubtotal || l.isTotal;
          const bgStyle = isHighlight ? "background:#f0f0f0;font-weight:bold;" : "";
          return `<tr style="${bgStyle}">
            <td>${l.conta}</td>
            <td>${l.divisor || ""}</td>
            <td style="text-align:right">${l.valor}</td>
            <td style="text-align:right">${l.custoPorTon || ""}</td>
            <td style="text-align:right">${l.percentual || ""}</td>
          </tr>`;
        })
        .join("");
      return `
        <tr><td colspan="5" style="background:rgb(${cor.join(",")});color:#fff;font-weight:bold;padding:5px 8px;">${secao.titulo}</td></tr>
        ${linhasHtml}`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    @page { size: landscape; margin: 10mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .header-left { flex: 1; }
    .system-name { font-size: 12px; font-weight: bold; color: #1e50a0; }
    .empresa { font-size: 10px; color: #3c3c3c; margin-top: 2px; }
    .titulo { font-size: 16px; font-weight: bold; color: #000; margin-top: 4px; }
    .subtitulo { font-size: 11px; color: #333; margin-top: 2px; }
    .timestamp { font-size: 8px; color: #666; font-style: italic; margin-top: 2px; }
    .logo { width: 60px; height: auto; }
    .kpis { display: flex; gap: 10px; margin: 8px 0; flex-wrap: wrap; }
    .kpi { border: 1px solid #ddd; border-radius: 4px; padding: 6px 10px; min-width: 120px; }
    .kpi-label { font-size: 8px; color: #666; }
    .kpi-value { font-size: 12px; font-weight: bold; color: #1e50a0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #2980b3; color: #fff; font-weight: bold; font-size: 9px; padding: 4px 6px; text-align: left; }
    td { padding: 3px 6px; font-size: 9px; border-bottom: 1px solid #e5e5e5; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 8px; font-size: 8px; color: #666; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="system-name">${SYSTEM_NAME_LINE1}</div>
      <div class="empresa">${empresa || SYSTEM_NAME_LINE2}</div>
      <div class="titulo">${titulo}</div>
      <div class="subtitulo">Período: ${periodo}</div>
      <div class="timestamp">${timestamp}</div>
    </div>
    <img src="${LOGO_CDN_URL}" class="logo" crossorigin="anonymous" />
  </div>
  <div class="kpis">${kpiHtml}</div>
  <table>
    <thead>
      <tr>
        <th>Grupo / Subtotal</th>
        <th>Setor/Processo</th>
        <th style="text-align:right">Total Geral (R$)</th>
        <th style="text-align:right">Custo/t (R$)</th>
        <th style="text-align:right">%</th>
      </tr>
    </thead>
    <tbody>${secoesHtml}</tbody>
  </table>
  <div class="footer">${SYSTEM_NAME_LINE1}</div>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  const img = printWindow.document.querySelector("img");
  if (img && !img.complete) {
    img.onload = () => { printWindow.print(); };
    img.onerror = () => { printWindow.print(); };
  } else {
    setTimeout(() => printWindow.print(), 300);
  }
}
