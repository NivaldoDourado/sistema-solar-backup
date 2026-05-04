# KNOWLEDGE BASE — Sistema SOLAR

> **Versão:** Mai/2026 — Revisão completa após implementação de Março/2026  
> **Aplicação:** Este documento cobre todo o aprendizado, estrutura e lógica de importação do Sistema SOLAR. Deve ser reutilizado nos dois outros sistemas que utilizam a mesma planilha CUSTOSOLAR.

---

## 1. Contexto de Negócio

O **Sistema SOLAR** é uma plataforma web de gestão de custos operacionais para mineração/pedreira. Ele centraliza dados que residem em planilhas Excel (CUSTOSOLAR), permitindo visualização analítica, apuração de custo por tonelada e relatórios gerenciais.

A estratégia de implantação segue três fases:

| Fase | Período | Fonte de Dados | Status |
|------|---------|----------------|--------|
| 1 — Histórico | Jan–Mar/2026 | Planilhas CUSTOSOLAR (Excel) | Em andamento |
| 2 — Transição | Abr/2026 em diante | Relatórios exportados do ERP DataGold | Planejado |
| 3 — Integração | TBD | API direta com ERP DataGold (REST/SOAP/outro) | Futuro |

O mesmo modelo de planilha CUSTOSOLAR é utilizado em **outros dois sistemas** que serão implantados com a mesma arquitetura e lógica de importação documentada aqui.

---

## 2. Estrutura da Planilha CUSTOSOLAR

### 2.1 Abas Relevantes para Importação

| Aba | Conteúdo | Processado por |
|-----|----------|----------------|
| `EMPRESA` | Período (mês/ano), produção vendida (SP09) | Interface web (Etapa 1) |
| `PRODSEC` | Produção total do mês em toneladas | Interface web (Etapa 1) |
| `MEMGERAL` | Lançamentos consolidados por conta de custo | Interface web (Etapa 1) |
| `RSSET` | Custo por setor/subsetor (resumo sintético) | Interface web (Etapa 1) |
| `RAS01`–`RAS12` | Custo detalhado por equipamento, por setor | `import-ras.mjs` (Etapa 2) |
| `MSET` | Despesas específicas por setor (Energia, Explosivos, etc.) | `import-ras.mjs` (Etapa 2) |

### 2.2 Mapeamento das Abas RAS para Setores

| Aba | Subsetor | Grupo | setorLinha | colIdx (0-based) |
|-----|---------|-------|-----------|-----------------|
| RAS01 | DESMONTE PRIMÁRIO | DESMONTE DE ROCHA | 1 | 11 |
| RAS02 | DESMONTE SECUNDÁRIO | DESMONTE DE ROCHA | 2 | 12 |
| RAS03 | DECAPEAMENTO | DESMONTE DE ROCHA | 8 | 18 |
| RAS04 | PEDRA PARA BRITADOR | CARGA E TRANSPORTE | 6 | 16 |
| RAS05 | BRITAGEM PRIMÁRIA | BRITAGEM | 3 | 13 |
| RAS06 | BRITAGEM SEC./TERC./QUART. | BRITAGEM | 4 | 14 |
| RAS07 | EXPEDIÇÃO | EXPEDIÇÃO | 9 | 19 |
| RAS08 | MOV. DE ESTOQUE | EXPEDIÇÃO | 7 | 17 |
| RAS09 | OFICINA E ALMOXARIFADO | SERVIÇOS AUXILIARES | 11 | 21 |
| RAS10 | REFEITÓRIO E LIMPEZA | SERVIÇOS AUXILIARES | 12 | 22 |
| RAS11 | OUTROS SERVIÇOS | SERVIÇOS AUXILIARES | 5 | 15 |
| RAS12 | ADMINISTRAÇÃO | ADMINISTRAÇÃO | 10 | 20 |

**`colIdx`** é o índice de coluna (0-based) que contém o valor rateado para aquele setor dentro de cada bloco de equipamento.

