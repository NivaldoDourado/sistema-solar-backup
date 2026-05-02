/**
 * Importador da aba RSSET da planilha CUSTOSOLAR
 * Lê os custos por setor/subsetor e faz upsert na tabela custo_setor
 *
 * Estrutura da aba RSSET:
 *   Col A: Grupo (DESMONTE DE ROCHA, BRITAGEM, etc.) — só aparece na primeira linha do grupo
 *   Col B: Subsetor (DECAPEAMENTO, DESMONTE PRIMÁRIO, etc.)
 *   Col E: Custo Fixo
 *   Col F: Custo Variável
 *   Col G: Total Custo
 *   Col H: Despesa Fixa
 *   Col I: Despesa Variável
 *   Col J: Total Despesa
 *   Col K: Total Geral
 *   Col L: Custo/t (R$/ton)
 */

import * as XLSX from "xlsx";
import { getDb } from "./db";
import { custoSetor, periodoCusto } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Subsetores a ignorar (linhas de subtotal, total, etc.)
const SUBSETORES_IGNORAR = new Set([
  "SUB-TOTAL",
  "TOTAL DOS DESEMBOLSOS",
  "SUBTOTAL DOS CUSTOS E DESPESAS",
]);

// Grupos a ignorar (linhas de despesas indiretas, totais gerais)
const GRUPOS_IGNORAR = new Set([
  "DESPESAS  INDIRETAS (VALOR/CUS",
  "TOTAL DOS GASTOS COM AS DESPES",
]);

// Ordem de exibição dos grupos
const ORDEM_GRUPOS: Record<string, number> = {
  "DESMONTE DE ROCHA": 1,
  "CARGA E TRANSPORTE": 2,
  "BRITAGEM": 3,
  "EXPEDIÇÃO": 4,
  "SERVIÇOS AUXILIARES": 5,
  "ADMINISTRAÇÃO": 6,
};

// Ordem de exibição dos subsetores dentro do grupo
const ORDEM_SUBSETORES: Record<string, number> = {
  "DECAPEAMENTO": 1,
  "DESMONTE PRIMÁRIO": 2,
  "DESMONTE SECUNDÁRIO": 3,
  "PEDRA PARA BRITADOR": 1,
  "BRITAGEM PRIMÁRIA": 1,
  "BRITAGEM SEC./TERC./QUART.": 2,
  "EXPEDIÇÃO": 1,
  "MOV. DE ESTOQUE": 2,
  "OFICINA E ALMOXARIFADO": 1,
  "REFEITÓRIO E LIMPEZA": 2,
  "OUTROS SERVIÇOS": 3,
  "ADMINISTRAÇÃO": 1,
};

