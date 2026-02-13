import { supabase } from '../supabaseClient';
import { FinancialData, TransactionType, TransactionStatus, Partner, ExpenseCategory, ClientType, PaymentMethod } from '../types';

export const TRANSACTION_TABLE = 'transactions';

export class TransactionService {

    static async fetchAll(): Promise<FinancialData[]> {
        const { data, error } = await supabase
            .from(TRANSACTION_TABLE)
            .select('*')
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching transactions:', error);
            throw error;
        }

        return (data || []).map(this.mapToFrontend);
    }

    static async create(transaction: FinancialData): Promise<FinancialData> {
        const dbPayload = this.mapToBackend(transaction);
        // Remove ID if present to let DB generate it, or keep if UUID provided manually
        if (!transaction.id || transaction.id === 'manual') {
            delete dbPayload.id;
        }

        const { data, error } = await supabase
            .from(TRANSACTION_TABLE)
            .insert(dbPayload)
            .select()
            .single();

        if (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }

        return this.mapToFrontend(data);
    }

    static async update(transaction: FinancialData): Promise<FinancialData> {
        if (!transaction.id) throw new Error('Transaction ID is required for update');

        const dbPayload = this.mapToBackend(transaction);
        // Remove ID from payload to avoid PK update error (though usually harmless)
        delete dbPayload.id;

        const { data, error } = await supabase
            .from(TRANSACTION_TABLE)
            .update(dbPayload)
            .eq('id', transaction.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating transaction:', error);
            throw error;
        }

        return this.mapToFrontend(data);
    }

    static async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from(TRANSACTION_TABLE)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        }
    }

    // --- Mappers ---

    private static mapToFrontend(dbItem: any): FinancialData {
        return {
            id: dbItem.id,
            date: dbItem.date,
            type: dbItem.type as TransactionType,
            status: dbItem.status as TransactionStatus,
            description: dbItem.description,

            category: dbItem.category as ExpenseCategory,
            linkedTransactionId: dbItem.linked_transaction_id,

            serviceType: dbItem.service_type,
            clientType: dbItem.client_type as ClientType,
            clientTaxId: dbItem.client_tax_id,
            clientAddress: dbItem.client_address,
            clientEmail: dbItem.client_email,
            responsibleName: dbItem.responsible_name,

            grossRevenue: Number(dbItem.gross_revenue) || 0,
            amount: Number(dbItem.amount) || 0,

            externalCommission: Number(dbItem.external_commission) || 0,
            externalCommissionDescription: dbItem.external_commission_description,

            originator: dbItem.originator as Partner,

            isReimbursable: dbItem.is_reimbursable,
            reimbursementBeneficiary: dbItem.reimbursement_beneficiary as Partner,

            attachmentUrl: dbItem.attachment_url,
            attachments: dbItem.attachments,

            issuedAt: dbItem.issued_at,
            invoiceNumber: dbItem.invoice_number,

            commissionType: dbItem.commission_type || 'fixed',
            commissionRate: Number(dbItem.commission_rate) || 0,

            paymentMethod: dbItem.payment_method as PaymentMethod,
            paymentLink: dbItem.payment_link,

            currency: dbItem.currency || 'USD',
            originalAmount: Number(dbItem.original_amount),
            exchangeRate: Number(dbItem.exchange_rate),
            exchangeSource: dbItem.exchange_source,
        };
    }

    private static mapToBackend(item: FinancialData): any {
        return {
            // id: item.id, // Handled in create/update logic
            date: item.date,
            type: item.type,
            status: item.status,
            description: item.description,

            category: item.category,
            linked_transaction_id: item.linkedTransactionId || null,

            service_type: item.serviceType,
            client_type: item.clientType,
            client_tax_id: item.clientTaxId,
            client_address: item.clientAddress,
            client_email: item.clientEmail,
            responsible_name: item.responsibleName,

            gross_revenue: item.grossRevenue || 0,
            amount: item.amount || 0,

            external_commission: item.externalCommission || 0,
            external_commission_description: item.externalCommissionDescription,

            originator: item.originator,

            is_reimbursable: item.isReimbursable || false,
            reimbursement_beneficiary: item.reimbursementBeneficiary,

            attachment_url: item.attachmentUrl,
            attachments: item.attachments,

            issued_at: item.issuedAt || null,
            invoice_number: item.invoiceNumber,

            commission_type: item.commissionType,
            commission_rate: item.commissionRate,

            payment_method: item.paymentMethod,
            payment_link: item.paymentLink,

            currency: item.currency,
            original_amount: item.originalAmount,
            exchange_rate: item.exchangeRate,
            exchange_source: item.exchangeSource,
        };
    }
}
