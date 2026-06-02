CREATE TABLE `reajuste_salario` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodoCustoId` int NOT NULL,
	`percentual` decimal(6,2) NOT NULL,
	`aplicado` enum('sim','nao') NOT NULL DEFAULT 'nao',
	`observacoes` text,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reajuste_salario_id` PRIMARY KEY(`id`)
);
