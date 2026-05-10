import { createConnection } from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await createConnection(DATABASE_URL);

// 1. Get periodo abril/26
const [periodos] = await conn.execute("SELECT id, mes, ano FROM periodo_custo WHERE mes = 4 AND ano = 2026 LIMIT 1");
const periodo = periodos[0];
console.log('Período:', periodo);

// 2. Get equipamentos com parte diária em abril que TÊM itens
const [equipsComPD] = await conn.execute(`
  SELECT pd.equipamentoId, e.nomeDoEquipamento, COUNT(pd.id) as totalPD, 
    COUNT(pdi.id) as totalItens, SUM(CAST(pd.horaKmTrabalhados AS DECIMAL(10,2))) as horasTotal
  FROM parte_diaria pd
  INNER JOIN equipamentos e ON e.id = pd.equipamentoId
  LEFT JOIN parte_diaria_itens pdi ON pdi.parteDiariaId = pd.id
  WHERE pd.data >= '2026-04-01' AND pd.data <= '2026-04-30'
  AND pd.horaKmTrabalhados IS NOT NULL
  GROUP BY pd.equipamentoId, e.nomeDoEquipamento
  HAVING totalItens > 0
  ORDER BY horasTotal DESC
  LIMIT 10
`);
console.log('\nEquipamentos COM parte diária E itens (top 10):');
equipsComPD.forEach(e => console.log(`  id=${e.equipamentoId} ${e.nomeDoEquipamento} PDs=${e.totalPD} Itens=${e.totalItens} Horas=${e.horasTotal}`));

// 3. Get equipamentos com parte diária mas SEM itens
const [equipsSemItens] = await conn.execute(`
  SELECT pd.equipamentoId, e.nomeDoEquipamento, COUNT(pd.id) as totalPD, 
    SUM(CAST(pd.horaKmTrabalhados AS DECIMAL(10,2))) as horasTotal
  FROM parte_diaria pd
  INNER JOIN equipamentos e ON e.id = pd.equipamentoId
  LEFT JOIN parte_diaria_itens pdi ON pdi.parteDiariaId = pd.id
  WHERE pd.data >= '2026-04-01' AND pd.data <= '2026-04-30'
  AND pd.horaKmTrabalhados IS NOT NULL
  GROUP BY pd.equipamentoId, e.nomeDoEquipamento
  HAVING COUNT(pdi.id) = 0
  ORDER BY horasTotal DESC
`);
console.log('\nEquipamentos COM parte diária mas SEM itens:');
equipsSemItens.forEach(e => console.log(`  id=${e.equipamentoId} ${e.nomeDoEquipamento} PDs=${e.totalPD} Horas=${e.horasTotal}`));

// 4. Check the CORRESPONDENCIAS_APROVADAS mapping for CS440
// The tag "BRITADOR CS440" maps to id=92
// Does id=92 have parte diária with itens?
const [cs440check] = await conn.execute(`
  SELECT pd.id, pd.data, pd.horaKmTrabalhados, COUNT(pdi.id) as numItens
  FROM parte_diaria pd
  LEFT JOIN parte_diaria_itens pdi ON pdi.parteDiariaId = pd.id
  WHERE pd.equipamentoId = 92 AND pd.data >= '2026-04-01' AND pd.data <= '2026-04-30'
  GROUP BY pd.id, pd.data, pd.horaKmTrabalhados
  LIMIT 5
`);
console.log('\nCS440 (id=92) partes diárias:');
cs440check.forEach(r => console.log(`  pd.id=${r.id} data=${r.data} horas=${r.horaKmTrabalhados} itens=${r.numItens}`));

// 5. Check grupo excluído
const [grupos] = await conn.execute("SELECT id, nome FROM grupos_de_equipamentos WHERE nome LIKE '%ENTREGA%' OR nome LIKE '%BALAN%'");
console.log('\nGrupos excluídos:', grupos);

// 6. Check which group CS440 belongs to
const [cs440grupo] = await conn.execute("SELECT id, nomeDoEquipamento, grupoId FROM equipamentos WHERE id = 92");
console.log('\nCS440 grupo:', cs440grupo);

// 7. Check caminhões da entrega de material
const [entrega] = await conn.execute("SELECT id, nomeDoEquipamento, grupoId FROM equipamentos WHERE grupoId IN (SELECT id FROM grupos_de_equipamentos WHERE nome LIKE '%ENTREGA%')");
console.log('\nEquipamentos do grupo ENTREGA DE MATERIAL:', entrega.map(e => `${e.id} ${e.nomeDoEquipamento}`));

await conn.end();
