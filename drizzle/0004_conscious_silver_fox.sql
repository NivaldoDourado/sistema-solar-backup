CREATE TABLE `rotinas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`ordem` int NOT NULL DEFAULT 0,
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rotinas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `status_rotina_diario` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rotinaId` int NOT NULL,
	`data` date NOT NULL,
	`status` enum('concluido','pendente','nao_marcado') NOT NULL DEFAULT 'nao_marcado',
	`userId` int NOT NULL,
	`observacao` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `status_rotina_diario_id` PRIMARY KEY(`id`)
);
