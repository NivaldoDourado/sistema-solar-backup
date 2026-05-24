CREATE TABLE `dashboard_cards_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`perfil` enum('admin','diretor','gerente','consultoria','coordenador','usuario','controle','operador') NOT NULL,
	`cardId` varchar(100) NOT NULL,
	`visivel` enum('sim','nao') NOT NULL DEFAULT 'sim',
	`ordem` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dashboard_cards_config_id` PRIMARY KEY(`id`)
);
