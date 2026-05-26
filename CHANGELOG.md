# Changelog

All notable changes to the OneBridge CFO Virtual app are documented here.

## Semi-Monthly Official Closing — 2026-05-26

Business correction: the official financial closing is **semi-monthly (biweekly)**,
not monthly. The monthly view is retained only as a management summary.

### Changes
- **Semi-monthly period model** — new `utils/periods.ts` defines the official
  period: H1 = day 1–15, H2 = day 16–last day (leap-year aware), with helpers
  for current/previous period, labels, keys (`2026-05-H1`), and date filtering.
- **Period closing snapshots** — official closings now stored under the new key
  `onebridge_cfo_period_closings_v1` via `PeriodClosingService`, keyed by period
  (`2026-05-H1` / `2026-05-H2`). Closing calculations filter transactions by date
  within the period; the shared financial engine is unchanged.
- **Dashboard** — the command view is now labelled a management summary; a
  semi-monthly closing card adds an H1/H2 selector plus "current period" and
  "previous period" shortcuts and a "Fechar quinzena" action.
- **Report** — the official report is the "Semi-Monthly Closing Report" (Quinzenal
  default), comparing live vs official period snapshot; PDF filename is now
  `Onebridge-Period-Closing-2026-05-H1.pdf`. The monthly scope is relabelled a
  management summary.
- **Legacy preservation** — existing monthly closings
  (`onebridge_cfo_monthly_closings_v1`) are preserved as legacy management data,
  exported in backups under `legacyMonthlyClosings`, and are not auto-migrated
  (a monthly total cannot be reliably split into H1/H2) and not used as official.
- **Backup** — bumped to version 2; export/import now round-trips period closings
  and preserves legacy monthly closings (also reads v1 backups).
- **Tests** — added semi-monthly smoke tests (H1/H2 boundaries, leap-year
  February, empty period, snapshot vs live independence, period PDF filename, and
  backup export/import restore of period closings).
- No financial formulas, invoice numbering, or other localStorage keys changed.

## Local-First MVP Stable Checkpoint — 2026-05-26

First stable checkpoint of the local-first MVP. The app runs entirely in the
browser with no Supabase or remote database required, financial tests pass, and
the production build completes with zero warnings.

### Highlights
- **Local transaction persistence** — transactions saved to `localStorage`
  (`onebridge_cfo_transactions_v1`) through a dedicated service layer.
- **Dynamic configurable options** — service modalities, expense descriptions,
  originators, and reimbursement parties are user-extensible and persisted
  (`onebridge_cfo_configurable_options_v1`).
- **Monthly history and closing snapshots** — per-month views plus official
  closing snapshots that capture the engine's results
  (`onebridge_cfo_monthly_closings_v1`).
- **Local invoice persistence** — invoice records, statuses, and per-year
  sequence numbering stored locally (`onebridge_cfo_invoices_v1`,
  `onebridge_cfo_invoice_sequence_v1`).
- **Backup / export / import** — full JSON export and import of transactions,
  options, closings, and invoices for preserving financial history.
- **Centralized financial engine** — all distribution, P&L, reserve, and
  origination math lives in `utils/calculations.ts`.
- **Financial rules documentation** — current MVP rules and pending
  business-approval items documented in `docs/FINANCIAL_RULES.md`.
- **Premium invoice / report / dashboard styling** — institutional visual pass
  across the invoice document, monthly closing report, and command dashboard.
- **Visual QA with demo data** — dev-only seeding utility populates two months
  of realistic data (paid/unpaid revenue, COGS, OpEx, commissions,
  reimbursements, invoices, a closed and an open month) for QA.
- **Print-readiness fixes** — issued invoices print sharp (no blur/overlay) and
  toner-friendly; reports paginate cleanly without splitting critical blocks;
  fixed a stray `0` render in the report transactions table.
- **Tailwind local setup** — replaced the Tailwind CDN with a local Tailwind v3
  + PostCSS/Vite pipeline.
- **Build warning cleanup** — removed the dead `/index.css` reference and split
  vendor dependencies into separate chunks so no chunk exceeds Vite's 500 kB
  warning threshold; `npm run build` now runs warning-free.
