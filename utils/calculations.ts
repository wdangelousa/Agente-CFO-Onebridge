import {
  FinancialData,
  DistributionResult,
  Partner,
  PARTNER_DISTRIBUTION_RATES,
  RATES,
  ORIGINATION_RATE,
  RESERVE_RATE,
  TransactionType,
  TransactionStatus,
  ExpenseCategory,
} from '../types.ts';

export type AccountingBasis = 'cash' | 'accrual';

export interface ProfitAndLossResult {
  grossRevenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  netIncome: number;
  grossMargin: number;
  netMargin: number;
  externalCommissions: number;
  expensesBreakdown: Record<string, number>;
  cogsBreakdown: Record<string, number>;
  opexBreakdown: Record<string, number>;
}

const PARTNER_KEYS = [Partner.EVANDRO, Partner.JULIA_SAMUEL, Partner.WALTER] as const;

export const roundCurrency = (value: number): number => {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
};

const shouldCountForBasis = (transaction: FinancialData, basis: AccountingBasis): boolean => {
  return basis === 'accrual' || transaction.status === TransactionStatus.PAID;
};

const normalizedExpenseAmount = (transaction: FinancialData): number => {
  const amount = Number(transaction.amount) || 0;

  if (transaction.currency === 'BRL') {
    return amount * (1 + RATES.FX_SAFETY_SPREAD);
  }

  return amount;
};

const normalizedRevenueAmount = (transaction: FinancialData): number => {
  return Number(transaction.grossRevenue) || 0;
};

const addBreakdown = (breakdown: Record<string, number>, label: string, amount: number) => {
  breakdown[label] = roundCurrency((breakdown[label] || 0) + amount);
};

export const calculateProfitAndLoss = (
  transactions: FinancialData[],
  basis: AccountingBasis = 'cash'
): ProfitAndLossResult => {
  let grossRevenue = 0;
  let cogs = 0;
  let opex = 0;
  let externalCommissions = 0;
  const cogsBreakdown: Record<string, number> = {};
  const opexBreakdown: Record<string, number> = {};

  transactions.forEach((transaction) => {
    if (!shouldCountForBasis(transaction, basis)) return;

    if (transaction.type === TransactionType.REVENUE) {
      const revenue = normalizedRevenueAmount(transaction);
      grossRevenue += revenue;

      const commission = Number(transaction.externalCommission) || 0;
      if (commission > 0) {
        externalCommissions += commission;
        cogs += commission;
        addBreakdown(cogsBreakdown, transaction.externalCommissionDescription || 'Comissão Externa', commission);
      }
    }

    if (transaction.type === TransactionType.EXPENSE) {
      const amount = normalizedExpenseAmount(transaction);
      const label = transaction.description || 'Outros';

      if (transaction.category === ExpenseCategory.COGS) {
        cogs += amount;
        addBreakdown(cogsBreakdown, label, amount);
      } else {
        opex += amount;
        addBreakdown(opexBreakdown, label, amount);
      }
    }
  });

  grossRevenue = roundCurrency(grossRevenue);
  cogs = roundCurrency(cogs);
  opex = roundCurrency(opex);
  externalCommissions = roundCurrency(externalCommissions);

  const grossProfit = roundCurrency(grossRevenue - cogs);
  const netIncome = roundCurrency(grossProfit - opex);
  const grossMargin = grossRevenue > 0 ? roundCurrency((grossProfit / grossRevenue) * 100) : 0;
  const netMargin = grossRevenue > 0 ? roundCurrency((netIncome / grossRevenue) * 100) : 0;

  return {
    grossRevenue,
    cogs,
    grossProfit,
    opex,
    netIncome,
    grossMargin,
    netMargin,
    externalCommissions,
    expensesBreakdown: { ...cogsBreakdown, ...opexBreakdown },
    cogsBreakdown,
    opexBreakdown,
  };
};

// Preserved MVP rule: origination is 10% of paid gross revenue by fixed partner.
// Business approval is still required; the formula is isolated for future change.
const calculateOriginationFees = (partnerRevenue: Record<string, number>) => {
  const fees = {
    [Partner.EVANDRO]: 0,
    [Partner.JULIA_SAMUEL]: 0,
    [Partner.WALTER]: 0,
    [Partner.NONE]: 0,
  };

  PARTNER_KEYS.forEach((partner) => {
    fees[partner] = roundCurrency((partnerRevenue[partner] || 0) * ORIGINATION_RATE);
  });

  return fees;
};

