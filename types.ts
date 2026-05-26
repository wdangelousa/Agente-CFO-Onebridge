
export enum Partner {
  EVANDRO = 'Evandro (Profiscal)',
  JULIA_SAMUEL = 'Julia/Samuel (Elevated)',
  WALTER = 'Walter (Moraes D\'Angelo)',
  NONE = 'Nenhum (Orgânico)'
}

export enum TransactionType {
  REVENUE = 'revenue',
  EXPENSE = 'expense'
}

export enum ExpenseCategory {
  COGS = 'cogs', // Custo Direto (Taxas Gov, Filing Fees) - Absorvido pela Empresa
  OPEX = 'opex'  // Despesa Operacional (Software, Aluguel) - Abate do Lucro Global
}

export enum TransactionStatus {
  PENDING = 'pending', // Provisionado / A Receber
  PAID = 'paid'        // Realizado / Pago / Efetivado
}

export enum PaymentMethod {
  WIRE = 'Wire Transfer',
  ZELLE = 'Zelle',
  PARCELADO_USA = 'ParceladoUSA'
}

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export enum ClientType {
  INDIVIDUAL = 'Pessoa Física',
  COMPANY = 'Pessoa Jurídica'
}

export interface FinancialAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

export interface FinancialData {
  id?: string;
  date?: string;
  competenceMonth?: string;
  createdAt?: string;
  updatedAt?: string;
  type: TransactionType;
  status: TransactionStatus;
  description: string; // Nome do Cliente (Receita) ou Descrição (Despesa)
  
  // Categorização de Despesa
  category?: ExpenseCategory;
  linkedTransactionId?: string; // ID da Receita vinculada (apenas para COGS)
  
  // Invoice & Client Details
  serviceType?: string; 
  clientType?: ClientType;
  clientTaxId?: string; 
  clientAddress?: string;
  clientEmail?: string;
  responsibleName?: string; 

  // Valores
  grossRevenue: number; // Apenas para Receita
  amount: number;       // Valor principal da Despesa
  
  // Comissões Externas (Ex: Parceiros que não são sócios)
  externalCommission: number;
  externalCommissionDescription?: string; // Quem recebe ou motivo (Ex: "Parceiro João")

  // Originador (Para Receita = Quem vendeu. Para Despesa COGS = De quem é o cliente)
  originator: string;

  // Reembolso
  isReimbursable?: boolean;
  reimbursementBeneficiary?: string;

  // Anexos (Legacy e Novo Suporte Múltiplo)
  attachmentUrl?: string; // Mantido para compatibilidade
  attachments?: FinancialAttachment[]; // Novo suporte a múltiplos arquivos

  // Status de Automação
  issuedAt?: string;
  invoiceNumber?: string;
  invoiceId?: string;

  // Commission Logic Meta
  commissionType?: 'fixed' | 'percentage';
  commissionRate?: number; 

  // Payment Details
  paymentMethod?: PaymentMethod;
  paymentLink?: string; 

  // Currency Metadata
  currency: 'USD' | 'BRL';
  originalAmount?: number; 
  exchangeRate?: number;   
  exchangeSource?: string; 
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedAt?: string;
  dueDate?: string;
  transactionIds: string[];
  payerName: string;
  clientName: string;
  description: string;
  subtotal: number;
  total: number;
  currency: 'USD' | 'BRL';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyClosingSnapshot {
  id: string;
  month: string;
  closedAt: string;
  totalRevenue: number;
  totalCOGS: number;
  totalOpEx: number;
  externalCommissions: number;
  originationFee: number;
  reserve: number;
  distributableProfit: number;
  partnerDistributions: {
    evandro: number;
    juliaSamuel: number;
    walter: number;
  };
  transactionIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionResult {
  realizedRevenue: number;
  totalCOGS: number;     // Custos Diretos (PAGOS)
  grossMargin: number;   // Receita Realizada - COGS Pagos
  totalOpEx: number;     // Despesas Operacionais (PAGAS)
  netIncome: number;     // Margem Bruta - OpEx
  
  safetyMargin: number;  // Disponível no Caixa (Cash Basis Logic - Realizado)
  provisionedFlow: number; // Total de saídas (Pagas + Pendentes)
  pendingPayables: number; // Apenas saídas pendentes (Future Liability)

  grossTotalBookkeeping: number; 
  externalCommissions: number;
  
  originationFee: number; // Total Global
  
  // Detalhamento de Comissões por Sócio (Novo)
  originationFees: {
    evandro: number;
    juliaSamuel: number;
    walter: number;
  };

  companyReserve: number;
  distributableBalance: number;
  partnerShares: {
    evandro: number;
    juliaSamuel: number;
    walter: number;
  };
  reimbursements: {
    evandro: number;
    juliaSamuel: number;
    walter: number;
  };
  finalPayouts: {
    evandro: number;
    juliaSamuel: number;
    walter: number;
    reserve: number;
  };
}

export const SHARES = {
  EVANDRO: 0.3334,
  JULIA_SAMUEL: 0.3333,
  WALTER: 0.3333
};

export const PARTNER_DISTRIBUTION_RATES = SHARES;

export const RATES = {
  ORIGINATION: 0.10,
  RESERVE: 0.12,
  DISTRIBUTION: 0.78,
  FX_SAFETY_SPREAD: 0.02
};

export const ORIGINATION_RATE = RATES.ORIGINATION;
export const RESERVE_RATE = RATES.RESERVE;
