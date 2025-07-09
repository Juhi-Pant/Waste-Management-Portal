ALTER TABLE "reports" ADD COLUMN "coordinates" json;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" varchar(50) DEFAULT 'user' NOT NULL;