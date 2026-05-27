# Supabase Pre-Apply Decisions

This memo records the recommended baseline decisions before applying the optional Supabase sync/backup table migration.

No migration has been applied yet. Do not run `npx supabase db push` until these decisions have been reviewed and approved.

## A. RLS / Ownership Model

Recommended for Phase 1:

- Use single-tenant authenticated access.
- Authenticated users can select, insert, and update sync rows.
- Do not allow anonymous writes.
- Do not create delete policies.

Future upgrade path:

- Add `owner_user_id` if the app becomes user-scoped.
- Add `organization_id` if the app becomes organization/team-scoped.
- Tighten RLS policies around ownership before multi-tenant use.

## B. Local ID Strategy

Recommended:

- Keep Supabase `id uuid` as the database primary key.
- Keep `local_id text unique` to map browser/localStorage records to Supabase rows.
- Do not require browser local IDs to be UUID.

Reasoning:

- The local-first MVP already has stable browser-local IDs.
- Some local fallback IDs may be string IDs rather than UUIDs.
- `local_id` avoids risky data conversion before sync behavior is designed.

## C. Invoice Sequence Conflict Behavior

Recommended:

- Never decrease the remote or local invoice sequence.
- On conflict, preserve the highest known `last_number`.
- Enforce `invoice_number unique`.
- Sync logic must not regenerate already-issued invoices.

Reasoning:

- Issued invoice numbers are business records.
- Browser refresh, backup restore, or future cloud sync must preserve invoice number and issue date.
- The sequence table should protect future invoices without rewriting existing ones.

## D. Existing Transactions Table

Recommended:

- Do not alter `public.transactions` in the optional sync-table migration.
- Treat transaction-table modifications as a separate future migration.
- Later evaluate adding:
  - `local_id`
  - `updated_at`
  - `deleted_at`
  - `sync_status`
  - `metadata`

Reasoning:

- The remote `transactions` table already exists and overlaps with the local model.
- Any change to an existing table deserves separate review.
- H1/H2 filtering can already use the existing `date` field.

## E. Period Closing Model

Confirmed:

- Official closing remains semi-monthly.
- H1 = day 1 through day 15.
- H2 = day 16 through the last day of the month.
- Monthly summaries remain management-only and are not official distribution closings.

Implementation implication:

- `period_closings` is the official closing table.
- Any future `monthly_closings` table, if added, must be labeled legacy or management summary only.

## F. Apply / Not Apply Recommendation

Recommendation:

- The proposed sync-table migration is structurally non-destructive.
- It is safe to apply only after human review.
- Do not wire runtime sync until a separate sync-service implementation is planned and approved.

Before applying:

- Review RLS assumptions.
- Confirm the app remains local-first after migration.
- Confirm no service role keys will be exposed in frontend code.
- Confirm backups exist before any future sync behavior writes remote data.
