CREATE TABLE `meta_custo_tonelada` (
	`id` int AUTO_INCREMENT NOT NULL,
	`valor` decimal(15,2) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_custo_tonelada_id` PRIMARY KEY(`id`)
);
