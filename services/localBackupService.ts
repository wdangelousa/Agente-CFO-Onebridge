import { ConfigOptionsService } from './configOptionsService';
import { InvoiceService } from './invoiceService';
import { MonthlyClosingService } from './monthlyClosingService';
import { TransactionService } from './transactionService';

const BACKUP_VERSION = 1;

export interface LocalBackupPayload {
  app: 'onebridge-cfo';
  version: number;
  exportedAt: string;
  transactions: unknown[];
  configurableOptions: unknown[];
  monthlyClosings: unknown[];
  invoices: unknown[];
  invoiceSequence: Record<string, number>;
}

export class LocalBackupService {
  static async exportAll(): Promise<string> {
    const payload: LocalBackupPayload = {
      app: 'onebridge-cfo',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      transactions: await TransactionService.fetchAll(),
      configurableOptions: await ConfigOptionsService.getAllOptions(),
      monthlyClosings: await MonthlyClosingService.fetchAll(),
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

    if (Array.isArray(payload.monthlyClosings)) {
      await MonthlyClosingService.replaceAll(payload.monthlyClosings as any[]);
    }

    if (Array.isArray(payload.invoices)) {
      await InvoiceService.replaceAll(payload.invoices as any[], payload.invoiceSequence);
    }
  }

  static async resetAll(): Promise<void> {
    await TransactionService.clearAll();
    await MonthlyClosingService.clearAll();
    await InvoiceService.clearAll();
    await ConfigOptionsService.resetOptionsToDefaults();
  }
}
