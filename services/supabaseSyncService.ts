import { ConfigOption, ConfigOptionsService } from './configOptionsService';
import { InvoiceService } from './invoiceService';
import { PeriodClosingService } from './periodClosingService';
import { getSupabaseClient, isSupabaseConfigured as hasSupabaseEnv } from './supabaseClient';
import { InvoiceRecord, PeriodClosingSnapshot } from '../types';

const SYNC_INFO_STORAGE_KEY = 'onebridge_cfo_supabase_sync_info_v1';

type SyncDirection = 'push' | 'pull';

export interface SupabaseSyncInfo {
  lastSyncAt?: string;
  lastPushAt?: string;
  lastPullAt?: string;
  lastDirection?: SyncDirection;
  lastMessage?: string;
}

export interface SupabaseSyncResult {
  ok: boolean;
  message: string;
  syncedAt: string;
}

type ConfigOptionRow = {
  local_id: string;
  type: ConfigOption['type'];
  label: string;
  value: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type PeriodClosingRow = {
  local_id: string;
  period_type: 'semi_monthly';
  period_key: string;
  month_key: string;
  half: 'H1' | 'H2';
  start_date: string;
  end_date: string;
  label: string;
  closed_at: string;
  totals: Record<string, number>;
  partner_distributions: PeriodClosingSnapshot['partnerDistributions'];
  transaction_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceRow = {
  local_id: string;
  invoice_number: string;
  status: InvoiceRecord['status'];
  issued_at: string | null;
  due_date: string | null;
  transaction_ids: string[];
  payer_name: string;
  service_description: string;
  subtotal: number;
  total: number;
  currency: InvoiceRecord['currency'];
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type InvoiceSequenceRow = {
  sequence_key: string;
  year: number;
  last_number: number;
  prefix: string;
  created_at: string;
  updated_at: string;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function nowIso(): string {
  return new Date().toISOString();
}

function readSyncInfo(): SupabaseSyncInfo {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const rawValue = storage.getItem(SYNC_INFO_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) as SupabaseSyncInfo : {};
  } catch {
    return {};
  }
}

function writeSyncInfo(direction: SyncDirection, message: string): SupabaseSyncInfo {
  const timestamp = nowIso();
  const previous = readSyncInfo();
  const next: SupabaseSyncInfo = {
    ...previous,
    lastSyncAt: timestamp,
    lastDirection: direction,
    lastMessage: message,
    ...(direction === 'push' ? { lastPushAt: timestamp } : { lastPullAt: timestamp }),
  };

  const storage = getStorage();
  if (storage) {
    storage.setItem(SYNC_INFO_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}

async function requireSupabaseClient() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable optional sync.');
  }

  const { data } = await client.auth.getSession();
  if (!data.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) {
      throw new Error(`Supabase is configured, but no authenticated session is available for RLS-protected sync. ${error.message}`);
    }
  }

  return client;
}

function optionToRow(option: ConfigOption): ConfigOptionRow {
  return {
    local_id: option.id,
    type: option.type,
    label: option.label,
    value: option.value,
    metadata: option.metadata || {},
    is_active: option.isActive,
    created_at: option.createdAt,
    updated_at: option.updatedAt,
  };
}

function rowToOption(row: any): ConfigOption {
  return {
    id: String(row.local_id || row.id),
    type: row.type,
    label: row.label,
    value: row.value,
    metadata: row.metadata || null,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function closingTotals(closing: PeriodClosingSnapshot): Record<string, number> {
  return {
    totalRevenue: closing.totalRevenue,
    totalCOGS: closing.totalCOGS,
    totalOpEx: closing.totalOpEx,
    externalCommissions: closing.externalCommissions,
    originationFee: closing.originationFee,
    reserve: closing.reserve,
    distributableProfit: closing.distributableProfit,
  };
}

function closingToRow(closing: PeriodClosingSnapshot): PeriodClosingRow {
  return {
    local_id: closing.id,
    period_type: 'semi_monthly',
    period_key: closing.periodKey,
    month_key: closing.monthKey,
    half: closing.half,
    start_date: closing.startDate,
    end_date: closing.endDate,
    label: closing.label,
    closed_at: closing.closedAt,
    totals: closingTotals(closing),
    partner_distributions: closing.partnerDistributions,
    transaction_ids: closing.transactionIds,
    notes: closing.notes || null,
    created_at: closing.createdAt,
    updated_at: closing.updatedAt,
  };
}

function rowToClosing(row: any): PeriodClosingSnapshot {
  const totals = row.totals || {};

  return {
    id: String(row.local_id || row.id),
    periodType: 'semi_monthly',
    periodKey: row.period_key,
    monthKey: row.month_key,
    half: row.half,
    startDate: row.start_date,
    endDate: row.end_date,
    label: row.label,
    closedAt: row.closed_at,
    totalRevenue: Number(totals.totalRevenue) || 0,
    totalCOGS: Number(totals.totalCOGS) || 0,
    totalOpEx: Number(totals.totalOpEx) || 0,
    externalCommissions: Number(totals.externalCommissions) || 0,
    originationFee: Number(totals.originationFee) || 0,
    reserve: Number(totals.reserve) || 0,
    distributableProfit: Number(totals.distributableProfit) || 0,
    partnerDistributions: row.partner_distributions || { evandro: 0, juliaSamuel: 0, walter: 0 },
    transactionIds: Array.isArray(row.transaction_ids) ? row.transaction_ids : [],
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function invoiceToRow(invoice: InvoiceRecord): InvoiceRow {
  return {
    local_id: invoice.id,
    invoice_number: invoice.invoiceNumber,
    status: invoice.status,
    issued_at: invoice.issuedAt || null,
    due_date: invoice.dueDate || null,
    transaction_ids: invoice.transactionIds,
    payer_name: invoice.payerName || invoice.clientName,
    service_description: invoice.description,
    subtotal: invoice.subtotal,
    total: invoice.total,
    currency: invoice.currency,
    notes: invoice.notes || null,
    metadata: { clientName: invoice.clientName },
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
  };
}

function rowToInvoice(row: any): InvoiceRecord {
  return {
    id: String(row.local_id || row.id),
    invoiceNumber: row.invoice_number,
    status: row.status,
    issuedAt: row.issued_at || undefined,
    dueDate: row.due_date || undefined,
    transactionIds: Array.isArray(row.transaction_ids) ? row.transaction_ids : [],
    payerName: row.payer_name || '',
    clientName: row.metadata?.clientName || row.payer_name || '',
    description: row.service_description || '',
    subtotal: Number(row.subtotal) || 0,
    total: Number(row.total) || 0,
    currency: row.currency || 'USD',
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sequenceToRows(sequence: Record<string, number>): InvoiceSequenceRow[] {
  const timestamp = nowIso();
  return Object.entries(sequence).map(([year, lastNumber]) => ({
    sequence_key: `OBS-${year}`,
    year: Number(year),
    last_number: Math.max(0, Number(lastNumber) || 0),
    prefix: 'OBS',
    created_at: timestamp,
    updated_at: timestamp,
  }));
}

function rowsToSequence(rows: any[], localSequence: Record<string, number>): Record<string, number> {
  const next = { ...localSequence };
  rows.forEach((row) => {
    const year = String(row.year);
    next[year] = Math.max(Number(next[year]) || 0, Number(row.last_number) || 0);
  });
  return next;
}

function mergeBy<T>(local: T[], remote: T[], keyOf: (item: T) => string): T[] {
  const byKey = new Map<string, T>();
  local.forEach((item) => byKey.set(keyOf(item), item));
  remote.forEach((item) => byKey.set(keyOf(item), item));
  return Array.from(byKey.values());
}

export class SupabaseSyncService {
  static isSupabaseConfigured(): boolean {
    return hasSupabaseEnv();
  }

  static getLastSyncInfo(): SupabaseSyncInfo {
    return readSyncInfo();
  }

  static async pushLocalBackupToSupabase(): Promise<SupabaseSyncResult> {
    const client = await requireSupabaseClient();

    const [options, closings, invoices, sequence] = await Promise.all([
      ConfigOptionsService.getAllOptions(),
      PeriodClosingService.fetchAll(),
      InvoiceService.fetchAll(),
      InvoiceService.getSequence(),
    ]);

    if (options.length > 0) {
      const { error } = await client
        .from('configurable_options')
        .upsert(options.map(optionToRow), { onConflict: 'type,value' });
      if (error) throw error;
    }

    if (closings.length > 0) {
      const { error } = await client
        .from('period_closings')
        .upsert(closings.map(closingToRow), { onConflict: 'period_key' });
      if (error) throw error;
    }

    if (invoices.length > 0) {
      const { error } = await client
        .from('invoices')
        .upsert(invoices.map(invoiceToRow), { onConflict: 'invoice_number' });
      if (error) throw error;
    }

    const sequenceRows = sequenceToRows(sequence);
    if (sequenceRows.length > 0) {
      const { data: existingRows, error: sequenceReadError } = await client
        .from('invoice_sequences')
        .select('sequence_key,year,last_number,prefix,created_at,updated_at');
      if (sequenceReadError) throw sequenceReadError;

      const existingByKey = new Map((existingRows || []).map((row: any) => [row.sequence_key, row]));
      const protectedRows = sequenceRows.map((row) => {
        const existing = existingByKey.get(row.sequence_key);
        return {
          ...row,
          last_number: Math.max(row.last_number, Number(existing?.last_number) || 0),
          created_at: existing?.created_at || row.created_at,
        };
      });

      const { error } = await client
        .from('invoice_sequences')
        .upsert(protectedRows, { onConflict: 'sequence_key' });
      if (error) throw error;

      await InvoiceService.setSequence(rowsToSequence([...(existingRows || []), ...protectedRows], sequence));
    }

    const message = `Supabase backup atualizado: ${options.length} opções, ${closings.length} fechamentos, ${invoices.length} invoices.`;
    const info = writeSyncInfo('push', message);

    return { ok: true, message, syncedAt: info.lastSyncAt || nowIso() };
  }

  static async pullBackupFromSupabase(): Promise<SupabaseSyncResult> {
    const client = await requireSupabaseClient();

    const [
      localOptions,
      localClosings,
      localInvoices,
      localSequence,
      remoteOptions,
      remoteClosings,
      remoteInvoices,
      remoteSequence,
    ] = await Promise.all([
      ConfigOptionsService.getAllOptions(),
      PeriodClosingService.fetchAll(),
      InvoiceService.fetchAll(),
      InvoiceService.getSequence(),
      client.from('configurable_options').select('*'),
      client.from('period_closings').select('*'),
      client.from('invoices').select('*'),
      client.from('invoice_sequences').select('*'),
    ]);

    if (remoteOptions.error) throw remoteOptions.error;
    if (remoteClosings.error) throw remoteClosings.error;
    if (remoteInvoices.error) throw remoteInvoices.error;
    if (remoteSequence.error) throw remoteSequence.error;

    const pulledOptions = (remoteOptions.data || []).map(rowToOption);
    const mergedOptions = mergeBy(
      localOptions,
      pulledOptions,
      (option) => `${option.type}:${option.value}`
    );
    await ConfigOptionsService.replaceAll(mergedOptions);

    const pulledClosings = (remoteClosings.data || []).map(rowToClosing);
    const mergedClosings = mergeBy(localClosings, pulledClosings, (closing) => closing.periodKey);
    await PeriodClosingService.replaceAll(mergedClosings);

    const pulledInvoices = (remoteInvoices.data || []).map(rowToInvoice);
    const mergedInvoices = mergeBy(localInvoices, pulledInvoices, (invoice) => invoice.invoiceNumber);
    const protectedSequence = rowsToSequence(remoteSequence.data || [], localSequence);
    await InvoiceService.replaceAll(mergedInvoices, protectedSequence);

    const message = `Supabase backup restaurado: ${pulledOptions.length} opções, ${pulledClosings.length} fechamentos, ${pulledInvoices.length} invoices.`;
    const info = writeSyncInfo('pull', message);

    return { ok: true, message, syncedAt: info.lastSyncAt || nowIso() };
  }
}
