CREATE TABLE `lancamento_salario` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodoCustoId` int NOT NULL,
	`contaCustoId` int NOT NULL,
	`valor` decimal(12,2) NOT NULL DEFAULT '0',
	`equipamentoId` int,
	`setorId` int,
	`descricao` varchar(255),
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lancamento_salario_id` PRIMARY KEY(`id`)
);
