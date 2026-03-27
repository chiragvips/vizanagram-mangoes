CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"party_name" text,
	"quantity" numeric(10, 2),
	"rate" numeric(10, 2),
	"amount" numeric(12, 2) NOT NULL,
	"transaction_type" text DEFAULT 'entry',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
