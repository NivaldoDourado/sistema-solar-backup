CREATE TABLE `lancamento_custo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodoCustoId` int NOT NULL,
	`contaCustoId` int NOT NULL,
	`valor` decimal(12,2) NOT NULL DEFAULT '0',
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lancamento_custo_id` PRIMARY KEY(`id`)
);
