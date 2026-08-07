ALTER TABLE `users` RENAME COLUMN `telegram_user_id` TO `discord_user_id`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `telegram_chat_id` TO `discord_channel_id`;--> statement-breakpoint
DROP INDEX `users_telegram_user_id_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_user_id_unique` ON `users` (`discord_user_id`);--> statement-breakpoint
DROP TABLE `telegram_connections`;--> statement-breakpoint
DROP TABLE `telegram_link_codes`;--> statement-breakpoint
CREATE TABLE `discord_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_guild_id` text NOT NULL,
	`discord_channel_id` text NOT NULL,
	`discord_username` text,
	`first_name` text,
	`linked_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_connections_discord_user_id_unique` ON `discord_connections` (`discord_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `discord_connections_workspace_unique` ON `discord_connections` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `discord_link_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_link_codes_code_hash_unique` ON `discord_link_codes` (`code_hash`);--> statement-breakpoint
CREATE INDEX `discord_link_codes_workspace_idx` ON `discord_link_codes` (`workspace_id`);--> statement-breakpoint
UPDATE `integrations`
SET `type` = 'discord', `status` = 'disconnected', `display_name` = 'Discord', `external_account_id` = NULL, `config` = '{}'
WHERE `type` = 'telegram';
