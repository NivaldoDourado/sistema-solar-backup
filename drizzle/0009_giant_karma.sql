CREATE TABLE `resumo_vendas_produto` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodoInicio` date NOT NULL,
	`periodoFim` date NOT NULL,
	`produto` varchar(200) NOT NULL,
	`grupo` varchar(100),
	`marca` varchar(100),
	`valor` decimal(15,4) NOT NULL,
	`quantidade` decimal(15,4) NOT NULL,
	`vlMedio` decimal(15,4),
	`setor` varchar(100),
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `resumo_vendas_produto_id` PRIMARY KEY(`id`)
);
