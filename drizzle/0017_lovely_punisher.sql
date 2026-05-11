CREATE TABLE `equipamento_excluido_tag` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag` varchar(100) NOT NULL,
	`descricao` varchar(255),
	`motivo` varchar(255),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `equipamento_excluido_tag_id` PRIMARY KEY(`id`)
);
