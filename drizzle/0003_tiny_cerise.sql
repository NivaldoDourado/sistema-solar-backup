CREATE TABLE `outras_paradas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`descricao` varchar(255) NOT NULL,
	`observacao` text,
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `outras_paradas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parte_diaria_paradas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parteDiariaId` int NOT NULL,
	`tipo` enum('ligado','desligado') NOT NULL,
	`horaInicial` varchar(10) NOT NULL,
	`horaFinal` varchar(10) NOT NULL,
	`tempoDecorrido` decimal(10,2),
	`motivoId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parte_diaria_paradas_id` PRIMARY KEY(`id`)
);
