# Plano de Portagem — Módulo de Apuração de Custos (SOLAR → PELEGRINE)

## 1. Resumo Executivo

Portar o módulo de Apuração de Custos do sistema SOLAR para o sistema PELEGRINE, adaptando a entrada de dados para a planilha do sistema Minerion SGA (CustosIP03.2026-NovoSistema.xlsx) e mantendo a mesma lógica de processamento (memória de cálculo, rateio) e saída (relatórios).

### Dados de Março/2026 (validação)
- **1.485 itens** filtrados de 6.387 totais
- **R$ 857.350,88** em despesas da planilha
- **R$ 138.224,86** em impostos (lançamento manual)
- **R$ 995.575,74** total geral estimado
- **46 equipamentos** e **55 setores/operacional** identificados nos 101 CCs da aba Filtros

---

## 2. Regras de Negócio da Importação

### 2.1 Filtro de Centros de Custo (aba "Filtros")
A aba "Filtros" define quais Cod. C.C participam da apuração. Cada CC tem um **Nível de Filtro (Empresa)**:

| Nível de Filtro | Regra | CCs |
|-----------------|-------|-----|
| **Irmãos Pelegrine** | Importar apenas despesas onde Empresa/Filial = "IRMAOS PELEGRINE" | ~30 CCs |
| **Todas** | Importar todas as despesas do CC, independente da empresa | ~69 CCs |
| **Todas (30%)** | Importar 30% do valor total das despesas do CC | 2 CCs (1527, 3143 - Diretoria) |

### 2.2 Dados a Importar por Item
De cada linha da aba "Custos IP 03.2026":
- **Data** (col 10)
- **Descrição** (col 6)
- **Qtd.** (col 7)
- **Esp.** (col 8 - unidade)
- **Valor** (col 12)
- **Lanc. Contábil** (col 9)
- **Referencia** (col 11)

### 2.3 Classificação de Despesas por Grupo → Conta de Custo
A coluna "Grupo" (col 4) classifica as despesas:

| Conta de Custo | Grupos da Planilha | Valor Mar/26 |
|----------------|-------------------|--------------|
| **Combustível** | COMBUSTIVEL/LUBRIF. (diesel, gasolina, álcool) | R$ 149.265 |
| **Lubrificantes** | COMBUSTIVEL/LUBRIF. (óleos, graxas, fluidos) | R$ 10.792 |
| **Peças de Desgaste** | PNEUS, REVESTIMENTO/MANDIBULA, ROLETES, CORREIAS | R$ 104.892 |
| **Outras Despesas** | SERVICOS, ALIMENTACAO, SEGURANCA/EPI, AJUDA DE CUSTO, DOACAO, RETIRADA DE LUCRO | R$ 248.597 |
| **Peças de Reposição / Itens de Consumo** | MATERIAL MECANICO, FILTROS, MANGUEIRAS, ELETRICO, ROLAMENTO, SOLDA, etc. (residual) | R$ 120.380 |
| **Salários/Folha** | PROVISAO FOLHA PAGTO (todos os regimes), PRO-LABORE, SALARIO A PAGAR, RESCISAO | R$ 213.949 |
| **Material de Perfuração** | MATERIAL DE PERFURACAO | R$ 5.509 |
| **Explosivos** | EXPLOSIVO | (R$ 0 em mar/26) |
| **Despesas Financeiras** | TARIFAS, TAXAS, TARIFA DE CARTOES | R$ 3.966 |
| **Imp., Trib., Taxas e CEFEM** | Lançamento manual (PDF Minerion) | R$ 138.225 |

### 2.4 Impostos (Lançamento Manual)
Fonte: Balancete Contábil Fiscal do Minerion SGA (PDF)
- Conta 3.1.9.01.1 - IMPOSTOS → coluna ".Debitos." = valor total do mês
- Composição: ICMS, ISS, PIS, COFINS, CEFEM
- Março/2026: R$ 138.224,86

---

## 3. Mapeamento de Centros de Custo

### 3.1 Área A - PRODUCAO/OPERACIONAL (20 CCs)

**Pedreira Sr. do Bonfim:**
- Perfuração (Operacional + Equipamentos: Carreta Perf. 01-02, Compressores)
- Extração/Desmonte (Operacional + Desmonte Primário/Secundário)
- Britagem/Rebritagem (Operacional + Equipamentos: Britador JC900, Rebritador HP200, Peneira, TC, Calha, etc.)
- Central de Energia

### 3.2 Área B - PRODUCAO/AUXILIARES (52 CCs)

**Equip. de Apoio:** Fiat Stradas, L200, Motos, Carro Pipa, Trator
**Carregamento:** Pá Carregadeiras (04-06), Escavadeiras (02-06), Empilhadeiras (02-06)
**Transporte:** Caçambas Estrada (04-06), Caçambas Fora de Estrada (RK430, Traçadas), Muncks
**Manutenção:** Mecânica Industrial, Mecânica Autos/Máquinas, Elétrica, Tornos/Fresas, Máq. Solda
**Outros:** Controle de Qualidade, Meio Ambiente, Parque Industrial

