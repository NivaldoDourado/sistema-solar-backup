# Lógica de Importação de Planilhas de Custos — Sistema SOLAR

**Documento técnico de referência** | Versão 1.0 | Maio/2026

---

## 1. Visão Geral

O Sistema SOLAR importa planilhas Excel de apuração de custos mensais produzidas por sistemas externos (atualmente o modelo **CUSTOSOLAR**, e futuramente outros dois sistemas da empresa). A importação é dividida em **duas etapas independentes**, executadas em sequência sobre o mesmo arquivo:

| Etapa | Endpoint | Aba(s) lida(s) | O que persiste |
|---|---|---|---|
| **1 — Sintética** | `POST /api/importacao-custo` | `MEMGERAL` + `EMPRESA` + `PRODSEC` | Lançamentos consolidados por conta de custo (`lancamento_custo`) + período (`periodo_custo`) |
| **2 — Analítica** | `POST /api/importacao-custo-setor-ras` | `MEM` + `MSET` | Rateio por equipamento/setor (`custo_setor_equipamento`) + despesas setoriais (`custo_setor_despesa`) |

A etapa 1 é **obrigatória** e cria o período. A etapa 2 é **complementar** — falha parcial não desfaz a etapa 1.

> **Regra fundamental:** As abas `MSET`, `MEM` e `MEMGERAL` contêm a **memória de cálculo** — o método matemático, as fórmulas de rateio e a lógica essencial. As abas `RAS` (ex.: `RSSET`, `RSDESMB`) são apenas relatórios de saída derivados dessas memórias e **não devem ser a fonte primária** de importação.

---

## 2. Estrutura das Abas Relevantes

### 2.1 Aba `EMPRESA`

Contém metadados do período e da empresa. Os campos lidos são:

| Coluna C | Coluna D | Uso |
|---|---|---|
| `DATA INICIAL DO CUSTO` | Data (ex.: `01/03/2026`) | Extrai mês e ano do período |

Adicionalmente, a linha com `SP09` / `EXPEDIÇÃO` na coluna B fornece a **quantidade vendida** (col F).

### 2.2 Aba `PRODSEC`

Contém a produção do mês. A linha com `PROD, DO MÊS (ton)` na coluna B fornece o **total de produção** (col C).

### 2.3 Aba `MEMGERAL` — Consolidação Total

Esta é a aba central da etapa 1. Ela contém **três tabelas lado a lado**, todas com o cabeçalho `RATEIO POR TIPO DE DESEMBOLSO`:

```
Col 0-5: RATEIO POR SETOR
Col 7-11: RATEIO POR TIPO DE DESEMBOLSO
  ├── 1ª ocorrência (col 7): DESPESAS (laranja) — apenas despesas
  ├── 2ª ocorrência (col 7): CUSTOS (azul) — apenas custos
  └── 3ª ocorrência (col 7): TOTAL consolidado (verde) ← USADA NA IMPORTAÇÃO
```

**A importação usa exclusivamente a 3ª ocorrência** (tabela verde = TOTAL), que consolida custos + despesas. O layout de colunas dentro desta tabela é:

| Índice (0-based) | Conteúdo |
|---|---|
| 7 | Nome da conta (ex.: `Sal.Adm./Diretoria/Pró-Labore/Encargos`) |
| 8 | Custo Fixo (CF) |
| 9 | Custo Variável (CV) |
| 10 | Despesa Fixa (DF) |
| 11 | Despesa Variável (DV) |

O valor importado para cada conta é a **soma CF + CV + DF + DV**.

### 2.4 Aba `MEM` — Memória de Equipamentos

Contém o rateio dos gastos de cada equipamento pelos setores em que ele trabalhou. A estrutura é de **blocos por equipamento**:

- **Col 1:** Nome do equipamento (aparece na primeira linha do bloco)
- **Col 2:** Tipo de despesa (`Salário do Operador`, `Combustível`, `Depreciação`, etc.)
- **Col 4:** Valor total da despesa do equipamento
- **Cols 11–22:** Valor da despesa rateado por setor (ver mapeamento abaixo)
- Linha `Total das Despesas do Equipame...`: col 4 = total geral, cols 11–22 = total por setor

**Mapeamento de colunas 11–22 para setores (CUSTOSOLAR):**

