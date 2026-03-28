CREATE TABLE `metas_indicadores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`indicador` varchar(100) NOT NULL,
	`descricao` varchar(255),
	`valorMeta` decimal(15,2),
	`valorLimiteAlerta` decimal(15,2),
	`tipoAlerta` enum('acima','abaixo') NOT NULL DEFAULT 'acima',
	`ativo` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_indicadores_id` PRIMARY KEY(`id`),
	CONSTRAINT `metas_indicadores_indicador_unique` UNIQUE(`indicador`)
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`userAgent` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