### 3.3 Área C - NAO OPERACIONAL (17 CCs)

**Administração:** Almoxarifado, Contabilidade, Escritório Central, Escritório Unidade, Refeitório, Vestiário, Doação
**Vendas:** Comissão, Publicidade, Frete, Veículos, Viagens, Operacional
**Diretoria:** Aparicio Pelegrine (30%), Fernando Pelegrine (30%), + Despesas ADM de cada

### 3.4 Área E - DESPESAS FINANCEIRAS (12 CCs)

Juros, Taxas, Cartório, Desconto Títulos, Encargos, IOF, Multas, Tarifas, Cobrança, Juros Finame, Taxas Cartão Cielo

---

## 4. Correspondência Cod. C.C → Equipamento/Setor

O mapeamento se dá pelo campo "código/Tag" do sistema Pelegrine. Equipamentos e contas que não tiverem cadastro/correspondência serão criados.

### Equipamentos com despesas em Março/2026:
| CC | Equipamento | Valor |
|----|-------------|-------|
| 3144 | Britador JC900 | R$ 70.254 |
| 3517 | Rebritador HP200 | R$ 41.890 |
| 3562 | Caçamba Estrada (04 Branca PKS2721 → via CC 3699?) | R$ 22.757 |
| 3699 | Caçamba 04 Branca PKS2721 | R$ 22.666 |
| 3163 | Britagem/Rebritagem Operacional | R$ 94.296 |
| 3787 | Pá Carregadeira 05 621E | R$ 14.427 |
| 3801 | Escavadeira 03 CX220B/01 | R$ 12.313 |
| 3800 | Escavadeira 05 Hyundai R220-LC | R$ 10.416 |
| 3832 | Pá Carregadeira 06 WA200 | R$ 8.889 |
| 3512 | Carreta de Perfuração 02 | R$ 8.222 |
| 3535 | Escavadeira 02 CX220A | R$ 7.619 |
| 3875 | Escavadeira 06 PC240LC | R$ (ver dados) |
| 3736 | Caçamba 05 Branca PFL1383 | R$ (ver dados) |
| 3753 | Caçamba 06 Branca PLM5C40 | R$ (ver dados) |
| 3146 | Transportadores de Correia | R$ 2.762 |
| 3551 | Caçamba Fora Estrada (RK430) | R$ 1.955 |
| 3528 | Rebritador 5 1/2 X 36 | R$ 1.711 |
| 3751 | Carro Pipa 02 | R$ 1.170 |
| 3575 | L200 KEF3595 | R$ 1.161 |
| 3584 | Motos | R$ 1.019 |
| 3148 | Rebritador 5 1/2 X 36 | R$ 650 |

---

## 5. Diferenças em relação ao SOLAR

| Aspecto | SOLAR | PELEGRINE |
|---------|-------|-----------|
| Legado (mar/26 para trás) | Sim | **Não** |
| Conta "Despesas Indiretas" | Sim | **Não existe** |
| Fonte de dados | Planilha DataGold + Fluxo + Salários | **1 planilha Minerion SGA** + impostos manual |
| Impostos | Importados da planilha | **Lançamento manual** (PDF balancete) |
| Filtro de empresa | Não aplicável | **Sim** (Irmãos Pelegrine / Todas / 30%) |
| Fator de rateio | Não aplicável | **30% para Diretoria** (CCs 1527, 3143) |

---

## 6. Fluxo de Importação Proposto

```
1. Upload da planilha .xlsx (Custos IP XX.YYYY)
2. Parser lê aba "Filtros" → monta mapa de CCs válidos + regra de empresa
3. Parser lê aba "Custos IP XX.YYYY" → filtra por CCs válidos + regra de empresa
4. Para cada item filtrado:
   a. Identifica Cod.C.C → busca correspondência no cadastro (equipamento ou setor)
   b. Classifica Grupo → conta de custo (Combustível, Lubrificantes, Peças de Desgaste, etc.)
   c. Aplica fator (1.0 ou 0.30 para Diretoria)
   d. Grava item_despesa com: data, descrição, qtd, esp, valor, lanc_contabil, referencia
5. Lançamento manual de Impostos (tela separada ou mesma tela)
6. Processamento: memória de cálculo + rateio (mesma lógica SOLAR)
7. Saída: relatórios sintéticos e analíticos (mesma lógica SOLAR)
```

---

## 7. Próximos Passos

1. **Definir mapeamento completo** Cod.C.C → equipamento/setor no Pelegrine (com o usuário)
2. **Implementar parser** da planilha Minerion SGA
3. **Adaptar schema** (sem conta Despesas Indiretas, com filtro de empresa e fator 30%)
4. **Portar módulo de processamento** (MEM, MSET, MEMGERAL)
5. **Portar relatórios** (sintéticos e analíticos)
6. **Validar** com dados de março/2026 (R$ 995.575,74 total)
