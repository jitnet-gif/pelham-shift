CREATE TABLE `push_keys` (
	`workspace` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`tick_key` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`sent_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`workspace` text NOT NULL,
	`member` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL
);
