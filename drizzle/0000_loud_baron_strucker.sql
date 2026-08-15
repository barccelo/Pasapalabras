CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`words` text NOT NULL,
	`mode` text NOT NULL,
	`duration` integer NOT NULL,
	`team_a` text NOT NULL,
	`team_b` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `live_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`game_title` text NOT NULL,
	`state` text NOT NULL,
	`updated_at` integer NOT NULL
);
