import { DistributionResult, FinancialData, MonthlyClosingSnapshot } from '../types.ts';

export const MONTHLY_CLOSINGS_STORAGE_KEY = 'onebridge_cfo_monthly_closings_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(month: string): string {
  return `closing-${month}-${Date.now().toString(36)}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

let memoryClosings: MonthlyClosingSnapshot[] = [];

function normalizeClosing(closing: MonthlyClosingSnapshot): MonthlyClosingSnapshot {
  const timestamp = nowIso();

  return {
    ...closing,
    id: closing.id || createId(closing.month),
    closedAt: closing.closedAt || timestamp,
    transactionIds: closing.transactionIds || [],
    partnerDistributions: {
      evandro: closing.partnerDistributions?.evandro || 0,
      juliaSamuel: closing.partnerDistributions?.juliaSamuel || 0,
      walter: closing.partnerDistributions?.walter || 0,
    },
    createdAt: closing.createdAt || timestamp,
    updatedAt: closing.updatedAt || timestamp,
  };
}

export class MonthlyClosingService {
  private static readAll(): MonthlyClosingSnapshot[] {
    const storage = getStorage();

    if (!storage) {
      return memoryClosings;
    }

    try {
      const rawValue = storage.getItem(MONTHLY_CLOSINGS_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      return Array.isArray(parsed) ? parsed.map((item) => normalizeClosing(item as MonthlyClosingSnapshot)) : [];
    } catch (error) {
      console.warn('Failed to read local monthly closings.', error);
      return [];
    }
  }

  private static writeAll(closings: MonthlyClosingSnapshot[]): void {
    const normalizedClosings = closings
      .map(normalizeClosing)
      .sort((a, b) => a.month.localeCompare(b.month));

    const storage = getStorage();

    if (!storage) {
      memoryClosings = normalizedClosings;
      return;
    }

    storage.setItem(MONTHLY_CLOSINGS_STORAGE_KEY, JSON.stringify(normalizedClosings));
  }

  static async fetchAll(): Promise<MonthlyClosingSnapshot[]> {
    return this.readAll();
  }

  static async findByMonth(month: string): Promise<MonthlyClosingSnapshot | null> {
    return this.readAll().find((closing) => closing.month === month) || null;
  }

  static buildSnapshot(
    month: string,
    transactions: FinancialData[],
    result: DistributionResult,
    notes?: string
  ): MonthlyClosingSnapshot {
    const timestamp = nowIso();
    return {
      id: createId(month),
      month,
      closedAt: timestamp,
      totalRevenue: result.realizedRevenue,
      totalCOGS: result.totalCOGS,
      totalOpEx: result.totalOpEx,
      externalCommissions: result.externalCommissions,
      originationFee: result.originationFee,
      reserve: result.companyReserve,
      distributableProfit: result.distributableBalance,
      partnerDistributions: {
        evandro: result.finalPayouts.evandro,
        juliaSamuel: result.finalPayouts.juliaSamuel,
        walter: result.finalPayouts.walter,
      },
      transactionIds: transactions.map((transaction) => transaction.id).filter((id): id is string => !!id),
      notes,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  static async closeMonth(
    month: string,
    transactions: FinancialData[],
    result: DistributionResult,
    notes?: string
  ): Promise<MonthlyClosingSnapshot> {
    const existing = this.readAll().find((closing) => closing.month === month);
    const snapshot = {
      ...this.buildSnapshot(month, transactions, result, notes),
      id: existing?.id || createId(month),
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    this.writeAll([
      ...this.readAll().filter((closing) => closing.month !== month),
      snapshot,
    ]);

    return snapshot;
  }

  static async replaceAll(closings: MonthlyClosingSnapshot[]): Promise<MonthlyClosingSnapshot[]> {
    const normalizedClosings = closings.map(normalizeClosing);
    this.writeAll(normalizedClosings);
    return normalizedClosings;
  }

  static async clearAll(): Promise<void> {
    this.writeAll([]);
  }
}
