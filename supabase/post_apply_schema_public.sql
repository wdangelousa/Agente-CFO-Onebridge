


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."configurable_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_id" "text",
    "type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "value" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "configurable_options_type_check" CHECK (("type" = ANY (ARRAY['service_modality'::"text", 'expense_description'::"text", 'originator'::"text", 'reimbursement_party'::"text"])))
);


ALTER TABLE "public"."configurable_options" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_sequences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sequence_key" "text" NOT NULL,
    "year" integer NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL,
    "prefix" "text" DEFAULT 'OBS'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_sequences_last_number_check" CHECK (("last_number" >= 0))
);


ALTER TABLE "public"."invoice_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_id" "text",
    "invoice_number" "text" NOT NULL,
    "status" "text" NOT NULL,
    "issued_at" timestamp with time zone,
    "due_date" "date",
    "transaction_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "payer_name" "text",
    "payer_email" "text",
    "service_description" "text",
    "subtotal" numeric(12,2),
    "total" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."period_closings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "local_id" "text",
    "period_type" "text" DEFAULT 'semi_monthly'::"text" NOT NULL,
    "period_key" "text" NOT NULL,
    "month_key" "text" NOT NULL,
    "half" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "label" "text" NOT NULL,
    "closed_at" timestamp with time zone NOT NULL,
    "totals" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "partner_distributions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "transaction_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "period_closings_check" CHECK (("start_date" <= "end_date")),
    CONSTRAINT "period_closings_half_check" CHECK (("half" = ANY (ARRAY['H1'::"text", 'H2'::"text"]))),
    CONSTRAINT "period_closings_period_type_check" CHECK (("period_type" = 'semi_monthly'::"text"))
);


ALTER TABLE "public"."period_closings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "gross_revenue" numeric,
    "net_income" numeric,
    "ai_analysis" "text",
    "month" "text",
    "status" "text" DEFAULT 'draft'::"text"
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "date" timestamp with time zone NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text",
    "linked_transaction_id" "uuid",
    "service_type" "text",
    "client_type" "text",
    "client_tax_id" "text",
    "client_address" "text",
    "client_email" "text",
    "responsible_name" "text",
    "gross_revenue" numeric DEFAULT 0,
    "amount" numeric DEFAULT 0,
    "external_commission" numeric DEFAULT 0,
    "external_commission_description" "text",
    "originator" "text",
    "is_reimbursable" boolean DEFAULT false,
    "reimbursement_beneficiary" "text",
    "issued_at" timestamp with time zone,
    "invoice_number" "text",
    "commission_type" "text" DEFAULT 'fixed'::"text",
    "commission_rate" numeric DEFAULT 0,
    "payment_method" "text",
    "payment_link" "text",
    "currency" "text" DEFAULT 'USD'::"text",
    "original_amount" numeric,
    "exchange_rate" numeric,
    "exchange_source" "text",
    "attachment_url" "text",
    "attachments" "jsonb"
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."configurable_options"
    ADD CONSTRAINT "configurable_options_local_id_key" UNIQUE ("local_id");



ALTER TABLE ONLY "public"."configurable_options"
    ADD CONSTRAINT "configurable_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configurable_options"
    ADD CONSTRAINT "configurable_options_type_value_key" UNIQUE ("type", "value");



ALTER TABLE ONLY "public"."invoice_sequences"
    ADD CONSTRAINT "invoice_sequences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_sequences"
    ADD CONSTRAINT "invoice_sequences_sequence_key_key" UNIQUE ("sequence_key");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_local_id_key" UNIQUE ("local_id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."period_closings"
    ADD CONSTRAINT "period_closings_local_id_key" UNIQUE ("local_id");



ALTER TABLE ONLY "public"."period_closings"
    ADD CONSTRAINT "period_closings_period_key_key" UNIQUE ("period_key");



ALTER TABLE ONLY "public"."period_closings"
    ADD CONSTRAINT "period_closings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "configurable_options_is_active_idx" ON "public"."configurable_options" USING "btree" ("is_active");



CREATE INDEX "configurable_options_type_idx" ON "public"."configurable_options" USING "btree" ("type");



CREATE INDEX "invoices_due_date_idx" ON "public"."invoices" USING "btree" ("due_date");



CREATE INDEX "invoices_status_idx" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "period_closings_dates_idx" ON "public"."period_closings" USING "btree" ("start_date", "end_date");



CREATE INDEX "period_closings_month_key_idx" ON "public"."period_closings" USING "btree" ("month_key");



CREATE INDEX "transactions_date_idx" ON "public"."transactions" USING "btree" ("date");



CREATE INDEX "transactions_type_idx" ON "public"."transactions" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "set_configurable_options_updated_at" BEFORE UPDATE ON "public"."configurable_options" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_invoice_sequences_updated_at" BEFORE UPDATE ON "public"."invoice_sequences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_period_closings_updated_at" BEFORE UPDATE ON "public"."period_closings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_linked_transaction_id_fkey" FOREIGN KEY ("linked_transaction_id") REFERENCES "public"."transactions"("id");



CREATE POLICY "Authenticated users can insert configurable options" ON "public"."configurable_options" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert invoice sequences" ON "public"."invoice_sequences" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert period closings" ON "public"."period_closings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can select configurable options" ON "public"."configurable_options" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can select invoice sequences" ON "public"."invoice_sequences" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can select invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can select period closings" ON "public"."period_closings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update configurable options" ON "public"."configurable_options" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update invoice sequences" ON "public"."invoice_sequences" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update invoices" ON "public"."invoices" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can update period closings" ON "public"."period_closings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all access for authenticated users" ON "public"."transactions" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."configurable_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."period_closings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."configurable_options" TO "anon";
GRANT ALL ON TABLE "public"."configurable_options" TO "authenticated";
GRANT ALL ON TABLE "public"."configurable_options" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_sequences" TO "anon";
GRANT ALL ON TABLE "public"."invoice_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."period_closings" TO "anon";
GRANT ALL ON TABLE "public"."period_closings" TO "authenticated";
GRANT ALL ON TABLE "public"."period_closings" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







