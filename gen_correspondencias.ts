import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { getDb } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  // Parse planilha
  const filePath = '/home/ubuntu/upload/DESPESASABRIL2026.xls';
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Extrair equipamentos da planilha com total de despesas
  const equipsPlanilha: { tag: string; descricao: string; setor: string; total: number }[] = [];

  let currentEquip: { tag: string; descricao: string; setor: string; total: number } | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const col0 = String(row[0] || '').trim();
    
    if (col0.includes('- Grupo:')) {
      if (currentEquip) {
        equipsPlanilha.push(currentEquip);
      }
      const grupoMatch = col0.match(/^(.+?)\s*-\s*(.+?)\s*-\s*Grupo:\s*(.+)$/);
      if (grupoMatch) {
        currentEquip = {
          tag: grupoMatch[1].trim(),
          descricao: grupoMatch[2].trim(),
          setor: grupoMatch[3].trim(),
          total: 0
        };
      }
    } else if (currentEquip) {
      // Somar custos (col 23)
      const custo = parseFloat(String(row[23] || '0').replace(',', '.'));
      if (!isNaN(custo) && custo > 0) {
        currentEquip.total += custo;
      }
    }
  }
  if (currentEquip) equipsPlanilha.push(currentEquip);

  // Buscar equipamentos do sistema
  const db = await getDb();
  const result = await db.execute(sql`SELECT id, codigoTag, nomeDoEquipamento, grupoId, setorId FROM equipamentos ORDER BY nomeDoEquipamento`);
  const equipsSistema = result[0] as any[];
  
  // Buscar grupos
  const gruposResult = await db.execute(sql`SELECT id, nome FROM grupos_de_equipamentos`);
  const grupos = gruposResult[0] as any[];
  const grupoMap = new Map(grupos.map((g: any) => [g.id, g.nome]));

  // Buscar setores
  const setoresResult = await db.execute(sql`SELECT id, nome FROM setores`);
  const setores = setoresResult[0] as any[];
  const setorMap = new Map(setores.map((s: any) => [s.id, s.nome]));

  // Fazer matching (mesmo algoritmo do importDespesas_router)
  const correspondencias: { 
    tagPlanilha: string; 
    descPlanilha: string; 
    setorPlanilha: string;
    total: number;
    matchSistema: string; 
    matchId: number;
    grupoSistema: string;
    setorSistema: string;
    tipoMatch: string;
  }[] = [];

  const semMatch: { tag: string; descricao: string; setor: string; total: number }[] = [];

  for (const eq of equipsPlanilha) {
    const tagNorm = eq.tag.toLowerCase().replace(/[^a-z0-9]/g, '');
    let found = false;
    
    for (const eqSistema of equipsSistema) {
      const nomeNorm = (eqSistema.nomeDoEquipamento || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const codigoNorm = (eqSistema.codigoTag || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Match por código tag
      if (tagNorm && codigoNorm && tagNorm === codigoNorm) {
        correspondencias.push({
          tagPlanilha: eq.tag,
          descPlanilha: eq.descricao,
          setorPlanilha: eq.setor,
          total: eq.total,
          matchSistema: eqSistema.nomeDoEquipamento,
          matchId: eqSistema.id,
          grupoSistema: grupoMap.get(eqSistema.grupoId) || '?',
          setorSistema: setorMap.get(eqSistema.setorId) || '?',
          tipoMatch: 'código exato'
        });
        found = true;
        break;
      }
      
      // Match por nome contém tag
      if (tagNorm.length > 3 && nomeNorm.includes(tagNorm)) {
        correspondencias.push({
          tagPlanilha: eq.tag,
          descPlanilha: eq.descricao,
          setorPlanilha: eq.setor,
          total: eq.total,
          matchSistema: eqSistema.nomeDoEquipamento,
          matchId: eqSistema.id,
          grupoSistema: grupoMap.get(eqSistema.grupoId) || '?',
          setorSistema: setorMap.get(eqSistema.setorId) || '?',
          tipoMatch: 'nome contém tag'
        });
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Match por palavras
      const tagWords = eq.tag.toLowerCase().split(/[\s\-\/]+/).filter((w: string) => w.length > 2);
      
      for (const eqSistema of equipsSistema) {
        const nomeWords = (eqSistema.nomeDoEquipamento || '').toLowerCase().split(/[\s\-\/]+/).filter((w: string) => w.length > 2);
        const matchCount = tagWords.filter((w: string) => nomeWords.some((nw: string) => nw.includes(w) || w.includes(nw))).length;
        
        if (matchCount >= 2 || (tagWords.length === 1 && matchCount === 1 && tagWords[0].length > 4)) {
          correspondencias.push({
            tagPlanilha: eq.tag,
            descPlanilha: eq.descricao,
            setorPlanilha: eq.setor,
            total: eq.total,
            matchSistema: eqSistema.nomeDoEquipamento,
            matchId: eqSistema.id,
            grupoSistema: grupoMap.get(eqSistema.grupoId) || '?',
            setorSistema: setorMap.get(eqSistema.setorId) || '?',
            tipoMatch: 'palavras parciais'
          });
          found = true;
          break;
        }
      }
    }
    
    if (!found) {
      semMatch.push(eq);
    }
  }

  // Gerar output formatado
  let output = '# Revisão de Correspondências - Planilha Abril/2026\n\n';
  output += `Total de equipamentos na planilha: ${equipsPlanilha.length}\n`;
  output += `Com correspondência: ${correspondencias.length}\n`;
  output += `Sem correspondência: ${semMatch.length}\n\n`;
  
  output += '## CORRESPONDÊNCIAS ENCONTRADAS (para revisão)\n\n';
  output += '| # | TAG Planilha | Descrição Planilha | → | Equipamento no Sistema (ID) | Grupo | Setor | Tipo Match | Total R$ |\n';
  output += '|---|---|---|---|---|---|---|---|---|\n';
  
  correspondencias.sort((a, b) => a.tagPlanilha.localeCompare(b.tagPlanilha));
  
  for (let i = 0; i < correspondencias.length; i++) {
    const c = correspondencias[i];
    output += `| ${i+1} | ${c.tagPlanilha} | ${c.descPlanilha} | → | ${c.matchSistema} (ID:${c.matchId}) | ${c.grupoSistema} | ${c.setorSistema} | ${c.tipoMatch} | ${c.total.toFixed(2)} |\n`;
  }
  
  output += '\n\n## SEM CORRESPONDÊNCIA\n\n';
  output += '| # | TAG Planilha | Descrição | Setor | Total R$ | Ação Sugerida |\n';
  output += '|---|---|---|---|---|---|\n';
  
  semMatch.sort((a, b) => a.tag.localeCompare(b.tag));
  
  const excluir = ['CD MURIBECA', 'ENSACADEIRA SOLOMIN', 'TOA1F53', 'CD SERRA DO MACHADO'];
  const naoLancar = ['OBRAS'];
  
  for (let i = 0; i < semMatch.length; i++) {
    const s = semMatch[i];
    let acao = 'CADASTRAR';
    if (excluir.some(e => s.tag.includes(e) || s.descricao.includes(e))) acao = 'EXCLUIR';
    if (naoLancar.some(e => s.tag.includes(e))) acao = 'NÃO LANÇAR';
    if (s.setor === 'SOLOMIN' || s.setor === 'FROTA') acao = 'EXCLUIR';
    if (s.tag === 'ALMOXARIFADO') acao = 'Outras Desp. Setor → ALMOXARIFADO';
    if (s.tag === 'OFICINA' || s.tag === 'OFICINABRITAGEM') acao = 'Outras Desp. Setor → OFICINA/BRITAGEM';
    if (s.tag === 'CANTINA') acao = 'Outras Desp. Setor → REFEITÓRIO';
    if (s.tag === 'MATERIAL DE CONSUMO') acao = 'Outras Desp. Setor → ADMINISTRAÇÃO';
    if (s.tag === 'MATERIAL EPI') acao = 'Outras Desp. Setor → OUTROS SERVIÇOS';
    if (s.tag === 'FAZENDA') acao = 'Outras Desp. Setor → OUTROS SERVIÇOS';
    if (s.tag === 'SUBSTAÇÃO' || s.tag === 'SIST. DESPOEIRAMENTO') acao = 'Outras Desp. Setor → BRITAGEM SECUNDÁRIA';
    
    output += `| ${i+1} | ${s.tag} | ${s.descricao} | ${s.setor} | ${s.total.toFixed(2)} | ${acao} |\n`;
  }
  
  fs.writeFileSync('/home/ubuntu/correspondencias_revisao.md', output);
  console.log('Arquivo gerado: /home/ubuntu/correspondencias_revisao.md');
  console.log(`\nResumo: ${correspondencias.length} com match, ${semMatch.length} sem match`);
  
  process.exit(0);
}

main().catch(console.error);
