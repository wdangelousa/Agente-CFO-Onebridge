-- Optional sync/backup tables for the local-first Onebridge CFO MVP.
-- Review-only migration: do not apply until the schema is approved.
-- This migration intentionally does not alter existing public.transactions
-- or public.reports tables.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.configurable_options (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,
  type text not null check (type in (
    'service_modality',
    'expense_description',
    'originator',
    'reimbursement_party'
  )),
  label text not null,
  value text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, value)
);

create table if not exists public.period_closings (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,
  period_type text not null default 'semi_monthly' check (period_type = 'semi_monthly'),
  period_key text not null unique,
  month_key text not null,
  half text not null check (half in ('H1', 'H2')),
  start_date date not null,
  end_date date not null,
  label text not null,
  closed_at timestamptz not null,
  totals jsonb not null default '{}'::jsonb,
  partner_distributions jsonb not null default '{}'::jsonb,
  transaction_ids jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,
  invoice_number text not null unique,
  status text not null check (status in ('draft', 'issued', 'paid', 'cancelled')),
  issued_at timestamptz,
  due_date date,
  transaction_ids jsonb not null default '[]'::jsonb,
  payer_name text,
  payer_email text,
  service_description text,
  subtotal numeric(12,2),
  total numeric(12,2) not null,
  currency text not null default 'USD',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_sequences (
  id uuid primary key default gen_random_uuid(),
  sequence_key text not null unique,
  year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  prefix text not null default 'OBS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists configurable_options_type_idx
  on public.configurable_options using btree (type);

create index if not exists configurable_options_is_active_idx
  on public.configurable_options using btree (is_active);

create index if not exists period_closings_month_key_idx
  on public.period_closings using btree (month_key);

create index if not exists period_closings_dates_idx
  on public.period_closings using btree (start_date, end_date);

create index if not exists invoices_status_idx
  on public.invoices using btree (status);

create index if not exists invoices_due_date_idx
  on public.invoices using btree (due_date);

create trigger set_configurable_options_updated_at
  before update on public.configurable_options
  for each row
  execute function public.set_updated_at();

create trigger set_period_closings_updated_at
  before update on public.period_closings
  for each row
  execute function public.set_updated_at();

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row
  execute function public.set_updated_at();

create trigger set_invoice_sequences_updated_at
  before update on public.invoice_sequences
  for each row
  execute function public.set_updated_at();

alter table public.configurable_options enable row level security;
alter table public.period_closings enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_sequences enable row level security;

create policy "Authenticated users can select configurable options"
  on public.configurable_options
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert configurable options"
  on public.configurable_options
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update configurable options"
  on public.configurable_options
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can select period closings"
  on public.period_closings
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert period closings"
  on public.period_closings
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update period closings"
  on public.period_closings
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can select invoices"
  on public.invoices
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert invoices"
  on public.invoices
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update invoices"
  on public.invoices
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can select invoice sequences"
  on public.invoice_sequences
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert invoice sequences"
  on public.invoice_sequences
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update invoice sequences"
  on public.invoice_sequences
  for update
  to authenticated
  using (true)
  with check (true);