### 2.3 Mapeamento de Linhas de Setor (coluna G, 0-based)

Dentro de cada bloco de equipamento, as linhas de setor seguem esta ordem fixa:

| setorLinha | Setor |
|-----------|-------|
| 0 | TOTAL DO PERÍODO |
| 1 | DESMONTE PRIMÁRIO |
| 2 | DESMONTE SECUNDÁRIO |
| 3 | BRITAGEM PRIMÁRIA |
| 4 | BRITAGEM SEC./TERC./QUART. |
| 5 | OUTROS SERVIÇOS |
| 6 | PEDRA PARA BRITADOR |
| 7 | MOV. DE ESTOQUE |
| 8 | DECAPEAMENTO |
| 9 | EXPEDIÇÃO |
| 10 | ADMINISTRAÇÃO |
| 11 | OFICINA E ALMOXARIFADO |
| 12 | REFEITÓRIO E LIMPEZA |

### 2.4 Estrutura de Bloco de Equipamento (14 linhas)

Cada equipamento ocupa um bloco fixo de linhas dentro de cada aba RAS:

```
Linha 0  (cabeçalho): col[1] = "EQUIPAMENTO"
Linha +0: col[1]=NOME_EQUIP, col[2]="Sal.Oper./Enc. Oper.", col[4]=valor_total, col[colIdx]=valor_setor
Linha +1: "Depreciação"
Linha +2: "Combustível"
Linha +3: "Lubrificantes"
Linha +4: "Peças de Desgaste"
Linha +5: "Peças de Reposição/Item de Consumo"
Linha +6: "Outras Despesas"
Linha +7: "Vida Útil (Hr) / Deprec. (R$/Hr)"
Linha +8: "Valor Inicial / Valor Final"
Linha +9: "Produção Total do Equipamento"  ← col[4]=valor_global, col[colIdx]=valor_setor
Linha +10: "Unidade de Produção"            ← col[4]=unidade (ex: "ton", "metro perf.")
Linha +11: "Equipamento Controlado por Hrs ou Km?"
Linha +12: "Total das Despesas do Equipamento" ← col[4]=total_geral, col[colIdx]=total_setor
```

**Filtro de pertinência ao setor:** um equipamento pertence ao setor da aba se tiver `horasTrabalhadas > 0` na linha `setorLinha` (coluna 7, 0-based).

### 2.5 Células com Fórmulas — Problema Crítico

A maioria das células de produção e custo contém **fórmulas Excel** (referências a outras abas). A biblioteca `xlsx` (SheetJS) armazena o valor calculado na propriedade `.v` da célula. O acesso correto é **sempre via propriedade `.v`**, nunca via `sheet_to_json` com `defval: null`.

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

Leitura do workbook deve incluir `cellFormula: true`:
```javascript
const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, cellFormula: true });
```

### 2.6 Lógica de Produção — Regra MAX(colE, colSetor)

- **Coluna E (idx 4):** produção total global do equipamento. Válida para equipamentos de uso exclusivo (perfuratrizes, britadores).
- **Coluna do setor (colIdx):** produção proporcional ao setor. Usada para caminhões que trabalham em múltiplos setores (colE = 0 nesses casos).

**Regra de importação:**
```javascript
producao = Math.max(getCellValue(ws, r, 4) || 0, getCellValue(ws, r, colIdx) || 0);
```

### 2.7 Estrutura da Aba MSET (Despesas Específicas)

A aba MSET tem **blocos de 14 linhas**, com **dois setores por bloco** (esquerdo e direito):

```
Linha 0 do bloco: col[1]=nome_setor_esq, col[4]=nome_setor_dir
Linha 1 do bloco: "DESCRIÇÃO" / "VALOR" (cabeçalho)
Linhas 2-13:
  col[1] = descrição da conta (setor esquerdo)
  col[2] = valor da conta (setor esquerdo)
  col[4] = descrição da conta (setor direito)
  col[5] = valor da conta (setor direito)
```

