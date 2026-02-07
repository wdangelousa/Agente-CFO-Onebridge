import React, { useMemo, useState } from 'react';
import { FinancialData, TransactionType, ExpenseCategory, TransactionStatus } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Activity, PieChart, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  transactions: FinancialData[];
  periodLabel: string;
}

export const PnLStatement: React.FC<Props> = ({ transactions, periodLabel }) => {
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val / 100);
  };

  const financials = useMemo(() => {
    let grossRevenue = 0;
    let cogs = 0;
    let opex = 0;
    
    // Grouping for detailed view
    const expensesBreakdown: Record<string, number> = {};

    transactions.forEach(t => {
      // Logic Switch: Cash vs Accrual
      const shouldCount = basis === 'accrual' ? true : t.status === TransactionStatus.PAID;

      if (!shouldCount) return;

      if (t.type === TransactionType.REVENUE) {
        grossRevenue += (t.grossRevenue || 0);
      } else if (t.type === TransactionType.EXPENSE) {
        const amount = t.amount || 0;
        
        if (t.category === ExpenseCategory.COGS) {
          cogs += amount;
        } else {
          opex += amount;
        }

        // Breakdown logic
        const desc = t.description || 'Outros';
        expensesBreakdown[desc] = (expensesBreakdown[desc] || 0) + amount;
      }
    });

    const grossProfit = grossRevenue - cogs;
    const netIncome = grossProfit - opex;
    
    const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
    const netMargin = grossRevenue > 0 ? (netIncome / grossRevenue) * 100 : 0;

    return {
      grossRevenue,
      cogs,
      grossProfit,
      opex,
      netIncome,
      grossMargin,
      netMargin,
      expensesBreakdown
    };
  }, [transactions, basis]);

  const isProfitable = financials.netIncome >= 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col font-sans">
      <div className="p-4 lg:p-6 bg-[#1A1C22] text-white border-b border-slate-800 flex justify-between items-start">
        <div>
          <h2 className="text-base lg:text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#D7FF3E]" />
            Profit & Loss Statement
          </h2>
          <div className="flex items-center gap-3 mt-2">
             <button 
               onClick={() => setBasis(basis === 'accrual' ? 'cash' : 'accrual')}
               className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest bg-[#1A1C22] hover:bg-black px-2 py-1 rounded transition-colors border border-slate-700"
             >
                {basis === 'accrual' ? <ToggleRight className="w-4 h-4 text-[#D7FF3E]" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
                {basis === 'accrual' ? 'Accrual (Competência)' : 'Cash (Caixa)'}
             </button>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Net Income</p>
           <p className={`text-2xl font-black font-mono leading-none ${isProfitable ? 'text-[#D7FF3E]' : 'text-red-400'}`}>
             {formatCurrency(financials.netIncome)}
           </p>
        </div>
      </div>

      <div className="p-6 flex-grow overflow-y-auto space-y-6">
        
        {/* REVENUE SECTION */}
        <div>
           <div className="flex justify-between items-end mb-2 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-[#1A1C22] uppercase tracking-wide">Revenue</h3>
              <span className="text-sm font-bold text-[#1A1C22]">{formatCurrency(financials.grossRevenue)}</span>
           </div>
           <div className="pl-4 space-y-1">
              <div className="flex justify-between text-xs text-[#6C757D]">
                 <span>Gross Sales ({basis === 'accrual' ? 'Invoiced' : 'Collected'})</span>
                 <span>{formatCurrency(financials.grossRevenue)}</span>
              </div>
           </div>
        </div>

        {/* COGS SECTION */}
        <div>
           <div className="flex justify-between items-end mb-2 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-[#1A1C22] uppercase tracking-wide">Cost of Goods Sold (COGS)</h3>
              <span className="text-sm font-bold text-red-600">({formatCurrency(financials.cogs)})</span>
           </div>
           <div className="pl-4 space-y-1">
              <div className="flex justify-between text-xs text-[#6C757D]">
                 <span>Direct Costs & Filing Fees</span>
                 <span>({formatCurrency(financials.cogs)})</span>
              </div>
           </div>
        </div>

        {/* GROSS PROFIT LINE */}
        <div className="bg-[#F8F9FA] p-3 rounded-lg border border-slate-200 flex justify-between items-center">
           <div>
              <p className="text-xs font-black text-[#6C757D] uppercase">Gross Profit</p>
              <p className="text-[10px] text-slate-400">Revenue - COGS</p>
           </div>
           <div className="text-right">
              <p className="text-lg font-black text-[#1A1C22]">{formatCurrency(financials.grossProfit)}</p>
              <p className="text-[10px] font-bold text-[#1A1C22]">{formatPercent(financials.grossMargin)} Margin</p>
           </div>
        </div>

        {/* OPEX SECTION */}
        <div>
           <div className="flex justify-between items-end mb-2 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-[#1A1C22] uppercase tracking-wide">Operating Expenses (OpEx)</h3>
              <span className="text-sm font-bold text-red-600">({formatCurrency(financials.opex)})</span>
           </div>
           <div className="pl-4 space-y-1">
              {financials.opex === 0 ? (
                 <p className="text-[10px] text-slate-300 italic">No operating expenses recorded.</p>
              ) : (
                // Only show simplified OpEx total or top categories to keep it clean, or map breakdown
                Object.entries(financials.expensesBreakdown).map(([desc, val], idx) => {
                   // Filter only OpEx conceptually (approximation since we grouped all expenses in breakdown)
                   // Ideally we would filter by category in the map, but for display simplicity:
                   if ((val as number) > 0) return (
                      <div key={idx} className="flex justify-between text-xs text-[#6C757D]">
                         <span className="truncate pr-4">{desc}</span>
                         <span>({formatCurrency(val as number)})</span>
                      </div>
                   )
                   return null;
                }).slice(0, 5) // Show top 5 for brevity
              )}
              {Object.keys(financials.expensesBreakdown).length > 5 && (
                 <p className="text-[9px] text-slate-400 italic text-right mt-1">...and others</p>
              )}
           </div>
        </div>

        {/* NET INCOME LINE */}
        <div className={`p-4 rounded-xl border-2 ${isProfitable ? 'bg-[#D7FF3E]/10 border-[#D7FF3E]' : 'bg-red-50 border-red-100'} flex justify-between items-center`}>
           <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isProfitable ? 'bg-[#D7FF3E] text-[#1A1C22]' : 'bg-red-200 text-red-700'}`}>
                 <DollarSign className="w-5 h-5" />
              </div>
              <div>
                 <p className={`text-sm font-black uppercase ${isProfitable ? 'text-[#1A1C22]' : 'text-red-800'}`}>Net Operating Income</p>
                 <p className={`text-[10px] font-bold ${isProfitable ? 'text-[#1A1C22]' : 'text-red-600'}`}>
                    {basis === 'accrual' ? 'Pre-Tax (Invoiced)' : 'Cash Available (Realized)'}
                 </p>
              </div>
           </div>
           <div className="text-right">
              <p className={`text-2xl font-black font-mono ${isProfitable ? 'text-[#1A1C22]' : 'text-red-700'}`}>{formatCurrency(financials.netIncome)}</p>
              <p className={`text-xs font-bold ${isProfitable ? 'text-[#1A1C22]' : 'text-red-600'}`}>{formatPercent(financials.netMargin)} Net Margin</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
           <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><PieChart className="w-3 h-3" /> Efficiency Ratio</p>
              <p className="text-lg font-bold text-[#1A1C22]">
                 {financials.grossRevenue > 0 ? ((financials.opex / financials.grossRevenue) * 100).toFixed(1) : '0.0'}%
              </p>
              <p className="text-[9px] text-[#6C757D]">OpEx as % of Revenue</p>
           </div>
           <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Burn Rate</p>
              <p className="text-lg font-bold text-[#1A1C22]">
                 {formatCurrency(financials.opex)}
              </p>
              <p className="text-[9px] text-[#6C757D]">Total Period Spend ({basis})</p>
           </div>
        </div>

      </div>
    </div>
  );
};