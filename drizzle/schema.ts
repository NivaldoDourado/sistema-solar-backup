import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, boolean } from "drizzle-orm/mysql-core";

/**
 * Sistema de Gestão de Frotas e Operações
 * Schema completo do banco de dados
 */

// ============================================================================
// TABELA DE USUÁRIOS E AUTENTICAÇÃO
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  mustChangePassword: mysqlEnum("mustChangePassword", ["sim", "nao"]).default("nao").notNull(),
  whatsapp: varchar("whatsapp", { length: 20 }),
  cargo: varchar("cargo", { length: 100 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]).default("usuario").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// CADASTROS BÁSICOS
// ============================================================================

// Unidades de Medida
export const unidades = mysqlTable("unidades", {
  id: int("id").autoincrement().primaryKey(),
  sigla: varchar("sigla", { length: 10 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Unidade = typeof unidades.$inferSelect;
export type InsertUnidade = typeof unidades.$inferInsert;

// Setores
export const setores = mysqlTable("setores", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setor = typeof setores.$inferSelect;
export type InsertSetor = typeof setores.$inferInsert;

// Grupos de Equipamentos
export const gruposDeEquipamentos = mysqlTable("grupos_de_equipamentos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GrupoDeEquipamento = typeof gruposDeEquipamentos.$inferSelect;
export type InsertGrupoDeEquipamento = typeof gruposDeEquipamentos.$inferInsert;

// Equipamentos
export const equipamentos = mysqlTable("equipamentos", {
  id: int("id").autoincrement().primaryKey(),
  codigoTag: varchar("codigoTag", { length: 100 }),
  nomeDoEquipamento: varchar("nomeDoEquipamento", { length: 255 }).notNull(),
  modelo: varchar("modelo", { length: 255 }),
  ano: varchar("ano", { length: 4 }),
  serie: varchar("serie", { length: 255 }),
  capacidade: varchar("capacidade", { length: 100 }),
  hrAcumulado: decimal("hrAcumulado", { precision: 10, scale: 2 }),
  kmAcumulado: decimal("kmAcumulado", { precision: 10, scale: 2 }),
  siglaUnidadeId: int("siglaUnidadeId"),
  grupoId: int("grupoId"),
  setorId: int("setorId"),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Equipamento = typeof equipamentos.$inferSelect;
export type InsertEquipamento = typeof equipamentos.$inferInsert;

// Produtos
export const produtos = mysqlTable("produtos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  unidadeId: int("unidadeId"),
  tipoId: int("tipoId"),
  densidade: decimal("densidade", { precision: 10, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = typeof produtos.$inferInsert;

// Tipos de Produtos
export const tiposDeProdutos = mysqlTable("tipos_de_produtos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TipoDeProduto = typeof tiposDeProdutos.$inferSelect;
export type InsertTipoDeProduto = typeof tiposDeProdutos.$inferInsert;

// Combustíveis (usando tabela de produtos com tipo específico)
export const combustiveis = mysqlTable("combustiveis", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  unidadeId: int("unidadeId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Combustivel = typeof combustiveis.$inferSelect;
export type InsertCombustivel = typeof combustiveis.$inferInsert;

// Serviços
export const servicos = mysqlTable("servicos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Servico = typeof servicos.$inferSelect;
export type InsertServico = typeof servicos.$inferInsert;

// Operadores/Motoristas
export const operadoresMotoristas = mysqlTable("operadores_motoristas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  funcao: mysqlEnum("funcao", ["operador", "motorista", "ambos"]).default("ambos").notNull(),
  matricula: varchar("matricula", { length: 50 }),
  telefone: varchar("telefone", { length: 20 }),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OperadorMotorista = typeof operadoresMotoristas.$inferSelect;
export type InsertOperadorMotorista = typeof operadoresMotoristas.$inferInsert;

// Setor de Custo (Plano de Contas)
export const setorDeCusto = mysqlTable("setor_de_custo", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SetorDeCusto = typeof setorDeCusto.$inferSelect;
export type InsertSetorDeCusto = typeof setorDeCusto.$inferInsert;

/// Conta Custo (Plano de Contas detalhado com classificação)
export const contaCusto = mysqlTable("conta_custo", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  divisor: mysqlEnum("divisor", ["producao", "vendas"]).default("producao"),
  classificacao: mysqlEnum("classificacao", ["custo_fixo", "custo_variavel", "despesa_fixa", "despesa_variavel"]).default("custo_variavel"),
  observacao: text("observacao"),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ContaCusto = typeof contaCusto.$inferSelect;
export type InsertContaCusto = typeof contaCusto.$inferInsert;

// Período de Custo (cabeçalho mensal para apuração de custos)
export const periodoCusto = mysqlTable("periodo_custo", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(), // 1-12
  ano: int("ano").notNull(), // ex: 2026
  producaoTotal: decimal("producaoTotal", { precision: 12, scale: 2 }), // puxada do Método Caminhões
  quantidadeVendida: decimal("quantidadeVendida", { precision: 12, scale: 2 }), // puxada do módulo de Vendas
  despesasIndiretas: decimal("despesasIndiretas", { precision: 12, scale: 2 }).default("0"), // lançamento manual
  fretePeriodo: decimal("fretePeriodo", { precision: 12, scale: 2 }).default("0"), // frete repassado a transportadores (deduzido da receita bruta)
  observacoes: text("observacoes"),
  fechado: mysqlEnum("fechado", ["sim", "nao"]).default("nao").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PeriodoCusto = typeof periodoCusto.$inferSelect;
export type InsertPeriodoCusto = typeof periodoCusto.$inferInsert;

// Lançamento de Custo por Conta (detalhe do período de custo)
export const lancamentoCusto = mysqlTable("lancamento_custo", {
  id: int("id").autoincrement().primaryKey(),
  periodoCustoId: int("periodoCustoId").notNull(), // FK para periodo_custo
  contaCustoId: int("contaCustoId").notNull(),     // FK para conta_custo
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull().default("0"),
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LancamentoCusto = typeof lancamentoCusto.$inferSelect;
export type InsertLancamentoCusto = typeof lancamentoCusto.$inferInsert;

// Item individual de despesa importado da planilha DataGold
export const itemDespesaImportado = mysqlTable("item_despesa_importado", {
  id: int("id").autoincrement().primaryKey(),
  periodoCustoId: int("periodoCustoId").notNull(),
  lancamentoCustoId: int("lancamentoCustoId"),       // FK para lancamento_custo (agregado)
  equipamentoTag: varchar("equipamentoTag", { length: 100 }).notNull(), // Tag do equipamento na planilha
  equipamentoDescricao: varchar("equipamentoDescricao", { length: 255 }), // Descrição do equipamento
  equipamentoSistemaId: int("equipamentoSistemaId"),  // FK para equipamentos (se houver correspondência)
  classificacao: varchar("classificacao", { length: 50 }).notNull(), // lubrificantes, pecas_desgaste, pecas_reposicao, outras_despesas, combustivel
  sequencia: varchar("sequencia", { length: 20 }),     // Número sequencial da planilha
  data: varchar("data", { length: 20 }),               // Data do item (dd/mm/aa)
  produto: varchar("produto", { length: 500 }).notNull(), // Nome do produto/serviço
  grupoProduto: varchar("grupoProduto", { length: 255 }), // Grupo do produto na planilha
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).default("0"),
  custo: decimal("custo", { precision: 12, scale: 2 }).notNull().default("0"),
  centroCusto: varchar("centroCusto", { length: 20 }),  // Código do centro de custo
  hodometro: decimal("hodometro", { precision: 12, scale: 2 }), // Hodômetro/Horímetro
  intervalo: decimal("intervalo", { precision: 12, scale: 2 }), // Intervalo entre abastecimentos
  horaPorLitro: varchar("horaPorLitro", { length: 20 }), // Hora por litro (formato HH:MM:SS)
  litrosPorHora: varchar("litrosPorHora", { length: 20 }), // Litros por hora
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ItemDespesaImportado = typeof itemDespesaImportado.$inferSelect;
export type InsertItemDespesaImportado = typeof itemDespesaImportado.$inferInsert;

// Lançamento de Fluxo Realizado (importação da planilha Fluxo de Caixa DataGold)
export const lancamentoFluxo = mysqlTable("lancamento_fluxo", {
  id: int("id").autoincrement().primaryKey(),
  periodoCustoId: int("periodoCustoId").notNull(),
  // Conta principal (nível 1)
  contaPrincipalCodigo: varchar("contaPrincipalCodigo", { length: 20 }).notNull(),
  contaPrincipalNome: varchar("contaPrincipalNome", { length: 255 }).notNull(),
  // Conta do sistema SOLAR correspondente
  contaSistema: varchar("contaSistema", { length: 255 }).notNull(),
  // Setor destino
  setor: varchar("setor", { length: 100 }).notNull(),
  // Conta agrupada (nível 2) - pode ser a própria principal se não tem subcontas
  contaAgrupadaCodigo: varchar("contaAgrupadaCodigo", { length: 20 }),
  contaAgrupadaNome: varchar("contaAgrupadaNome", { length: 255 }),
  // Conta subagrupada (nível 3)
  contaSubagrupadaCodigo: varchar("contaSubagrupadaCodigo", { length: 20 }),
  contaSubagrupadaNome: varchar("contaSubagrupadaNome", { length: 255 }),
  // Nível hierárquico do lançamento (1=principal, 2=agrupada, 3=subagrupada, 4=sub-sub)
  nivel: int("nivel").notNull().default(2),
  // Valor do lançamento
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull().default("0"),
  // Observações (ex: "compra de areia")
  observacoes: text("observacoes"),
  // Se é resultado de rateio (energia produção)
  isRateio: boolean("isRateio").default(false),
  percentualRateio: decimal("percentualRateio", { precision: 5, scale: 4 }),
  // Metadados
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LancamentoFluxo = typeof lancamentoFluxo.$inferSelect;
export type InsertLancamentoFluxo = typeof lancamentoFluxo.$inferInsert;

// Lançamento de Custo por Setor (Custo Sintético por Setor)
export const custoSetor = mysqlTable("custo_setor", {
  id: int("id").autoincrement().primaryKey(),
  periodoCustoId: int("periodoCustoId").notNull(), // FK para periodo_custo
  // Grupo/Setor principal (ex: DESMONTE DE ROCHA, BRITAGEM)
  grupoNome: varchar("grupoNome", { length: 255 }).notNull(),
  // Subsetor (ex: DESMONTE PRIMÁRIO, BRITAGEM PRIMÁRIA)
  subsetorNome: varchar("subsetorNome", { length: 255 }).notNull(),
  // Referência ao setor operacional (pode ser nulo para subsetores agrupados)
  setorId: int("setorId"),
  // Valores da planilha RSSET
  custoFixo: decimal("custoFixo", { precision: 14, scale: 2 }).default("0"),
  custoVariavel: decimal("custoVariavel", { precision: 14, scale: 2 }).default("0"),
  totalCusto: decimal("totalCusto", { precision: 14, scale: 2 }).default("0"),
  despesaFixa: decimal("despesaFixa", { precision: 14, scale: 2 }).default("0"),
  despesaVariavel: decimal("despesaVariavel", { precision: 14, scale: 2 }).default("0"),
  totalDespesa: decimal("totalDespesa", { precision: 14, scale: 2 }).default("0"),
  totalGeral: decimal("totalGeral", { precision: 14, scale: 2 }).default("0"),
  // Custo por tonelada (calculado)
  custoTon: decimal("custoTon", { precision: 10, scale: 4 }).default("0"),
  // Percentual do total
  percentualTotal: decimal("percentualTotal", { precision: 8, scale: 4 }).default("0"),
  // Ordem de exibição
  ordemExibicao: int("ordemExibicao").default(0),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustoSetor = typeof custoSetor.$inferSelect;
export type InsertCustoSetor = typeof custoSetor.$inferInsert;

// ============================================================================
// MÓDULOS OPERACIONAIS
// ============================================================================

// Parte Diária (Cabeçalho)
export const parteDiaria = mysqlTable("parte_diaria", {
  id: int("id").autoincrement().primaryKey(),
  data: date("data").notNull(),
  equipamentoId: int("equipamentoId").notNull(),
  turno: varchar("turno", { length: 50 }),
  // Campos de Hora/Km (renomeados de horímetro)
  horaKmInicial: decimal("horaKmInicial", { precision: 10, scale: 2 }),
  horaKmFinal: decimal("horaKmFinal", { precision: 10, scale: 2 }),
  horaKmTrabalhados: decimal("horaKmTrabalhados", { precision: 10, scale: 2 }),
  // Campos de tempo
  tempoParadoLigado: decimal("tempoParadoLigado", { precision: 10, scale: 2 }),
  tempoParadoDesligado: decimal("tempoParadoDesligado", { precision: 10, scale: 2 }),
  tempoProdutivo: decimal("tempoProdutivo", { precision: 10, scale: 2 }),
  // Campos de produção
  producaoLivre: decimal("producaoLivre", { precision: 10, scale: 2 }),
  qtdFuros: decimal("qtdFuros", { precision: 10, scale: 2 }),
  profundidadeFuros: decimal("profundidadeFuros", { precision: 10, scale: 2 }),
  producaoPerfuracao: decimal("producaoPerfuracao", { precision: 10, scale: 2 }),
  // Campos de Produção Balança (para britadores e transportadoras de correia)
  leituraInicialBalanca: decimal("leituraInicialBalanca", { precision: 12, scale: 2 }),
  leituraFinalBalanca: decimal("leituraFinalBalanca", { precision: 12, scale: 2 }),
  producaoBalanca: decimal("producaoBalanca", { precision: 12, scale: 2 }),
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ParteDiaria = typeof parteDiaria.$inferSelect;
export type InsertParteDiaria = typeof parteDiaria.$inferInsert;

// Itens da Parte Diária (Múltiplas linhas de serviço)
export const parteDiariaItens = mysqlTable("parte_diaria_itens", {
  id: int("id").autoincrement().primaryKey(),
  parteDiariaId: int("parteDiariaId").notNull(),
  setorId: int("setorId").notNull(),
  servicoId: int("servicoId").notNull(),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).notNull(), // Número de viagens/ciclos
  producao: decimal("producao", { precision: 10, scale: 2 }), // Quantidade × Capacidade do equipamento
  operadorMotoristaId: int("operadorMotoristaId"), // FK para tabela operadores_motoristas
  operadorMotorista: varchar("operadorMotorista", { length: 255 }), // Campo legado - nome texto livre
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ParteDiariaItem = typeof parteDiariaItens.$inferSelect;
export type InsertParteDiariaItem = typeof parteDiariaItens.$inferInsert;

// Tempos de Descarga por Viagem (controle de produtividade no britador)
export const temposDescarga = mysqlTable("tempos_descarga", {
  id: int("id").autoincrement().primaryKey(),
  parteDiariaItemId: int("parteDiariaItemId").notNull(), // FK para parte_diaria_itens
  parteDiariaId: int("parteDiariaId").notNull(), // FK para parte_diaria (facilita consultas)
  numeroViagem: int("numeroViagem").notNull(), // Sequencial da viagem (1, 2, 3...)
  horaInicio: varchar("horaInicio", { length: 10 }).notNull(), // Formato HH:MM
  horaFinal: varchar("horaFinal", { length: 10 }).notNull(), // Formato HH:MM
  tempoMinutos: int("tempoMinutos"), // Tempo calculado em minutos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TempoDescarga = typeof temposDescarga.$inferSelect;
export type InsertTempoDescarga = typeof temposDescarga.$inferInsert;

// Configurações do Sistema (feature flags por cliente)
export const configuracoesSistema = mysqlTable("configuracoes_sistema", {
  id: int("id").autoincrement().primaryKey(),
  chave: varchar("chave", { length: 100 }).notNull().unique(),
  valor: varchar("valor", { length: 500 }).notNull(),
  descricao: text("descricao"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConfiguracaoSistema = typeof configuracoesSistema.$inferSelect;
export type InsertConfiguracaoSistema = typeof configuracoesSistema.$inferInsert;

// Abastecimento
export const abastecimento = mysqlTable("abastecimento", {
  id: int("id").autoincrement().primaryKey(),
  data: date("data").notNull(),
  equipamentoId: int("equipamentoId").notNull(),
  combustivelId: int("combustivelId").notNull(),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).notNull(),
  horaKm: varchar("horaKm", { length: 50 }),
  valorUnitario: decimal("valorUnitario", { precision: 10, scale: 2 }),
  valorTotal: decimal("valorTotal", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Abastecimento = typeof abastecimento.$inferSelect;
export type InsertAbastecimento = typeof abastecimento.$inferInsert;

// Produção
export const producao = mysqlTable("producao", {
  id: int("id").autoincrement().primaryKey(),
  data: date("data").notNull(),
  produtoId: int("produtoId").notNull(),
  equipamentoId: int("equipamentoId").notNull(),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).notNull(),
  metaDiaria: decimal("metaDiaria", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Producao = typeof producao.$inferSelect;
export type InsertProducao = typeof producao.$inferInsert;

// Custos
export const custos = mysqlTable("custos", {
  id: int("id").autoincrement().primaryKey(),
  data: date("data").notNull(),
  descricao: varchar("descricao", { length: 255 }).notNull(),
  valor: decimal("valor", { precision: 10, scale: 2 }).notNull(),
  setorDeCustoId: int("setorDeCustoId").notNull(),
  setorId: int("setorId"),
  equipamentoId: int("equipamentoId"),
  contaCustoId: int("contaCustoId"),
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Custo = typeof custos.$inferSelect;
export type InsertCusto = typeof custos.$inferInsert;

// ============================================================================
// MÓDULO DE MANUTENÇÃO
// ============================================================================

// Manutenção Preventiva
export const manutencaoPreventiva = mysqlTable("manutencao_preventiva", {
  id: int("id").autoincrement().primaryKey(),
  equipamentoId: int("equipamentoId").notNull(),
  descricao: varchar("descricao", { length: 255 }).notNull(),
  periodicidade: varchar("periodicidade", { length: 100 }),
  ultimaManutencao: date("ultimaManutencao"),
  proximaManutencao: date("proximaManutencao"),
  status: mysqlEnum("status", ["pendente", "em_andamento", "concluida", "atrasada"]).default("pendente").notNull(),
  observacoes: text("observacoes"),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ManutencaoPreventiva = typeof manutencaoPreventiva.$inferSelect;
export type InsertManutencaoPreventiva = typeof manutencaoPreventiva.$inferInsert;

// Manutenção Preditiva
export const manutencaoPreditiva = mysqlTable("manutencao_preditiva", {
  id: int("id").autoincrement().primaryKey(),
  equipamentoId: int("equipamentoId").notNull(),
  indicador: varchar("indicador", { length: 255 }).notNull(),
  valorMedido: decimal("valorMedido", { precision: 10, scale: 2 }),
  valorReferencia: decimal("valorReferencia", { precision: 10, scale: 2 }),
  dataLeitura: date("dataLeitura").notNull(),
  status: mysqlEnum("status", ["normal", "atencao", "critico"]).default("normal").notNull(),
  observacoes: text("observacoes"),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ManutencaoPreditiva = typeof manutencaoPreditiva.$inferSelect;
export type InsertManutencaoPreditiva = typeof manutencaoPreditiva.$inferInsert;

// Paradas Mecânicas
export const paradasMecanicas = mysqlTable("paradas_mecanicas", {
  id: int("id").autoincrement().primaryKey(),
  equipamentoId: int("equipamentoId").notNull(),
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim"),
  motivoParada: varchar("motivoParada", { length: 255 }).notNull(),
  descricao: text("descricao"),
  tempoParada: decimal("tempoParada", { precision: 10, scale: 2 }),
  custoEstimado: decimal("custoEstimado", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["em_andamento", "concluida"]).default("em_andamento").notNull(),
  horKmRevisao: decimal("horKmRevisao", { precision: 10, scale: 2 }),
  intervaloRevisao: decimal("intervaloRevisao", { precision: 10, scale: 2 }),
  horKmProximaRevisao: decimal("horKmProximaRevisao", { precision: 10, scale: 2 }),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ParadaMecanica = typeof paradasMecanicas.$inferSelect;
export type InsertParadaMecanica = typeof paradasMecanicas.$inferInsert;

// Paradas Normais
export const paradasNormais = mysqlTable("paradas_normais", {
  id: int("id").autoincrement().primaryKey(),
  equipamentoId: int("equipamentoId").notNull(),
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim"),
  motivoParada: varchar("motivoParada", { length: 255 }).notNull(),
  descricao: text("descricao"),
  tempoParada: decimal("tempoParada", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["planejada", "em_andamento", "concluida"]).default("planejada").notNull(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ParadaNormal = typeof paradasNormais.$inferSelect;
export type InsertParadaNormal = typeof paradasNormais.$inferInsert;

// ============================================================================
// MÓDULO DE MEDIÇÃO DAS PILHAS
// ============================================================================

export const medicaoPilhas = mysqlTable("medicao_pilhas", {
  id: int("id").autoincrement().primaryKey(),
  data: date("data").notNull(),
  equipamentoId: int("equipamentoId").notNull(),
  produtoId: int("produtoId").notNull(),
  medida1: decimal("medida1", { precision: 10, scale: 4 }).notNull(),
  medida2: decimal("medida2", { precision: 10, scale: 4 }).notNull(),
  medida3: decimal("medida3", { precision: 10, scale: 4 }).notNull(),
  mediaMedidas: decimal("mediaMedidas", { precision: 10, scale: 4 }),
  volumeRecipiente: decimal("volumeRecipiente", { precision: 10, scale: 4 }).notNull(),
  horaProdutiva: decimal("horaProdutiva", { precision: 10, scale: 4 }).notNull(),
  densidade: decimal("densidade", { precision: 10, scale: 4 }).notNull(),
  qtdProduzida: decimal("qtdProduzida", { precision: 10, scale: 4 }),
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MedicaoPilha = typeof medicaoPilhas.$inferSelect;
export type InsertMedicaoPilha = typeof medicaoPilhas.$inferInsert;

// ============================================================================
// HISTÓRICO DE PESAGENS (CAPACIDADE POR VIGÊNCIA)
// ============================================================================

export const pesagensEquipamentos = mysqlTable("pesagens_equipamentos", {
  id: int("id").autoincrement().primaryKey(),
  equipamentoId: int("equipamentoId").notNull(),
  capacidade: decimal("capacidade", { precision: 10, scale: 4 }).notNull(),
  dataVigencia: date("dataVigencia").notNull(), // Data a partir da qual esta capacidade passa a valer
  observacao: text("observacao"),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PesagemEquipamento = typeof pesagensEquipamentos.$inferSelect;
export type InsertPesagemEquipamento = typeof pesagensEquipamentos.$inferInsert;

// ============================================================================
// SISTEMA DE ALERTAS
// ============================================================================

export const alertas = mysqlTable("alertas", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["consumo_anormal", "producao_baixa", "custo_elevado", "manutencao_vencida"]).notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao"),
  equipamentoId: int("equipamentoId"),
  severidade: mysqlEnum("severidade", ["baixa", "media", "alta", "critica"]).default("media").notNull(),
  status: mysqlEnum("status", ["ativo", "resolvido", "ignorado"]).default("ativo").notNull(),
  dataDeteccao: timestamp("dataDeteccao").defaultNow().notNull(),
  dataResolucao: timestamp("dataResolucao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Alerta = typeof alertas.$inferSelect;
export type InsertAlerta = typeof alertas.$inferInsert;

// ============================================================================
// LOGS DE AUDITORIA
// ============================================================================

export const logs = mysqlTable("logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  acao: varchar("acao", { length: 255 }).notNull(),
  tabela: varchar("tabela", { length: 100 }),
  registroId: int("registroId"),
  detalhes: text("detalhes"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Log = typeof logs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;

// ============================================================================
// SISTEMA DE NOTIFICAÇÕES
// ============================================================================

export const notificacoes = mysqlTable("notificacoes", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["revisao_preventiva", "manutencao_vencida", "alerta_geral"]).notNull(),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  mensagem: text("mensagem").notNull(),
  equipamentoId: int("equipamentoId"),
  lida: mysqlEnum("lida", ["sim", "nao"]).default("nao").notNull(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notificacao = typeof notificacoes.$inferSelect;
export type InsertNotificacao = typeof notificacoes.$inferInsert;

// ============================================================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================================================

export const configuracoes = mysqlTable("configuracoes", {
  id: int("id").autoincrement().primaryKey(),
  chave: varchar("chave", { length: 100 }).notNull().unique(),
  valor: text("valor").notNull(),
  descricao: varchar("descricao", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Configuracao = typeof configuracoes.$inferSelect;
export type InsertConfiguracao = typeof configuracoes.$inferInsert;

// ============================================================================
// DESTINATÁRIOS WHATSAPP
// ============================================================================

export const destinatariosWhatsapp = mysqlTable("destinatarios_whatsapp", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  telefone: varchar("telefone", { length: 20 }).notNull(),
  cargo: varchar("cargo", { length: 100 }),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  // Cards que este destinatário recebe (JSON com array de strings)
  cardsSelecionados: text("cardsSelecionados"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DestinatarioWhatsapp = typeof destinatariosWhatsapp.$inferSelect;
export type InsertDestinatarioWhatsapp = typeof destinatariosWhatsapp.$inferInsert;

// ============================================================================
// MÓDULO DE PEÇAS DE DESGASTE
// ============================================================================

// Categorias de Peças de Desgaste
export const categoriasPecasDesgaste = mysqlTable("categorias_pecas_desgaste", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CategoriaPecaDesgaste = typeof categoriasPecasDesgaste.$inferSelect;
export type InsertCategoriaPecaDesgaste = typeof categoriasPecasDesgaste.$inferInsert;

// Peças de Desgaste (Catálogo)
export const pecasDesgaste = mysqlTable("pecas_desgaste", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  codigo: varchar("codigo", { length: 100 }),
  categoriaId: int("categoriaId").notNull(),
  unidade: varchar("unidade", { length: 50 }).default("un").notNull(),
  vidaUtilEstimada: varchar("vidaUtilEstimada", { length: 100 }),
  estoqueMinimo: int("estoqueMinimo").default(0),
  observacoes: text("observacoes"),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PecaDesgaste = typeof pecasDesgaste.$inferSelect;
export type InsertPecaDesgaste = typeof pecasDesgaste.$inferInsert;

// Movimentações de Peças de Desgaste
export const movimentacoesPecas = mysqlTable("movimentacoes_pecas", {
  id: int("id").autoincrement().primaryKey(),
  data: date("data").notNull(),
  pecaId: int("pecaId").notNull(),
  tipo: mysqlEnum("tipo", ["entrada", "saida", "troca"]).notNull(),
  quantidade: int("quantidade").notNull(),
  equipamentoId: int("equipamentoId"),
  notaFiscal: varchar("notaFiscal", { length: 100 }),
  fornecedor: varchar("fornecedor", { length: 255 }),
  valorUnitario: decimal("valorUnitario", { precision: 10, scale: 2 }),
  valorTotal: decimal("valorTotal", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MovimentacaoPeca = typeof movimentacoesPecas.$inferSelect;
export type InsertMovimentacaoPeca = typeof movimentacoesPecas.$inferInsert;

// Trocas de Peças vinculadas à Parte Diária
export const trocasPecasParteDiaria = mysqlTable("trocas_pecas_parte_diaria", {
  id: int("id").autoincrement().primaryKey(),
  parteDiariaId: int("parteDiariaId").notNull(),
  pecaId: int("pecaId").notNull(),
  quantidade: int("quantidade").notNull().default(1),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 2 }),
  custoTotal: decimal("custoTotal", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  movimentacaoId: int("movimentacaoId"), // FK para movimentacoes_pecas gerada automaticamente
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrocaPecaParteDiaria = typeof trocasPecasParteDiaria.$inferSelect;
export type InsertTrocaPecaParteDiaria = typeof trocasPecasParteDiaria.$inferInsert;

// ============================================================================
// MÓDULO DE VENDAS DE MATERIAL
// ============================================================================

// Clientes
export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cpfCnpj: varchar("cpfCnpj", { length: 20 }),
  inscricaoEstadual: varchar("inscricaoEstadual", { length: 30 }),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  endereco: varchar("endereco", { length: 500 }),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  cep: varchar("cep", { length: 10 }),
  observacoes: text("observacoes"),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

// Vendas (Notas Fiscais)
export const vendas = mysqlTable("vendas", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["venda", "amortizacao", "doacao"]).default("venda").notNull(),
  numeroNF: varchar("numeroNF", { length: 50 }),
  serieNF: varchar("serieNF", { length: 10 }),
  data: date("data").notNull(),
  clienteId: int("clienteId").notNull(),
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).default("0"),
  pesoTotal: decimal("pesoTotal", { precision: 12, scale: 2 }).default("0"),
  observacoes: text("observacoes"),
  transportadoraNome: varchar("transportadoraNome", { length: 200 }),
  motoristaNome: varchar("motoristaNome", { length: 200 }),
  placaVeiculo: varchar("placaVeiculo", { length: 20 }),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Venda = typeof vendas.$inferSelect;
export type InsertVenda = typeof vendas.$inferInsert;

// Itens de Venda (Produtos da Nota Fiscal)
export const vendaItens = mysqlTable("venda_itens", {
  id: int("id").autoincrement().primaryKey(),
  vendaId: int("vendaId").notNull(),
  produtoId: int("produtoId").notNull(),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }).notNull(),
  valorUnitario: decimal("valorUnitario", { precision: 10, scale: 2 }).notNull(),
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VendaItem = typeof vendaItens.$inferSelect;
export type InsertVendaItem = typeof vendaItens.$inferSelect;

// ============================================================================
// RESUMO DE VENDAS POR PRODUTO (importado do ERP)
// ============================================================================
export const resumoVendasProduto = mysqlTable("resumo_vendas_produto", {
  id: int("id").autoincrement().primaryKey(),
  // Período de referência
  periodoInicio: date("periodoInicio").notNull(),
  periodoFim: date("periodoFim").notNull(),
  // Dados do produto
  produto: varchar("produto", { length: 200 }).notNull(),
  grupo: varchar("grupo", { length: 100 }),
  marca: varchar("marca", { length: 100 }),
  // Valores
  valor: decimal("valor", { precision: 15, scale: 4 }).notNull(),
  quantidade: decimal("quantidade", { precision: 15, scale: 4 }).notNull(),
  vlMedio: decimal("vlMedio", { precision: 15, scale: 4 }),
  // Metadados
  setor: varchar("setor", { length: 100 }),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResumoVendaProduto = typeof resumoVendasProduto.$inferSelect;
export type InsertResumoVendaProduto = typeof resumoVendasProduto.$inferInsert;

// ============================================================================
// SISTEMA DE PERMISSÕES CONFIGURÁVEIS
// ============================================================================

export const permissoesPerfilModulo = mysqlTable("permissoes_perfil_modulo", {
  id: int("id").autoincrement().primaryKey(),
  perfil: mysqlEnum("perfil", ["admin", "diretor", "gerente", "consultoria", "coordenador", "usuario", "controle", "operador"]).notNull(),
  modulo: varchar("modulo", { length: 100 }).notNull(),
  visualizar: mysqlEnum("visualizar", ["sim", "nao"]).default("nao").notNull(),
  criar: mysqlEnum("criar", ["sim", "nao"]).default("nao").notNull(),
  editar: mysqlEnum("editar", ["sim", "nao"]).default("nao").notNull(),
  excluir: mysqlEnum("excluir", ["sim", "nao"]).default("nao").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PermissaoPerfilModulo = typeof permissoesPerfilModulo.$inferSelect;
export type InsertPermissaoPerfilModulo = typeof permissoesPerfilModulo.$inferInsert;
// ============================================================================
// METAS DE INDICADORES (PWA Mobile)
// ============================================================================
export const metasIndicadores = mysqlTable("metas_indicadores", {
  id: int("id").autoincrement().primaryKey(),
  indicador: varchar("indicador", { length: 100 }).notNull().unique(),
  // ex: "combustivel_litros", "custo_total", "producao_m3", "manutencoes_abertas"
  descricao: varchar("descricao", { length: 255 }),
  valorMeta: decimal("valorMeta", { precision: 15, scale: 2 }),
  valorLimiteAlerta: decimal("valorLimiteAlerta", { precision: 15, scale: 2 }),
  // "acima" = alerta quando valor > limite, "abaixo" = alerta quando valor < limite
  tipoAlerta: mysqlEnum("tipoAlerta", ["acima", "abaixo"]).default("acima").notNull(),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetaIndicador = typeof metasIndicadores.$inferSelect;
export type InsertMetaIndicador = typeof metasIndicadores.$inferInsert;

// ============================================================================
// PUSH SUBSCRIPTIONS (Web Push API - PWA Mobile)
// ============================================================================
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: varchar("userAgent", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// ============================================================================
// MÓDULO OUTRAS PARADAS (Cadastro de motivos de parada)
// ============================================================================
export const outrasParadas = mysqlTable("outras_paradas", {
  id: int("id").autoincrement().primaryKey(),
  descricao: varchar("descricao", { length: 255 }).notNull(),
  observacao: text("observacao"),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OutraParada = typeof outrasParadas.$inferSelect;
export type InsertOutraParada = typeof outrasParadas.$inferInsert;

// ============================================================================
// ITENS DE PARADA DA PARTE DIÁRIA (subgrupos Ligado e Desligado)
// ============================================================================
export const parteDiariaParadas = mysqlTable("parte_diaria_paradas", {
  id: int("id").autoincrement().primaryKey(),
  parteDiariaId: int("parteDiariaId").notNull(),
  tipo: mysqlEnum("tipo", ["ligado", "desligado"]).notNull(), // subgrupo
  horaInicial: varchar("horaInicial", { length: 10 }).notNull(), // HH:MM
  horaFinal: varchar("horaFinal", { length: 10 }).notNull(),     // HH:MM
  tempoDecorrido: decimal("tempoDecorrido", { precision: 10, scale: 2 }), // calculado
  motivoId: int("motivoId"), // FK para outras_paradas.id
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ParteDiariaParada = typeof parteDiariaParadas.$inferSelect;
export type InsertParteDiariaParada = typeof parteDiariaParadas.$inferInsert;

// ============================================================================
// MÓDULO CHECKLIST DE ROTINAS DIÁRIAS
// ============================================================================

// Cadastro de rotinas (gerenciado por consultoria/admin)
export const rotinas = mysqlTable("rotinas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  ordem: int("ordem").default(0).notNull(),
  ativo: mysqlEnum("ativo", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Rotina = typeof rotinas.$inferSelect;
export type InsertRotina = typeof rotinas.$inferInsert;

// Status diário de cada rotina (um registro por rotina por dia)
export const statusRotinaDiario = mysqlTable("status_rotina_diario", {
  id: int("id").autoincrement().primaryKey(),
  rotinaId: int("rotinaId").notNull(),
  data: date("data").notNull(), // data do dia (YYYY-MM-DD)
  status: mysqlEnum("status", ["concluido", "pendente", "nao_marcado"]).default("nao_marcado").notNull(),
  userId: int("userId").notNull(), // quem marcou
  observacao: text("observacao"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type StatusRotinaDiario = typeof statusRotinaDiario.$inferSelect;
export type InsertStatusRotinaDiario = typeof statusRotinaDiario.$inferInsert;

// ============================================================================
// MÓDULO RELATÓRIO ANALÍTICO POR SETOR (RAS) — Centros de Custo Detalhados
// ============================================================================

// Centro de Custo por Equipamento (dados das abas RAS01-RAS12)
// Cada registro representa um equipamento/centro de custo em um subsetor/período
export const custoSetorEquipamento = mysqlTable("custo_setor_equipamento", {
  id: int("id").autoincrement().primaryKey(),
  periodoCustoId: int("periodoCustoId").notNull(),   // FK para periodo_custo
  subsetorNome: varchar("subsetorNome", { length: 255 }).notNull(), // ex: DESMONTE PRIMÁRIO
  grupoNome: varchar("grupoNome", { length: 255 }).notNull(),       // ex: DESMONTE DE ROCHA
  equipamentoNome: varchar("equipamentoNome", { length: 255 }).notNull(), // ex: CARRETA PERFURATRIZ - ROCK 01
  // Despesas do equipamento
  salOperEncOper: decimal("salOperEncOper", { precision: 14, scale: 2 }).default("0"),
  depreciacao: decimal("depreciacao", { precision: 14, scale: 2 }).default("0"),
  combustivel: decimal("combustivel", { precision: 14, scale: 2 }).default("0"),
  lubrificantes: decimal("lubrificantes", { precision: 14, scale: 2 }).default("0"),
  pecasDesgaste: decimal("pecasDesgaste", { precision: 14, scale: 2 }).default("0"),
  pecasReposicao: decimal("pecasReposicao", { precision: 14, scale: 2 }).default("0"),
  outrasDespesas: decimal("outrasDespesas", { precision: 14, scale: 2 }).default("0"),
  totalDespesasEquipamento: decimal("totalDespesasEquipamento", { precision: 14, scale: 2 }).default("0"),
  // Informações operacionais
  horasTrabalhadas: decimal("horasTrabalhadas", { precision: 10, scale: 2 }).default("0"),
  qtdCombustivelLitros: decimal("qtdCombustivelLitros", { precision: 10, scale: 2 }).default("0"),
  producaoTotal: decimal("producaoTotal", { precision: 14, scale: 2 }).default("0"),
  unidadeProducao: varchar("unidadeProducao", { length: 50 }),
  ordemExibicao: int("ordemExibicao").default(0),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustoSetorEquipamento = typeof custoSetorEquipamento.$inferSelect;
export type InsertCustoSetorEquipamento = typeof custoSetorEquipamento.$inferInsert;

// Despesas Específicas do Setor (dados da aba MSET — Energia Elétrica, Explosivos, etc.)
// Cada registro representa uma conta de despesa em um subsetor/período
export const custoSetorDespesa = mysqlTable("custo_setor_despesa", {
  id: int("id").autoincrement().primaryKey(),
  periodoCustoId: int("periodoCustoId").notNull(),   // FK para periodo_custo
  subsetorNome: varchar("subsetorNome", { length: 255 }).notNull(), // ex: DESMONTE PRIMÁRIO
  grupoNome: varchar("grupoNome", { length: 255 }).notNull(),       // ex: DESMONTE DE ROCHA
  descricao: varchar("descricao", { length: 255 }).notNull(),       // ex: Energia Elétrica
  valor: decimal("valor", { precision: 14, scale: 2 }).default("0"),
  ordemExibicao: int("ordemExibicao").default(0),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustoSetorDespesa = typeof custoSetorDespesa.$inferSelect;
export type InsertCustoSetorDespesa = typeof custoSetorDespesa.$inferInsert;


// ============================================================================
// AVALIAÇÃO GLOBAL (Análise do Lucro/Prejuízo — modelo RSDESMB E35:E49)
// ============================================================================

export const avaliacaoGlobal = mysqlTable("avaliacao_global", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),

  // Bloco A — preenchido automaticamente (buscado do sistema)
  // faturamento: vem do resumo_vendas_produto
  // custos: vem da apuracao_custo (totalGeral com Despesas Indiretas)

  // Bloco C — Frete pela Competência (informado manualmente)
  frete: decimal("frete", { precision: 15, scale: 2 }).default("0").notNull(),

  // Bloco D — Valores que não são dos Custos pela Competência (informados manualmente)
  investEquip: decimal("investEquip", { precision: 15, scale: 2 }).default("0").notNull(),     // D1: Investimentos Equipamentos/Terrenos/Afins
  investBritagem: decimal("investBritagem", { precision: 15, scale: 2 }).default("0").notNull(), // D2: Investimentos Britagem/Processos/Afins
  difFrete: decimal("difFrete", { precision: 15, scale: 2 }).default("0").notNull(),           // D3: Diferença Frete (Fluxo de Caixa x Competência)
  difImpostos: decimal("difImpostos", { precision: 15, scale: 2 }).default("0").notNull(),     // D4: Diferença Impostos (Fluxo de Caixa x Competência)
  distribLucro: decimal("distribLucro", { precision: 15, scale: 2 }).default("0").notNull(),   // D5: Distribuição de Lucro/Retirada Sócios e Afins
  outros: decimal("outros", { precision: 15, scale: 2 }).default("0").notNull(),               // D6: Outros/Duplicatas

  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AvaliacaoGlobal = typeof avaliacaoGlobal.$inferSelect;
export type InsertAvaliacaoGlobal = typeof avaliacaoGlobal.$inferInsert;

// ============================================================================
// META DE CUSTO POR TONELADA (Simulação de Custos)
// ============================================================================
export const metaCustoTonelada = mysqlTable("meta_custo_tonelada", {
  id: int("id").autoincrement().primaryKey(),
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetaCustoTonelada = typeof metaCustoTonelada.$inferSelect;
export type InsertMetaCustoTonelada = typeof metaCustoTonelada.$inferInsert;


// ============================================================================
// LANÇAMENTO MANUAL DE SALÁRIOS (alocação em equipamentos ou setores)
// ============================================================================
export const lancamentoSalario = mysqlTable("lancamento_salario", {
  id: int("id").autoincrement().primaryKey(),
  periodoCustoId: int("periodoCustoId").notNull(), // FK para periodo_custo
  contaCustoId: int("contaCustoId").notNull(),     // FK para conta_custo (Sal.Oper., Sal.Adm., Sal. Diretoria/Pró-Labore)
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull().default("0"),
  // Destino: equipamento OU setor (um dos dois será preenchido)
  equipamentoId: int("equipamentoId"),             // FK para equipamentos (quando conta = Sal.Oper.)
  setorId: int("setorId"),                         // FK para setores (quando conta = Sal.Adm. ou Sal. Diretoria/Pró-Labore)
  descricao: varchar("descricao", { length: 255 }), // Descrição opcional (ex: "Operador João - Escavadeira")
  observacoes: text("observacoes"),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LancamentoSalario = typeof lancamentoSalario.$inferSelect;
export type InsertLancamentoSalario = typeof lancamentoSalario.$inferInsert;
