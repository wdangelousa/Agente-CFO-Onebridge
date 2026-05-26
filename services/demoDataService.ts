import {
  ClientType,
  ExpenseCategory,
  FinancialData,
  InvoiceRecord,
  PeriodClosingSnapshot,
  Partner,
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from '../types';
import { calculateDistribution } from '../utils/calculations';
import { createStoredDate } from '../utils/date';
import { getSemiMonthlyPeriodsForMonth, isDateInPeriod } from '../utils/periods';
import { TransactionService } from './transactionService';
import { InvoiceService } from './invoiceService';
import { PeriodClosingService } from './periodClosingService';

/**
 * Dev/manual-only demo data utility.
 *
 * This seeds the SAME localStorage keys the app already uses, through the
 * existing service layer (no new keys, no formula changes). It is never wired
 * to run automatically — it is only reachable from a clearly labelled manual
 * action that is hidden outside `import.meta.env.DEV`.
 *
 * Scenario: two consecutive months for "ONEBRIDGE STALWART LLC".
 *  - CLOSED_MONTH (one month before the open month): has an official closing snapshot.
 *  - OPEN_MONTH: live, no snapshot, with a paid invoice and an issued/unpaid invoice.
 */

// Anchor the demo to a fixed, recent two-month window so screenshots are stable.
const OPEN_MONTH = { year: 2026, month: 5 }; // May 2026 (open / live)
const CLOSED_MONTH = { year: 2026, month: 4 }; // April 2026 (officially closed)

const monthKey = (m: { year: number; month: number }) =>
  `${m.year}-${m.month.toString().padStart(2, '0')}`;

const baseFields = {
  clientType: ClientType.COMPANY,
  externalCommission: 0,
  currency: 'USD' as const,
  paymentMethod: PaymentMethod.WIRE,
  paymentLink: '',
  commissionType: 'fixed' as const,
  commissionRate: 0,
};

function buildTransactions(): FinancialData[] {
  const closed = CLOSED_MONTH;
  const open = OPEN_MONTH;

  // ---- CLOSED MONTH (April 2026) ------------------------------------------
  const closedRevenuePaid: FinancialData = {
    ...baseFields,
    id: 'demo-rev-apr-1',
    type: TransactionType.REVENUE,
    status: TransactionStatus.PAID,
    description: 'Helios Imports LLC',
    serviceType: 'Abertura Delaware',
    clientType: ClientType.COMPANY,
    clientTaxId: '88-1234567',
    clientAddress: '500 Brickell Ave, Suite 1200, Miami, FL 33131, USA',
    clientEmail: 'cfo@heliosimports.com',
    responsibleName: 'Marcos Ribeiro',
    grossRevenue: 12000,
    amount: 0,
    originator: Partner.EVANDRO,
    paymentMethod: PaymentMethod.WIRE,
    date: createStoredDate(closed.year, closed.month, 5),
    competenceMonth: monthKey(closed),
  };

  const closedRevenuePaidWithCommission: FinancialData = {
    ...baseFields,
    id: 'demo-rev-apr-2',
    type: TransactionType.REVENUE,
    status: TransactionStatus.PAID,
    description: 'Aurora Tech Inc.',
    serviceType: 'Planej.Tributário Avançado',
    clientType: ClientType.COMPANY,
    clientTaxId: '47-7654321',
    clientAddress: '1209 Orange St, Wilmington, DE 19801, USA',
    clientEmail: 'finance@auroratech.io',
    responsibleName: 'Patricia Gomes',
    grossRevenue: 8500,
    amount: 0,
    externalCommission: 500,
    externalCommissionDescription: 'Parceiro indicador — Nova Capital',
    originator: Partner.WALTER,
    paymentMethod: PaymentMethod.ZELLE,
    date: createStoredDate(closed.year, closed.month, 14),
    competenceMonth: monthKey(closed),
  };

  const closedCogs: FinancialData = {
    ...baseFields,
    id: 'demo-exp-apr-1',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PAID,
    description: 'Taxa Governamental (Filing Fee)',
    serviceType: '',
    grossRevenue: 0,
    amount: 1200,
    category: ExpenseCategory.COGS,
    linkedTransactionId: 'demo-rev-apr-1',
    originator: Partner.EVANDRO,
    date: createStoredDate(closed.year, closed.month, 6),
    competenceMonth: monthKey(closed),
  };

  const closedOpex: FinancialData = {
    ...baseFields,
    id: 'demo-exp-apr-2',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PAID,
    description: 'Software / Assinaturas',
    serviceType: '',
    grossRevenue: 0,
    amount: 450,
    category: ExpenseCategory.OPEX,
    originator: Partner.NONE,
    date: createStoredDate(closed.year, closed.month, 10),
    competenceMonth: monthKey(closed),
  };

  const closedReimbursable: FinancialData = {
    ...baseFields,
    id: 'demo-exp-apr-3',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PAID,
    description: 'Reembolso de Viagem',
    serviceType: '',
    grossRevenue: 0,
    amount: 320,
    category: ExpenseCategory.OPEX,
    isReimbursable: true,
    reimbursementBeneficiary: Partner.WALTER,
    originator: Partner.NONE,
    date: createStoredDate(closed.year, closed.month, 18),
    competenceMonth: monthKey(closed),
  };

  // ---- OPEN MONTH (May 2026) ----------------------------------------------
  const openRevenuePaid: FinancialData = {
    ...baseFields,
    id: 'demo-rev-may-1',
    type: TransactionType.REVENUE,
    status: TransactionStatus.PAID,
    description: 'Costa Verde Holdings',
    serviceType: 'Compliance Anual Flórida',
    clientType: ClientType.COMPANY,
    clientTaxId: '12-9988776',
    clientAddress: '100 SE 2nd St, Suite 2000, Miami, FL 33131, USA',
    clientEmail: 'ap@costaverde.com',
    responsibleName: 'Helena Duarte',
    grossRevenue: 15000,
    amount: 0,
    originator: Partner.JULIA_SAMUEL,
    paymentMethod: PaymentMethod.WIRE,
    date: createStoredDate(open.year, open.month, 7),
    competenceMonth: monthKey(open),
  };

  const openRevenueUnpaid: FinancialData = {
    ...baseFields,
    id: 'demo-rev-may-2',
    type: TransactionType.REVENUE,
    status: TransactionStatus.PENDING,
    description: 'Brava Ventures Corp.',
    serviceType: 'Registro Marca USPTO p/ classe',
    clientType: ClientType.COMPANY,
    clientTaxId: '63-4455667',
    clientAddress: '30 N Gould St, Sheridan, WY 82801, USA',
    clientEmail: 'legal@bravaventures.com',
    responsibleName: 'Rafael Antunes',
    grossRevenue: 6800,
    amount: 0,
    originator: Partner.EVANDRO,
    paymentMethod: PaymentMethod.PARCELADO_USA,
    paymentLink: 'https://pay.parcelado.us/demo/brava-ventures',
    date: createStoredDate(open.year, open.month, 12),
    competenceMonth: monthKey(open),
  };

  const openCogsPending: FinancialData = {
    ...baseFields,
    id: 'demo-exp-may-1',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    description: 'Apostilamento',
    serviceType: '',
    grossRevenue: 0,
    amount: 900,
    category: ExpenseCategory.COGS,
    linkedTransactionId: 'demo-rev-may-1',
    originator: Partner.JULIA_SAMUEL,
    date: createStoredDate(open.year, open.month, 9),
    competenceMonth: monthKey(open),
  };

  const openOpex: FinancialData = {
    ...baseFields,
    id: 'demo-exp-may-2',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PAID,
    description: 'Marketing / Ads',
    serviceType: '',
    grossRevenue: 0,
    amount: 600,
    category: ExpenseCategory.OPEX,
    originator: Partner.NONE,
    date: createStoredDate(open.year, open.month, 11),
    competenceMonth: monthKey(open),
  };

  const openReimbursable: FinancialData = {
    ...baseFields,
    id: 'demo-exp-may-3',
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PAID,
    description: 'Material de Escritório',
    serviceType: '',
    grossRevenue: 0,
    amount: 210,
    category: ExpenseCategory.OPEX,
    isReimbursable: true,
    reimbursementBeneficiary: Partner.EVANDRO,
    originator: Partner.NONE,
    date: createStoredDate(open.year, open.month, 16),
    competenceMonth: monthKey(open),
  };

  return [
    closedRevenuePaid,
    closedRevenuePaidWithCommission,
    closedCogs,
    closedOpex,
    closedReimbursable,
    openRevenuePaid,
    openRevenueUnpaid,
    openCogsPending,
    openOpex,
    openReimbursable,
  ];
}

function buildInvoices(): { invoices: InvoiceRecord[]; sequence: Record<string, number> } {
  const open = OPEN_MONTH;
  const year = open.year.toString();
  const issuedAtPaid = createStoredDate(open.year, open.month, 7);
  const issuedAtUnpaid = createStoredDate(open.year, open.month, 12);
  const now = new Date().toISOString();

  const paidInvoice: InvoiceRecord = {
    id: 'demo-inv-may-1',
    invoiceNumber: 'OBS-2026-0001',
    status: 'paid',
    issuedAt: issuedAtPaid,
    dueDate: createStoredDate(open.year, open.month, 21).slice(0, 10),
    transactionIds: ['demo-rev-may-1'],
    payerName: 'Costa Verde Holdings',
    clientName: 'Costa Verde Holdings',
    description: 'Compliance Anual Flórida',
    subtotal: 15000,
    total: 15000,
    currency: 'USD',
    notes: 'Pagamento confirmado via wire transfer.',
    createdAt: now,
    updatedAt: now,
  };

  const issuedInvoice: InvoiceRecord = {
    id: 'demo-inv-may-2',
    invoiceNumber: 'OBS-2026-0002',
    status: 'issued',
    issuedAt: issuedAtUnpaid,
    dueDate: createStoredDate(open.year, open.month, 26).slice(0, 10),
    transactionIds: ['demo-rev-may-2'],
    payerName: 'Brava Ventures Corp.',
    clientName: 'Brava Ventures Corp.',
    description: 'Registro Marca USPTO p/ classe',
    subtotal: 6800,
    total: 6800,
    currency: 'USD',
    notes: 'Aguardando pagamento via ParceladoUSA.',
    createdAt: now,
    updatedAt: now,
  };

  return { invoices: [paidInvoice, issuedInvoice], sequence: { [year]: 2 } };
}

// Both halves of the closed month are officially closed in the demo, so QA can
// see semi-monthly period closings (H1 and H2) reconciling against live values.
function buildPeriodClosings(transactions: FinancialData[]): PeriodClosingSnapshot[] {
  const [h1, h2] = getSemiMonthlyPeriodsForMonth(CLOSED_MONTH.year, CLOSED_MONTH.month);
  return [h1, h2].map((period) => {
    const periodTransactions = transactions.filter((t) => isDateInPeriod(t.date, period));
    const result = calculateDistribution(periodTransactions);
    const snapshot = PeriodClosingService.buildSnapshot(
      period,
      periodTransactions,
      result,
      'Fechamento quinzenal de demonstração (dados de teste).'
    );
    return { ...snapshot, id: `demo-closing-${period.periodKey}` };
  });
}

export class DemoDataService {
  static readonly OPEN_MONTH_KEY = monthKey(OPEN_MONTH);
  static readonly CLOSED_MONTH_KEY = monthKey(CLOSED_MONTH);

  /**
   * Replaces all local data with a populated two-month demo scenario.
   * Reuses the existing service `replaceAll` paths, so no localStorage keys
   * or financial formulas are touched.
   */
  static async seed(): Promise<void> {
    const transactions = buildTransactions();
    const { invoices, sequence } = buildInvoices();
    const periodClosings = buildPeriodClosings(transactions);

    await TransactionService.replaceAll(transactions);
    await InvoiceService.replaceAll(invoices, sequence);
    await PeriodClosingService.replaceAll(periodClosings);
  }
}
