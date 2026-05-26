import { ConfigOptionsService } from './configOptionsService';
import { InvoiceService } from './invoiceService';
import { MonthlyClosingService } from './monthlyClosingService';
import { PeriodClosingService } from './periodClosingService';
import { TransactionService } from './transactionService';

// Bumped to 2 when official closing moved from monthly to semi-monthly.
// periodClosings is the official closing data; legacyMonthlyClosings is
// preserved for safety but is NOT used as official semi-monthly closing.
const BACKUP_VERSION = 2;

export interface LocalBackupPayload {
  app: 'onebridge-cfo';
  version: number;
  exportedAt: string;
  transactions: unknown[];
  configurableOptions: unknown[];
  periodClosings: unknown[];
  legacyMonthlyClosings: unknown[];
  invoices: unknown[];
  invoiceSequence: Record<string, number>;
  // Deprecated alias kept for reading v1 backups on import.
  monthlyClosings?: unknown[];
}

export class LocalBackupService {
  static async exportAll(): Promise<string> {
    const payload: LocalBackupPayload = {
      app: 'onebridge-cfo',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      transactions: await TransactionService.fetchAll(),
      configurableOptions: await ConfigOptionsService.getAllOptions(),
      periodClosings: await PeriodClosingService.fetchAll(),
      legacyMonthlyClosings: await MonthlyClosingService.fetchAll(),
      invoices: await InvoiceService.fetchAll(),
      invoiceSequence: await InvoiceService.getSequence(),
    };

    return JSON.stringify(payload, null, 2);
  }

  static async importAll(json: string): Promise<void> {
    const payload = JSON.parse(json) as Partial<LocalBackupPayload>;

    if (payload.app !== 'onebridge-cfo' || !Array.isArray(payload.transactions)) {
      throw new Error('Arquivo de backup inválido.');
    }

    await TransactionService.replaceAll(payload.transactions as any[]);

    if (Array.isArray(payload.configurableOptions)) {
      await ConfigOptionsService.importOptions(JSON.stringify(payload.configurableOptions));
    }

    // Official semi-monthly closings.
    if (Array.isArray(payload.periodClosings)) {
      await PeriodClosingService.replaceAll(payload.periodClosings as any[]);
    }

    // Legacy monthly closings: preserved as-is. Restore from either the new
    // legacyMonthlyClosings field or the deprecated v1 monthlyClosings field.
    const legacyMonthly = Array.isArray(payload.legacyMonthlyClosings)
      ? payload.legacyMonthlyClosings
      : Array.isArray(payload.monthlyClosings)
        ? payload.monthlyClosings
        : null;
    if (legacyMonthly) {
      await MonthlyClosingService.replaceAll(legacyMonthly as any[]);
    }

    if (Array.isArray(payload.invoices)) {
      await InvoiceService.replaceAll(payload.invoices as any[], payload.invoiceSequence);
    }
  }

  static async resetAll(): Promise<void> {
    await TransactionService.clearAll();
    await PeriodClosingService.clearAll();
    await MonthlyClosingService.clearAll();
    await InvoiceService.clearAll();
    await ConfigOptionsService.resetOptionsToDefaults();
  }
}
