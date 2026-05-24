# Análise da Planilha Pelegrine - CustosIP03.2026-NovoSistema.xlsx

## Estrutura Geral

### Aba "Custos IP 03.2026" (6.387 itens x 15 colunas)
| Col | Nome | Descrição |
|-----|------|-----------|
| 1 | Nome do Centro de Custo | Hierarquia completa: "A - PRODUCAO/OPERACIONAL, 01 - PEDREIRA, 250 - BRITAGEM..." |
| 2 | Empresa/Filial | IRMAOS PELEGRINE, PELEGRINE PREMOLDADOS, JACOMIX, JACOBRITA, TUBOS BONFIM, EDEPEL |
| 3 | Cod. C.C | Código numérico (139 únicos: 333, 347, 1008, 3512, etc.) |
| 4 | Grupo | Tipo de material/serviço (49 grupos: COMBUSTIVEL, MATERIAL MECANICO, PROVISAO FOLHA, etc.) |
| 5 | (sem nome) | Subgrupo (ex: "EPIS*") |
| 6 | Descrição | Descrição do item |
| 7 | Qtd. | Quantidade |
| 8 | Esp. | Unidade (PAR, UN, LT, etc.) |
| 9 | Lanc. Contabil | Número do lançamento contábil |
| 10 | Data | Data do lançamento |
| 11 | Referencia | Referência (BX, REG, NF, etc.) |
| 12 | Valor | Valor em R$ |
| 13 | (vazio) | Sem dados |
| 14 | CC | **VAZIO** - Header "CC" mas sem dados preenchidos |
| 15 | CS | **VAZIO** - Header "CS" mas sem dados preenchidos |

### Aba "Filtros" (103 registros x 7 colunas)
| Col | Descrição |
|-----|-----------|
| 1 | Cod. C.C |
| 2 | Status: "S" (houve despesas) ou "NT" (não houve) |
| 3 | Número de agrupamento (1-10 ou None) |
| 4 | Empresa: "Irmãos Pelegrine", "Todas", "Todas (30%)" |
| 5 | Descrição hierárquica completa do CC |
| 6 | "Sim" (sempre) |
| 7 | Status secundário: "S", "NT" ou None |

## Valores Totais
- **Total geral:** R$ 10.931.605,62
- **Total de itens:** 6.387

## Por Empresa/Filial
| Empresa | Valor |
|---------|-------|
| PELEGRINE PREMOLDADOS | R$ 3.441.932,42 |
| IRMAOS PELEGRINE | R$ 1.070.554,04 |
| JACOMIX | R$ 416.897,86 |
| JACOBRITA | R$ 255.690,45 |
| TUBOS BONFIM | R$ 161.410,40 |
| EDEPEL | R$ 119.317,64 |

## Observação Importante
As colunas CC (14) e CS (15) estão **completamente vazias** nesta planilha.
O mapeamento de conta de custo e setor precisará ser feito via:
- Cod. C.C → correspondência definida pelo usuário
- Aba Filtros → agrupamentos por número na coluna 3

## Hierarquia dos Centros de Custo (da coluna "Nome do Centro de Custo")
### A - PRODUCAO/OPERACIONAL
- 01 - PEDREIRA (SR. DO BONFIM): Perfuração, Extração/Desmonte, Britagem/Rebritagem
- 02 - CONCRETEIRA (SR. DO BONFIM): Operacional, Equipamentos, Revenda
- 03 - FÁBRICA: Custo Composição, Produção/Operacional, Retoque/Acabamento, Cocada/Arruela
- 04 - OBRAS: Operacional
- 06 - CONCRETEIRA (JACOBINA): Operacional, Equipamentos
- 08 - PEDREIRA (JACOBINA): Britagem, Extração, Carregadeiras

### B - PRODUCAO/AUXILIARES
- 100 - Equip. de Apoio (Fiat Stradas, L200, Motos, Carro Pipa)
- 150 - Carregamento (Carregadeiras, Escavadeiras, Empilhadeiras)
- 200 - Transporte (Caçambas Estrada, Fora de Estrada, Muncks)
- 250 - Manutenção (Oficina Mecânica, Elétrica, Industrial)
- 300 - Controle de Qualidade
- 350 - Meio Ambiente
- 450 - Parque Industrial
- 500 - Apoio (S. EF.)

### C - NAO OPERACIONAL
- Administração (Almoxarifado, Contabilidade, Escritório, Refeitório, Vestiário, Doação)
- Vendas (Frete, Comissão)
- Diretoria (Aparicio Pelegrine, Fernando Pelegrine)

### E - DESPESAS FINANCEIRAS
- Juros, Cobrança, Taxas Cartão

### F - TRIBUTOS
- Federal
