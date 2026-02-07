
import { FinancialData, DistributionResult, Partner, SHARES, RATES, TransactionType, TransactionStatus, ExpenseCategory } from '../types';

export const calculateDistribution = (transactions: FinancialData[]): DistributionResult => {
  // 1. Buckets Globais
  let realizedRevenue = 0;       // Cash In (Status: PAID)
  let totalCOGS = 0;             // Cost of Goods Sold (PAID ONLY)
  let totalOpEx = 0;             // Operational Expenses (PAID ONLY)
  let provisionedFlow = 0;       // Total Liability (PAID + PENDING)
  let grossTotalBookkeeping = 0; // Accrual Revenue (Invoiced/Total)

  // 2. Buckets por Sócio (Para Originação Líquida)
  // Estrutura: { [Partner]: { revenue: 0, cogs: 0 } }
  let partnerPerformance = {
    [Partner.EVANDRO]: { revenue: 0, cogs: 0 },
    [Partner.JULIA_SAMUEL]: { revenue: 0, cogs: 0 },
    [Partner.WALTER]: { revenue: 0, cogs: 0 },
    [Partner.NONE]: { revenue: 0, cogs: 0 }
  };

  // 3. Reembolsos
  let reimbursementByPartner: Record<string, number> = {
    [Partner.EVANDRO]: 0,
    [Partner.JULIA_SAMUEL]: 0,
    [Partner.WALTER]: 0,
    [Partner.NONE]: 0
  };

  transactions.forEach(t => {
    // --- LÓGICA DE DESPESA (OUTFLOW) ---
    if (t.type === TransactionType.EXPENSE) {
      let amountUSD = t.amount || 0; // QA Fix: Ensure not undefined
      
      // Safety Spread para FX (Mantido, mas assume-se que amount já foi convertido pelo Form)
      if (t.currency === 'BRL') {
        amountUSD = amountUSD * (1 + RATES.FX_SAFETY_SPREAD);
      }

      // 1. Provisioned Flow: Soma TUDO (Pago ou Pendente) para visão de passivo total
      provisionedFlow += amountUSD;

      // 2. Cálculo de Caixa (Cash Basis): Só abate do resultado se estiver PAGO
      if (t.status === TransactionStatus.PAID) {
        if (t.category === ExpenseCategory.COGS) {
          totalCOGS += amountUSD;
          // Mantemos o registro de quem originou o custo para relatórios
          if (t.originator) {
             partnerPerformance[t.originator].cogs += amountUSD;
          }
        } else {
          totalOpEx += amountUSD;
        }

        // Reembolso: Só conta se a despesa foi efetivamente PAGA pelo sócio
        if (t.isReimbursable && t.reimbursementBeneficiary && t.reimbursementBeneficiary !== Partner.NONE) {
          // Safe access
          if (typeof reimbursementByPartner[t.reimbursementBeneficiary] === 'number') {
              reimbursementByPartner[t.reimbursementBeneficiary] += amountUSD;
          }
        }
      }
    }

    // --- LÓGICA DE RECEITA (INFLOW) ---
    if (t.type === TransactionType.REVENUE) {
      const gross = t.grossRevenue || 0; // QA Fix: Ensure not undefined
      grossTotalBookkeeping += gross;

      if (t.status === TransactionStatus.PAID) {
        realizedRevenue += gross;
        
        // Atribui receita ao originador
        if (t.originator) {
           partnerPerformance[t.originator].revenue += gross;
        }
      }
    }
  });

  // 4. Cálculos Derivados (Cash Basis)
  const grossMargin = realizedRevenue - totalCOGS; // Margem de Contribuição Global (Realizada)
  const netIncome = grossMargin - totalOpEx;       // Lucro Líquido Contábil (Realizado)
  
  // Safety Margin (Caixa Disponível) = Receita Realizada - Despesas Pagas
  // Note: provisionedFlow tem tudo, então não usamos ele aqui para o Caixa Imediato
  const safetyMargin = netIncome; 

  // Passivo Pendente (Contas a Pagar Futuras)
  const pendingPayables = provisionedFlow - (totalCOGS + totalOpEx);

  // 5. Cálculo de Originação (ATUALIZADO: Sobre Receita Bruta REALIZADA)
  // Regra nova: Fee = Revenue Realizada * 10%
  let totalOriginationFee = 0;
  const originationFees = {
    [Partner.EVANDRO]: 0,
    [Partner.JULIA_SAMUEL]: 0,
    [Partner.WALTER]: 0,
    [Partner.NONE]: 0
  };

  Object.values(Partner).forEach(p => {
    if (p !== Partner.NONE) {
       // Fee calculada puramente sobre o volume de vendas REALIZADO
       const fee = partnerPerformance[p].revenue * RATES.ORIGINATION;
       originationFees[p] = fee;
       totalOriginationFee += fee;
    }
  });

  // 6. Base de Distribuição
  // A base é o Caixa Livre (Safety Margin) menos as comissões que precisam ser pagas
  const distributableBase = Math.max(0, safetyMargin - totalOriginationFee);

  // 7. Reserva
  const companyReserve = distributableBase * RATES.RESERVE;
  
  // 8. Saldo Final para Dividendo
  const finalDistributable = Math.max(0, distributableBase - companyReserve);

  // 9. Quotas
  const shareEvandro = finalDistributable * SHARES.EVANDRO;
  const shareJulia = finalDistributable * SHARES.JULIA_SAMUEL;
  const shareWalter = finalDistributable * SHARES.WALTER;

  return {
    realizedRevenue,
    totalCOGS,
    grossMargin,
    totalOpEx,
    netIncome,
    safetyMargin,
    provisionedFlow,
    pendingPayables,
    grossTotalBookkeeping,
    
    originationFee: totalOriginationFee,
    
    // Novo Objeto de Retorno Detalhado
    originationFees: {
      evandro: originationFees[Partner.EVANDRO],
      juliaSamuel: originationFees[Partner.JULIA_SAMUEL],
      walter: originationFees[Partner.WALTER]
    },

    companyReserve,
    distributableBalance: finalDistributable,
    
    partnerShares: {
      evandro: shareEvandro,
      juliaSamuel: shareJulia,
      walter: shareWalter
    },
    reimbursements: {
      evandro: reimbursementByPartner[Partner.EVANDRO],
      juliaSamuel: reimbursementByPartner[Partner.JULIA_SAMUEL],
      walter: reimbursementByPartner[Partner.WALTER],
    },
    finalPayouts: {
      evandro: shareEvandro + originationFees[Partner.EVANDRO] + reimbursementByPartner[Partner.EVANDRO],
      juliaSamuel: shareJulia + originationFees[Partner.JULIA_SAMUEL] + reimbursementByPartner[Partner.JULIA_SAMUEL],
      walter: shareWalter + originationFees[Partner.WALTER] + reimbursementByPartner[Partner.WALTER],
      reserve: companyReserve
    }
  };
};
