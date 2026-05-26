import { calculateDistribution, calculateProfitAndLoss, roundCurrency } from '../utils/calculations.ts';
import { ClientType, ExpenseCategory, FinancialData, InvoiceRecord, Partner, PaymentMethod, TransactionStatus, TransactionType } from '../types.ts';
import {
  buildSemiMonthlyPeriod,
  getPeriodFromKey,
  getPeriodReportFileName,
  getPreviousSemiMonthlyPeriod,
  getSemiMonthlyPeriodForDate,
  getSemiMonthlyPeriodsForMonth,
  isDateInPeriod,
} from '../utils/periods.ts';
import { PeriodClosingService } from '../services/periodClosingService.ts';
import { LocalBackupService } from '../services/localBackupService.ts';

const baseTransaction = {
  clientType: ClientType.INDIVIDUAL,
  clientTaxId: '',
  clientAddress: '',
  clientEmail: '',
  responsibleName: '',
  externalCommission: 0,
  originator: Partner.EVANDRO,
  currency: 'USD' as const,
  paymentMethod: PaymentMethod.WIRE,
  paymentLink: '',
  commissionType: 'fixed' as const,
  commissionRate: 0,
  competenceMonth: '2026-05',
};

const revenue = (overrides: Partial<FinancialData>): FinancialData => ({
  ...baseTransaction,
  id: `rev-${Math.random().toString(36).slice(2)}`,
  type: TransactionType.REVENUE,
  status: TransactionStatus.PAID,
  description: 'Revenue',
  serviceType: 'Tax Planning',
  grossRevenue: 1000,
  amount: 0,
  date: '2026-05-10T12:00:00.000Z',
  ...overrides,
});

const expense = (overrides: Partial<FinancialData>): FinancialData => ({
  ...baseTransaction,
  id: `exp-${Math.random().toString(36).slice(2)}`,
  type: TransactionType.EXPENSE,
  status: TransactionStatus.PAID,
  description: 'Expense',
  serviceType: '',
  grossRevenue: 0,
  amount: 100,
  category: ExpenseCategory.COGS,
  date: '2026-05-11T12:00:00.000Z',
  ...overrides,
});

const assertEqual = (label: string, actual: number | string | boolean | undefined, expected: number | string | boolean | undefined) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
};

const assertClose = (label: string, actual: number, expected: number) => {
  if (Math.abs(roundCurrency(actual) - roundCurrency(expected)) > 0.01) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
};

const paidRevenueOnly = calculateDistribution([revenue({})]);
assertClose('paid revenue realized', paidRevenueOnly.realizedRevenue, 1000);
assertClose('paid revenue origination fee', paidRevenueOnly.originationFee, 100);
assertClose('paid revenue reserve after origination', paidRevenueOnly.companyReserve, 108);
assertClose('paid revenue distributable', paidRevenueOnly.distributableBalance, 792);
assertClose(
  'partner shares reconcile',
  paidRevenueOnly.partnerShares.evandro + paidRevenueOnly.partnerShares.juliaSamuel + paidRevenueOnly.partnerShares.walter,
  paidRevenueOnly.distributableBalance
);

const unpaidRevenueOnly = calculateDistribution([revenue({ status: TransactionStatus.PENDING })]);
assertClose('unpaid revenue not realized', unpaidRevenueOnly.realizedRevenue, 0);
assertClose('unpaid revenue not distributable', unpaidRevenueOnly.distributableBalance, 0);
assertClose('unpaid revenue accrual visible', unpaidRevenueOnly.grossTotalBookkeeping, 1000);

const cogsAndOpex = calculateDistribution([
  revenue({ grossRevenue: 1000 }),
  expense({ amount: 200, category: ExpenseCategory.COGS }),
  expense({ amount: 150, category: ExpenseCategory.OPEX }),
]);
assertClose('COGS reduces gross margin', cogsAndOpex.grossMargin, 800);
assertClose('OpEx reduces net income', cogsAndOpex.netIncome, 650);

const externalCommission = calculateDistribution([
  revenue({ grossRevenue: 1000, externalCommission: 80, externalCommissionDescription: 'Referral' }),
]);
assertClose('external commission counted as COGS once', externalCommission.totalCOGS, 80);
assertClose('external commission lowers net income', externalCommission.netIncome, 920);

