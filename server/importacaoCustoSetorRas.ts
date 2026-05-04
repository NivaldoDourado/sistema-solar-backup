/**
 * Importador das abas MEM e MSET da planilha CUSTOSOLAR
 *
 * Fonte primária de dados analíticos:
 *   MEM  → custo_setor_equipamento (equipamentos com custo rateado por setor)
 *   MSET → custo_setor_despesa     (despesas específicas de cada setor)
 *
 * Estrutura da aba MEM:
 *   Cada equipamento tem um bloco de linhas onde:
 *   - col 1 = nome do equipamento (aparece na primeira linha do bloco)
 *   - col 2 = tipo de despesa (Salário do Operador, Combustível, etc.)
 *   - col 4 = valor total da despesa
 *   - col 11-22 = valor da despesa rateado por setor
 *   - Linha "Total das Despesas do Equipame": col 4 = total geral, col 11-22 = total por setor
 *
 * Estrutura da aba MSET:
 *   Blocos de 14 linhas com 2 setores por bloco (lado esquerdo e direito).
 *   Linha de cabeçalho do bloco: col 1 = setor esquerdo, col 4 = setor direito
 *   Linha "DESCRIÇÃO / VALOR": col 2 = "VALOR", col 5 = "VALOR"
 *   Linhas de contas: col 1 = descrição, col 2 = valor; col 4 = descrição, col 5 = valor
 */