| Col | Subsetor | Grupo |
|---|---|---|
| 11 | DESMONTE PRIMÁRIO | DESMONTE DE ROCHA |
| 12 | DESMONTE SECUNDÁRIO | DESMONTE DE ROCHA |
| 13 | BRITAGEM PRIMÁRIA | BRITAGEM |
| 14 | BRITAGEM SEC./TERC./QUART. | BRITAGEM |
| 15 | OUTROS SERVIÇOS | APOIO À PRODUÇÃO |
| 16 | PEDRA PARA BRITADOR | PEDRA PARA BRITADOR |
| 17 | MOV. DE ESTOQUE | APOIO À PRODUÇÃO |
| 18 | DECAPEAMENTO | DESMONTE DE ROCHA |
| 19 | EXPEDIÇÃO | EXPEDIÇÃO |
| 20 | ADMINISTRAÇÃO | ADMINISTRAÇÃO |
| 21 | OFICINA E ALMOXARIFADO | SERVIÇOS AUXILIARES |
| 22 | REFEITÓRIO E LIMPEZA | SERVIÇOS AUXILIARES |

> **Atenção para outros sistemas:** O número de colunas e a ordem dos setores podem variar. O mapeamento `COL_SETOR_MAP` no arquivo `importacaoCustoSetorRas.ts` deve ser ajustado para cada sistema.

**Lógica de rateio proporcional (MEM):**

Para cada equipamento, o valor de cada tipo de despesa é distribuído proporcionalmente entre os setores:

```
proporção_setor = valor_total_setor / total_geral_equipamento
valor_despesa_no_setor = valor_despesa_tipo × proporção_setor
```

Exemplo: se um equipamento tem R$ 10.000 de combustível e trabalhou 40% do tempo no Desmonte Primário, então R$ 4.000 de combustível é atribuído ao Desmonte Primário.

**Mapeamento de tipos de despesa da MEM para campos do banco:**

| Nome na planilha | Campo no banco |
|---|---|
| `Salário do Operador` / `Sal.Oper./Enc. Oper.` | `salOperEncOper` |
| `Depreciação` | `depreciacao` |
| `Combustível (Critério 1)` / `Combustível` | `combustivel` |
| `Lubrificantes` | `lubrificantes` |
| `Peças de Desgaste` | `pecasDesgaste` |
| `Peças de Repos./Item de Cons.` / `Peças de Reposição` | `pecasReposicao` |
| `Outras Despesas` / `Outras Despesas (Serviços, etc)` | `outrasDespesas` |

### 2.5 Aba `MSET` — Memória de Setores (Despesas Específicas)

Contém as despesas que **não são de equipamentos** mas são atribuídas diretamente a cada setor (ex.: salários administrativos, impostos, despesas de escritório). A estrutura é de **blocos de 14 linhas com 2 setores por bloco**:

```
Linha N:   [col 1] = Nome setor esquerdo   [col 4] = Nome setor direito
Linha N+1: [col 2] = "VALOR"               [col 5] = "VALOR"
Linhas N+2 a N+12: contas do setor
  [col 1] = descrição da conta (esquerdo)  [col 2] = valor
  [col 4] = descrição da conta (direito)   [col 5] = valor
```

**Detecção de blocos:** O parser localiza todas as linhas onde `col[2] === "VALOR"` e `col[5] === "VALOR"` — a linha anterior é sempre o cabeçalho do bloco com os nomes dos dois setores.

**Validação de setores:** Apenas setores presentes no `MSET_GRUPO_MAP` são processados. Setores desconhecidos são ignorados silenciosamente.

**Contas a ignorar:** `DESCRIÇÃO / VALOR`, `TOTAL DAS DESPESAS`, `TOTAL`, células vazias, e contas com valor zero.

### 2.6 Aba `DESPSET` — Despesas de Setores (variante)

Em outros sistemas da empresa, a aba equivalente à `MSET` pode se chamar `DESPSET`. A **lógica matemática é idêntica** — blocos de setores com despesas específicas atribuídas diretamente. O que muda são:

- O nome da aba
- Os nomes dos setores (que devem ser adicionados ao `MSET_GRUPO_MAP`)
- Os nomes das contas dentro de cada setor
- A ausência das abas `RAS` (RSSET, RSDESMB, etc.)

---

## 3. Mapeamento de Contas: MEMGERAL → Sistema

O importador usa um sistema de **correspondência fuzzy** (distância de Levenshtein) com limiar de 70% de similaridade, complementado por uma tabela de **aliases explícitos** para casos onde os nomes diferem muito entre a planilha e o cadastro do sistema.

### 3.1 Tabela de Aliases Atual (CUSTOSOLAR)

