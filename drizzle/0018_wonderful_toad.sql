CREATE TABLE `conta_excluida_fluxo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`motivo` varchar(500),
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conta_excluida_fluxo_id` PRIMARY KEY(`id`)
);
