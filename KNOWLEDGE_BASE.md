# Base de Conhecimento — Sistema SOLAR
## Aprendizado Técnico, Lógica de Importação e Roadmap de Evolução

**Projeto:** Sistema SOLAR — Pedreira Souza e Oliveira Ltda  
**Última atualização:** Maio/2026  
**Finalidade:** Documentar toda a lógica, estrutura e aprendizado acumulado para reutilização em outros sistemas que utilizam a mesma planilha de custos CUSTOSOLAR.

---

## 1. Contexto de Negócio

O Sistema SOLAR é uma plataforma web de gestão de custos operacionais para mineração/pedreira. Ele centraliza dados que atualmente residem em planilhas Excel (CUSTOSOLAR), permitindo visualização analítica, apuração de custo por tonelada e relatórios gerenciais.

A estratégia de implantação segue três fases:

| Fase | Período | Fonte de Dados | Status |
|------|---------|----------------|--------|
| 1 — Histórico | Jan–Mar/2026 | Planilhas CUSTOSOLAR (Excel) | Em andamento |
| 2 — Transição | Abr/2026 em diante | Relatórios exportados do ERP DataGold | Planejado |
| 3 — Integração | TBD | API direta com ERP DataGold (REST/SOAP/outro) | Futuro |

O mesmo modelo de planilha CUSTOSOLAR é utilizado em **outros dois sistemas** que serão implantados com a mesma arquitetura e lógica de importação documentada aqui.

---

## 2. Estrutura da Planilha CUSTOSOLAR

### 2.1 Abas Principais

A planilha contém as seguintes abas relevantes para importação:

| Aba | Conteúdo | Setor Correspondente | Coluna de Custo do Setor (0-based) |
|-----|----------|----------------------|-------------------------------------|
| RAS01 | Relatório Analítico por Setor | DESMONTE PRIMÁRIO | 11 |
| RAS02 | Relatório Analítico por Setor | DESMONTE SECUNDÁRIO | 12 |
| RAS03 | Relatório Analítico por Setor | DECAPEAMENTO | 18 |
| RAS04 | Relatório Analítico por Setor | PEDRA PARA BRITADOR | 16 |
| RAS05 | Relatório Analítico por Setor | BRITAGEM PRIMÁRIA | 13 |
| RAS06 | Relatório Analítico por Setor | BRITAGEM SEC./TERC./QUART. | 14 |
| RAS07 | Relatório Analítico por Setor | EXPEDIÇÃO | 19 |
| RAS08 | Relatório Analítico por Setor | MOV. DE ESTOQUE | 17 |
| RAS09 | Relatório Analítico por Setor | OFICINA E ALMOXARIFADO | 21 |
| RAS10 | Relatório Analítico por Setor | REFEITÓRIO E LIMPEZA | 22 |
| RAS11 | Relatório Analítico por Setor | OUTROS SERVIÇOS | 15 |
| RAS12 | Relatório Analítico por Setor | ADMINISTRAÇÃO | 20 |
| MSET | Mapa de Setores | Totais consolidados | — |
| DPEQUIP | Dados por Equipamento | Base de dados dos equipamentos | — |

### 2.2 Estrutura de Bloco de Equipamento (por aba RAS)

Cada equipamento ocupa um bloco fixo de linhas dentro de cada aba RAS. A estrutura do bloco é identificada pelos valores da **coluna C** (descrição do tipo de despesa):

