import { CORRESPONDENCIAS_APROVADAS, CORRESPONDENCIAS_FORCADAS, TAGS_OUTRAS_DESP_SETOR, TAGS_NAO_LANCAR, TAGS_EXCLUIR } from './server/importDespesas_correspondencias.ts';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Obter codigoTag dos equipamentos
const [equipRows] = await conn.execute(`SELECT codigoTag FROM equipamentos WHERE codigoTag IS NOT NULL`);
const codigoTags = new Set(equipRows.map(r => r.codigoTag));

// Tags mapeadas (MEM)
const tagsMapeadas = new Set([
  ...codigoTags,
  ...Object.keys(CORRESPONDENCIAS_APROVADAS),
  ...Object.keys(CORRESPONDENCIAS_FORCADAS),
]);

// Tags de setores (MSET etapa 4)
const tagsSetores = new Set(Object.keys(TAGS_OUTRAS_DESP_SETOR));
const tagsNaoLancar = new Set(TAGS_NAO_LANCAR);
const tagsExcluir = new Set(TAGS_EXCLUIR);

// Obter todos os itens importados
const [rows] = await conn.execute(`
  SELECT equipamentoTag, ROUND(SUM(custo), 2) as total
  FROM item_despesa_importado
  WHERE periodoCustoId = 60001
  GROUP BY equipamentoTag
  ORDER BY total DESC
`);

let totalItens = 0;
let totalCapturadoMEM = 0;
let totalSetores = 0;
let totalExcluido = 0;
let totalNaoCapturado = 0;
const naoCapturados = [];

for (const row of rows) {
  const tag = row.equipamentoTag;
  const val = parseFloat(row.total);
  totalItens += val;
  
  if (tagsMapeadas.has(tag)) {
    totalCapturadoMEM += val;
  } else if (tagsSetores.has(tag)) {
    totalSetores += val;
  } else if (tagsNaoLancar.has(tag) || tagsExcluir.has(tag)) {
    totalExcluido += val;
  } else {
    totalNaoCapturado += val;
    naoCapturados.push({ tag, total: val });
  }
}

console.log(`Total itens importados: R$ ${totalItens.toFixed(2)}`);
console.log(`Capturado pelo MEM (tags mapeadas): R$ ${totalCapturadoMEM.toFixed(2)}`);
console.log(`Capturado pelo MSET (tags setores): R$ ${totalSetores.toFixed(2)}`);
console.log(`Excluído (não lançar / excluir): R$ ${totalExcluido.toFixed(2)}`);
console.log(`NÃO CAPTURADO: R$ ${totalNaoCapturado.toFixed(2)}`);
console.log('');
console.log('=== TAGS NÃO CAPTURADAS (compõem os NÃO ALOCADOS) ===');
naoCapturados.sort((a, b) => b.total - a.total);
for (const item of naoCapturados) {
  console.log(`  "${item.tag}": R$ ${item.total.toFixed(2)}`);
}

await conn.end();
process.exit(0);
