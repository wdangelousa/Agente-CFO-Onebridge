# Supabase Realignment Plan

## A. Executive Summary

The Onebridge CFO app is currently a stable local-first MVP. Runtime data is stored in browser `localStorage`, and the app does not require Supabase, login, or a remote database to start or operate.

The Supabase project `dashboard-onebridge-2026` (`syigcvmwmedsusupxlal`) has been reconnected for audit and planning only. The remote schema was pulled locally for inspection. Supabase has not been wired into the app runtime, and no schema changes were pushed to the remote database.

Recommended architecture: keep the app local-first and add Supabase later as an optional sync/backup layer.

## B. Current Local-First Model

### Transactions

Storage key: `onebridge_cfo_transactions_v1`

Transactions are stored as `FinancialData` records with local IDs, transaction type, status, date, `competenceMonth`, revenue/expense fields, client/invoice metadata, originator, reimbursement fields, attachments, payment data, currency metadata, `createdAt`, and `updatedAt`.

The transaction `date` field is the reliable source for semi-monthly filtering. `competenceMonth` supports monthly management views but should not be the official closing boundary.

### Configurable Options

Storage key: `onebridge_cfo_configurable_options_v1`

Configurable options include:

- `service_modality`
- `expense_description`
- `originator`
- `reimbursement_party`

Each option has `id`, `type`, `label`, normalized `value`, optional `metadata`, `isActive`, `createdAt`, and `updatedAt`.

### Official Period Closings

Storage key: `onebridge_cfo_period_closings_v1`

Official closings are semi-monthly:

- H1 = day 1 through day 15
- H2 = day 16 through the last day of the month

These snapshots preserve official period totals and included transaction IDs. They are the official distribution closing records.

### Legacy Monthly Closings

Storage key: `onebridge_cfo_monthly_closings_v1`

Monthly closings are legacy management summaries only. They must not be treated as official distribution closings.

### Invoices

Storage key: `onebridge_cfo_invoices_v1`

Invoices are separate local records linked to transactions by `transactionIds`. Invoice issuance does not change revenue recognition by itself.

### Invoice Sequence

Storage key: `onebridge_cfo_invoice_sequence_v1`

Invoice numbering is deterministic and local, currently using year-based sequences such as `OBS-2026-0001`.

### Backup / Export / Import

Local backup export/import includes transactions, configurable options, official period closings, legacy monthly closings, invoices, and invoice sequence. Backup version 2 treats `periodClosings` as official and `legacyMonthlyClosings` as non-official legacy data.

## C. Current Supabase Schema

Pulled schema file:

- `supabase/migrations/20260527022037_remote_schema.sql`

Migration history also contains a zero-byte stub from the earlier failed pull:

- `supabase/migrations/20260527021431_remote_schema.sql`

### Tables

#### `public.transactions`

