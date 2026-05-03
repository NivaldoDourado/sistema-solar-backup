/**
 * Importador das abas RAS01-RAS12 e MSET da planilha CUSTOSOLAR
 *
 * RAS01-RAS12: Centros de custo por equipamento em cada subsetor
 * MSET: Despesas específicas do setor (Energia Elétrica, Explosivos, etc.)
 *
 * Estrutura de cada bloco de equipamento nas abas RAS (14 linhas por equipamento):
 *   Linha 1: Nome do equipamento
 *   Linhas 2-8: Despesas individuais:
 *     - Sal.Oper./Enc.Oper.
 *     - Depreciação
 *     - Combustível
 *     - Lubrificantes
 *     - Peças de Desgaste
 *     - Peças de Reposição/Item de Consumo
 *     - Outras Despesas
 *   Linha 9: Total das Despesas do Equipamento
 *   Linhas 10-14: Informações operacionais (horas, combustível litros, produção, etc.)
 */

import * as XLSX from "xlsx";
import { getDb } from "./db";
import {
  custoSetorEquipamento,
  custoSetorDespesa,
  periodoCusto,
} from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Mapeamento das abas RAS para subsetor/grupo
const RAS_ABAS: Record<string, { subsetor: string; grupo: string; ordem: number }> = {
  RAS01: { subsetor: "DESMONTE PRIMÁRIO",       grupo: "DESMONTE DE ROCHA",   ordem: 1 },
  RAS02: { subsetor: "DESMONTE SECUNDÁRIO",      grupo: "DESMONTE DE ROCHA",   ordem: 2 },
  RAS03: { subsetor: "CARGA E TRANSPORTE",       grupo: "CARGA E TRANSPORTE",  ordem: 1 },
  RAS04: { subsetor: "BRITAGEM PRIMÁRIA",        grupo: "BRITAGEM",            ordem: 1 },
  RAS05: { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM",          ordem: 2 },
  RAS06: { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM",          ordem: 2 },
  RAS07: { subsetor: "BRITAGEM SEC./TERC./QUART.", grupo: "BRITAGEM",          ordem: 2 },
  RAS08: { subsetor: "EXPEDIÇÃO",                grupo: "EXPEDIÇÃO",           ordem: 1 },
  RAS09: { subsetor: "SERVIÇOS AUXILIARES",      grupo: "SERVIÇOS AUXILIARES", ordem: 1 },
  RAS10: { subsetor: "OFICINA E ALMOXARIFADO",   grupo: "SERVIÇOS AUXILIARES", ordem: 2 },
  RAS11: { subsetor: "REFEITÓRIO E LIMPEZA",     grupo: "SERVIÇOS AUXILIARES", ordem: 3 },
  RAS12: { subsetor: "ADMINISTRAÇÃO",            grupo: "ADMINISTRAÇÃO",       ordem: 1 },
};

// Nomes das linhas de despesas dentro de cada bloco de equipamento
const DESPESAS_LINHAS = [
  "salOperEncOper",
  "depreciacao",
  "combustivel",
  "lubrificantes",
  "pecasDesgaste",
  "pecasReposicao",
  "outrasDespesas",
] as const;

function toNum(val: any): number {
  if (val === null || val === undefined || val === "" || val === "#REF!" || val === "#N/A") return 0;
  const s = String(val).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function strVal(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

/**
 * Parseia uma aba RAS e retorna array de equipamentos com suas despesas
 */
function parseAbaRas(ws: XLSX.WorkSheet, subsetor: string, grupo: string) {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  const equipamentos: Array<{
    equipamentoNome: string;
    salOperEncOper: number;
    depreciacao: number;
    combustivel: number;
    lubrificantes: number;
    pecasDesgaste: number;
    pecasReposicao: number;
    outrasDespesas: number;
    totalDespesasEquipamento: number;
    horasTrabalhadas: number;
    qtdCombustivelLitros: number;
    producaoTotal: number;
    unidadeProducao: string;
    ordemExibicao: number;
  }> = [];

  // Encontrar onde começa a tabela de equipamentos
  // Procurar por uma linha que tenha "EQUIPAMENTOS" ou similar como cabeçalho
  // Na estrutura da planilha, os blocos de equipamentos geralmente começam após linha 5-6
  let startRow = 0;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    // Procurar por linha que contenha "EQUIPAMENTOS" em alguma coluna
    const hasEquipamentos = row.some(
      (cell) => cell && String(cell).toUpperCase().includes("EQUIPAMENTO")
    );
    if (hasEquipamentos) {
      startRow = i + 1;
      break;
    }
  }

  // Se não encontrou cabeçalho, tentar a partir da linha 6 (índice 5)
  if (startRow === 0) startRow = 5;

  let ordem = 0;
  let i = startRow;

  while (i < rows.length) {
    const row = rows[i];
    if (!row) { i++; continue; }

    // Coluna A (índice 0) = nome do equipamento
    const nomeEquip = strVal(row[0]);

    // Pular linhas vazias ou de total/subtotal
    if (!nomeEquip) { i++; continue; }
    if (
      nomeEquip.toUpperCase().includes("TOTAL") ||
      nomeEquip.toUpperCase().includes("SUB-TOTAL") ||
      nomeEquip.toUpperCase().includes("SUBTOTAL")
    ) {
      i++;
      continue;
    }

    // Verificar se há pelo menos 8 linhas abaixo (bloco de equipamento)
    if (i + 8 >= rows.length) break;

    // Ler as 7 linhas de despesas (linhas i+1 a i+7)
    // Coluna B (índice 1) = valor da despesa
    const salOper = toNum(rows[i + 1]?.[1]);
    const deprec = toNum(rows[i + 2]?.[1]);
    const combust = toNum(rows[i + 3]?.[1]);
    const lubr = toNum(rows[i + 4]?.[1]);
    const pecasDesg = toNum(rows[i + 5]?.[1]);
    const pecasRep = toNum(rows[i + 6]?.[1]);
    const outras = toNum(rows[i + 7]?.[1]);

    // Linha i+8 = total das despesas
    const totalDesp = toNum(rows[i + 8]?.[1]);

    // Linhas operacionais (i+9 a i+13)
    const horasTrab = toNum(rows[i + 9]?.[1]);
    const qtdCombust = toNum(rows[i + 10]?.[1]);
    const producao = toNum(rows[i + 11]?.[1]);
    const unidade = strVal(rows[i + 12]?.[1]) || "t";

    // Só adicionar se tiver algum valor
    const temValor = salOper + deprec + combust + lubr + pecasDesg + pecasRep + outras + totalDesp > 0;
    if (temValor || nomeEquip.length > 2) {
      ordem++;
      equipamentos.push({
        equipamentoNome: nomeEquip,
        salOperEncOper: salOper,
        depreciacao: deprec,
        combustivel: combust,
        lubrificantes: lubr,
        pecasDesgaste: pecasDesg,
        pecasReposicao: pecasRep,
        outrasDespesas: outras,
        totalDespesasEquipamento: totalDesp || (salOper + deprec + combust + lubr + pecasDesg + pecasRep + outras),
        horasTrabalhadas: horasTrab,
        qtdCombustivelLitros: qtdCombust,
        producaoTotal: producao,
        unidadeProducao: unidade,
        ordemExibicao: ordem,
      });
    }

    // Avançar 14 linhas (bloco completo)
    i += 14;
  }

  return equipamentos;
}

/**
 * Parseia a aba MSET e retorna despesas específicas por subsetor
 */
function parseAbaMset(ws: XLSX.WorkSheet) {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: false,
  });

  const despesas: Array<{
    subsetorNome: string;
    grupoNome: string;
    descricao: string;
    valor: number;
    ordemExibicao: number;
  }> = [];

  // Mapeamento de subsetores da aba MSET para grupos
  const SUBSETOR_GRUPO: Record<string, string> = {
    "DESMONTE PRIMÁRIO": "DESMONTE DE ROCHA",
    "DESMONTE SECUNDÁRIO": "DESMONTE DE ROCHA",
    "CARGA E TRANSPORTE": "CARGA E TRANSPORTE",
    "BRITAGEM PRIMÁRIA": "BRITAGEM",
    "BRITAGEM SEC./TERC./QUART.": "BRITAGEM",
    "EXPEDIÇÃO": "EXPEDIÇÃO",
    "SERVIÇOS AUXILIARES": "SERVIÇOS AUXILIARES",
    "OFICINA E ALMOXARIFADO": "SERVIÇOS AUXILIARES",
    "REFEITÓRIO E LIMPEZA": "SERVIÇOS AUXILIARES",
    "ADMINISTRAÇÃO": "ADMINISTRAÇÃO",
  };

  let subsetorAtual = "";
  let grupoAtual = "";
  let ordemDespesa = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const colA = strVal(row[0]);
    const colB = strVal(row[1]);

    if (!colA && !colB) continue;

    // Detectar linha de subsetor (coluna A preenchida, sem valor numérico em B)
    if (colA && !colB) {
      const colAUpper = colA.toUpperCase();
      // Verificar se é um nome de subsetor conhecido
      const subsetorMatch = Object.keys(SUBSETOR_GRUPO).find(
        (s) => colAUpper.includes(s.toUpperCase()) || s.toUpperCase().includes(colAUpper)
      );
      if (subsetorMatch) {
        subsetorAtual = subsetorMatch;
        grupoAtual = SUBSETOR_GRUPO[subsetorMatch];
        ordemDespesa = 0;
      } else if (colAUpper.length > 3 && !colAUpper.includes("TOTAL") && !colAUpper.includes("SUBTOTAL")) {
        // Pode ser um nome de subsetor não mapeado
        subsetorAtual = colA;
        grupoAtual = "OUTROS";
        ordemDespesa = 0;
      }
      continue;
    }

    // Linha de despesa: coluna A = descrição, coluna B = valor
    if (colA && colB && subsetorAtual) {
      const valor = toNum(colB);
      if (
        !colA.toUpperCase().includes("TOTAL") &&
        !colA.toUpperCase().includes("SUBTOTAL") &&
        valor !== 0
      ) {
        ordemDespesa++;
        despesas.push({
          subsetorNome: subsetorAtual,
          grupoNome: grupoAtual,
          descricao: colA,
          valor,
          ordemExibicao: ordemDespesa,
        });
      }
    }
  }

  return despesas;
}

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

