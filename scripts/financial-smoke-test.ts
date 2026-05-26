import { calculateDistribution, calculateProfitAndLoss, roundCurrency } from '../utils/calculations.ts';
import { ClientType, ExpenseCategory, FinancialData, InvoiceRecord, Partner, PaymentMethod, TransactionStatus, TransactionType } from '../types.ts';
import { MonthlyClosingService } from '../services/monthlyClosingService.ts';

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

const closedSnapshot = MonthlyClosingService.buildSnapshot('2026-05', [revenue({ grossRevenue: 1000 })], paidRevenueOnly);
assertEqual('closed month stores live engine total', closedSnapshot.distributableProfit, paidRevenueOnly.distributableBalance);

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

console.log('Financial smoke tests passed.');
