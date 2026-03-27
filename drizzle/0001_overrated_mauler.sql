CREATE TABLE `abastecimento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` date NOT NULL,
	`equipamentoId` int NOT NULL,
	`combustivelId` int NOT NULL,
	`quantidade` decimal(10,2) NOT NULL,
	`horaKm` varchar(50),
	`valorUnitario` decimal(10,2),
	`valorTotal` decimal(10,2),
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `abastecimento_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('consumo_anormal','producao_baixa','custo_elevado','manutencao_vencida') NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`descricao` text,
	`equipamentoId` int,
	`severidade` enum('baixa','media','alta','critica') NOT NULL DEFAULT 'media',
	`status` enum('ativo','resolvido','ignorado') NOT NULL DEFAULT 'ativo',
	`dataDeteccao` timestamp NOT NULL DEFAULT (now()),
	`dataResolucao` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categorias_pecas_desgaste` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categorias_pecas_desgaste_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`cpfCnpj` varchar(20),
	`inscricaoEstadual` varchar(30),
	`telefone` varchar(20),
	`email` varchar(320),
	`endereco` varchar(500),
	`cidade` varchar(100),
	`estado` varchar(2),
	`cep` varchar(10),
	`observacoes` text,
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `combustiveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`unidadeId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `combustiveis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `configuracoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chave` varchar(100) NOT NULL,
	`valor` text NOT NULL,
	`descricao` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoes_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuracoes_chave_unique` UNIQUE(`chave`)
);
--> statement-breakpoint
CREATE TABLE `configuracoes_sistema` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chave` varchar(100) NOT NULL,
	`valor` varchar(500) NOT NULL,
	`descricao` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoes_sistema_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuracoes_sistema_chave_unique` UNIQUE(`chave`)
);
--> statement-breakpoint
CREATE TABLE `conta_custo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conta_custo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` date NOT NULL,
	`descricao` varchar(255) NOT NULL,
	`valor` decimal(10,2) NOT NULL,
	`setorDeCustoId` int NOT NULL,
	`setorId` int,
	`equipamentoId` int,
	`contaCustoId` int,
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `destinatarios_whatsapp` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`telefone` varchar(20) NOT NULL,
	`cargo` varchar(100),
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`cardsSelecionados` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `destinatarios_whatsapp_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `equipamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoTag` varchar(100),
	`nomeDoEquipamento` varchar(255) NOT NULL,
	`modelo` varchar(255),
	`ano` varchar(4),
	`serie` varchar(255),
	`capacidade` varchar(100),
	`hrAcumulado` decimal(10,2),
	`kmAcumulado` decimal(10,2),
	`siglaUnidadeId` int,
	`grupoId` int,
	`setorId` int,
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `equipamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `grupos_de_equipamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `grupos_de_equipamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`acao` varchar(255) NOT NULL,
	`tabela` varchar(100),
	`registroId` int,
	`detalhes` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manutencao_preditiva` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipamentoId` int NOT NULL,
	`indicador` varchar(255) NOT NULL,
	`valorMedido` decimal(10,2),
	`valorReferencia` decimal(10,2),
	`dataLeitura` date NOT NULL,
	`status` enum('normal','atencao','critico') NOT NULL DEFAULT 'normal',
	`observacoes` text,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manutencao_preditiva_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manutencao_preventiva` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipamentoId` int NOT NULL,
	`descricao` varchar(255) NOT NULL,
	`periodicidade` varchar(100),
	`ultimaManutencao` date,
	`proximaManutencao` date,
	`status` enum('pendente','em_andamento','concluida','atrasada') NOT NULL DEFAULT 'pendente',
	`observacoes` text,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manutencao_preventiva_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `medicao_pilhas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` date NOT NULL,
	`equipamentoId` int NOT NULL,
	`produtoId` int NOT NULL,
	`medida1` decimal(10,4) NOT NULL,
	`medida2` decimal(10,4) NOT NULL,
	`medida3` decimal(10,4) NOT NULL,
	`mediaMedidas` decimal(10,4),
	`volumeRecipiente` decimal(10,4) NOT NULL,
	`horaProdutiva` decimal(10,4) NOT NULL,
	`densidade` decimal(10,4) NOT NULL,
	`qtdProduzida` decimal(10,4),
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `medicao_pilhas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentacoes_pecas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` date NOT NULL,
	`pecaId` int NOT NULL,
	`tipo` enum('entrada','saida','troca') NOT NULL,
	`quantidade` int NOT NULL,
	`equipamentoId` int,
	`notaFiscal` varchar(100),
	`fornecedor` varchar(255),
	`valorUnitario` decimal(10,2),
	`valorTotal` decimal(10,2),
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `movimentacoes_pecas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('revisao_preventiva','manutencao_vencida','alerta_geral') NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`mensagem` text NOT NULL,
	`equipamentoId` int,
	`lida` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operadores_motoristas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`funcao` enum('operador','motorista','ambos') NOT NULL DEFAULT 'ambos',
	`matricula` varchar(50),
	`telefone` varchar(20),
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operadores_motoristas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paradas_mecanicas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipamentoId` int NOT NULL,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp,
	`motivoParada` varchar(255) NOT NULL,
	`descricao` text,
	`tempoParada` decimal(10,2),
	`custoEstimado` decimal(10,2),
	`status` enum('em_andamento','concluida') NOT NULL DEFAULT 'em_andamento',
	`horKmRevisao` decimal(10,2),
	`intervaloRevisao` decimal(10,2),
	`horKmProximaRevisao` decimal(10,2),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paradas_mecanicas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paradas_normais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipamentoId` int NOT NULL,
	`dataInicio` timestamp NOT NULL,
	`dataFim` timestamp,
	`motivoParada` varchar(255) NOT NULL,
	`descricao` text,
	`tempoParada` decimal(10,2),
	`status` enum('planejada','em_andamento','concluida') NOT NULL DEFAULT 'planejada',
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paradas_normais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parte_diaria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` date NOT NULL,
	`equipamentoId` int NOT NULL,
	`turno` varchar(50),
	`horaKmInicial` decimal(10,2),
	`horaKmFinal` decimal(10,2),
	`horaKmTrabalhados` decimal(10,2),
	`tempoParadoLigado` decimal(10,2),
	`tempoParadoDesligado` decimal(10,2),
	`tempoProdutivo` decimal(10,2),
	`producaoLivre` decimal(10,2),
	`qtdFuros` decimal(10,2),
	`profundidadeFuros` decimal(10,2),
	`producaoPerfuracao` decimal(10,2),
	`leituraInicialBalanca` decimal(12,2),
	`leituraFinalBalanca` decimal(12,2),
	`producaoBalanca` decimal(12,2),
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parte_diaria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parte_diaria_itens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parteDiariaId` int NOT NULL,
	`setorId` int NOT NULL,
	`servicoId` int NOT NULL,
	`quantidade` decimal(10,2) NOT NULL,
	`producao` decimal(10,2),
	`operadorMotoristaId` int,
	`operadorMotorista` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parte_diaria_itens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pecas_desgaste` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`codigo` varchar(100),
	`categoriaId` int NOT NULL,
	`unidade` varchar(50) NOT NULL DEFAULT 'un',
	`vidaUtilEstimada` varchar(100),
	`estoqueMinimo` int DEFAULT 0,
	`observacoes` text,
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pecas_desgaste_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissoes_perfil_modulo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`perfil` enum('admin','diretor','gerente','consultoria','coordenador','usuario','controle','operador') NOT NULL,
	`modulo` varchar(100) NOT NULL,
	`visualizar` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`criar` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`editar` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`excluir` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permissoes_perfil_modulo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pesagens_equipamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipamentoId` int NOT NULL,
	`capacidade` decimal(10,4) NOT NULL,
	`dataVigencia` date NOT NULL,
	`observacao` text,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pesagens_equipamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `producao` (
	`id` int AUTO_INCREMENT NOT NULL,
	`data` date NOT NULL,
	`produtoId` int NOT NULL,
	`equipamentoId` int NOT NULL,
	`quantidade` decimal(10,2) NOT NULL,
	`metaDiaria` decimal(10,2),
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `producao_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`unidadeId` int,
	`tipoId` int,
	`densidade` decimal(10,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `produtos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `servicos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `servicos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `setor_de_custo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `setor_de_custo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `setores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `setores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tempos_descarga` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parteDiariaItemId` int NOT NULL,
	`parteDiariaId` int NOT NULL,
	`numeroViagem` int NOT NULL,
	`horaInicio` varchar(10) NOT NULL,
	`horaFinal` varchar(10) NOT NULL,
	`tempoMinutos` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tempos_descarga_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tipos_de_produtos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tipos_de_produtos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trocas_pecas_parte_diaria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parteDiariaId` int NOT NULL,
	`pecaId` int NOT NULL,
	`quantidade` int NOT NULL DEFAULT 1,
	`custoUnitario` decimal(10,2),
	`custoTotal` decimal(10,2),
	`observacoes` text,
	`movimentacaoId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trocas_pecas_parte_diaria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `unidades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sigla` varchar(10) NOT NULL,
	`descricao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `unidades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `venda_itens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendaId` int NOT NULL,
	`produtoId` int NOT NULL,
	`quantidade` decimal(10,2) NOT NULL,
	`valorUnitario` decimal(10,2) NOT NULL,
	`valorTotal` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `venda_itens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` enum('venda','amortizacao','doacao') NOT NULL DEFAULT 'venda',
	`numeroNF` varchar(50),
	`serieNF` varchar(10),
	`data` date NOT NULL,
	`clienteId` int NOT NULL,
	`valorTotal` decimal(12,2) DEFAULT '0',
	`pesoTotal` decimal(12,2) DEFAULT '0',
	`observacoes` text,
	`transportadoraNome` varchar(200),
	`motoristaNome` varchar(200),
	`placaVeiculo` varchar(20),
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','diretor','gerente','consultoria','coordenador','usuario','controle','operador') NOT NULL DEFAULT 'usuario';--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` enum('sim','nao') DEFAULT 'nao' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `whatsapp` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `cargo` varchar(100);