| Linha relativa | Coluna C | Coluna B | Coluna E | Coluna do Setor (colIdx) |
|----------------|----------|----------|----------|--------------------------|
| 0 | `Sal.Oper./Enc. Oper.` | **Nome do Equipamento** | Valor global | Valor proporcional ao setor |
| 1 | `Depreciação` | — | Valor global | Valor proporcional |
| 2 | `Combustível` | Qtd. Combustível (litros) | Valor global | Valor proporcional |
| 3 | `Lubrificantes` | — | Valor global | Valor proporcional |
| 4 | `Peças de Desgaste` | — | Valor global | Valor proporcional |
| 5 | `Peças de Reposição/Item de Consumo` | — | Valor global | Valor proporcional |
| 6 | `Outras Despesas` | Qtd. Combustível (litros) | Valor global | Valor proporcional |
| 7 | `Vida Útil (Hr) / Deprec. (R$/Hr)` | — | — | — |
| 8 | `Valor Inicial / Valor Final` | — | — | — |
| 9 | `Produção Total do Equipamento` | Qtd. Combustível (litros) | **Produção global** | **Produção proporcional ao setor** |
| 10 | `Unidade de Produção` | — | **Unidade** (ex: ton, metro perf.) | — |
| 11 | `Equipamento Controlado por Hrs ou Km?` | Horas Trabalhadas | Hr ou Km | — |
| 12 | `Total das Despesas do Equipamento` | Horas Trabalhadas (valor) | Total global | **Total do setor** |

> **Atenção:** O nome do equipamento está na **coluna B** da linha onde coluna C = `Sal.Oper./Enc. Oper.`. O bloco termina quando coluna C = `Total das Despesas do Equipamento`.

### 2.3 Colunas de Produção — Comportamento Crítico

Este é o ponto mais importante descoberto durante a implementação:

**Coluna E (índice 4) — Produção Global:** Contém a produção total do equipamento no período, independente do setor. Para equipamentos de uso exclusivo (perfuratrizes, britadores), este valor é igual ao da coluna do setor. Para equipamentos compartilhados (caminhões), este valor pode ser zero enquanto o valor real está na coluna do setor.

**Coluna do Setor (colIdx) — Produção Proporcional:** Contém a produção calculada proporcionalmente ao tempo alocado naquele setor. Para caminhões que trabalham em múltiplos setores, este é o valor correto para o setor em questão.

**Regra de importação:** `producao = MAX(colE, colSetor)`. Isso garante que tanto equipamentos exclusivos quanto compartilhados tenham seus valores capturados corretamente.

### 2.4 Células com Fórmulas

A maioria das células de produção e custo contém **fórmulas Excel** (referências a outras abas como `DPEQUIP`). A biblioteca `xlsx` (SheetJS) armazena o valor calculado na propriedade `.v` da célula. O acesso correto é **sempre via propriedade `.v`**, nunca via `sheet_to_json` com `defval: null`, pois este método retorna `null` para células de fórmula.

```javascript
// ✅ CORRETO — acessa o valor calculado da fórmula
function getCellValue(ws, row, col) {
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
  if (!cell) return null;
  return cell.v !== undefined ? cell.v : null;
}

// ❌ INCORRETO — retorna null para células com fórmula
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const producao = rows[rowIndex][colIndex]; // pode ser null mesmo com valor calculado
```

A leitura deve ser feita com a opção `cellFormula: true`:
```javascript
const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellFormula: true });
```

---

## 3. Estrutura do Banco de Dados

### 3.1 Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `periodo_custo` | Períodos mensais (mes, ano, producaoTotal, quantidadeVendida, etc.) |
| `custo_setor_equipamento` | Custos por equipamento em cada setor/subsetor |
| `custo_setor_despesa` | Despesas específicas do setor (não vinculadas a equipamentos) |

### 3.2 Tabela `custo_setor_equipamento` — Colunas Relevantes

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `periodoCustoId` | FK | Referência ao período |
| `subsetorNome` | string | Nome do subsetor (ex: "PEDRA PARA BRITADOR") |
| `grupoNome` | string | Nome do grupo (ex: "CARGA E TRANSPORTE") |
| `equipamentoNome` | string | Nome completo do equipamento |
| `salOperEncOper` | decimal | Salário operacional + encargos |
| `depreciacao` | decimal | Depreciação |
| `combustivel` | decimal | Combustível |
| `lubrificantes` | decimal | Lubrificantes |
| `pecasDesgaste` | decimal | Peças de desgaste |
| `pecasReposicao` | decimal | Peças de reposição/item de consumo |
| `outrasDespesas` | decimal | Outras despesas |
| `totalDespesasEquipamento` | decimal | Total das despesas do equipamento |
| `horasTrabalhadas` | decimal | Horas trabalhadas no setor |
| `qtdCombustivelLitros` | decimal | Quantidade de combustível em litros |
| `producaoTotal` | decimal | **Produção do equipamento no setor** |
| `unidadeProducao` | string | Unidade de produção (ton, metro perf., etc.) |

