import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
const urlObj = new URL(url);
const m = {
  1: urlObj.username,
  2: urlObj.password,
  3: urlObj.hostname,
  4: urlObj.port,
  5: urlObj.pathname.slice(1).split('?')[0]
};
const conn = await mysql.createConnection({
  host: m[3], port: parseInt(m[4]), user: m[1], password: m[2], database: m[5],
  ssl: { rejectUnauthorized: false }
});

// Verificar dados de Energia Elétrica de Março/2026 (periodoCustoId=1)
const [rows] = await conn.execute(
  `SELECT subsetorNome, grupoNome, descricao, valor 
   FROM custo_setor_despesa 
   WHERE periodoCustoId = 1 AND descricao LIKE '%Energia%'
   ORDER BY valor DESC`
);
console.log('Energia Elétrica - Março/2026:');
console.table(rows);

// Verificar todas as descrições únicas disponíveis
const [descs] = await conn.execute(
  `SELECT DISTINCT descricao, COUNT(*) as qtd, SUM(CAST(valor AS DECIMAL(14,2))) as total
   FROM custo_setor_despesa 
   WHERE periodoCustoId = 1
   GROUP BY descricao
   ORDER BY total DESC`
);
console.log('\nTodas as contas DESPSET de Março/2026:');
console.table(descs);

await conn.end();
