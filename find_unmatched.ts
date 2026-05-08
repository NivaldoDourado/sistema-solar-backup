import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { getDb } from './server/db';
import { equipamentos } from './drizzle/schema';
import { sql } from 'drizzle-orm';

async function main() {
  // Parse planilha
  const filePath = '/home/ubuntu/upload/DESPESASABRIL2026.xls';
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Extrair equipamentos da planilha
  const equipsPlanilha: { tag: string; descricao: string; setor: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const col0 = String(row[0] || '').trim();
    
    if (col0.includes('- Grupo:')) {
      // Format: "TAG- DESCRICAO - Grupo: SETOR"
      const grupoMatch = col0.match(/^(.+?)\s*-\s*(.+?)\s*-\s*Grupo:\s*(.+)$/);
      if (grupoMatch) {
        const tag = grupoMatch[1].trim();
        const descricao = grupoMatch[2].trim();
        const setor = grupoMatch[3].trim();
        equipsPlanilha.push({ tag, descricao, setor });
      }
    }
  }

  // Buscar equipamentos do sistema via SQL raw
  const db = await getDb();
  const result = await db.execute(sql`SELECT id, codigoTag, nomeDoEquipamento, grupoId, setorId FROM equipamentos`);
  const equipsSistema = result[0] as any[];
  
  console.log(`\nEquipamentos na planilha: ${equipsPlanilha.length}`);
  console.log(`Equipamentos no sistema: ${equipsSistema.length}\n`);

  // Fazer matching
  const semCorrespondencia: { tag: string; descricao: string; setor: string }[] = [];
  const comCorrespondencia: { tag: string; descricao: string; match: string; tipo: string }[] = [];
  
  for (const eq of equipsPlanilha) {
    const tagNorm = eq.tag.toLowerCase().replace(/[^a-z0-9]/g, '');
    let found = false;
    let matchInfo = '';
    let matchTipo = '';
    
    for (const eqSistema of equipsSistema) {
      const nomeNorm = (eqSistema.nomeDoEquipamento || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const codigoNorm = (eqSistema.codigoTag || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Exact match on codigoTag
      if (tagNorm && codigoNorm && (tagNorm === codigoNorm || nomeNorm.includes(tagNorm) || tagNorm.includes(nomeNorm.substring(0, 6)))) {
        found = true;
        matchInfo = eqSistema.nomeDoEquipamento;
        matchTipo = 'exata';
        break;
      }
      
      // Partial match on words
      const tagWords = eq.tag.toLowerCase().split(/[\s\-\/]+/).filter((w: string) => w.length > 2);
      const nomeWords = (eqSistema.nomeDoEquipamento || '').toLowerCase().split(/[\s\-\/]+/).filter((w: string) => w.length > 2);
      const matchCount = tagWords.filter((w: string) => nomeWords.some((nw: string) => nw.includes(w) || w.includes(nw))).length;
      
      if (matchCount >= 2 || (tagWords.length === 1 && matchCount === 1 && tagWords[0].length > 4)) {
        found = true;
        matchInfo = eqSistema.nomeDoEquipamento;
        matchTipo = 'parcial';
        break;
      }
    }
    
    if (!found) {
      semCorrespondencia.push(eq);
    } else {
      comCorrespondencia.push({ tag: eq.tag, descricao: eq.descricao, match: matchInfo, tipo: matchTipo });
    }
  }

  console.log(`=== EQUIPAMENTOS SEM CORRESPONDÊNCIA (${semCorrespondencia.length}) ===\n`);
  for (const eq of semCorrespondencia) {
    console.log(`  TAG: "${eq.tag}" | DESC: "${eq.descricao}" | SETOR: "${eq.setor}"`);
  }
  
  console.log(`\n=== EQUIPAMENTOS COM CORRESPONDÊNCIA (${comCorrespondencia.length}) ===\n`);
  for (const eq of comCorrespondencia) {
    console.log(`  TAG: "${eq.tag}" → ${eq.tipo}: "${eq.match}"`);
  }
  
  process.exit(0);
}

main().catch(console.error);