function toNum(val: any): number {
  if (val === null || val === undefined || val === "" || val === "#REF!") return 0;
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

export interface ImportacaoCustoSetorResult {
  periodoCustoId: number;
  mes: number;
  ano: number;
  subsetoresImportados: number;
  criados: number;
  atualizados: number;
  erros: string[];
}

export async function importarCustoSetor(
  buffer: Buffer,
  userId: number
): Promise<ImportacaoCustoSetorResult> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  // Ler planilha
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = workbook.Sheets["RSSET"];
  if (!ws) throw new Error("Aba RSSET não encontrada na planilha");

  // Converter para array de arrays
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

  // Extrair período da célula K1 (índice [0][10])
  const dataCelula = rows[0]?.[10];
  let mes = 0;
  let ano = 0;
  if (dataCelula) {
    const d = new Date(dataCelula);
    if (!isNaN(d.getTime())) {
      mes = d.getMonth() + 1;
      ano = d.getFullYear();
    }
  }

  if (!mes || !ano) throw new Error("Não foi possível extrair o período da aba RSSET (célula K1)");

  // Buscar ou criar o período de custo
  const [periodoExistente] = await db
    .select({ id: periodoCusto.id })
    .from(periodoCusto)
    .where(and(eq(periodoCusto.mes, mes), eq(periodoCusto.ano, ano)))
    .limit(1);

  if (!periodoExistente) {
    throw new Error(
      `Período ${mes}/${ano} não encontrado. Crie o período em Lançamento de Custos antes de importar.`
    );
  }
  const periodoCustoId = periodoExistente.id;

  // Ler linhas da planilha
  const erros: string[] = [];
  let criados = 0;
  let atualizados = 0;
  let grupoAtual = "";

  // Linha 6 = índice 5 (0-based)
  for (let rowIdx = 5; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const colA = row[0]; // Grupo
    const colB = row[1]; // Subsetor
    const colE = row[4]; // Custo Fixo
    const colF = row[5]; // Custo Variável
    const colG = row[6]; // Total Custo
    const colH = row[7]; // Despesa Fixa
    const colI = row[8]; // Despesa Variável
    const colJ = row[9]; // Total Despesa
    const colK = row[10]; // Total Geral
    const colL = row[11]; // Custo/t

    const grupoStr = colA ? String(colA).trim() : "";
    const subsetorStr = colB ? String(colB).trim() : "";

    // Atualizar grupo atual se a coluna A tem valor
    if (grupoStr && !GRUPOS_IGNORAR.has(grupoStr)) {
      grupoAtual = grupoStr;
    }

    // Pular linhas sem subsetor, de subtotal ou grupos a ignorar
    if (!subsetorStr) continue;
    if (SUBSETORES_IGNORAR.has(subsetorStr)) continue;
    if (GRUPOS_IGNORAR.has(grupoAtual)) continue;
    // Parar ao chegar nas linhas de totais finais
    if (subsetorStr === "TOTAL DOS DESEMBOLSOS") break;

    const custoFixo = toNum(colE);
    const custoVariavel = toNum(colF);
    const totalCusto = toNum(colG);
    const despesaFixa = toNum(colH);
    const despesaVariavel = toNum(colI);
    const totalDespesa = toNum(colJ);
    const totalGeral = toNum(colK);
    const custoTon = toNum(colL);

    // Calcular percentual em relação ao total (será recalculado no frontend)
    const ordemGrupo = ORDEM_GRUPOS[grupoAtual] ?? 99;
    const ordemSubsetor = ORDEM_SUBSETORES[subsetorStr] ?? 99;
    const ordemExibicao = ordemGrupo * 100 + ordemSubsetor;

    try {
      // Verificar se já existe
      const [existing] = await db
        .select({ id: custoSetor.id })
        .from(custoSetor)
        .where(
          and(
            eq(custoSetor.periodoCustoId, periodoCustoId),
            eq(custoSetor.subsetorNome, subsetorStr)
          )
        )
        .limit(1);

      const data = {
        periodoCustoId,
        grupoNome: grupoAtual,
        subsetorNome: subsetorStr,
        setorId: null,
        custoFixo: custoFixo.toFixed(2),
        custoVariavel: custoVariavel.toFixed(2),
        totalCusto: totalCusto.toFixed(2),
        despesaFixa: despesaFixa.toFixed(2),
        despesaVariavel: despesaVariavel.toFixed(2),
        totalDespesa: totalDespesa.toFixed(2),
        totalGeral: totalGeral.toFixed(2),
        custoTon: custoTon.toFixed(4),
        percentualTotal: "0.0000",
        ordemExibicao,
        userId,
      };

      if (existing) {
        await db.update(custoSetor).set(data).where(eq(custoSetor.id, existing.id));
        atualizados++;
      } else {
        await db.insert(custoSetor).values(data);
        criados++;
      }
    } catch (err: any) {
      erros.push(`Erro ao importar subsetor "${subsetorStr}": ${err.message}`);
    }
  }

  return {
    periodoCustoId,
    mes,
    ano,
    subsetoresImportados: criados + atualizados,
    criados,
    atualizados,
    erros,
  };
}

// ============================================================
// Rota Express para upload da planilha RSSET
// ============================================================
import { Router } from "express";
import multer from "multer";
import { sdk } from "./_core/sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export function registerImportacaoCustoSetorRoute(app: any) {
  const router = Router();

  router.post("/api/importacao-custo-setor", upload.single("file"), async (req: any, res: any) => {
    try {
      // Verificar autenticação
      let currentUser: any = null;
      try {
        currentUser = await sdk.authenticateRequest(req as any);
      } catch (_e) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      if (!currentUser?.id) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const result = await importarCustoSetor(req.file.buffer, currentUser.id);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[importacao-custo-setor] Erro:", err);
      return res.status(500).json({ error: err.message || "Erro interno ao importar planilha" });
    }
  });

  app.use(router);
}
