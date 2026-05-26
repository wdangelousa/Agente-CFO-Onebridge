import { FinancialData, InvoiceRecord, InvoiceStatus } from '../types';

export const INVOICE_STORAGE_KEY = 'onebridge_cfo_invoices_v1';
export const INVOICE_SEQUENCE_STORAGE_KEY = 'onebridge_cfo_invoice_sequence_v1';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

let memoryInvoices: InvoiceRecord[] = [];
let memorySequence: Record<string, number> = {};

function getAmount(transaction: FinancialData): number {
  return transaction.grossRevenue || transaction.amount || 0;
}

function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeInvoice(invoice: Partial<InvoiceRecord>): InvoiceRecord {
  const timestamp = nowIso();
  const transactionIds = Array.isArray(invoice.transactionIds) ? invoice.transactionIds.filter(Boolean) : [];

  return {
    id: invoice.id || createId(),
    invoiceNumber: invoice.invoiceNumber || '',
    status: invoice.status || 'draft',
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    transactionIds,
    payerName: invoice.payerName || invoice.clientName || '',
    clientName: invoice.clientName || invoice.payerName || '',
    description: invoice.description || '',
    subtotal: Number(invoice.subtotal) || 0,
    total: Number(invoice.total) || Number(invoice.subtotal) || 0,
    currency: invoice.currency || 'USD',
    notes: invoice.notes,
    createdAt: invoice.createdAt || timestamp,
    updatedAt: invoice.updatedAt || timestamp,
  };
}

export class InvoiceService {
  private static readAll(): InvoiceRecord[] {
    const storage = getStorage();

    if (!storage) {
      return memoryInvoices;
    }

    try {
      const rawValue = storage.getItem(INVOICE_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      return Array.isArray(parsed) ? parsed.map((invoice) => normalizeInvoice(invoice)) : [];
    } catch (error) {
      console.warn('Failed to read local invoices. Starting with an empty invoice ledger.', error);
      return [];
    }
  }

  private static writeAll(invoices: InvoiceRecord[]): void {
    const normalizedInvoices = invoices.map((invoice) => normalizeInvoice(invoice));
    const storage = getStorage();

    if (!storage) {
      memoryInvoices = normalizedInvoices;
      return;
    }

    storage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(normalizedInvoices));
  }