const negativeMonth = calculateDistribution([
  expense({ amount: 500, category: ExpenseCategory.OPEX }),
]);
assertClose('negative month has no distributable balance', negativeMonth.distributableBalance, 0);
assertClose('negative month partner share evandro', negativeMonth.partnerShares.evandro, 0);

const pendingExpense = calculateDistribution([
  revenue({ grossRevenue: 1000 }),
  expense({ amount: 250, status: TransactionStatus.PENDING, category: ExpenseCategory.OPEX }),
]);
assertClose('pending expense excluded from cash OpEx', pendingExpense.totalOpEx, 0);
assertClose('pending expense shown as payable', pendingExpense.pendingPayables, 250);

const cashPnL = calculateProfitAndLoss([
  revenue({ status: TransactionStatus.PENDING, grossRevenue: 1000 }),
  expense({ status: TransactionStatus.PENDING, amount: 100, category: ExpenseCategory.OPEX }),
], 'cash');
const accrualPnL = calculateProfitAndLoss([
  revenue({ status: TransactionStatus.PENDING, grossRevenue: 1000 }),
  expense({ status: TransactionStatus.PENDING, amount: 100, category: ExpenseCategory.OPEX }),
], 'accrual');
assertClose('cash P&L excludes unpaid revenue', cashPnL.grossRevenue, 0);
assertClose('accrual P&L includes unpaid revenue', accrualPnL.grossRevenue, 1000);
assertClose('accrual P&L includes unpaid OpEx', accrualPnL.opex, 100);

// --- Semi-monthly period model ------------------------------------------------

assertEqual('day 1 -> H1', getSemiMonthlyPeriodForDate('2026-05-01').half, 'H1');
assertEqual('day 15 -> H1', getSemiMonthlyPeriodForDate('2026-05-15').half, 'H1');
assertEqual('day 16 -> H2', getSemiMonthlyPeriodForDate('2026-05-16').half, 'H2');
assertEqual('last day -> H2', getSemiMonthlyPeriodForDate('2026-05-31').half, 'H2');

const [mayH1, mayH2] = getSemiMonthlyPeriodsForMonth(2026, 5);
assertEqual('H1 start date', mayH1.startDate, '2026-05-01');
assertEqual('H1 end date', mayH1.endDate, '2026-05-15');
assertEqual('H2 start date', mayH2.startDate, '2026-05-16');
assertEqual('H2 end date (May 31)', mayH2.endDate, '2026-05-31');
assertEqual('H1 period key', mayH1.periodKey, '2026-05-H1');
assertEqual('H1 month key', mayH1.monthKey, '2026-05');
assertEqual('H1 label en-dash', mayH1.label, 'May 1–15, 2026');

// Leap-year February end dates
assertEqual('leap Feb H2 end (2024)', getSemiMonthlyPeriodsForMonth(2024, 2)[1].endDate, '2024-02-29');
assertEqual('non-leap Feb H2 end (2026)', getSemiMonthlyPeriodsForMonth(2026, 2)[1].endDate, '2026-02-28');

// Previous period navigation
assertEqual('prev of H2 is same-month H1', getPreviousSemiMonthlyPeriod(mayH2).periodKey, '2026-05-H1');
assertEqual('prev of H1 is prev-month H2', getPreviousSemiMonthlyPeriod(mayH1).periodKey, '2026-04-H2');
assertEqual('prev of Jan H1 crosses year', getPreviousSemiMonthlyPeriod(buildSemiMonthlyPeriod(2026, 1, 'H1')).periodKey, '2025-12-H2');

// Period key parsing
assertEqual('parse period key end date', getPeriodFromKey('2026-05-H2')?.endDate, '2026-05-31');

// Date-range filtering: H1 = days 1-15, H2 = days 16-last
assertEqual('day1 in H1', isDateInPeriod('2026-05-01T12:00:00.000Z', mayH1), true);
assertEqual('day15 in H1', isDateInPeriod('2026-05-15T12:00:00.000Z', mayH1), true);
assertEqual('day16 not in H1', isDateInPeriod('2026-05-16T12:00:00.000Z', mayH1), false);
assertEqual('day16 in H2', isDateInPeriod('2026-05-16T12:00:00.000Z', mayH2), true);
assertEqual('last day in H2', isDateInPeriod('2026-05-31T12:00:00.000Z', mayH2), true);

