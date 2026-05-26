import { FinancialData, TransactionType } from '../types';
import { getDateMonthPart } from '../utils/date';

export const TRANSACTION_STORAGE_KEY = 'onebridge_cfo_transactions_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `txn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function normalizeTransaction(transaction: FinancialData): FinancialData {
  const timestamp = nowIso();
  const date = transaction.date || timestamp;
  const competenceMonth = transaction.competenceMonth || getDateMonthPart(date);
  const amount = transaction.type === TransactionType.REVENUE
    ? transaction.grossRevenue || transaction.amount || 0
    : transaction.amount || 0;

  return {
    ...transaction,
    id: transaction.id || createId(),
    date,
    competenceMonth,
    amount: transaction.type === TransactionType.EXPENSE ? amount : transaction.amount || 0,
    grossRevenue: transaction.type === TransactionType.REVENUE ? transaction.grossRevenue || amount : transaction.grossRevenue || 0,
    currency: transaction.currency || 'USD',
    createdAt: transaction.createdAt || timestamp,
    updatedAt: transaction.updatedAt || timestamp,
  };
}

let memoryTransactions: FinancialData[] = [];

export class TransactionService {
  private static readAll(): FinancialData[] {
    const storage = getStorage();

    if (!storage) {
      return memoryTransactions;
    }

    try {
      const rawValue = storage.getItem(TRANSACTION_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      const transactions = parsed.map((item) => normalizeTransaction(item as FinancialData));
      this.writeAll(transactions);
      return transactions;
    } catch (error) {
      console.warn('Failed to read local transactions. Starting with an empty ledger.', error);
      return [];
    }
  }

  private static writeAll(transactions: FinancialData[]): void {
    const normalizedTransactions = transactions
      .map(normalizeTransaction)
      .sort((a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime());

    const storage = getStorage();

    if (!storage) {
      memoryTransactions = normalizedTransactions;
      return;
    }

    storage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(normalizedTransactions));
  }

  static async fetchAll(): Promise<FinancialData[]> {
    return this.readAll();
  }

  static async create(transaction: FinancialData): Promise<FinancialData> {
    const created = normalizeTransaction({
      ...transaction,
      id: transaction.id && transaction.id !== 'manual' ? transaction.id : undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    this.writeAll([...this.readAll(), created]);
    return created;
  }

  static async update(transaction: FinancialData): Promise<FinancialData> {
    if (!transaction.id) {
      throw new Error('Transaction ID is required for update');
    }

    const transactions = this.readAll();
    const index = transactions.findIndex((item) => item.id === transaction.id);

    if (index < 0) {
      throw new Error('Transaction not found');
    }

    const updated = normalizeTransaction({
      ...transaction,
      createdAt: transactions[index].createdAt || transaction.createdAt,
      updatedAt: nowIso(),
    });

    transactions[index] = updated;
    this.writeAll(transactions);
    return updated;
  }

  static async upsertMany(nextTransactions: FinancialData[]): Promise<FinancialData[]> {
    const current = this.readAll();
    const byId = new Map(current.map((transaction) => [transaction.id, transaction]));

    nextTransactions.forEach((transaction) => {
      const existing = transaction.id ? byId.get(transaction.id) : undefined;
      const normalized = normalizeTransaction({
        ...existing,
        ...transaction,
        id: transaction.id || existing?.id,
        createdAt: existing?.createdAt || transaction.createdAt || nowIso(),
        updatedAt: nowIso(),
      } as FinancialData);
      byId.set(normalized.id, normalized);
    });

    const updated = Array.from(byId.values());
    this.writeAll(updated);
    return updated;
  }

  static async delete(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((transaction) => transaction.id !== id));
  }

  static async replaceAll(transactions: FinancialData[]): Promise<FinancialData[]> {
    const normalizedTransactions = transactions.map((transaction) => normalizeTransaction(transaction));
    this.writeAll(normalizedTransactions);
    return normalizedTransactions;
  }

  static async clearAll(): Promise<void> {
    this.writeAll([]);
  }
}