  private static readSequence(): Record<string, number> {
    const storage = getStorage();

    if (!storage) {
      return memorySequence;
    }

    try {
      const rawValue = storage.getItem(INVOICE_SEQUENCE_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : {};
      return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
    } catch {
      return {};
    }
  }

  private static writeSequence(sequence: Record<string, number>): void {
    const storage = getStorage();

    if (!storage) {
      memorySequence = sequence;
      return;
    }

    storage.setItem(INVOICE_SEQUENCE_STORAGE_KEY, JSON.stringify(sequence));
  }

  private static nextInvoiceNumber(dateIso = nowIso()): string {
    const year = new Date(dateIso).getUTCFullYear().toString();
    const sequence = this.readSequence();
    const next = (Number(sequence[year]) || 0) + 1;
    sequence[year] = next;
    this.writeSequence(sequence);
    return `OBS-${year}-${next.toString().padStart(4, '0')}`;
  }

  private static buildFromTransaction(transaction: FinancialData, existing?: InvoiceRecord): InvoiceRecord {
    const issuedAt = existing?.issuedAt || transaction.issuedAt || nowIso();
    const invoiceNumber = existing?.invoiceNumber || transaction.invoiceNumber || this.nextInvoiceNumber(issuedAt);
    const total = getAmount(transaction);
    const status: InvoiceStatus = existing?.status || 'draft';

    return normalizeInvoice({
      ...existing,
      id: existing?.id || transaction.invoiceId || createId(),
      invoiceNumber,
      status,
      issuedAt: existing?.issuedAt || transaction.issuedAt,
      dueDate: existing?.dueDate || addDaysIso(issuedAt, 14),
      transactionIds: transaction.id ? [transaction.id] : [],
      payerName: existing?.payerName || transaction.description,
      clientName: existing?.clientName || transaction.description,
      description: existing?.description || transaction.serviceType || 'Professional Services',
      subtotal: total,
      total,
      currency: transaction.currency || 'USD',
      notes: existing?.notes,
      createdAt: existing?.createdAt,
      updatedAt: nowIso(),
    });
  }

  static async fetchAll(): Promise<InvoiceRecord[]> {
    return this.readAll();
  }

  static async findByTransactionId(transactionId?: string): Promise<InvoiceRecord | null> {
    if (!transactionId) return null;
    return this.readAll().find((invoice) => invoice.transactionIds.includes(transactionId)) || null;
  }

  static async getOrCreateForTransaction(transaction: FinancialData): Promise<InvoiceRecord> {
    const existing = await this.findByTransactionId(transaction.id);
    if (existing) return existing;

    const invoice = this.buildFromTransaction(transaction);
    this.writeAll([...this.readAll(), invoice]);
    return invoice;
  }

  static async issueForTransaction(transaction: FinancialData, updates: Partial<InvoiceRecord> = {}): Promise<InvoiceRecord> {
    const existing = await this.findByTransactionId(transaction.id);
    const baseInvoice = this.buildFromTransaction(transaction, existing || undefined);
    const invoice = normalizeInvoice({
      ...baseInvoice,
      ...updates,
      invoiceNumber: baseInvoice.invoiceNumber,
      status: updates.status || 'issued',
      issuedAt: existing?.issuedAt || updates.issuedAt || nowIso(),
      transactionIds: transaction.id ? [transaction.id] : [],
      updatedAt: nowIso(),
    });

    this.writeAll([...this.readAll().filter((item) => item.id !== invoice.id), invoice]);
    return invoice;
  }

  static async updateStatus(id: string, status: InvoiceStatus): Promise<InvoiceRecord> {
    const invoices = this.readAll();
    const index = invoices.findIndex((invoice) => invoice.id === id);
    if (index < 0) throw new Error('Invoice not found');

    const updated = normalizeInvoice({ ...invoices[index], status, updatedAt: nowIso() });
    invoices[index] = updated;
    this.writeAll(invoices);
    return updated;
  }

  static async update(invoice: InvoiceRecord): Promise<InvoiceRecord> {
    const updated = normalizeInvoice({ ...invoice, updatedAt: nowIso() });
    this.writeAll([...this.readAll().filter((item) => item.id !== updated.id), updated]);
    return updated;
  }

  static async replaceAll(invoices: InvoiceRecord[], sequence?: Record<string, number>): Promise<InvoiceRecord[]> {
    const normalizedInvoices = invoices.map((invoice) => normalizeInvoice(invoice));
    this.writeAll(normalizedInvoices);
    if (sequence) {
      this.writeSequence(sequence);
    } else {
      this.rebuildSequenceFromInvoices(normalizedInvoices);
    }
    return normalizedInvoices;
  }

  static async clearAll(): Promise<void> {
    this.writeAll([]);
    this.writeSequence({});
  }

  static async getSequence(): Promise<Record<string, number>> {
    return this.readSequence();
  }

  static async setSequence(sequence: Record<string, number>): Promise<void> {
    this.writeSequence(sequence);
  }

  private static rebuildSequenceFromInvoices(invoices: InvoiceRecord[]): void {
    const sequence: Record<string, number> = {};
    invoices.forEach((invoice) => {
      const match = invoice.invoiceNumber.match(/^OBS-(\d{4})-(\d+)$/);
      if (!match) return;
      const [, year, rawNumber] = match;
      sequence[year] = Math.max(sequence[year] || 0, Number(rawNumber) || 0);
    });
    this.writeSequence(sequence);
  }
}