| Nome na planilha MEMGERAL | Nome no sistema SOLAR |
|---|---|
| `Sal.Adm./Diretoria/Pró-Labore/Encargos` | `RH - ADM / Salários não Operacionais` |
| `Sal. do Oper.` / `Sal. Oper.` | `Sal.Oper./Enc. Oper.` |
| `Peças de Reposição` | `Peças de Reposição / Itens de Consumo` |
| `Outras Despesas` | `Outras Despesas dos Equipamentos` |
| `Imp., Trib., Taxas e CEFEM` | `Impostos, CEFEM e Outras Taxas` |
| `Desp. Admin., Telef. e Inform.` | `Despesas Administrativas` |
| `Outras Desp. Setor Proc.` | `Outras Despesas de Setores` |
| `Equip. Apoio (Comb., Lub., Peças, Serv.)` | `Equipamentos de Apoio` |
| `Jurídico / Cons. Esp. / Serv. Ter.` | `Consultorias Especializadas` |
| `Comisão de Vendas` *(erro de grafia)* | `Comissão de Vendas` |

> **Para novos sistemas:** Ao integrar um novo sistema de custos, o primeiro passo é comparar os nomes de contas da planilha com os cadastros no SOLAR e adicionar os aliases necessários na tabela `ALIASES` do arquivo `importacaoCusto.ts`.

### 3.2 Algoritmo de Mapeamento

Para cada conta encontrada na planilha MEMGERAL:

1. Normalizar o nome: minúsculas, remover acentos, substituir pontuação por espaço, colapsar espaços.
2. Verificar se existe um alias para o nome normalizado.
3. Para cada conta cadastrada no sistema, calcular a similaridade de Levenshtein entre o nome da planilha e o nome do sistema (com e sem alias).
4. Aceitar o mapeamento se a melhor similaridade for ≥ 70%.
5. Contas sem mapeamento são listadas no campo `naoMapeados` da resposta da API.

---

## 4. Extração do Período

O período (mês/ano) é extraído com a seguinte ordem de prioridade:

1. **Aba `EMPRESA`:** linha onde col C = `DATA INICIAL DO CUSTO`, col D = data.
2. **Aba `RSSET`:** célula K1 (índice `[0][10]`).
3. **Fallback genérico:** varrer as primeiras 5 linhas de todas as abas buscando padrão `MM/YYYY` ou data válida.

---

## 5. Fluxo Completo de Importação

```
Arquivo Excel (.xlsx)
        │
        ├─── Aba EMPRESA ──────────────────────► Período (mês/ano) + Qtd. Vendida
        ├─── Aba PRODSEC ──────────────────────► Produção Total (ton)
        │
        ├─── Aba MEMGERAL (3ª tabela verde) ──► Lançamentos por conta (sintético)
        │         └── Fuzzy match + aliases ──► contaCusto.id
        │                                       └── INSERT/UPDATE lancamento_custo
        │
        ├─── Aba MEM ──────────────────────────► Equipamentos × Setores (analítico)
        │         └── Rateio proporcional ─────► custo_setor_equipamento
        │
        └─── Aba MSET / DESPSET ───────────────► Despesas setoriais (analítico)
                  └── Blocos 2 setores/bloco ──► custo_setor_despesa
```

---

## 6. Grupos e Setores do CUSTOSOLAR

Os grupos e subsetores reconhecidos pelo importador atual são:

| Grupo | Subsetores |
|---|---|
| DESMONTE DE ROCHA | DECAPEAMENTO, DESMONTE PRIMÁRIO, DESMONTE SECUNDÁRIO |
| BRITAGEM | BRITAGEM PRIMÁRIA, BRITAGEM SEC./TERC./QUART. |
| PEDRA PARA BRITADOR | PEDRA PARA BRITADOR |
| EXPEDIÇÃO | EXPEDIÇÃO, MOV. DE ESTOQUE |
| SERVIÇOS AUXILIARES | OFICINA E ALMOXARIFADO, REFEITÓRIO E LIMPEZA, OUTROS SERVIÇOS, APOIO GERAL |
| ADMINISTRAÇÃO | ADMINISTRAÇÃO |

---

## 7. Adaptação para Outros Sistemas de Custos

Conforme orientação do cliente, a empresa opera **três sistemas de custos** com planilhas de estrutura similar. Os dois sistemas adicionais **não utilizam as abas RAS** (`RSSET`, `RSDESMB`, etc.) e diferem do CUSTOSOLAR apenas em:

