-- Create transactions table
create table if not exists public.transactions (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Core Fields
    date timestamp with time zone not null,
    type text not null, -- 'revenue' | 'expense'
    status text not null, -- 'pending' | 'paid'
    description text not null,
    
    -- Categorization
    category text, -- 'cogs' | 'opex'
    linked_transaction_id uuid references public.transactions(id),
    
    -- Client / Invoice Details
    service_type text,
    client_type text, -- 'Pessoa Física' | 'Pessoa Jurídica'
    client_tax_id text,
    client_address text,
    client_email text,
    responsible_name text,
    
    -- Financial Values
    gross_revenue numeric default 0,
    amount numeric default 0, -- Expense amount
    
    -- Commission & Partners
    external_commission numeric default 0,
    external_commission_description text,
    originator text, -- Partner enum
    
    -- Reimbursement
    is_reimbursable boolean default false,
    reimbursement_beneficiary text,
    
    -- Metadata / Ops
    issued_at timestamp with time zone,
    invoice_number text,
    
    commission_type text default 'fixed', -- 'fixed' | 'percentage'
    commission_rate numeric default 0,
    
    payment_method text,
    payment_link text,
    
    currency text default 'USD', -- 'USD' | 'BRL'
    original_amount numeric,
    exchange_rate numeric,
    exchange_source text,
    
    -- Legacy Attachment and New Attachments (JSONB)
    attachment_url text,
    attachments jsonb
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Create policy to allow all authenticated users to view/edit everything (Shared Ledger)
create policy "Enable all access for authenticated users"
on public.transactions
for all
to authenticated
using (true)
with check (true);

-- Create indexes for common queries
create index if not exists transactions_date_idx on public.transactions(date);
create index if not exists transactions_type_idx on public.transactions(type);