import * as XLSX from "xlsx";
import { getDb } from "./db";
import {
  custoSetorEquipamento,
  custoSetorDespesa,
  periodoCusto,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Mapeamento de colunas 11-22 da MEM para setores ─────────────────────────
const COL_SETOR_MAP: Record<number, { subsetor: string; grupo: string }> = {
  11: { subsetor: "DESMONTE PRIMÁRIO",          grupo: "DESMONTE DE ROCHA"   },
  12: { subsetor: "DESMONTE SECUNDÁRIO",         grupo: "DESMONTE DE ROCHA"   },
  13: { subsetor: "BRITAGEM PRIMÁRIA",           grupo: "BRITAGEM"            },
  14: { subsetor: "BRITAGEM SEC./TERC./QUART.",  grupo: "BRITAGEM"            },
  15: { subsetor: "OUTROS SERVIÇOS",             grupo: "APOIO À PRODUÇÃO"    },
  16: { subsetor: "PEDRA PARA BRITADOR",         grupo: "PEDRA PARA BRITADOR" },
  17: { subsetor: "MOV. DE ESTOQUE",             grupo: "APOIO À PRODUÇÃO"    },
  18: { subsetor: "DECAPEAMENTO",                grupo: "DESMONTE DE ROCHA"   },
  19: { subsetor: "EXPEDIÇÃO",                   grupo: "EXPEDIÇÃO"           },
  20: { subsetor: "ADMINISTRAÇÃO",               grupo: "ADMINISTRAÇÃO"       },
  21: { subsetor: "OFICINA E ALMOXARIFADO",      grupo: "SERVIÇOS AUXILIARES" },
  22: { subsetor: "REFEITÓRIO E LIMPEZA",        grupo: "SERVIÇOS AUXILIARES" },
};

// ─── Mapeamento de tipo de despesa (col 2 da MEM) para campo do banco ─────────
const CONTA_MAP_MEM: Record<string, string> = {
  "Salário do Operador":               "salOperEncOper",
  "Sal.Oper./Enc. Oper.":              "salOperEncOper",
  "Sal. Oper./Enc. Oper.":             "salOperEncOper",
  "Depreciação":                       "depreciacao",
  "Depreciacao":                       "depreciacao",
  "Combustível (Critério 1)":          "combustivel",
  "Combustível":                       "combustivel",
  "Lubrificantes":                     "lubrificantes",
  "Peças de Desgaste":                 "pecasDesgaste",
  "Peças de Repos./Item de Cons.":     "pecasReposicao",
  "Peças de Reposição/Item de Consumo": "pecasReposicao",
  "Peças de Reposição":                "pecasReposicao",
  "Outras Despesas":                   "outrasDespesas",
  "Outras Despesas (Serviços, etc)":   "outrasDespesas",
};

// ─── Mapeamento de setores MSET para grupos ───────────────────────────────────
const MSET_GRUPO_MAP: Record<string, string> = {
  "DESMONTE PRIMÁRIO":          "DESMONTE DE ROCHA",
  "DESMONTE SECUNDÁRIO":        "DESMONTE DE ROCHA",
  "DECAPEAMENTO":               "DESMONTE DE ROCHA",
  "BRITAGEM PRIMÁRIA":          "BRITAGEM",
  "BRITAGEM SEC./TERC./QUART.": "BRITAGEM",
  "PEDRA PARA BRITADOR":        "PEDRA PARA BRITADOR",
  "EXPEDIÇÃO":                  "EXPEDIÇÃO",
  "MOV. DE ESTOQUE":            "EXPEDIÇÃO",
  "OFICINA E ALMOXARIFADO":     "SERVIÇOS AUXILIARES",
  "REFEITÓRIO E LIMPEZA":       "SERVIÇOS AUXILIARES",
  "OUTROS SERVIÇOS":            "SERVIÇOS AUXILIARES",
  "APOIO GERAL":                "SERVIÇOS AUXILIARES",
  "ADMINISTRAÇÃO":              "ADMINISTRAÇÃO",
};

// Todos os nomes de setores válidos na MSET
const MSET_SETORES_VALIDOS = new Set(Object.keys(MSET_GRUPO_MAP));

// Linhas a ignorar na MSET
const MSET_SKIP = new Set([
  "DESCRIÇÃO / VALOR",
  "TOTAL DAS DESPESAS",
  "TOTAL",
  "",
]);

function toNum(val: any): number {
  if (val === null || val === undefined || val === "" || val === "#REF!" || val === "#N/A") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const s = String(val).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function strVal(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// ─── Parser da aba MEM ────────────────────────────────────────────────────────
interface EquipamentoMem {
  equipamentoNome: string;
  subsetorNome: string;
  grupoNome: string;
  salOperEncOper: number;
  depreciacao: number;
  combustivel: number;
  lubrificantes: number;
  pecasDesgaste: number;
  pecasReposicao: number;
  outrasDespesas: number;
  totalDespesasEquipamento: number;
  horasTrabalhadas: number;
  producaoTotal: number;
  unidadeProducao: string;
}

function parseAbaMem(ws: XLSX.WorkSheet): EquipamentoMem[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  const result: EquipamentoMem[] = [];

  let equipAtual: string | null = null;
  let blocoLinhas: any[][] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const col1 = strVal(row[1]);
    const col2 = strVal(row[2]);
    const col4 = toNum(row[4]);

    // Linha de total do equipamento
    if (col2.startsWith("Total das Despesas")) {
      if (equipAtual && col4 > 0) {
        const totalGeral = col4;
        const totalRow = row;

        // Extrair custos por tipo de despesa
        const custosPorTipo: Record<string, number> = {};
        let producao = 0;
        let unidadeProducao = "ton";
        let horasTrabalhadas = 0;

        for (const bRow of blocoLinhas) {
          const bCol2 = strVal(bRow[2]);
          const bCol4 = toNum(bRow[4]);

          if (bCol2.startsWith("Produção Total")) {
            producao = bCol4;
            if (bRow[5] && strVal(bRow[5])) unidadeProducao = strVal(bRow[5]);
            else if (bRow[3] && strVal(bRow[3])) unidadeProducao = strVal(bRow[3]);
          } else if (bCol2 && !bCol2.startsWith("Total") && bCol4 > 0) {
            const campo = CONTA_MAP_MEM[bCol2];
            if (campo) custosPorTipo[campo] = (custosPorTipo[campo] || 0) + bCol4;
          }

          // Horas trabalhadas: col 7 da primeira linha do bloco
          if (bRow === blocoLinhas[0] && toNum(bRow[7]) > 0) {
            horasTrabalhadas = toNum(bRow[7]);
          }
        }

        // Para cada setor (colunas 11-22), criar um registro se houver valor
        for (const [colStr, setorInfo] of Object.entries(COL_SETOR_MAP)) {
          const col = parseInt(colStr);
          const valorSetor = toNum(totalRow[col]);
          if (valorSetor <= 0) continue;

          // Proporcionar os custos por tipo ao setor
          const proporcao = totalGeral > 0 ? valorSetor / totalGeral : 0;

          result.push({
            equipamentoNome: equipAtual,
            subsetorNome: setorInfo.subsetor,
            grupoNome: setorInfo.grupo,
            salOperEncOper: (custosPorTipo["salOperEncOper"] || 0) * proporcao,
            depreciacao: (custosPorTipo["depreciacao"] || 0) * proporcao,
            combustivel: (custosPorTipo["combustivel"] || 0) * proporcao,
            lubrificantes: (custosPorTipo["lubrificantes"] || 0) * proporcao,
            pecasDesgaste: (custosPorTipo["pecasDesgaste"] || 0) * proporcao,
            pecasReposicao: (custosPorTipo["pecasReposicao"] || 0) * proporcao,
            outrasDespesas: (custosPorTipo["outrasDespesas"] || 0) * proporcao,
            totalDespesasEquipamento: valorSetor,
            horasTrabalhadas: horasTrabalhadas * proporcao,
            producaoTotal: producao * proporcao,
            unidadeProducao,
          });
        }
      }
      // Resetar para o próximo equipamento
      equipAtual = null;
      blocoLinhas = [];
      continue;
    }

    // Linha de cabeçalho de equipamento
    // Ignorar linhas auxiliares: "FOTO", linhas de setor, linhas vazias
    if (
      col1 &&
      col2 &&
      col1 !== "FOTO" &&
      !col1.startsWith("TOTAL") &&
      col2 !== "TOTAL DO PERÍODO" &&
      !col2.startsWith("Produção Total")
    ) {
      // Verificar se col2 é um tipo de despesa válido
      const isDespevaValida =
        CONTA_MAP_MEM[col2] ||
        col2.startsWith("Sal") ||
        col2.startsWith("Comb") ||
        col2.startsWith("Lubr") ||
        col2.startsWith("Peç") ||
        col2.startsWith("Outr") ||
        col2.startsWith("Depr");

      if (isDespevaValida) {
        if (!equipAtual || col1 !== equipAtual) {
          equipAtual = col1;
          blocoLinhas = [];
        }
      }
    }

    // Adicionar linha ao bloco atual
    if (equipAtual) {
      blocoLinhas.push(row);
    }
  }

  return result;
}

// ─── Parser da aba MSET ───────────────────────────────────────────────────────
interface DespesaMset {
  subsetorNome: string;
  grupoNome: string;
  descricao: string;
  valor: number;
  ordemExibicao: number;
}

function parseAbaMset(ws: XLSX.WorkSheet): DespesaMset[] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  });

  const result: DespesaMset[] = [];

  // Encontrar blocos: linhas onde col[2] === 'VALOR' e col[5] === 'VALOR'
  // A linha anterior (i-1) tem os nomes dos setores
  const blocoHeaders: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && strVal(row[2]) === "VALOR" && strVal(row[5]) === "VALOR") {
      blocoHeaders.push(i - 1);
    }
  }

  for (const headerIdx of blocoHeaders) {
    const headerRow = rows[headerIdx];
    if (!headerRow) continue;

    // Processar lado esquerdo (col 1, val col 2) e direito (col 4, val col 5)
    for (const [nameCol, valCol] of [[1, 2], [4, 5]] as [number, number][]) {
      const subsetorNome = strVal(headerRow[nameCol]);
      if (!subsetorNome || !MSET_SETORES_VALIDOS.has(subsetorNome)) continue;

      const grupoNome = MSET_GRUPO_MAP[subsetorNome];
      let ordemDespesa = 0;

      // Processar linhas de contas (headerIdx+2 a headerIdx+12)
      for (let r = headerIdx + 2; r < headerIdx + 13 && r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;

        const desc = strVal(row[nameCol]);
        // Ler valor diretamente da célula para evitar perda de precisão
        const cellAddr = XLSX.utils.encode_cell({ r, c: valCol });
        const cell = ws[cellAddr];
        const val = cell ? toNum(cell.v) : 0;

        if (!desc || MSET_SKIP.has(desc) || val === 0) continue;

        ordemDespesa++;
        result.push({
          subsetorNome,
          grupoNome,
          descricao: desc,
          valor: val,
          ordemExibicao: ordemDespesa,
        });
      }
    }
  }

  return result;
}