| Aspecto | O que muda | Onde ajustar no código |
|---|---|---|
| Nome da aba de setores | `MSET` → `DESPSET` (ou outro nome) | `importacaoCustoSetorRas.ts`: linha `workbook.Sheets["MSET"]` |
| Nomes dos setores/subsetores | Diferentes grupos e subsetores | `MSET_GRUPO_MAP` e `MSET_SETORES_VALIDOS` |
| Mapeamento de colunas (MEM) | Colunas 11–22 podem ter ordem diferente | `COL_SETOR_MAP` |
| Nomes das contas (MEMGERAL) | Diferentes descrições de contas | Tabela `ALIASES` em `importacaoCusto.ts` |
| Nomes dos tipos de despesa (MEM) | Diferentes descrições de tipos | `CONTA_MAP_MEM` |

**O que permanece idêntico:**
- A lógica de rateio proporcional (MEM): `proporção = valor_setor / total_equipamento`
- A estrutura de blocos da MSET/DESPSET: 2 setores por bloco, 14 linhas, detecção por `col[2] === "VALOR"`
- A tabela verde da MEMGERAL como fonte dos lançamentos sintéticos
- O algoritmo de fuzzy matching para mapeamento de contas
- A sequência de 2 etapas (sintética → analítica)
- As tabelas do banco de dados (`lancamento_custo`, `custo_setor_equipamento`, `custo_setor_despesa`)

### 7.1 Checklist para Integrar um Novo Sistema

Ao receber a planilha do novo sistema, seguir esta sequência:

1. **Identificar as abas disponíveis** — verificar se existem `EMPRESA`, `PRODSEC`, `MEMGERAL`, `MEM`, `MSET`/`DESPSET`.
2. **Mapear os setores** — listar todos os subsetores da aba `MSET`/`DESPSET` e atualizar `MSET_GRUPO_MAP`.
3. **Mapear as colunas da MEM** — verificar quais colunas (11–22) correspondem a quais setores e atualizar `COL_SETOR_MAP`.
4. **Mapear os tipos de despesa da MEM** — verificar os nomes das linhas de despesa e atualizar `CONTA_MAP_MEM`.
5. **Comparar contas da MEMGERAL com o cadastro** — listar as contas da tabela verde e verificar quais precisam de aliases.
6. **Cadastrar as contas faltantes no sistema** — se existirem contas novas, cadastrá-las em Cadastros → Plano de Contas.
7. **Adicionar aliases** — para contas com nomes muito diferentes, adicionar na tabela `ALIASES`.
8. **Testar com uma planilha real** — fazer upload e verificar o campo `naoMapeados` na resposta.

---

## 8. Tabelas do Banco de Dados

### `periodo_custo`
Criado/atualizado na etapa 1. Campos-chave: `mes`, `ano`, `producaoTotal`, `quantidadeVendida`, `despesasIndiretas`, `fechado`.

### `lancamento_custo`
Um registro por conta de custo por período. Campos: `periodoCustoId`, `contaCustoId`, `valor`, `observacoes`.

### `custo_setor`
Resumo sintético por subsetor (importado da aba `RSSET` — apenas no CUSTOSOLAR). Campos: `grupoNome`, `subsetorNome`, `custoFixo`, `custoVariavel`, `totalCusto`, `despesaFixa`, `despesaVariavel`, `totalDespesa`, `totalGeral`, `custoTon`.

### `custo_setor_equipamento`
Detalhe analítico por equipamento × subsetor (importado da aba `MEM`). Campos: `equipamentoNome`, `subsetorNome`, `grupoNome`, `salOperEncOper`, `depreciacao`, `combustivel`, `lubrificantes`, `pecasDesgaste`, `pecasReposicao`, `outrasDespesas`, `totalDespesasEquipamento`, `horasTrabalhadas`, `producaoTotal`.

### `custo_setor_despesa`
Despesas específicas por subsetor (importado da aba `MSET`/`DESPSET`). Campos: `subsetorNome`, `grupoNome`, `descricao`, `valor`, `ordemExibicao`.

---

## 9. Observações Operacionais

**Despesas Indiretas:** O campo `despesasIndiretas` do período **não é lido automaticamente** da planilha. No CUSTOSOLAR, o valor está na célula `L31` da aba `RSDESMB`. Atualmente é informado manualmente na tela de Lançamento de Custos. Futura automação: ler `RSDESMB!L31` durante a importação.

**Período fechado:** Se o período já existir com `fechado = "sim"`, a importação da etapa 1 é bloqueada com erro HTTP 400.

**Idempotência:** Ambas as etapas são idempotentes — reimportar a mesma planilha atualiza os registros existentes (upsert) sem duplicar.

**Limite de arquivo:** 20 MB por upload.

**Formatos aceitos:** `.xlsx` (XLSX moderno). Arquivos `.xls` (formato antigo) não são suportados.

---

*Documento gerado automaticamente a partir do código-fonte do Sistema SOLAR em Maio/2026.*
