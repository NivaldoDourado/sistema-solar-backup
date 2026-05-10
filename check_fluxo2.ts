import { getDb } from "./server/db";
import { lancamentoFluxo } from "./drizzle/schema";
import { sql } from "drizzle-orm";

async function main() {
  const db = (await getDb())!;
  const count = await db.select({ c: sql`COUNT(*)` }).from(lancamentoFluxo);
  console.log("Total lancamento_fluxo:", count[0].c);
  const sample = await db.select().from(lancamentoFluxo).limit(10);
  for (const r of sample) {
    console.log(JSON.stringify({
      setor: r.setor,
      conta: r.contaPrincipalNome,
      valor: r.valor,
      isRateio: r.isRateio,
      pct: r.percentualRateio
    }));
  }
  process.exit(0);
}
main();