const calculatePartnerShares = (finalDistributable: number) => {
  const evandro = roundCurrency(finalDistributable * PARTNER_DISTRIBUTION_RATES.EVANDRO);
  const juliaSamuel = roundCurrency(finalDistributable * PARTNER_DISTRIBUTION_RATES.JULIA_SAMUEL);
  const walter = roundCurrency(finalDistributable - evandro - juliaSamuel);

  return {
    evandro,
    juliaSamuel,
    walter,
  };
};

export const calculateDistribution = (transactions: FinancialData[]): DistributionResult => {
  const cashPnL = calculateProfitAndLoss(transactions, 'cash');
  let provisionedFlow = 0;
  let grossTotalBookkeeping = 0;

  const partnerRevenue: Record<string, number> = {
    [Partner.EVANDRO]: 0,
    [Partner.JULIA_SAMUEL]: 0,
    [Partner.WALTER]: 0,
    [Partner.NONE]: 0,
  };

  const reimbursementByPartner: Record<string, number> = {
    [Partner.EVANDRO]: 0,
    [Partner.JULIA_SAMUEL]: 0,
    [Partner.WALTER]: 0,
    [Partner.NONE]: 0,
  };

  transactions.forEach((transaction) => {
    if (transaction.type === TransactionType.REVENUE) {
      const gross = normalizedRevenueAmount(transaction);
      grossTotalBookkeeping += gross;

      if (transaction.status === TransactionStatus.PAID && transaction.originator && partnerRevenue[transaction.originator] !== undefined) {
        partnerRevenue[transaction.originator] += gross;
      }
    }

    if (transaction.type === TransactionType.EXPENSE) {
      const amount = normalizedExpenseAmount(transaction);
      provisionedFlow += amount;

      if (
        transaction.status === TransactionStatus.PAID &&
        transaction.isReimbursable &&
        transaction.reimbursementBeneficiary &&
        transaction.reimbursementBeneficiary !== Partner.NONE &&
        reimbursementByPartner[transaction.reimbursementBeneficiary] !== undefined
      ) {
        reimbursementByPartner[transaction.reimbursementBeneficiary] += amount;
      }
    }
  });

  const originationFees = calculateOriginationFees(partnerRevenue);
  const originationFee = roundCurrency(PARTNER_KEYS.reduce((sum, partner) => sum + originationFees[partner], 0));
  const distributableBase = roundCurrency(Math.max(0, cashPnL.netIncome - originationFee));

  // Preserved MVP rule: reserve is 12% of cash net income after origination.
  // Business approval is still required; this line is the single reserve formula.
  const companyReserve = roundCurrency(distributableBase * RESERVE_RATE);

  const distributableBalance = roundCurrency(Math.max(0, distributableBase - companyReserve));
  const partnerShares = calculatePartnerShares(distributableBalance);

  const paidOutflows = roundCurrency(cashPnL.cogs + cashPnL.opex);
  const pendingPayables = roundCurrency(Math.max(0, provisionedFlow - paidOutflows));

  return {
    realizedRevenue: cashPnL.grossRevenue,
    totalCOGS: cashPnL.cogs,
    grossMargin: cashPnL.grossProfit,
    totalOpEx: cashPnL.opex,
    netIncome: cashPnL.netIncome,
    safetyMargin: cashPnL.netIncome,
    provisionedFlow: roundCurrency(provisionedFlow),
    pendingPayables,
    grossTotalBookkeeping: roundCurrency(grossTotalBookkeeping),
    externalCommissions: cashPnL.externalCommissions,

    originationFee,

    originationFees: {
      evandro: originationFees[Partner.EVANDRO],
      juliaSamuel: originationFees[Partner.JULIA_SAMUEL],
      walter: originationFees[Partner.WALTER],
    },

    companyReserve,
    distributableBalance,

    partnerShares,
    reimbursements: {
      evandro: roundCurrency(reimbursementByPartner[Partner.EVANDRO]),
      juliaSamuel: roundCurrency(reimbursementByPartner[Partner.JULIA_SAMUEL]),
      walter: roundCurrency(reimbursementByPartner[Partner.WALTER]),
    },
    finalPayouts: {
      evandro: roundCurrency(partnerShares.evandro + originationFees[Partner.EVANDRO] + reimbursementByPartner[Partner.EVANDRO]),
      juliaSamuel: roundCurrency(partnerShares.juliaSamuel + originationFees[Partner.JULIA_SAMUEL] + reimbursementByPartner[Partner.JULIA_SAMUEL]),
      walter: roundCurrency(partnerShares.walter + originationFees[Partner.WALTER] + reimbursementByPartner[Partner.WALTER]),
      reserve: companyReserve,
    },
  };
};
