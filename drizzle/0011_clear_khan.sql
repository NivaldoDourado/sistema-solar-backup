CREATE TABLE `avaliacao_global` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`frete` decimal(15,2) NOT NULL DEFAULT '0',
	`investEquip` decimal(15,2) NOT NULL DEFAULT '0',
	`investBritagem` decimal(15,2) NOT NULL DEFAULT '0',
	`difFrete` decimal(15,2) NOT NULL DEFAULT '0',
	`difImpostos` decimal(15,2) NOT NULL DEFAULT '0',
	`distribLucro` decimal(15,2) NOT NULL DEFAULT '0',
	`outros` decimal(15,2) NOT NULL DEFAULT '0',
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `avaliacao_global_id` PRIMARY KEY(`id`)
);