// ─── Resultado da importação ──────────────────────────────────────────────────
export interface ImportacaoCustoSetorRasResult {
  periodoCustoId: number;
  mes: number;
  ano: number;
  equipamentosImportados: number;
  despesasImportadas: number;
  criados: number;
  atualizados: number;
  erros: string[];
}

// ─── Função principal de importação ──────────────────────────────────────────
export async function importarCustoSetorRas(
  buffer: Buffer,
  userId: number
): Promise<ImportacaoCustoSetorRasResult> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });

  // ─── Extrair período ────────────────────────────────────────────────────────
  let mes = 0;
  let ano = 0;

  // Tentar da aba EMPRESA (campo DATA INICIAL DO CUSTO)
  const wsEmpresa = workbook.Sheets["EMPRESA"];
  if (wsEmpresa) {
    const empRows: any[][] = XLSX.utils.sheet_to_json(wsEmpresa, {
      header: 1,
      defval: null,
      raw: false,
    });
    for (const row of empRows) {
      if (row[2] === "DATA INICIAL DO CUSTO" && row[3]) {
        const d = row[3] instanceof Date ? row[3] : new Date(String(row[3]));
        if (!isNaN(d.getTime())) {
          mes = d.getMonth() + 1;
          ano = d.getFullYear();
          break;
        }
      }
    }
  }

  // Fallback: tentar da aba RSSET (célula K1)
  if (!mes || !ano) {
    const wsRsset = workbook.Sheets["RSSET"];
    if (wsRsset) {
      const rssetRows: any[][] = XLSX.utils.sheet_to_json(wsRsset, {
        header: 1,
        defval: null,
        raw: false,
      });
      const dataCelula = rssetRows[0]?.[10];
      if (dataCelula) {
        const d = new Date(String(dataCelula));
        if (!isNaN(d.getTime())) {
          mes = d.getMonth() + 1;
          ano = d.getFullYear();
        }
      }
    }
  }

  // Fallback: tentar de qualquer aba com data nas primeiras linhas
  if (!mes || !ano) {
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: null,
        raw: false,
      });
      for (const row of rows.slice(0, 5)) {
        for (const cell of (row || [])) {
          if (!cell) continue;
          const match = String(cell).match(/(\d{1,2})\/(\d{4})/);
          if (match) {
            mes = parseInt(match[1]);
            ano = parseInt(match[2]);
            break;
          }
          const d = new Date(String(cell));
          if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
            mes = d.getMonth() + 1;
            ano = d.getFullYear();
            break;
          }
        }
        if (mes && ano) break;
      }
      if (mes && ano) break;
    }
  }

  if (!mes || !ano) {
    throw new Error(
      "Não foi possível extrair o período da planilha. Verifique se a planilha contém a aba EMPRESA ou RSSET com data válida."
    );
  }

  // ─── Buscar período de custo ────────────────────────────────────────────────
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

  const erros: string[] = [];
  let criados = 0;
  let atualizados = 0;
  let equipamentosImportados = 0;
  let despesasImportadas = 0;

  // ─── Importar aba MEM ───────────────────────────────────────────────────────
  const wsMem = workbook.Sheets["MEM"];
  if (!wsMem) {
    erros.push("Aba MEM não encontrada na planilha — equipamentos não importados");
  } else {
    const equipamentos = parseAbaMem(wsMem);

    for (const equip of equipamentos) {
      try {
        const [existing] = await db
          .select({ id: custoSetorEquipamento.id })
          .from(custoSetorEquipamento)
          .where(
            and(
              eq(custoSetorEquipamento.periodoCustoId, periodoCustoId),
              eq(custoSetorEquipamento.subsetorNome, equip.subsetorNome),
              eq(custoSetorEquipamento.equipamentoNome, equip.equipamentoNome)
            )
          )
          .limit(1);

        const data = {
          periodoCustoId,
          subsetorNome: equip.subsetorNome,
          grupoNome: equip.grupoNome,
          equipamentoNome: equip.equipamentoNome,
          salOperEncOper: equip.salOperEncOper.toFixed(2),
          depreciacao: equip.depreciacao.toFixed(2),
          combustivel: equip.combustivel.toFixed(2),
          lubrificantes: equip.lubrificantes.toFixed(2),
          pecasDesgaste: equip.pecasDesgaste.toFixed(2),
          pecasReposicao: equip.pecasReposicao.toFixed(2),
          outrasDespesas: equip.outrasDespesas.toFixed(2),
          totalDespesasEquipamento: equip.totalDespesasEquipamento.toFixed(2),
          horasTrabalhadas: equip.horasTrabalhadas.toFixed(2),
          producaoTotal: equip.producaoTotal > 0 ? equip.producaoTotal.toFixed(4) : null,
          unidadeProducao: equip.unidadeProducao,
          ordemExibicao: equipamentosImportados + 1,
          userId,
        };

        if (existing) {
          await db
            .update(custoSetorEquipamento)
            .set(data)
            .where(eq(custoSetorEquipamento.id, existing.id));
          atualizados++;
        } else {
          await db.insert(custoSetorEquipamento).values(data);
          criados++;
        }
        equipamentosImportados++;
      } catch (err: any) {
        erros.push(
          `Erro ao importar equipamento "${equip.equipamentoNome}" (${equip.subsetorNome}): ${err.message}`
        );
      }
    }
  }

  // ─── Importar aba MSET ──────────────────────────────────────────────────────
  const wsMset = workbook.Sheets["MSET"];
  if (!wsMset) {
    erros.push("Aba MSET não encontrada na planilha — despesas setoriais não importadas");
  } else {
    const despesas = parseAbaMset(wsMset);

    for (const desp of despesas) {
      try {
        const [existing] = await db
          .select({ id: custoSetorDespesa.id })
          .from(custoSetorDespesa)
          .where(
            and(
              eq(custoSetorDespesa.periodoCustoId, periodoCustoId),
              eq(custoSetorDespesa.subsetorNome, desp.subsetorNome),
              eq(custoSetorDespesa.descricao, desp.descricao)
            )
          )
          .limit(1);

        const data = {
          periodoCustoId,
          subsetorNome: desp.subsetorNome,
          grupoNome: desp.grupoNome,
          descricao: desp.descricao,
          valor: desp.valor.toFixed(2),
          ordemExibicao: desp.ordemExibicao,
          userId,
        };

        if (existing) {
          await db
            .update(custoSetorDespesa)
            .set(data)
            .where(eq(custoSetorDespesa.id, existing.id));
          atualizados++;
        } else {
          await db.insert(custoSetorDespesa).values(data);
          criados++;
        }
        despesasImportadas++;
      } catch (err: any) {
        erros.push(
          `Erro ao importar despesa "${desp.descricao}" (${desp.subsetorNome}): ${err.message}`
        );
      }
    }
  }

  return {
    periodoCustoId,
    mes,
    ano,
    equipamentosImportados,
    despesasImportadas,
    criados,
    atualizados,
    erros,
  };
}

// ─── Rota Express ─────────────────────────────────────────────────────────────
import { Router } from "express";
import multer from "multer";
import { sdk } from "./_core/sdk";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export function registerImportacaoCustoSetorRasRoute(app: any) {
  const router = Router();

  router.post(
    "/api/importacao-custo-setor-ras",
    upload.single("file"),
    async (req: any, res: any) => {
      try {
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

        const result = await importarCustoSetorRas(req.file.buffer, currentUser.id);
        return res.json({ success: true, ...result });
      } catch (err: any) {
        console.error("[importacao-custo-setor-ras] Erro:", err);
        return res
          .status(500)
          .json({ error: err.message || "Erro interno ao importar planilha MEM+MSET" });
      }
    }
  );

  app.use(router);
}
