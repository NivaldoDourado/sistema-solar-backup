import * as fs from "fs";
import * as path from "path";

// Simular a chamada do confirmarImportacao
// Primeiro precisamos parsear a planilha para obter os equipamentos selecionados
import * as XLSX from "xlsx";

const filePath = "/home/ubuntu/upload/DESPESASABRIL2026.xls";
const buffer = fs.readFileSync(filePath);
const fileBase64 = buffer.toString("base64");

// Testar via HTTP direto no servidor
async function testConfirmImport() {
  // Primeiro fazer o parse para obter os equipamentos
  const parseResponse = await fetch("http://localhost:3000/api/trpc/importDespesas.parsePlanilha", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": "app_session_id=test" },
    body: JSON.stringify({
      json: {
        fileBase64,
        fileName: "DESPESASABRIL2026.xls",
        mes: 4,
        ano: 2026,
      }
    }),
  });

  if (!parseResponse.ok) {
    console.log("Parse falhou:", parseResponse.status, await parseResponse.text());
    return;
  }

  const parseResult = await parseResponse.json();
  console.log("Parse OK - Equipamentos:", parseResult.result?.data?.json?.totalEquipamentos || "N/A");
  
  // Agora confirmar com os equipamentos selecionados
  const equipamentos = parseResult.result?.data?.json?.equipamentos || [];
  const selecionados = equipamentos
    .filter((e: any) => e.selecionado)
    .map((e: any) => ({
      codigoTag: e.codigoTag,
      equipamentoSistemaId: e.correspondencia?.id,
    }));

  console.log(`\nEquipamentos selecionados para importação: ${selecionados.length}`);
  console.log("Primeiros 5:", selecionados.slice(0, 5));

  const confirmResponse = await fetch("http://localhost:3000/api/trpc/importDespesas.confirmarImportacao", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": "app_session_id=test" },
    body: JSON.stringify({
      json: {
        fileBase64,
        fileName: "DESPESASABRIL2026.xls",
        mes: 4,
        ano: 2026,
        equipamentosSelecionados: selecionados,
      }
    }),
  });

  if (!confirmResponse.ok) {
    const errText = await confirmResponse.text();
    console.log("\nConfirmação falhou:", confirmResponse.status);
    console.log("Erro:", errText.substring(0, 500));
    return;
  }

  const confirmResult = await confirmResponse.json();
  console.log("\n=== RESULTADO DA IMPORTAÇÃO ===");
  console.log(JSON.stringify(confirmResult.result?.data?.json || confirmResult, null, 2));
}

testConfirmImport().catch(console.error);
