import * as XLSX from "xlsx";
import * as fs from "fs";

// Buscar planilha de abril
const files = fs.readdirSync("/home/ubuntu/upload").filter(f => f.endsWith(".xlsx") || f.endsWith(".xls"));
console.log("Arquivos disponíveis:", files);

const filePath = files.length > 0 ? `/home/ubuntu/upload/${files[files.length - 1]}` : null;
if (!filePath) { console.log("Nenhuma planilha encontrada"); process.exit(0); }

console.log("Usando:", filePath);
const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

// Buscar itens de combustível de um equipamento específico
let currentEquip = "";
let combustivelItems: any[] = [];

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const col0 = String(row[0] || "").trim();
  
  if (col0.includes("Grupo:") && col0.includes("-")) {
    const parts = col0.replace(/\s*-\s*Grupo:.*$/, "").split("-").map((p: string) => p.trim());
    currentEquip = (parts[0] || "").replace(/\s+/g, " ").trim();
    continue;
  }
  
  const seq = Number(col0);
  if (!isNaN(seq) && seq > 0 && currentEquip) {
    const produto = String(row[8] || "").trim().toLowerCase();
    const grupoProduto = String(row[15] || "").trim().toLowerCase();
    
    // Detectar combustível
    const isCombustivel = grupoProduto.includes("combustível") || grupoProduto.includes("combustivel") ||
      produto.includes("diesel") || produto.includes("gasolina");
    
    if (isCombustivel) {
      combustivelItems.push({
        equip: currentEquip,
        data: String(row[3] || "").trim(),
        produto: String(row[8] || "").trim(),
        grupoProduto: String(row[15] || "").trim(),
        quantidade: Number(row[19]) || 0,
        custo: Number(row[23]) || 0,
        centroCusto: String(row[26] || "").trim(),
        hodometro: row[27] !== "" && row[27] !== undefined ? Number(row[27]) : null,
        intervalo: row[29] !== "" && row[29] !== undefined ? Number(row[29]) : null,
        horaPorLitro: String(row[33] || "").trim(),
        litrosPorHora: String(row[36] || "").trim(),
      });
    }
  }
}

console.log(`\nTotal itens de combustível: ${combustivelItems.length}`);
console.log(`\nEquipamentos com combustível: ${new Set(combustivelItems.map(i => i.equip)).size}`);

// Mostrar amostra por equipamento
const byEquip = new Map<string, any[]>();
for (const item of combustivelItems) {
  if (!byEquip.has(item.equip)) byEquip.set(item.equip, []);
  byEquip.get(item.equip)!.push(item);
}

let count = 0;
for (const [equip, items] of byEquip) {
  if (count >= 3) break;
  console.log(`\n=== ${equip} (${items.length} abastecimentos) ===`);
  for (const item of items.slice(0, 5)) {
    console.log(`  ${item.data} | ${item.produto} | Qtd: ${item.quantidade} | Custo: ${item.custo} | Horímetro: ${item.hodometro} | Intervalo: ${item.intervalo} | Lt/Hr: ${item.litrosPorHora} | Hr/Lt: ${item.horaPorLitro}`);
  }
  if (items.length > 5) console.log(`  ... e mais ${items.length - 5} itens`);
  count++;
}
