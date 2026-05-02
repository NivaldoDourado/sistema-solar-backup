CREATE TABLE `periodo_custo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mes` int NOT NULL,
	`ano` int NOT NULL,
	`producaoTotal` decimal(12,2),
	`quantidadeVendida` decimal(12,2),
	`despesasIndiretas` decimal(12,2) DEFAULT '0',
	`observacoes` text,
	`fechado` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `periodo_custo_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `conta_custo` ADD `divisor` enum('producao','vendas') DEFAULT 'producao';--> statement-breakpoint
ALTER TABLE `conta_custo` ADD `classificacao` enum('custo_fixo','custo_variavel','despesa_fixa','despesa_variavel') DEFAULT 'custo_variavel';--> statement-breakpoint
ALTER TABLE `conta_custo` ADD `ativo` enum('sim','nao') DEFAULT 'sim' NOT NULL;