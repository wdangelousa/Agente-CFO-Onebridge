# Changelog

All notable changes to the OneBridge CFO Virtual app are documented here.

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