**Identificação do cabeçalho de bloco:** col[1] está em maiúsculas E a próxima linha tem col[1] = "DESCRIÇÃO".

### 2.8 Estrutura da Aba RSSET

| Coluna | Conteúdo |
|--------|---------|
| A | Grupo (aparece apenas na 1ª linha do grupo) |
| B | Subsetor |
| E | Custo Fixo |
| F | Custo Variável |
| G | Total Custo |
| H | Despesa Fixa |
| I | Despesa Variável |
| J | Total Despesa |
| K | Total Geral (célula K1 contém o período) |
| L | Custo/t (R$/ton) |

**Período:** extraído da célula K1 (índice `[0][10]`).  
**Início dos dados:** linha 6 (índice 5, 0-based).  
**Parada:** ao encontrar "TOTAL DOS DESEMBOLSOS" na coluna B.

### 2.9 Estrutura da Aba MEMGERAL

A aba MEMGERAL tem 3 tabelas lado a lado. A importação usa a **3ª ocorrência** de "RATEIO POR TIPO DE DESEMBOLSO" na coluna 7 (tabela verde = TOTAL consolidado):

| Índice | Coluna |
|--------|--------|
| 7 | Nome da conta |
| 8 | Custo Fixo (CF) |
| 9 | Custo Variável (CV) |
| 10 | Despesa Fixa (DF) |
| 11 | Despesa Variável (DV) |

O mapeamento de nomes da planilha para contas do banco é feito por **similaridade fuzzy** (limiar mínimo de 70%).

---

## 3. Estrutura do Banco de Dados

### 3.1 Tabelas Principais do Módulo de Custo

```
periodo_custo
├── id (PK)
├── mes, ano
├── producaoTotal (toneladas produzidas)
├── quantidadeVendida (toneladas vendidas/expedidas)
└── fechado (enum: 'sim'|'nao')

conta_custo
├── id (PK)
├── nome (ex: "Combustível", "Peças de Reposição / Itens de Consumo")
├── ativo (enum: 'sim'|'nao')
└── aliases (texto livre para mapeamento fuzzy)

lancamento_custo
├── id (PK)
├── periodoCustoId (FK → periodo_custo)
├── contaCustoId (FK → conta_custo)
└── valor (decimal 14,2)

custo_setor
├── id (PK)
├── periodoCustoId (FK)
├── grupoNome, subsetorNome
├── custoFixo, custoVariavel, totalCusto
├── despesaFixa, despesaVariavel, totalDespesa
├── totalGeral, custoTon
└── ordemExibicao

custo_setor_equipamento
├── id (PK)
├── periodoCustoId (FK)
├── grupoNome, subsetorNome
├── equipamentoNome
├── salOperEncOper, depreciacao, combustivel, lubrificantes
├── pecasDesgaste, pecasReposicao, outrasDespesas
├── totalDespesasEquipamento
├── horasTrabalhadas, qtdCombustivelLitros
├── producaoTotal (NULL se não há produção registrada)
├── unidadeProducao (ex: "ton", "metro perf.")
└── ordemExibicao

custo_setor_despesa
├── id (PK)
├── periodoCustoId (FK)
├── grupoNome, subsetorNome
├── descricao (ex: "Energia Elétrica", "Explosivos e Acessórios")
├── valor
└── ordemExibicao
```

### 3.2 Hierarquia de Grupos e Subsetores

| Grupo | Ordem | Subsetores |
|-------|-------|-----------|
| DESMONTE DE ROCHA | 1 | DESMONTE PRIMÁRIO, DESMONTE SECUNDÁRIO, DECAPEAMENTO |
| CARGA E TRANSPORTE | 2 | PEDRA PARA BRITADOR |
| BRITAGEM | 3 | BRITAGEM PRIMÁRIA, BRITAGEM SEC./TERC./QUART. |
| EXPEDIÇÃO | 4 | EXPEDIÇÃO, MOV. DE ESTOQUE |
| SERVIÇOS AUXILIARES | 5 | OFICINA E ALMOXARIFADO, REFEITÓRIO E LIMPEZA, OUTROS SERVIÇOS |
| ADMINISTRAÇÃO | 6 | ADMINISTRAÇÃO |

