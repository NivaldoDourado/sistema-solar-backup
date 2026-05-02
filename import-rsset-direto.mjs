/**
 * Script para importar dados da aba RSSET de março/2026 diretamente no banco de produção.
 * Usa a função importarCustoSetor do importacaoCustoSetor.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import * as XLSX from "xlsx";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, and } from "drizzle-orm";

// Carregar variáveis de ambiente
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não encontrada");
  process.exit(1);
}

// Conectar ao banco
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// Importar schema
const { custoSetor, periodoCusto } = await import("./drizzle/schema.js").catch(() =>
  import("./drizzle/schema.ts")
);

// Ler planilha
const FILE_PATH = "/home/ubuntu/upload/CUSTOSOLAR-MARÇO-2026.xlsx";
const buffer = readFileSync(FILE_PATH);
const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

if (!workbook.SheetNames.includes("RSSET")) {
  console.error("Aba RSSET não encontrada na planilha");
  process.exit(1);
}

// Extrair período da aba EMPRESA
let mes = 3, ano = 2026;
if (workbook.SheetNames.includes("EMPRESA")) {
  const wsEmp = workbook.Sheets["EMPRESA"];
  const empData = XLSX.utils.sheet_to_json(wsEmp, { header: 1, defval: null });
  for (const row of empData) {
    if (row[2] === "DATA INICIAL DO CUSTO" && row[3]) {
      const d = new Date(row[3]);
      if (!isNaN(d.getTime())) { mes = d.getMonth() + 1; ano = d.getFullYear(); }
      break;
    }
  }
}
console.log(`Período: ${mes}/${ano}`);

// Buscar ou criar período de custo
const [periodoExistente] = await db.select().from(periodoCusto)
  .where(and(eq(periodoCusto.mes, mes), eq(periodoCusto.ano, ano)));

if (!periodoExistente) {
  console.error(`Período ${mes}/${ano} não encontrado no banco. Crie o período primeiro.`);
  process.exit(1);
}
const periodoCustoId = periodoExistente.id;
console.log(`Período encontrado: id=${periodoCustoId}`);

// Ler aba RSSET
const ws = workbook.Sheets["RSSET"];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

// Mapeamento de grupos e subsetores
const dados = [];
let grupoAtual = null;

for (const row of rows) {
  const colA = row[0] ? String(row[0]).trim() : null;
  const colB = row[1] ? String(row[1]).trim() : null;

  // Ignorar linhas de total/subtotal
  if (colB === "SUB-TOTAL" || colA === "TOTAL DOS DESEMBOLSOS" || colA === "SUBTOTAL DOS CUSTOS E DESPESAS (R$/Ton)") continue;
  if (colA && colA.startsWith("DESPESAS") && colA.includes("INDIRETAS")) continue;
  if (colA && colA.startsWith("TOTAL DOS GASTOS")) continue;

  // Detectar grupo (coluna A preenchida, coluna B preenchida = linha de subsetor com grupo)
  if (colA && colB && !colA.startsWith("DESPESAS") && !colA.startsWith("TOTAL")) {
    grupoAtual = colA;
  }

  // Linha de subsetor (coluna B preenchida, valores numéricos)
  if (colB && grupoAtual && colB !== "SUB-TOTAL") {
    const custoFixo = typeof row[4] === "number" ? row[4] : 0;
    const custoVariavel = typeof row[5] === "number" ? row[5] : 0;
    const totalCusto = typeof row[6] === "number" ? row[6] : (custoFixo + custoVariavel);
    const despesaFixa = typeof row[7] === "number" ? row[7] : 0;
    const despesaVariavel = typeof row[8] === "number" ? row[8] : 0;
    const totalDespesa = typeof row[9] === "number" ? row[9] : (despesaFixa + despesaVariavel);
    const totalGeral = typeof row[10] === "number" ? row[10] : (totalCusto + totalDespesa);
    const custoTon = typeof row[11] === "number" ? row[11] : 0;

    // Ignorar linhas com todos os valores zerados
    if (totalGeral === 0 && custoTon === 0) continue;

    dados.push({
      periodoCustoId,
      grupoNome: grupoAtual,
      subsetorNome: colB,
      custoFixo: custoFixo.toFixed(4),
      custoVariavel: custoVariavel.toFixed(4),
      totalCusto: totalCusto.toFixed(4),
      despesaFixa: despesaFixa.toFixed(4),
      despesaVariavel: despesaVariavel.toFixed(4),
      totalDespesa: totalDespesa.toFixed(4),
      totalGeral: totalGeral.toFixed(4),
      custoTon: custoTon.toFixed(6),
    });
  }
}

console.log(`\nSubsetores encontrados: ${dados.length}`);
dados.forEach(d => console.log(`  ${d.grupoNome} / ${d.subsetorNome}: R$ ${parseFloat(d.totalGeral).toLocaleString("pt-BR", {minimumFractionDigits: 2})}`));

// Inserir/atualizar no banco
let criados = 0, atualizados = 0;
for (const d of dados) {
  const [existente] = await db.select().from(custoSetor)
    .where(and(
      eq(custoSetor.periodoCustoId, d.periodoCustoId),
      eq(custoSetor.grupoNome, d.grupoNome),
      eq(custoSetor.subsetorNome, d.subsetorNome)
    ));

  if (existente) {
    await db.update(custoSetor).set({
      custoFixo: d.custoFixo,
      custoVariavel: d.custoVariavel,
      totalCusto: d.totalCusto,
      despesaFixa: d.despesaFixa,
      despesaVariavel: d.despesaVariavel,
      totalDespesa: d.totalDespesa,
      totalGeral: d.totalGeral,
      custoTon: d.custoTon,
      updatedAt: new Date(),
    }).where(eq(custoSetor.id, existente.id));
    atualizados++;
  } else {
    await db.insert(custoSetor).values({
      ...d,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    criados++;
  }
}

console.log(`\nResultado: ${criados} criados, ${atualizados} atualizados`);
await connection.end();