export async function importarCustoSetorRas(
  buffer: Buffer,
  userId: number
): Promise<ImportacaoCustoSetorRasResult> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  // Ler planilha
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  // Extrair período da aba RAS01 (ou qualquer RAS disponível)
  // Tentar extrair da célula que contém o mês/ano — geralmente célula B1 ou C1
  let mes = 0;
  let ano = 0;

  // Tentar extrair período da aba RSSET ou de qualquer aba disponível
  const abasDisponiveis = workbook.SheetNames;

  // Tentar extrair o período da aba RAS01
  const wsRas01 = workbook.Sheets["RAS01"];
  if (wsRas01) {
    const rows01: any[][] = XLSX.utils.sheet_to_json(wsRas01, {
      header: 1,
      defval: null,
      raw: false,
    });
    // Procurar nas primeiras 5 linhas por uma data
    for (let i = 0; i < Math.min(5, rows01.length); i++) {
      const row = rows01[i];
      if (!row) continue;
      for (const cell of row) {
        if (!cell) continue;
        const d = new Date(String(cell));
        if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
          mes = d.getMonth() + 1;
          ano = d.getFullYear();
          break;
        }
        // Tentar formato "MM/YYYY" ou "MÊS/ANO"
        const match = String(cell).match(/(\d{1,2})\/(\d{4})/);
        if (match) {
          mes = parseInt(match[1]);
          ano = parseInt(match[2]);
          break;
        }
      }
      if (mes && ano) break;
    }
  }

  // Se não encontrou na RAS01, tentar na RSSET
  if (!mes || !ano) {
    const wsRsset = workbook.Sheets["RSSET"];
    if (wsRsset) {
      const rowsRsset: any[][] = XLSX.utils.sheet_to_json(wsRsset, {
        header: 1,
        defval: null,
        raw: false,
      });
      const dataCelula = rowsRsset[0]?.[10];
      if (dataCelula) {
        const d = new Date(dataCelula);
        if (!isNaN(d.getTime())) {
          mes = d.getMonth() + 1;
          ano = d.getFullYear();
        }
      }
    }
  }

  if (!mes || !ano) {
    throw new Error(
      "Não foi possível extrair o período da planilha. Verifique se a planilha contém a aba RAS01 ou RSSET com data válida."
    );
  }

  // Buscar o período de custo
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

  // =====================================================================
  // Importar abas RAS01-RAS12
  // =====================================================================

  // Para subsetores que acumulam (BRITAGEM SEC./TERC./QUART.), precisamos
  // agregar equipamentos de múltiplas abas
  const equipamentosPorSubsetor: Record<
    string,
    {
      subsetorNome: string;
      grupoNome: string;
      equipamentos: ReturnType<typeof parseAbaRas>;
    }
  > = {};

  for (const [abaName, meta] of Object.entries(RAS_ABAS)) {
    const ws = workbook.Sheets[abaName];
    if (!ws) {
      // Aba não encontrada — não é erro, pode não existir
      continue;
    }

    const equips = parseAbaRas(ws, meta.subsetor, meta.grupo);

    if (!equipamentosPorSubsetor[meta.subsetor]) {
      equipamentosPorSubsetor[meta.subsetor] = {
        subsetorNome: meta.subsetor,
        grupoNome: meta.grupo,
        equipamentos: [],
      };
    }

    // Adicionar equipamentos ao subsetor (com ordem ajustada para não colidir)
    const offsetOrdem = equipamentosPorSubsetor[meta.subsetor].equipamentos.length;
    for (const eq_ of equips) {
      equipamentosPorSubsetor[meta.subsetor].equipamentos.push({
        ...eq_,
        ordemExibicao: eq_.ordemExibicao + offsetOrdem,
      });
    }
  }

  // Fazer upsert dos equipamentos
  for (const { subsetorNome, grupoNome, equipamentos } of Object.values(equipamentosPorSubsetor)) {
    for (const equip of equipamentos) {
      try {
        // Verificar se já existe
        const [existing] = await db
          .select({ id: custoSetorEquipamento.id })
          .from(custoSetorEquipamento)
          .where(
            and(
              eq(custoSetorEquipamento.periodoCustoId, periodoCustoId),
              eq(custoSetorEquipamento.subsetorNome, subsetorNome),
              eq(custoSetorEquipamento.equipamentoNome, equip.equipamentoNome)
            )
          )
          .limit(1);

        const data = {
          periodoCustoId,
          subsetorNome,
          grupoNome,
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
          qtdCombustivelLitros: equip.qtdCombustivelLitros.toFixed(2),
          producaoTotal: equip.producaoTotal.toFixed(2),
          unidadeProducao: equip.unidadeProducao,
          ordemExibicao: equip.ordemExibicao,
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
          `Erro ao importar equipamento "${equip.equipamentoNome}" (${subsetorNome}): ${err.message}`
        );
      }
    }
  }

  // =====================================================================
  // Importar aba MSET (despesas específicas do setor)
  // =====================================================================
  const wsMset = workbook.Sheets["MSET"];
  if (wsMset) {
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

// ============================================================
// Rota Express para upload da planilha RAS
// ============================================================
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

        const result = await importarCustoSetorRas(req.file.buffer, currentUser.id);
        return res.json({ success: true, ...result });
      } catch (err: any) {
        console.error("[importacao-custo-setor-ras] Erro:", err);
        return res
          .status(500)
          .json({ error: err.message || "Erro interno ao importar planilha RAS" });
      }
    }
  );

  app.use(router);
}
