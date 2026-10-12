CREATE TABLE `copilot_sessions` (
	`workspace_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`session_id` text,
	`stream_index` integer DEFAULT 0 NOT NULL,
	`busy_until` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `auth_user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `copilot_sessions_session_id_unique` ON `copilot_sessions` (`session_id`);--> statement-breakpoint
CREATE TABLE `telegram_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`telegram_user_id` text NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`telegram_username` text,
	`linked_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_connections_workspace_id_unique` ON `telegram_connections` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_connections_telegram_user_id_unique` ON `telegram_connections` (`telegram_user_id`);--> statement-breakpoint
CREATE TABLE `telegram_link_codes` (
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
CREATE UNIQUE INDEX `telegram_link_codes_code_hash_unique` ON `telegram_link_codes` (`code_hash`);