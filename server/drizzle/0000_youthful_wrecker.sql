CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"anchor" text NOT NULL,
	"server_revision" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_session_id_anchor_unique" UNIQUE("session_id","anchor"),
	CONSTRAINT "positive_revision" CHECK ("documents"."server_revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "school_memberships" (
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "school_memberships_school_id_user_id_pk" PRIMARY KEY("school_id","user_id"),
	CONSTRAINT "membership_role" CHECK ("school_memberships"."role" in ('teacher', 'school_admin')),
	CONSTRAINT "membership_active" CHECK ("school_memberships"."active" in (0, 1))
);
--> statement-breakpoint
CREATE TABLE "save_receipts" (
	"document_id" uuid NOT NULL,
	"mutation_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"content_hash" text NOT NULL,
	"server_revision" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "save_receipts_document_id_mutation_id_pk" PRIMARY KEY("document_id","mutation_id")
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaching_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"context" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teaching_sessions_id_school_id_unique" UNIQUE("id","school_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"subject" text NOT NULL,
	CONSTRAINT "users_issuer_subject_unique" UNIQUE("issuer","subject")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_school_id_teaching_sessions_id_school_id_fk" FOREIGN KEY ("session_id","school_id") REFERENCES "public"."teaching_sessions"("id","school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_memberships" ADD CONSTRAINT "school_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "save_receipts" ADD CONSTRAINT "save_receipts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_school_id_user_id_school_memberships_school_id_user_id_fk" FOREIGN KEY ("school_id","user_id") REFERENCES "public"."school_memberships"("school_id","user_id") ON DELETE no action ON UPDATE no action;