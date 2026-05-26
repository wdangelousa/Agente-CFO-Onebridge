import { DistributionResult, FinancialData, PeriodClosingSnapshot } from '../types.ts';
import { SemiMonthlyPeriod } from '../utils/periods.ts';

export const PERIOD_CLOSINGS_STORAGE_KEY = 'onebridge_cfo_period_closings_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(periodKey: string): string {
  return `closing-${periodKey}-${Date.now().toString(36)}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

let memoryClosings: PeriodClosingSnapshot[] = [];

function normalizeClosing(closing: PeriodClosingSnapshot): PeriodClosingSnapshot {
  const timestamp = nowIso();

  return {
    ...closing,
    id: closing.id || createId(closing.periodKey),
    periodType: 'semi_monthly',
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

export class PeriodClosingService {
  private static readAll(): PeriodClosingSnapshot[] {
    const storage = getStorage();

    if (!storage) {
      return memoryClosings;
    }

    try {
      const rawValue = storage.getItem(PERIOD_CLOSINGS_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      return Array.isArray(parsed) ? parsed.map((item) => normalizeClosing(item as PeriodClosingSnapshot)) : [];
    } catch (error) {
      console.warn('Failed to read local period closings.', error);
      return [];
    }
  }

  private static writeAll(closings: PeriodClosingSnapshot[]): void {
    const normalizedClosings = closings
      .map(normalizeClosing)
      .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

    const storage = getStorage();

    if (!storage) {
      memoryClosings = normalizedClosings;
      return;
    }

    storage.setItem(PERIOD_CLOSINGS_STORAGE_KEY, JSON.stringify(normalizedClosings));
  }

  static async fetchAll(): Promise<PeriodClosingSnapshot[]> {
    return this.readAll();
  }

  static async findByPeriodKey(periodKey: string): Promise<PeriodClosingSnapshot | null> {
    return this.readAll().find((closing) => closing.periodKey === periodKey) || null;
  }

  static buildSnapshot(
    period: SemiMonthlyPeriod,
    transactions: FinancialData[],
    result: DistributionResult,
    notes?: string
  ): PeriodClosingSnapshot {
    const timestamp = nowIso();
    return {
      id: createId(period.periodKey),
      periodType: 'semi_monthly',
      periodKey: period.periodKey,
      monthKey: period.monthKey,
      half: period.half,
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label,
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

  static async closePeriod(
    period: SemiMonthlyPeriod,
    transactions: FinancialData[],
    result: DistributionResult,
    notes?: string
  ): Promise<PeriodClosingSnapshot> {
    const existing = this.readAll().find((closing) => closing.periodKey === period.periodKey);
    const snapshot = {
      ...this.buildSnapshot(period, transactions, result, notes),
      id: existing?.id || createId(period.periodKey),
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    this.writeAll([
      ...this.readAll().filter((closing) => closing.periodKey !== period.periodKey),
      snapshot,
    ]);

    return snapshot;
  }

  static async replaceAll(closings: PeriodClosingSnapshot[]): Promise<PeriodClosingSnapshot[]> {
    const normalizedClosings = closings.map(normalizeClosing);
    this.writeAll(normalizedClosings);
    return normalizedClosings;
  }

  static async clearAll(): Promise<void> {
    this.writeAll([]);
  }
}
