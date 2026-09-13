CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
