drop extension if exists "pg_net";


  create table "public"."reports" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "gross_revenue" numeric,
    "net_income" numeric,
    "ai_analysis" text,
    "month" text,
    "status" text default 'draft'::text
      );


alter table "public"."reports" enable row level security;


  create table "public"."transactions" (
    "id" uuid not null default gen_random_uuid(),
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "date" timestamp with time zone not null,
    "type" text not null,
    "status" text not null,
    "description" text not null,
    "category" text,
    "linked_transaction_id" uuid,
    "service_type" text,
    "client_type" text,
    "client_tax_id" text,
    "client_address" text,
    "client_email" text,
    "responsible_name" text,
    "gross_revenue" numeric default 0,
    "amount" numeric default 0,
    "external_commission" numeric default 0,
    "external_commission_description" text,
    "originator" text,
    "is_reimbursable" boolean default false,
    "reimbursement_beneficiary" text,
    "issued_at" timestamp with time zone,
    "invoice_number" text,
    "commission_type" text default 'fixed'::text,
    "commission_rate" numeric default 0,
    "payment_method" text,
    "payment_link" text,
    "currency" text default 'USD'::text,
    "original_amount" numeric,
    "exchange_rate" numeric,
    "exchange_source" text,
    "attachment_url" text,
    "attachments" jsonb
      );


alter table "public"."transactions" enable row level security;

CREATE UNIQUE INDEX reports_pkey ON public.reports USING btree (id);

CREATE INDEX transactions_date_idx ON public.transactions USING btree (date);

CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id);

CREATE INDEX transactions_type_idx ON public.transactions USING btree (type);

alter table "public"."reports" add constraint "reports_pkey" PRIMARY KEY using index "reports_pkey";

alter table "public"."transactions" add constraint "transactions_pkey" PRIMARY KEY using index "transactions_pkey";

alter table "public"."transactions" add constraint "transactions_linked_transaction_id_fkey" FOREIGN KEY (linked_transaction_id) REFERENCES public.transactions(id) not valid;

alter table "public"."transactions" validate constraint "transactions_linked_transaction_id_fkey";

grant delete on table "public"."reports" to "anon";

grant insert on table "public"."reports" to "anon";

grant references on table "public"."reports" to "anon";

grant select on table "public"."reports" to "anon";

grant trigger on table "public"."reports" to "anon";

grant truncate on table "public"."reports" to "anon";

grant update on table "public"."reports" to "anon";

grant delete on table "public"."reports" to "authenticated";

grant insert on table "public"."reports" to "authenticated";

grant references on table "public"."reports" to "authenticated";

grant select on table "public"."reports" to "authenticated";

grant trigger on table "public"."reports" to "authenticated";

grant truncate on table "public"."reports" to "authenticated";

grant update on table "public"."reports" to "authenticated";

grant delete on table "public"."reports" to "service_role";

grant insert on table "public"."reports" to "service_role";

grant references on table "public"."reports" to "service_role";

grant select on table "public"."reports" to "service_role";

grant trigger on table "public"."reports" to "service_role";

grant truncate on table "public"."reports" to "service_role";

grant update on table "public"."reports" to "service_role";

grant delete on table "public"."transactions" to "anon";

grant insert on table "public"."transactions" to "anon";

grant references on table "public"."transactions" to "anon";

grant select on table "public"."transactions" to "anon";

grant trigger on table "public"."transactions" to "anon";

grant truncate on table "public"."transactions" to "anon";

grant update on table "public"."transactions" to "anon";

grant delete on table "public"."transactions" to "authenticated";

grant insert on table "public"."transactions" to "authenticated";

grant references on table "public"."transactions" to "authenticated";

grant select on table "public"."transactions" to "authenticated";

grant trigger on table "public"."transactions" to "authenticated";

grant truncate on table "public"."transactions" to "authenticated";

grant update on table "public"."transactions" to "authenticated";

grant delete on table "public"."transactions" to "service_role";

grant insert on table "public"."transactions" to "service_role";

grant references on table "public"."transactions" to "service_role";

grant select on table "public"."transactions" to "service_role";

grant trigger on table "public"."transactions" to "service_role";

grant truncate on table "public"."transactions" to "service_role";

grant update on table "public"."transactions" to "service_role";


  create policy "Enable all access for authenticated users"
  on "public"."transactions"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



