CREATE TABLE `correspondencia_tag` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tag` varchar(255) NOT NULL,
	`tipo` enum('equipamento','setor','explosivos','excluir','nao_lancar') NOT NULL,
	`equipamentoId` int,
	`setorDestino` varchar(255),
	`descricao` varchar(500),
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `correspondencia_tag_id` PRIMARY KEY(`id`)
);