### 3.3 Contas de Custo Cadastradas

| ID | Nome |
|----|------|
| 1 | RH - ADM / Salários não Operacionais |
| 2 | Impostos, CEFEM e Outras Taxas |
| 3 | Encargos de Movimentação Financeira |
| 4 | Despesas Administrativas |
| 5 | Energia Elétrica |
| 6 | Explosivos e Acessórios |
| 7 | Outras Despesas de Setores |
| 8 | Equipamentos de Apoio |
| 9 | Despesas Indiretas |
| 10 | Consultorias Especializadas |
| 11 | Entrega de Material |
| 12 | Salários da Diretoria |
| 13 | RH - Salários da Operação |
| 14 | Combustível |
| 15 | Lubrificantes |
| 16 | Peças de Desgaste |
| 17 | Peças de Reposição / Itens de Consumo |
| 18 | Pneus |
| 19 | Outras Despesas dos Equipamentos |
| 20 | Depreciação |
| 30002 | Frota/Man.Pat./Seg./Out. |
| 30003 | Comissão de Vendas |
| 30004 | Sal.Oper./Enc. Oper. |

---

## 4. Fluxo de Importação de um Novo Mês

A importação de um novo mês segue **três etapas obrigatórias**, nesta ordem:

### Etapa 1 — Importar via Interface Web

1. Acessar a tela **Importação de Planilha** no sistema
2. Fazer upload do arquivo `CUSTOSOLAR-MÊS-ANO.xlsx`
3. O sistema processa automaticamente:
   - **Aba EMPRESA**: extrai mês/ano e quantidade vendida (linha SP09 = EXPEDIÇÃO)
   - **Aba PRODSEC**: extrai produção total do mês
   - **Aba MEMGERAL**: lê a 3ª ocorrência de "RATEIO POR TIPO DE DESEMBOLSO" e cria lançamentos via mapeamento fuzzy
   - **Aba RSSET**: lê linha a linha (a partir da linha 6), cria registros em `custo_setor`

### Etapa 2 — Executar `import-ras.mjs`

```bash
# 1. Editar as variáveis no início do script:
#    PLANILHA = '/home/ubuntu/upload/CUSTOSOLAR-MÊS-ANO.xlsx'
#    (O período é extraído automaticamente da aba RSSET, célula K1)

# 2. Executar:
cd /home/ubuntu
node import-ras.mjs
```

**O que o script faz:**
- Busca o `periodoCustoId` pelo mês/ano extraído da planilha
- **Limpa** todos os registros existentes de `custo_setor_equipamento` e `custo_setor_despesa` para o período
- Processa as abas **RAS01–RAS12** → insere em `custo_setor_equipamento`
- Processa a aba **MSET** → insere em `custo_setor_despesa` (cada conta individualmente)

### Etapa 3 — Executar `update-ras-producao.mjs`

```bash
# 1. Editar as variáveis no início do script:
#    PLANILHA = '/home/ubuntu/upload/CUSTOSOLAR-MÊS-ANO.xlsx'
#    PERIODO_MES = <mês>   (ex: 2 para fevereiro)
#    PERIODO_ANO = <ano>   (ex: 2026)

# 2. Executar:
cd /home/ubuntu
node update-ras-producao.mjs
```

**O que o script faz:**
- Atualiza `producaoTotal` e `unidadeProducao` na tabela `custo_setor_equipamento`
- Usa acesso direto à propriedade `.v` para capturar valores de fórmulas
- Aplica a regra `MAX(colE, colSetor)` para caminhões e equipamentos compartilhados
- **Resultado esperado:** ~33 equipamentos atualizados por período

