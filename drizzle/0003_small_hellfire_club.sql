CREATE TABLE `scheduled_run_claims` (
	`kind` text NOT NULL,
	`user_id` text NOT NULL,
	`bucket` integer NOT NULL,
	`claimed_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `user_id`, `bucket`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