### 3.3 Hierarquia de Grupos e Subsetores

A ordem de exibição no Relatório Analítico segue esta hierarquia:

| Grupo | Ordem | Subsetores |
|-------|-------|-----------|
| DESMONTE DE ROCHA | 1 | DESMONTE PRIMÁRIO, DESMONTE SECUNDÁRIO, DECAPEAMENTO |
| CARGA E TRANSPORTE | 2 | PEDRA PARA BRITADOR |
| BRITAGEM | 3 | BRITAGEM PRIMÁRIA, BRITAGEM SEC./TERC./QUART. |
| EXPEDIÇÃO | 4 | EXPEDIÇÃO, MOV. DE ESTOQUE |
| SERVIÇOS AUXILIARES | 5 | OFICINA E ALMOXARIFADO, REFEITÓRIO E LIMPEZA, OUTROS SERVIÇOS |
| ADMINISTRAÇÃO | 6 | ADMINISTRAÇÃO |

---

## 4. Scripts de Importação

### 4.1 `import-ras.mjs` — Importação Completa dos Dados RAS

Importa todos os dados de custos das abas RAS01-RAS12 e MSET para as tabelas `custo_setor_equipamento` e `custo_setor_despesa`. Deve ser executado uma vez por período.

**Localização:** `/home/ubuntu/import-ras.mjs`  
**Uso:** `node import-ras.mjs`  
**Pré-requisito:** Arquivo da planilha em `/home/ubuntu/upload/CUSTOSOLAR-[MES]-[ANO].xlsx`

### 4.2 `update-ras-producao.mjs` — Atualização das Produções

Atualiza os campos `producaoTotal` e `unidadeProducao` para todos os equipamentos com produção registrada. Deve ser executado após o `import-ras.mjs`.

**Localização:** `/home/ubuntu/update-ras-producao.mjs`  
**Uso:** `node update-ras-producao.mjs`  
**Resultado esperado:** ~33 equipamentos atualizados para Março/2026

**Lógica central:**
```javascript
// Para cada equipamento em cada aba RAS:
// 1. Identificar início de bloco: colC === 'Sal.Oper./Enc. Oper.'
// 2. Capturar nome: colB
// 3. Na linha 'Produção Total do Equipamento': producao = MAX(getCellValue(ws,r,4), getCellValue(ws,r,colIdx))
// 4. Na linha 'Unidade de Produção': unidade = getCellValue(ws,r,4)
// 5. Na linha 'Total das Despesas do Equipamento': se custoSetor > 0 → UPDATE no banco
```

### 4.3 Adaptação para Outros Meses

Para importar Janeiro/2026 e Fevereiro/2026, os scripts precisam apenas de:
1. Alterar o caminho do arquivo (`PLANILHA`)
2. Alterar `PERIODO_MES` e `PERIODO_ANO`
3. Criar o período no banco via interface antes de executar

---

## 5. Unidades de Produção por Subgrupo

| Subgrupo | Unidade de Produção |
|----------|---------------------|
| DESMONTE PRIMÁRIO | **metro perf.** (perfuratrizes) / ton (outros) |
| DESMONTE SECUNDÁRIO | ton |
| DECAPEAMENTO | ton |
| PEDRA PARA BRITADOR | ton |
| BRITAGEM PRIMÁRIA | ton |
| BRITAGEM SEC./TERC./QUART. | ton |
| EXPEDIÇÃO | ton |
| MOV. DE ESTOQUE | ton |
| OUTROS SERVIÇOS | ton |

