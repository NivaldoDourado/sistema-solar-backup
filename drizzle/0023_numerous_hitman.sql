ALTER TABLE `reajuste_salario` ADD `percentualSetor` decimal(6,2);--> statement-breakpoint
ALTER TABLE `reajuste_salario` ADD `aplicadoSetor` enum('sim','nao') DEFAULT 'nao' NOT NULL;