> **Pré-requisito:** O período deve existir no banco (criado na Etapa 1) antes de executar os scripts. Se não existir, o script retorna: `"Período X/YYYY não encontrado. Crie o período em Lançamento de Custos antes de importar."`

---

## 5. Unidades de Produção por Subgrupo

| Subgrupo | Unidade de Produção |
|----------|---------------------|
| DESMONTE PRIMÁRIO | **metro perf.** (perfuratrizes) |
| DESMONTE SECUNDÁRIO | ton |
| DECAPEAMENTO | ton |
| PEDRA PARA BRITADOR | ton |
| BRITAGEM PRIMÁRIA | ton |
| BRITAGEM SEC./TERC./QUART. | ton |
| EXPEDIÇÃO | ton |
| MOV. DE ESTOQUE | ton |
| OFICINA E ALMOXARIFADO | — (sem produção) |
| REFEITÓRIO E LIMPEZA | — (sem produção) |
| OUTROS SERVIÇOS | — (sem produção) |
| ADMINISTRAÇÃO | — (sem produção) |

> **Atenção:** A PERFURATRIZ HIDRÁULICA WOLF FOX 8-20 pode ter unidade "ton" na planilha fonte. Corrigir via UPDATE direto no banco após cada importação enquanto a planilha fonte não for ajustada pelo responsável.

---

## 6. Funcionalidades do Sistema

### 6.1 Telas Implementadas

| Tela | Rota | Descrição |
|------|------|-----------|
| Dashboard | `/` | Visão geral com KPIs |
| Apuração de Custo | `/apuracao-custo` | Lançamentos consolidados por conta, gráficos, custo/ton |
| Custo Sintético por Setor | `/custo-setor` | Resumo por grupo e subsetor, custo/ton por setor |
| Relatório Analítico | `/custo-setor-analitico` | Detalhamento por equipamento e despesas específicas |
| Importação de Planilha | `/importacao` | Upload da planilha CUSTOSOLAR |

### 6.2 Sistema de Drill-down (Navegação Bidirecional)

O sistema implementa navegação bidirecional em três níveis:

```
Apuração de Custo
  └─ clique em conta (ex: "Peças de Reposição")
     → /custo-setor-analitico?conta=pecasReposicao
       └─ banner amarelo + coluna destacada + botão "← Apuração de Custo"

Custo por Setor
  ├─ clique em grupo (ex: "BRITAGEM")
  │  → /custo-setor-analitico?grupo=BRITAGEM
  │    └─ banner amarelo + botão "← Custo por Setor"
  └─ clique em subsetor (ex: "PEDRA PARA BRITADOR")
     → /custo-setor-analitico?subsetor=PEDRA+PARA+BRITADOR
       └─ banner amarelo + botão "← Custo por Setor"
```

**Query params suportados pelo Relatório Analítico:**

| Param | Exemplo | Efeito |
|-------|---------|--------|
| `?conta=<campo>` | `?conta=combustivel` | Filtra e destaca a coluna da conta |
| `?subsetor=<nome>` | `?subsetor=PEDRA+PARA+BRITADOR` | Exibe apenas o subsetor especificado |
| `?grupo=<nome>` | `?grupo=BRITAGEM` | Exibe apenas os subsetores do grupo |

**Campos de conta suportados:** `combustivel`, `pecasReposicao`, `lubrificantes`, `pecasDesgaste`, `salOperEncOper`, `outrasDespesas`

### 6.3 Destaque Visual de Coluna Filtrada

Quando o Relatório Analítico abre com `?conta=`, a coluna correspondente recebe:
- Cabeçalho: `bg-yellow-200` + borda superior amarela + texto em negrito
- Células: `bg-yellow-100` + borda lateral esquerda amarela
- Badge: "Ordenado por: [nome da conta]"
- Equipamentos ordenados por valor decrescente nessa coluna

