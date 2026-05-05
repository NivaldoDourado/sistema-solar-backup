# Estrutura do Painel de Avaliação Global
## Baseado na planilha RSDESMB (células E35:E49) — Março/2026

### BLOCO A — ANÁLISE DO LUCRO/PREJUÍZO (Estudo dos Custos pela Competência)

| Linha | Descrição | Valor (Mar/26) | Origem |
|---|---|---|---|
| A | Faturamento pela Competência (A) | R$ 7.726.398,17 | Resumo de Vendas ERP (importado) |
| B | Despesas do Estudo dos Custos pela Competência (B) | R$ 2.907.476,11 | Custo Total (Apuração de Custo) |
| C | Frete pela Competência (C) | R$ 1.552.995,14 | **Informado manualmente** |
| A-B-C | Saldo Bruto (A-B-C) | R$ 3.265.926,92 | Calculado: A - B - C |
| % | Margem Bruta | 42,27% | Calculado: Saldo Bruto / Faturamento |

### BLOCO D — ANÁLISE DO LUCRO/PREJUÍZO (Valores que não são dos Custos pela Competência)

| Linha | Descrição | Valor (Mar/26) | Origem |
|---|---|---|---|
| D1 | Investimentos Compras Equipamentos/Terrenos/Afins | R$ 1.618.863,25 | **Informado manualmente** |
| D2 | Investimentos/Modificações Britagem/Processos/Afins | R$ 120.079,98 | **Informado manualmente** |
| D3 | Diferença Frete (Fluxo de Caixa x Competência) | R$ 284.309,00 | **Informado manualmente** |
| D4 | Diferença Impostos (Fluxo de Caixa x Competência) | R$ 334.012,41 | **Informado manualmente** |
| D5 | Distribuição de Lucro/Retirada Sócios e Afins | R$ 100.000,00 | **Informado manualmente** |
| D6 | Dif. Fluxo de Cx. que não são da Compet./Outros/Duplicatas | R$ 67.733,86 | **Informado manualmente** |
| D | Total (D) | R$ 2.424.998,50 | Calculado: soma D1..D6 |

### RESULTADO FINAL

| Linha | Descrição | Valor (Mar/26) | Origem |
|---|---|---|---|
| A-B-C-D | Saldo Final (A-B-C-D) | R$ 840.928,42 | Calculado: Saldo Bruto - Total D |
| % | Margem Final | 10,88% | Calculado: Saldo Final / Faturamento |

---

## Regras de Cálculo

1. **Receita dos Produtos** = Faturamento (A) − Frete (C)
2. **Saldo Bruto** = Faturamento (A) − Custos (B) − Frete (C)
3. **Margem Bruta** = Saldo Bruto / Faturamento (A) × 100
4. **Total D** = D1 + D2 + D3 + D4 + D5 + D6
5. **Saldo Final** = Saldo Bruto − Total D
6. **Margem Final** = Saldo Final / Faturamento (A) × 100

---

## Campos Automáticos (buscados do sistema)
- **Faturamento (A)**: soma de `valor` da tabela `resumo_vendas_produto` para o período
- **Custos (B)**: `totalGeral` da tabela `apuracao_custo` para o período (com Despesas Indiretas)

## Campos Manuais (informados pelo usuário)
- Frete pela Competência (C)
- D1: Investimentos Equipamentos/Terrenos/Afins
- D2: Investimentos Britagem/Processos/Afins
- D3: Diferença Frete (Fluxo de Caixa x Competência)
- D4: Diferença Impostos (Fluxo de Caixa x Competência)
- D5: Distribuição de Lucro/Retirada Sócios
- D6: Outros/Duplicatas

---

## Schema da Tabela `avaliacao_global`

```sql
CREATE TABLE avaliacao_global (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mes INT NOT NULL,
  ano INT NOT NULL,
  frete DECIMAL(15,2) DEFAULT 0,          -- C: Frete pela Competência
  invest_equip DECIMAL(15,2) DEFAULT 0,   -- D1: Investimentos Equipamentos
  invest_britagem DECIMAL(15,2) DEFAULT 0, -- D2: Investimentos Britagem
  dif_frete DECIMAL(15,2) DEFAULT 0,      -- D3: Diferença Frete
  dif_impostos DECIMAL(15,2) DEFAULT 0,   -- D4: Diferença Impostos
  distrib_lucro DECIMAL(15,2) DEFAULT 0,  -- D5: Distribuição Lucro
  outros DECIMAL(15,2) DEFAULT 0,         -- D6: Outros/Duplicatas
  observacoes TEXT,
  createdAt DATETIME DEFAULT NOW(),
  updatedAt DATETIME DEFAULT NOW(),
  UNIQUE KEY (mes, ano)
);
```
