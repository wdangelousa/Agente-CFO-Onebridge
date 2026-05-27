# Supabase Sync Migration Review

This checklist covers the proposed optional sync/backup migration only. The app remains local-first, and these migrations have not been applied to the remote database.

## Migration Files Created

- [x] `supabase/migrations/20260527023745_create_optional_sync_tables.sql`

## Tables Proposed

- [x] `public.configurable_options`
- [x] `public.period_closings`
- [x] `public.invoices`
- [x] `public.invoice_sequences`

## RLS Policies

- [x] RLS enabled on all new tables.
- [x] Authenticated users can select.
- [x] Authenticated users can insert.
- [x] Authenticated users can update.
- [x] No anonymous write policies.
- [x] No delete policies.

## Safety Checks

- [x] No destructive operations included.
- [x] No `drop table`.
- [x] No remote schema reset.
- [x] No `npx supabase db push` performed.
- [x] Existing `public.transactions` table untouched.
- [x] Existing `public.reports` table untouched.
- [x] LocalStorage persistence untouched.
- [x] App runtime untouched.
- [x] Login/auth not reintroduced into the app.
- [x] Financial formulas unchanged.
- [x] Invoice numbering unchanged.

## Business Rule Checks

- [x] Official closing remains semi-monthly.
- [x] H1 = day 1 through day 15.
- [x] H2 = day 16 through the last day of the month.
- [x] Monthly summaries remain management-only and legacy/non-official.
- [x] `period_closings` is the proposed official closing table.

## Manual Review Required Before Any Future `db push`

- [ ] Confirm RLS ownership model: single-tenant authenticated vs user/org scoped.
- [ ] Confirm whether `public.transactions` should receive `local_id`, `updated_at`, `deleted_at`, `sync_status`, and `metadata` in a separate migration.
- [ ] Confirm local ID strategy for rows whose browser-local IDs are not UUIDs.
- [ ] Confirm invoice sequence sync conflict behavior.
- [ ] Confirm whether attachment storage buckets are needed or whether JSON attachment metadata is enough.
- [ ] Confirm whether `payer_email` should be populated from transaction `clientEmail`.
- [ ] Review migration in Supabase SQL editor or CLI dry-run process before applying.
- [ ] Take/export local app backups before enabling any cloud sync.
- [ ] Do not run `npx supabase db push` until the above items are approved.
