CREATE TABLE "catalog_nodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"parent_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lesson_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	CONSTRAINT "lesson_versions_lesson_id_version_unique" UNIQUE("lesson_id","version")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"topic_id" uuid NOT NULL,
	"definition" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_receipts" (
	"session_id" uuid NOT NULL,
	"mutation_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"server_revision" integer NOT NULL,
	CONSTRAINT "progress_receipts_session_id_mutation_id_pk" PRIMARY KEY("session_id","mutation_id")
);
--> statement-breakpoint
ALTER TABLE "teaching_sessions" ADD COLUMN "lesson_version_id" uuid;--> statement-breakpoint
ALTER TABLE "teaching_sessions" ADD COLUMN "progress" jsonb;--> statement-breakpoint
ALTER TABLE "teaching_sessions" ADD COLUMN "progress_server_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_nodes" ADD CONSTRAINT "catalog_nodes_parent_id_catalog_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."catalog_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topic_id_catalog_nodes_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."catalog_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_receipts" ADD CONSTRAINT "progress_receipts_session_id_teaching_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."teaching_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_lesson_version_id_lesson_versions_id_fk" FOREIGN KEY ("lesson_version_id") REFERENCES "public"."lesson_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Published rows are append-only, including writes outside the API.
CREATE FUNCTION protect_published_lesson_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published lesson versions are immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_published_lesson_version BEFORE UPDATE OR DELETE ON lesson_versions
FOR EACH ROW EXECUTE FUNCTION protect_published_lesson_version();
--> statement-breakpoint
CREATE FUNCTION protect_session_lesson_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lesson_version_id IS DISTINCT FROM OLD.lesson_version_id THEN
    RAISE EXCEPTION 'Teaching session lesson pin is immutable';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_session_lesson_pin BEFORE UPDATE ON teaching_sessions
FOR EACH ROW EXECUTE FUNCTION protect_session_lesson_pin();