> **Observação importante:** As CARRETAS PERFURATRIZ (ROCK 01 e ROCK 02) e a PERFURATRIZ HIDRÁULICA WOLF FOX 8-20 têm unidade **"metro perf."**, não "ton". A planilha RAS01 registra a unidade corretamente para as carretas, mas pode registrar "ton" para a Wolf Fox — nesse caso, o UPDATE manual é necessário até que a planilha fonte seja corrigida.

---

## 6. Roadmap de Evolução

### 6.1 Fase 2 — Integração com ERP DataGold (Abr/2026 em diante)

A partir de Abril/2026, os dados de custo passarão a vir dos relatórios exportados do ERP DataGold. As atividades planejadas são:

1. **Mapeamento de relatórios:** Identificar quais relatórios do DataGold correspondem às abas RAS da planilha CUSTOSOLAR.
2. **Parser de relatórios:** Desenvolver um parser para os formatos de exportação do DataGold (CSV, Excel, PDF ou outro formato disponível).
3. **Tela de importação na interface:** Criar um botão "Importar Relatório DataGold" na tela de Importação de Planilha, eliminando a necessidade de scripts manuais.
4. **Validação cruzada:** Comparar os primeiros meses importados via DataGold com os dados históricos das planilhas para garantir consistência.

### 6.2 Fase 3 — Integração via API (TBD)

Quando a API do DataGold estiver disponível (REST/SOAP ou outro protocolo), a integração direta eliminará a necessidade de exportação manual. As opções a avaliar são:

- **REST API:** Endpoint HTTP com autenticação JWT/OAuth — solução preferencial por ser moderna e amplamente suportada.
- **SOAP/Web Services:** Comum em ERPs mais antigos — requer geração de cliente WSDL.
- **Banco de dados direto:** Acesso read-only ao banco do DataGold via conexão MySQL/SQL Server — viável mas requer acordo de infraestrutura.
- **Webhook/Evento:** DataGold notifica o SOLAR quando novos dados estão disponíveis — ideal para automação em tempo real.

### 6.3 Reutilização em Outros Sistemas

Os dois outros sistemas que utilizam a mesma planilha CUSTOSOLAR herdarão toda a estrutura aqui documentada:

- **Schema do banco de dados:** Idêntico (tabelas `periodo_custo`, `custo_setor_equipamento`, `custo_setor_despesa`)
- **Scripts de importação:** `import-ras.mjs` e `update-ras-producao.mjs` reutilizáveis com ajuste apenas do `DATABASE_URL` e caminho da planilha
- **Mapeamento de abas:** Idêntico se a estrutura da planilha for a mesma
- **Lógica de produção:** `MAX(colE, colSetor)` com acesso direto à propriedade `.v`

---

## 7. Lições Aprendidas

| Problema | Causa | Solução |
|----------|-------|---------|
| Produção de caminhões não importada | `sheet_to_json` retorna `null` para células de fórmula | Usar `getCellValue()` com acesso direto à propriedade `.v` |
| Produção de caminhões = 0 mesmo com `.v` correto | Caminhões têm produção na coluna do setor, não na coluna E | Usar `MAX(colE, colSetor)` |
| Unidade "ton" para perfuratriz | Planilha fonte registra "ton" para Wolf Fox | UPDATE manual; corrigir planilha fonte |
| Nomes de equipamentos com espaços extras | Inconsistência na planilha | Usar `TRIM(equipamentoNome)` no WHERE do UPDATE |
| Coluna `codigo` não existe em `periodo_custo` | Schema usa `mes` + `ano` em vez de código | Filtrar por `mes = ? AND ano = ?` |

---

## 8. Referências Técnicas

- **Biblioteca XLSX (SheetJS):** Leitura de planilhas Excel com suporte a fórmulas via opção `cellFormula: true`. Valores calculados disponíveis em `cell.v`.
- **Stack do projeto:** React 19 + Tailwind 4 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB
- **Autenticação:** Manus OAuth com sessão por cookie
- **Hospedagem:** Manus WebDev (domínios: `solargest-us3q3oba.manus.space`, `dgsolar.manus.space`, `gem-solar.com`)
