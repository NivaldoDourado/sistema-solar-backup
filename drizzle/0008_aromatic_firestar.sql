CREATE TABLE `custo_setor_despesa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodoCustoId` int NOT NULL,
	`subsetorNome` varchar(255) NOT NULL,
	`grupoNome` varchar(255) NOT NULL,
	`descricao` varchar(255) NOT NULL,
	`valor` decimal(14,2) DEFAULT '0',
	`ordemExibicao` int DEFAULT 0,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custo_setor_despesa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custo_setor_equipamento` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodoCustoId` int NOT NULL,
	`subsetorNome` varchar(255) NOT NULL,
	`grupoNome` varchar(255) NOT NULL,
	`equipamentoNome` varchar(255) NOT NULL,
	`salOperEncOper` decimal(14,2) DEFAULT '0',
	`depreciacao` decimal(14,2) DEFAULT '0',
	`combustivel` decimal(14,2) DEFAULT '0',
	`lubrificantes` decimal(14,2) DEFAULT '0',
	`pecasDesgaste` decimal(14,2) DEFAULT '0',
	`pecasReposicao` decimal(14,2) DEFAULT '0',
	`outrasDespesas` decimal(14,2) DEFAULT '0',
	`totalDespesasEquipamento` decimal(14,2) DEFAULT '0',
	`horasTrabalhadas` decimal(10,2) DEFAULT '0',
	`qtdCombustivelLitros` decimal(10,2) DEFAULT '0',
	`producaoTotal` decimal(14,2) DEFAULT '0',
	`unidadeProducao` varchar(50),
	`ordemExibicao` int DEFAULT 0,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custo_setor_equipamento_id` PRIMARY KEY(`id`)
);