### 6.4 Indicadores de Produção e Vendas

Exibidos na barra de status de **Apuração de Custo** e **Custo por Setor**:
```
Aberto  |  Produção: 92.675,15 t  |  Vendas: 90.236,48 t
```

---

## 7. Lições Aprendidas

| Problema | Causa | Solução |
|---------|-------|---------|
| Produção retornava `null` para fórmulas | `sheet_to_json` não avalia fórmulas | Acessar diretamente `cell.v` via `XLSX.utils.encode_cell` |
| Caminhões com produção = 0 na coluna E | Produção em coluna do setor (colIdx), não em colE | Usar `MAX(colE, colSetor)` |
| Despesas específicas importadas como uma linha só | Script lia seção resumida da MSET | Reescrever para ler blocos detalhados (col[1]/col[2] e col[4]/col[5]) |
| Período não encontrado no banco | Etapa 1 não foi executada antes dos scripts | Sempre executar a importação via interface antes dos scripts |
| Unidade "ton" para PERFURATRIZ WOLF FOX | Planilha fonte tem erro | UPDATE direto no banco após importação |
| Coluna `codigo` não existe em `periodo_custo` | Schema usa `mes` + `ano` | Filtrar por `mes = ? AND ano = ?` |
| Nomes de equipamentos com espaços extras | Inconsistência na planilha | Usar `TRIM()` no WHERE do UPDATE |

---

## 8. Roadmap de Fases

### Fase 1 — Planilha CUSTOSOLAR (Jan–Mar/2026) ✅ Em andamento

Scripts e parsers prontos e documentados.

**Meses a importar:**
- [x] Março/2026 — concluído
- [ ] Fevereiro/2026 — próximo
- [ ] Janeiro/2026 — a seguir

### Fase 2 — Relatórios DataGold (Abr/2026 em diante)

A partir de Abril/2026, os dados virão dos relatórios exportados pelo ERP DataGold. Atividades planejadas:

1. Receber um exemplo de relatório DataGold (qualquer formato: Excel, CSV, PDF)
2. Analisar a estrutura e desenvolver o parser correspondente
3. Criar botão "Importar Relatório DataGold" na tela de Importação
4. Validar os primeiros meses contra os dados históricos da Fase 1

### Fase 3 — Integração via API (futuro)

Conexão direta com o DataGold via API (provavelmente REST ou SOAP). Opções a avaliar:
- **API SET** (mencionada pelo cliente) — avaliar documentação disponível
- **REST API** com autenticação OAuth/JWT — solução preferencial
- **SOAP/Web Services** — comum em ERPs mais antigos
- **Banco de dados direto** — acesso read-only via MySQL/SQL Server
- **Webhook/Evento** — ideal para automação em tempo real

---

## 9. Reutilização em Outros Sistemas

Para replicar este sistema em outros dois projetos com a mesma planilha CUSTOSOLAR:

1. **Clonar o projeto** `sistema-solar` como base
2. **Copiar os scripts** `import-ras.mjs` e `update-ras-producao.mjs`
3. **Ajustar apenas:**
   - `DATABASE_URL` (apontar para o banco do novo sistema)
   - `PLANILHA` (caminho do arquivo)
   - `PERIODO_MES` e `PERIODO_ANO`
   - Mapeamento `RAS_ABAS` se a estrutura de setores for diferente
4. **O schema do banco é idêntico** — tabelas `periodo_custo`, `custo_setor_equipamento`, `custo_setor_despesa`
5. **A lógica de produção é idêntica** — `MAX(colE, colSetor)` com acesso direto à propriedade `.v`
6. **As contas de custo podem ter nomes diferentes** — o mapeamento fuzzy da MEMGERAL se adapta automaticamente (limiar 70%)

---

*Documento gerado em Mai/2026. Atualizar a cada nova fase de implementação.*