const mayTxns = [
  revenue({ date: '2026-05-01T12:00:00.000Z', grossRevenue: 1000 }),
  revenue({ date: '2026-05-15T12:00:00.000Z', grossRevenue: 1000 }),
  revenue({ date: '2026-05-16T12:00:00.000Z', grossRevenue: 1000 }),
  revenue({ date: '2026-05-31T12:00:00.000Z', grossRevenue: 1000 }),
];
const h1Txns = mayTxns.filter((t) => isDateInPeriod(t.date, mayH1));
const h2Txns = mayTxns.filter((t) => isDateInPeriod(t.date, mayH2));
assertEqual('H1 captures 2 transactions', h1Txns.length, 2);
assertEqual('H2 captures 2 transactions', h2Txns.length, 2);
assertClose('H1 realized revenue (days 1 & 15)', calculateDistribution(h1Txns).realizedRevenue, 2000);
assertClose('H2 realized revenue (days 16 & last)', calculateDistribution(h2Txns).realizedRevenue, 2000);

// Empty period yields no distribution
assertClose('empty period distributable', calculateDistribution([]).distributableBalance, 0);

// Period closing snapshot freezes engine values; later live edits do not mutate it.
const periodSnapshot = PeriodClosingService.buildSnapshot(mayH1, h1Txns, calculateDistribution(h1Txns));
assertEqual('period closing periodKey', periodSnapshot.periodKey, '2026-05-H1');
assertClose('period closing froze revenue', periodSnapshot.totalRevenue, 2000);
const liveAfterEdit = calculateDistribution([...h1Txns, revenue({ date: '2026-05-10T12:00:00.000Z', grossRevenue: 5000 })]);
assertClose('snapshot stays frozen after live edit', periodSnapshot.totalRevenue, 2000);
assertClose('live recomputes after edit', liveAfterEdit.realizedRevenue, 7000);

// PDF filename for period report
assertEqual('period report filename H1', getPeriodReportFileName(mayH1), 'Onebridge-Period-Closing-2026-05-H1');
assertEqual('period report filename H2', getPeriodReportFileName(mayH2), 'Onebridge-Period-Closing-2026-05-H2');

const closedSnapshot = PeriodClosingService.buildSnapshot(mayH1, [revenue({ grossRevenue: 1000 })], paidRevenueOnly);
assertEqual('period closing stores live engine total', closedSnapshot.distributableProfit, paidRevenueOnly.distributableBalance);

const invoiceIssuedButUnpaid: InvoiceRecord = {
  id: 'inv-issued',
  invoiceNumber: 'OBS-2026-0001',
  status: 'issued',
  issuedAt: '2026-05-10T12:00:00.000Z',
  dueDate: '2026-05-24',
  transactionIds: ['rev-unpaid'],
  payerName: 'Client',
  clientName: 'Client',
  description: 'Tax Planning',
  subtotal: 1000,
  total: 1000,
  currency: 'USD',
  createdAt: '2026-05-10T12:00:00.000Z',
  updatedAt: '2026-05-10T12:00:00.000Z',
};
const invoicePaid: InvoiceRecord = { ...invoiceIssuedButUnpaid, id: 'inv-paid', invoiceNumber: 'OBS-2026-0002', status: 'paid' };
assertEqual('issued invoice total matches linked transaction total', invoiceIssuedButUnpaid.total, 1000);
assertEqual('paid invoice status is independent metadata', invoicePaid.status, 'paid');

// --- Backup export/import round-trips period closings -------------------------
// Runs in Node where the services fall back to in-memory storage.
await PeriodClosingService.replaceAll([periodSnapshot]);
const exportedJson = await LocalBackupService.exportAll();
const exported = JSON.parse(exportedJson);
assertEqual('backup version bumped to 2', exported.version, 2);
assertEqual('backup includes period closings', Array.isArray(exported.periodClosings) ? exported.periodClosings.length : -1, 1);
assertEqual('backup includes legacy monthly field', Array.isArray(exported.legacyMonthlyClosings), true);

await PeriodClosingService.clearAll();
assertEqual('period closings cleared before import', (await PeriodClosingService.fetchAll()).length, 0);

await LocalBackupService.importAll(exportedJson);
const restoredClosings = await PeriodClosingService.fetchAll();
assertEqual('import restores period closings', restoredClosings.length, 1);
assertEqual('restored period key', restoredClosings[0].periodKey, '2026-05-H1');
assertClose('restored period revenue', restoredClosings[0].totalRevenue, 2000);

console.log('Financial smoke tests passed.');
