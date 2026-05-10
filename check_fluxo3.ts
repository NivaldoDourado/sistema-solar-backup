import { getDb } from "./server/db";
import { lancamentoFluxo } from "./drizzle/schema";
import { like, sql } from "drizzle-orm";

async function main() {
  const db = (await getDb())!;
  
  // Buscar todos os setores distintos
  const setores = await db.selectDistinct({ setor: lancamentoFluxo.setor }).from(lancamentoFluxo);
  console.log("Setores:", setores.map(s => s.setor));
  
  // Buscar contas distintas
  const contas = await db.selectDistinct({ conta: lancamentoFluxo.contaPrincipalNome }).from(lancamentoFluxo);
  console.log("\nContas:", contas.map(c => c.conta));
  
  // Buscar energia
  const energia = await db.select().from(lancamentoFluxo).where(like(lancamentoFluxo.contaPrincipalNome, "%ENERGIA%"));
  console.log("\nEnergia Elétrica:");
  for (const r of energia) {
    console.log(`  Setor: ${r.setor} | Valor: ${r.valor} | Rateio: ${r.isRateio} | %: ${r.percentualRateio} | SubConta: ${r.contaAgrupadaNome}`);
  }
  
  // Buscar lançamentos com rateio
  const rateios = await db.select().from(lancamentoFluxo).where(sql`${lancamentoFluxo.isRateio} = true`);
  console.log("\nLançamentos com rateio:", rateios.length);
  for (const r of rateios) {
    console.log(`  Setor: ${r.setor} | Conta: ${r.contaPrincipalNome} | Valor: ${r.valor} | %: ${r.percentualRateio}`);
  }
  
  process.exit(0);
}
main();
