import { getDb } from "./server/db";
import { lancamentoFluxo } from "./drizzle/schema";
import { eq, like } from "drizzle-orm";

async function main() {
  const db = (await getDb())!;
  const results = await db
    .select()
    .from(lancamentoFluxo)
    .where(like(lancamentoFluxo.contaPrincipalNome, "%ENERGIA%"));
  
  console.log("Lançamentos de Energia no Fluxo:");
  for (const r of results) {
    console.log(`  Setor: ${r.setor} | Conta: ${r.contaPrincipalNome} | Valor: ${r.valor} | Rateio: ${r.isRateio} | %: ${r.percentualRateio}`);
  }
  process.exit(0);
}
main();