Fields:

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default timezone('utc', now())`
- `date timestamptz not null`
- `type text not null`
- `status text not null`
- `description text not null`
- `category text`
- `linked_transaction_id uuid references public.transactions(id)`
- `service_type text`
- `client_type text`
- `client_tax_id text`
- `client_address text`
- `client_email text`
- `responsible_name text`
- `gross_revenue numeric default 0`
- `amount numeric default 0`
- `external_commission numeric default 0`
- `external_commission_description text`
- `originator text`
- `is_reimbursable boolean default false`
- `reimbursement_beneficiary text`
- `issued_at timestamptz`
- `invoice_number text`
- `commission_type text default 'fixed'`
- `commission_rate numeric default 0`
- `payment_method text`
- `payment_link text`
- `currency text default 'USD'`
- `original_amount numeric`
- `exchange_rate numeric`
- `exchange_source text`
- `attachment_url text`
- `attachments jsonb`

Indexes:

- `transactions_pkey` on `id`
- `transactions_date_idx` on `date`
- `transactions_type_idx` on `type`

RLS:

- RLS is enabled.
- Policy: `Enable all access for authenticated users`, `for all`, `to authenticated`, `using (true)`, `with check (true)`.

Notes:

- This table has many direct overlaps with the local transaction model.
- It is missing `updated_at`.
- It is missing `competence_month`, though semi-monthly filtering can use `date`.
- It stores invoice number/issued date inline, but there is no dedicated invoice lifecycle table.

#### `public.reports`

Fields:

- `id uuid primary key default extensions.uuid_generate_v4()`
- `created_at timestamptz not null default timezone('utc', now())`
- `gross_revenue numeric`
- `net_income numeric`
- `ai_analysis text`
- `month text`
- `status text default 'draft'`

Indexes:

- `reports_pkey` on `id`

RLS:

- RLS is enabled.
- No policy was present in the pulled public schema.

Notes:

- This appears to be a legacy AI/monthly report table.
- It does not represent official semi-monthly closings.
- It should not be used as the official distribution closing model.

### Enums

No custom public enum types were found. Transaction type, status, category, payment method, and currency are stored as `text`.

### Grants

The pulled schema includes grants for `anon`, `authenticated`, and `service_role` on `reports` and `transactions`. RLS still governs table access.

### Storage / Buckets

No storage bucket definitions were visible in the pulled public schema. Transaction attachment fields exist as `attachment_url text` and `attachments jsonb`, but bucket configuration was not captured by this public schema pull.

### Missing Remote Tables

The pulled Supabase schema does not currently include:

- `period_closings`
- `monthly_closings`
- `invoices`
- `invoice_sequences`
- `configurable_options`
- dedicated attachment/document metadata table

## D. Mapping Table

| Local model | Local field/key | Supabase table | Supabase field | Mapping status | Notes |
|---|---|---|---|---|---|
| Transactions | `onebridge_cfo_transactions_v1` | `transactions` | table | direct | Core transaction table exists. |
| Transactions | `id` | `transactions` | `id` | requires transform | Local IDs may be UUID or generated string; remote expects UUID. Preserve local ID in separate field or enforce UUID migration. |
| Transactions | `date` | `transactions` | `date` | direct | Required for semi-monthly H1/H2 filtering. |
| Transactions | `competenceMonth` | `transactions` | missing | missing | Needed for management monthly views if remote mirrors local exactly. Can be derived from `date`, but explicit field helps compatibility. |
| Transactions | `createdAt` | `transactions` | `created_at` | direct | Name transform from camelCase to snake_case. |
| Transactions | `updatedAt` | `transactions` | missing | missing | Add for sync conflict detection. |
| Transactions | `type` | `transactions` | `type` | direct | Text values align conceptually. |
| Transactions | `status` | `transactions` | `status` | direct | Text values align conceptually. |
| Transactions | `description` | `transactions` | `description` | direct | Direct text mapping. |
| Transactions | `category` | `transactions` | `category` | direct | Expense-only field. |
| Transactions | `linkedTransactionId` | `transactions` | `linked_transaction_id` | requires transform | Remote expects UUID foreign key. |
| Transactions | `serviceType` | `transactions` | `service_type` | direct | Dynamic service labels can be stored as text. |
| Transactions | `clientType` | `transactions` | `client_type` | direct | Text mapping. |
| Transactions | `clientTaxId` | `transactions` | `client_tax_id` | direct | Text mapping. |
| Transactions | `clientAddress` | `transactions` | `client_address` | direct | Text mapping. |
| Transactions | `clientEmail` | `transactions` | `client_email` | direct | Text mapping. |
| Transactions | `responsibleName` | `transactions` | `responsible_name` | direct | Text mapping. |
| Transactions | `grossRevenue` | `transactions` | `gross_revenue` | direct | Numeric mapping. |
| Transactions | `amount` | `transactions` | `amount` | direct | Numeric mapping. |
| Transactions | `externalCommission` | `transactions` | `external_commission` | direct | Numeric mapping. |
| Transactions | `externalCommissionDescription` | `transactions` | `external_commission_description` | direct | Text mapping. |
| Transactions | `originator` | `transactions` | `originator` | direct | Text label preserved; fixed partner math remains in app engine. |
| Transactions | `isReimbursable` | `transactions` | `is_reimbursable` | direct | Boolean mapping. |
| Transactions | `reimbursementBeneficiary` | `transactions` | `reimbursement_beneficiary` | direct | Text label mapping. |
| Transactions | `issuedAt` | `transactions` | `issued_at` | ambiguous | Current local invoice lifecycle is separate; transaction field is legacy/link metadata. |
| Transactions | `invoiceNumber` | `transactions` | `invoice_number` | ambiguous | Current invoice source of truth is `invoices`, not transaction field. |
| Transactions | `invoiceId` | `transactions` | missing | missing | Needed to link transaction to dedicated invoice table if kept. |
| Transactions | `commissionType` | `transactions` | `commission_type` | direct | Text mapping. |
| Transactions | `commissionRate` | `transactions` | `commission_rate` | direct | Numeric mapping. |
| Transactions | `paymentMethod` | `transactions` | `payment_method` | direct | Text mapping. |
| Transactions | `paymentLink` | `transactions` | `payment_link` | direct | Text mapping. |
| Transactions | `currency` | `transactions` | `currency` | direct | Text mapping. |
| Transactions | `originalAmount` | `transactions` | `original_amount` | direct | Numeric mapping. |
| Transactions | `exchangeRate` | `transactions` | `exchange_rate` | direct | Numeric mapping. |
| Transactions | `exchangeSource` | `transactions` | `exchange_source` | direct | Text mapping. |
| Transactions | `attachmentUrl` | `transactions` | `attachment_url` | direct | Legacy single attachment URL. |
| Transactions | `attachments` | `transactions` | `attachments` | direct | JSONB mapping. Bucket/storage mapping still unknown. |
| Configurable options | `onebridge_cfo_configurable_options_v1` | missing | missing | missing | Requires `configurable_options` table if Supabase sync is added. |
| Configurable options | `type`, `label`, `value`, `metadata`, `isActive` | missing | missing | missing | Add normalized unique index on `(type, value)`. |
| Official period closings | `onebridge_cfo_period_closings_v1` | missing | missing | missing | Requires new `period_closings` table. |
| Legacy monthly closings | `onebridge_cfo_monthly_closings_v1` | missing | missing | obsolete | Legacy only. If added, mark as management summaries, not official closings. |
| Invoices | `onebridge_cfo_invoices_v1` | missing | missing | missing | Requires dedicated `invoices` table for lifecycle status, due date, totals, and transaction links. |
| Invoice sequence | `onebridge_cfo_invoice_sequence_v1` | missing | missing | missing | Requires `invoice_sequences` table or sequence state row by year. |
| Reports | none current official key | `reports` | `month`, `gross_revenue`, `net_income`, `ai_analysis`, `status` | obsolete | Legacy AI/monthly report table; not official closing data. |

## E. Semi-Monthly Official Closing Requirements

Official Supabase model should be a new `period_closings` table.

Required fields:

- `id`
- `period_type`
- `period_key`
- `month_key`
- `half`
- `start_date`
- `end_date`
- `label`
- `closed_at`
- `totals`
- `partner_distributions`
- `transaction_ids`
- `notes`
- `created_at`
- `updated_at`

Required semantics:

- `period_type` should be `semi_monthly`.
- `period_key` should be unique, for example `2026-05-H1` or `2026-05-H2`.
- H1 means day 1 through day 15.
- H2 means day 16 through the last day of the month.
- `month_key` supports management grouping, but monthly summaries are not official closings.
- `transaction_ids` must preserve the exact transaction set included in the closing.
- The saved snapshot must remain official even if transactions later change.

Suggested JSON structure:

- `totals`: revenue, COGS, OpEx, external commissions, origination fee, reserve, distributable profit, and any other audited totals.
- `partner_distributions`: Evandro, Julia/Samuel, Walter.

## Proposed Sync Tables

Review-only migration file:

- `supabase/migrations/20260527023745_create_optional_sync_tables.sql`

This migration is non-destructive because it only proposes new optional sync/backup tables and one shared `public.set_updated_at()` trigger function. It does not alter `public.transactions`, does not alter `public.reports`, does not delete data, and has not been applied to the remote database.

### `public.configurable_options`

Why needed:

- Mirrors `onebridge_cfo_configurable_options_v1`.
- Preserves dynamic service modalities, expense descriptions, originators, and reimbursement parties.
- Allows cloud backup/sync of user-created options without hardcoding them into the app.

Mapping:

- `local_id` stores the browser-local option ID.
- `type`, `label`, `value`, `metadata`, `is_active`, `created_at`, and `updated_at` map directly to the local option model.
- `unique(type, value)` preserves local duplicate-prevention semantics.

RLS:

- Authenticated users can select, insert, and update.
- No anonymous write policies.
- No delete policy in this proposal; deactivation should use `is_active`.

### `public.period_closings`

Why needed:

- Mirrors `onebridge_cfo_period_closings_v1`.
- Provides the official Supabase model for semi-monthly closing snapshots.
- Keeps official distribution closings separate from monthly management summaries.

Mapping:

- `period_type`, `period_key`, `month_key`, `half`, `start_date`, `end_date`, `label`, `closed_at`, and `notes` map directly to the local `PeriodClosingSnapshot`.
- `totals` stores revenue, COGS, OpEx, external commissions, origination fee, reserve, and distributable profit.
- `partner_distributions` stores the partner payout buckets.
- `transaction_ids` stores the exact transactions included in the official closing.
- `local_id` preserves the browser-local closing ID.

Semi-monthly rule:

- H1 = day 1 through day 15.
- H2 = day 16 through the last day of the month.
- Monthly summaries remain management-only and are not official closings.

RLS:

- Authenticated users can select, insert, and update.
- No anonymous write policies.
- No delete policy in this proposal.

### `public.invoices`

Why needed:

- Mirrors `onebridge_cfo_invoices_v1`.
- Preserves local invoice lifecycle separately from transaction records.
- Avoids treating `transactions.invoice_number` as the invoice source of truth.

Mapping:

- `local_id` stores the browser-local invoice ID.
- `invoice_number`, `status`, `issued_at`, `due_date`, `transaction_ids`, `payer_name`, `service_description`, `subtotal`, `total`, `currency`, `notes`, `created_at`, and `updated_at` map to the local invoice record.
- `metadata` is reserved for future non-formula operational fields.
- `payer_email` is available for later sync from transaction/client metadata.

RLS:

- Authenticated users can select, insert, and update.
- No anonymous write policies.
- No delete policy in this proposal; cancellation should use `status = 'cancelled'`.

### `public.invoice_sequences`

Why needed:

- Mirrors `onebridge_cfo_invoice_sequence_v1`.
- Preserves the current deterministic invoice numbering model.
- Prevents cloud sync from accidentally regenerating invoice numbers.

Mapping:

- `sequence_key` can be the year or another stable local sequence key.
- `year`, `last_number`, and `prefix` preserve the local sequence state.

RLS:

- Authenticated users can select, insert, and update.
- No anonymous write policies.
- No delete policy in this proposal.

### Existing `public.transactions`

This pass intentionally does not alter `public.transactions`.

Later, it likely needs a separate migration for:

- `local_id` to preserve browser-local IDs.
- `sync_status` if manual sync/restore needs explicit state.
- `updated_at` for conflict detection.
- `deleted_at` if soft-delete sync is required.
- `metadata` for non-formula operational metadata.
- explicit `competence_month` only if remote monthly management summaries need to match local views without deriving from `date`.

The existing `date` field is compatible with H1/H2 filtering and should remain the official period boundary source.

## F. Recommended Architecture

### Preferred: Local-First App + Supabase Sync/Backup Layer

This is the recommended path.

Pros:

- Preserves the stable local-first MVP.
- Keeps offline/local operation.
- Avoids forcing login immediately.
- Allows cloud backup and later multi-device sync.
- Lets Supabase schema evolve without breaking the current browser ledger.
- Reduces data-loss risk because local export/import remains available.

Cons:

- Requires conflict-resolution decisions before automatic multi-device sync.
- Requires careful ID strategy because current local IDs may not all be UUIDs.
- Requires explicit mapping between local camelCase and remote snake_case fields.

### Alternative: Supabase-Primary App With Auth/Login

Pros:

- Centralized data source.
- Built-in auth/RLS patterns.
- Easier multi-device consistency after auth is mature.

Cons:

- Would break the current no-login MVP expectation.
- Higher risk of startup failures if Supabase is unavailable.
- Requires a full runtime service migration and RLS design before production use.
- More likely to disrupt invoice numbering and closing workflows if rushed.

## G. Non-Destructive Future Migration Sequence

Do not implement this sequence yet. This is the recommended future path:

1. Create new Supabase tables that mirror the local-first data model:
   - `transactions` additions or replacement sync table fields for `updated_at`, `competence_month`, and local ID handling.
   - `configurable_options`.
   - `period_closings`.
   - `invoices`.
   - `invoice_sequences`.
2. Add RLS policies safely:
   - Start with authenticated-only access.
   - Avoid exposing service role keys in frontend code.
   - Decide whether single-tenant MVP can use simple authenticated policies or needs organization/user ownership columns.
3. Add an optional sync service that is not used at startup.
4. Add manual controls:
   - `Sync to Supabase`
   - `Restore from Supabase`
   - dry-run/preview mode before overwrite.
5. Add conflict detection using `updatedAt`/`updated_at` and stable IDs.
6. Only later consider Supabase-primary mode if the business explicitly wants login and remote-first behavior.

## H. Risks and Blockers

### Migration History

Migration-history repair was performed:

```bash
npx --yes supabase migration repair --status applied 20260527021431
```

During `db pull`, the CLI also asked to update remote migration history for the generated schema pull migration. That bookkeeping update was accepted, and migration list now shows:

- `20260527021431` local and remote
- `20260527022037` local and remote

No `db push` was run.

### Schema Gaps

The remote schema lacks dedicated tables for:

- official semi-monthly period closings
- invoices
- invoice sequence
- configurable options
- legacy monthly management summaries
- dedicated attachment/document records

### Ambiguous Mappings

Invoice fields on `transactions` are ambiguous because current local invoice lifecycle is stored in a separate invoice ledger.

Transaction IDs are also ambiguous because the remote table expects UUIDs while local fallback IDs can be string IDs. A safe sync layer should either preserve a `local_id` field or migrate local IDs to UUIDs only after careful backup.

### Legacy Monthly Closings

Any future Supabase `monthly_closings` table must be clearly labeled legacy or management summary. It must not become the official distribution closing table.

### Semi-Monthly Compatibility

The existing remote `transactions.date` field can support H1/H2 filtering. The remote schema still needs `period_closings` to preserve official closing snapshots.

### Auth/RLS

RLS is enabled. `transactions` currently has a permissive authenticated policy. `reports` has RLS enabled but no policy in the pulled public schema.

Before runtime sync, decide whether the app is single-tenant authenticated, multi-user, or organization-scoped. Add ownership columns before relying on shared authenticated policies.

### Data-Loss Risks

The highest-risk areas are:

- mapping local string IDs to remote UUIDs
- overwriting local data during restore
- treating legacy monthly summaries as official closings
- rebuilding invoice sequence incorrectly
- syncing transaction invoice fields as if they were the invoice source of truth

### Next Decision Required

Confirm whether Supabase should remain optional sync/backup only for the next phase. If yes, the next implementation task should be schema design for missing sync tables, still without changing local runtime behavior.
