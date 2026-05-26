# Financial Rules

This document describes the financial rules currently implemented by the local-first MVP. It is an implementation reference, not final accounting, tax, legal, or operating agreement approval.

The calculation source of truth is `utils/calculations.ts`. Dashboards, P&L views, distribution results, and monthly closings should use that engine so totals do not drift between screens.

## Revenue Recognition

The MVP supports cash and accrual calculation views:

- Cash view counts only transactions with `status: paid`.
- Accrual view counts all transactions in the selected period, including pending transactions.
- The distribution engine uses cash-basis results for realized revenue, expenses, origination, reserve, and partner distributions.
- Invoice issuance does not recognize revenue by itself. A transaction must be marked paid before it affects cash-basis revenue and distributions.

## COGS Treatment

COGS expenses reduce gross margin when they count under the selected accounting basis:

- Cash view includes paid COGS only.
- Accrual view includes paid and pending COGS.
- External commissions attached to counted revenue are treated as COGS.

## OpEx Treatment

OpEx expenses reduce operating profit when they count under the selected accounting basis:

- Cash view includes paid OpEx only.
- Accrual view includes paid and pending OpEx.
- OpEx does not reduce gross margin; it reduces net income after gross profit.

## External Commission Treatment

External commission amounts on revenue transactions are included as COGS when the related revenue transaction counts under the selected basis.

In the distribution engine, this means external commissions on paid revenue reduce cash net income once through COGS. They should not be added again as a separate deduction elsewhere.

## Reimbursement Treatment

Paid reimbursable expenses assigned to a fixed partner are tracked as partner reimbursements.

Reimbursements are added to final partner payouts, but they do not increase or decrease the distributable balance. They are repayment amounts layered on top of partner share and origination fee calculations.

Dynamic reimbursement labels can be saved on transactions for records, but only fixed partner labels currently participate in reimbursement payout buckets.

## Origination Fee Treatment

**Business rule preserved from current implementation; final business approval required.**

Current formula:

```text
origination fee per fixed partner = paid gross revenue originated by that partner * 10%
```

Current behavior:

- The formula uses paid gross revenue, not net revenue.
- The formula is calculated per fixed partner originator.
- The total origination fee is deducted before reserve and partner distribution.
- Dynamic originator labels that do not match a fixed partner do not receive an origination fee bucket.
- The formula is isolated in `calculateOriginationFees` so the base or eligibility rule can be changed later without rewriting the whole engine.

## Reserve Treatment

**Business rule preserved from current implementation; final business approval required.**

Current formula:

```text
distributable base = max(0, cash net income - total origination fee)
company reserve = distributable base * 12%
```

Current behavior:

- Reserve is calculated after origination fee.
- Reserve is based on cash net income after origination, not gross revenue or gross profit.
- Negative distributable base is floored at zero before reserve is calculated.
- The reserve formula is intentionally kept as a single isolated calculation line in `calculateDistribution`.

## Partner Distribution

Current partner distribution rates:

- Evandro: 33.34%
- Julia/Samuel: 33.33%
- Walter: 33.33%

The distributable balance is calculated as:

```text
distributable balance = max(0, distributable base - company reserve)
```

Evandro and Julia/Samuel are rounded directly from their configured percentages. Walter receives the residual amount after those rounded shares, so partner distributions reconcile to the distributable balance subject to currency rounding.

Negative months do not create positive partner distributions. The distributable base is floored at zero.

## Monthly Closing Snapshots

Monthly closings save an official local snapshot of the selected month using the same distribution calculation engine as the live dashboard.

Saved closings preserve the calculated values and included transaction IDs at closing time. Editing transactions later can change the live monthly view, but it should not silently overwrite the saved official closing snapshot.

## Invoice Impact

Invoice records are operational metadata. They do not change revenue recognition by themselves.

Current rules:

- Issued invoices do not count as paid revenue.
- Paid invoice status does not automatically change transaction status unless explicit app logic does so.
- Cash-basis revenue is controlled by transaction `status`.
- Invoice totals should match the linked transaction totals, but cancelled invoices do not reverse revenue unless the linked transaction is also adjusted.

## Currency Assumptions

The MVP primarily reports totals in USD.

Current assumptions:

- USD transaction amounts are used directly.
- BRL expenses are adjusted with the configured FX safety spread in the calculation engine.
- The app stores transaction currency metadata, but full multi-currency accounting and realized FX gain/loss treatment are not finalized.

Currency handling should receive separate business and accounting review before relying on mixed-currency financial statements.
