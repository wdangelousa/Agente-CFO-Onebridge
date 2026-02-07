
import React, { useState, useMemo, useEffect } from 'react';
import { DistributionResult, FinancialData, TransactionType } from '../types';
import { calculateDistribution } from '../utils/calculations';
import { Logo } from './Logo';
import { X, Printer, CalendarRange, Users, AlertCircle, ArrowUpCircle, Calendar } from 'lucide-react';

interface Props {
  result: DistributionResult;
  transactions: FinancialData[];
  onClose: () => void;
  initialMonth: string;
  initialFortnight: number;
  onPeriodChange: (month: string, fortnight: number) => void;
}

enum ReportPeriod {
  QUINZENAL = 'Quinzenal',
  MENSAL = 'Mensal',
  CUSTOM = 'Livre'
}

export const ReportModal: React.FC<Props> = ({ transactions, onClose, initialMonth, initialFortnight, onPeriodChange }) => {
  const [periodType, setPeriodType] = useState<ReportPeriod>(ReportPeriod.QUINZENAL);
  const [referenceMonth, setReferenceMonth] = useState(initialMonth);
  const [fortnightMode, setFortnightMode] = useState<1 | 2>(initialFortnight as 1 | 2);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate specific date ranges for labels
  const fortnightDates = useMemo(() => {
    const [year, month] = referenceMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      f1: `01/${month.toString().padStart(2, '0')} a 15/${month.toString().padStart(2, '0')}`,
      f2: `16/${month.toString().padStart(2, '0')} a ${lastDay}/${month.toString().padStart(2, '0')}`
    };
  }, [referenceMonth]);

  useEffect(() => {
    recalculateDates(periodType, referenceMonth, fortnightMode);
  }, [periodType, referenceMonth, fortnightMode]);

  const recalculateDates = (type: ReportPeriod, refMonth: string, mode: 1 | 2) => {
    const [year, monthNum] = refMonth.split('-').map(Number);
    const month = monthNum - 1;

    let start = '';
    let end = '';
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    if (type === ReportPeriod.QUINZENAL) {
      if (mode === 1) {
        start = formatDate(new Date(year, month, 1));
        end = formatDate(new Date(year, month, 15));
      } else {
        start = formatDate(new Date(year, month, 16));
        end = formatDate(new Date(year, month + 1, 0));
      }
    } else if (type === ReportPeriod.MENSAL) {
      start = formatDate(new Date(year, month, 1));
      end = formatDate(new Date(year, month + 1, 0));
    }

    if (start && end) {
      setStartDate(start);
      setEndDate(end);
    }
  };

  const handleFortnightChange = (mode: 1 | 2) => {
    setFortnightMode(mode);
    onPeriodChange(referenceMonth, mode);
  };

  const filteredTransactions = useMemo(() => {
    if (!startDate || !endDate) return [];
    return transactions.filter(t => {
      if (!t.date) return false;
      const tDate = t.date.split('T')[0];
      return tDate >= startDate && tDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

  const filteredResult = useMemo(() => calculateDistribution(filteredTransactions), [filteredTransactions]);

  const handlePrint = () => window.print();
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm print:bg-white print:p-0">
      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl flex flex-col print:h-auto print:shadow-none print:w-full print:max-w-none print:rounded-none overflow-hidden">
        
        {/* Controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-6 items-end print:hidden">
           <div>
             <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Escopo</label>
             <div className="flex bg-white p-1 rounded-lg border border-slate-200">
               {Object.values(ReportPeriod).map(p => (
                 <button key={p} onClick={() => setPeriodType(p)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${periodType === p ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                   {p}
                 </button>
               ))}
             </div>
           </div>

           <div>
             <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Mês de Referência</label>
             <input type="month" value={referenceMonth} onChange={(e) => { setReferenceMonth(e.target.value); onPeriodChange(e.target.value, fortnightMode); }} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-slate-950 outline-none" />
           </div>

           {periodType === ReportPeriod.QUINZENAL && (
             <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Seleção da Quinzena</label>
                <div className="flex gap-2">
                   <button onClick={() => handleFortnightChange(1)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center ${fortnightMode === 1 ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      <span>1ª Quinzena</span>
                      <span className="opacity-70">{fortnightDates.f1}</span>
                   </button>
                   <button onClick={() => handleFortnightChange(2)} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex flex-col items-center ${fortnightMode === 2 ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                      <span>2ª Quinzena</span>
                      <span className="opacity-70">{fortnightDates.f2}</span>
                   </button>
                </div>
             </div>
           )}

           <div className="ml-auto flex gap-3">
             <button onClick={handlePrint} disabled={filteredTransactions.length === 0} className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold shadow-lg transition-all disabled:bg-slate-300 disabled:cursor-not-allowed">
               <Printer className="w-4 h-4" /> Imprimir
             </button>
             <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"><X className="w-6 h-6" /></button>
           </div>
        </div>

        {/* Report Content Area */}
        <div className="flex-1 overflow-auto bg-slate-200/50 p-8 print:p-0 print:bg-white print:overflow-visible">
          <div className="bg-white max-w-[210mm] mx-auto min-h-[297mm] shadow-xl p-[20mm] print:shadow-none print:m-0 print:w-full print:max-w-none print:h-auto text-slate-900 relative">
            <div className="flex justify-between items-start mb-10 border-b-4 border-slate-900 pb-8">
              <div className="scale-90 origin-top-left"><Logo variant="dark" /></div>
              <div className="text-right">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Relatório Financeiro</h1>
                <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mt-1">Demonstrativo de Fechamento</p>
                <div className="mt-4 flex flex-col items-end text-xs font-bold text-slate-500">
                   <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                      <Calendar className="w-3.5 h-3.5" />
                      {startDate.split('-').reverse().join('/')} até {endDate.split('-').reverse().join('/')}
                   </div>
                   <p className="mt-2 text-[10px] text-slate-400 font-mono">BATCH ID: {crypto.randomUUID().split('-')[0].toUpperCase()}</p>
                </div>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                  <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-xl font-black uppercase tracking-widest">Sem lançamentos</p>
               </div>
            ) : (
            <div className="space-y-10">
              <div className="grid grid-cols-4 gap-0 border-2 border-slate-900 rounded-xl overflow-hidden divide-x-2 divide-slate-900">
                <div className="p-4 bg-slate-50"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Receita</p><p className="text-lg font-black text-slate-900">{formatCurrency(filteredResult.grossTotalBookkeeping)}</p></div>
                <div className="p-4 bg-slate-50"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Custo OpEx</p><p className="text-lg font-black text-red-600">{formatCurrency(filteredResult.totalOpEx)}</p></div>
                <div className="p-4 bg-slate-50"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Líquido</p><p className="text-lg font-black text-emerald-600">{formatCurrency(filteredResult.safetyMargin)}</p></div>
                <div className="p-4 bg-slate-900 text-white"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Reserva (12%)</p><p className="text-lg font-black">{formatCurrency(filteredResult.companyReserve)}</p></div>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ArrowUpCircle className="w-4 h-4 text-emerald-600" /> Detalhamento de Transações
                </h3>
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase border-b border-slate-200 text-left"><th className="px-4 py-2">Data</th><th className="px-4 py-2">Descrição / Serviço</th><th className="px-4 py-2 text-right">Valor USD</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="text-xs">
                        <td className="px-4 py-3 text-slate-400 font-mono">{t.date?.split('T')[0].split('-').reverse().join('/')}</td>
                        <td className="px-4 py-3"><p className="font-bold text-slate-800">{t.description}</p><p className="text-[10px] text-slate-400">{t.serviceType || 'Operacional'}</p></td>
                        <td className={`px-4 py-3 text-right font-bold ${t.type === TransactionType.REVENUE ? 'text-emerald-700' : 'text-red-700'}`}>
                           {t.type === TransactionType.REVENUE ? '+' : '-'}{formatCurrency(t.type === TransactionType.REVENUE ? t.grossRevenue : t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-900 rounded-2xl p-8 text-white">
                <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-b border-slate-700 pb-4 flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-emerald-400" /> Distribuição Detalhada (Memória de Cálculo)
                </h3>
                
                {/* Detailed Table for Partners - HIGH CONTRAST COLORS APPLIED */}
                <table className="w-full">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase text-right border-b border-slate-800">
                       <th className="pb-3 text-left pl-2 text-slate-300">Sócio / Entidade</th>
                       <th className="pb-3 text-slate-400">Quota (33%)</th>
                       <th className="pb-3 text-emerald-400">Comissão (10%)</th>
                       <th className="pb-3 text-amber-400">Reembolsos</th>
                       <th className="pb-3 text-white">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[
                      { 
                        name: 'EVANDRO (PROFISCAL)', 
                        quota: filteredResult.partnerShares.evandro, 
                        fee: filteredResult.originationFees.evandro, 
                        reimb: filteredResult.reimbursements.evandro,
                        total: filteredResult.finalPayouts.evandro 
                      },
                      { 
                        name: 'JULIA/SAMUEL (ELEVATED)', 
                        quota: filteredResult.partnerShares.juliaSamuel, 
                        fee: filteredResult.originationFees.juliaSamuel, 
                        reimb: filteredResult.reimbursements.juliaSamuel,
                        total: filteredResult.finalPayouts.juliaSamuel 
                      },
                      { 
                        name: 'WALTER (MORAES D\'ANGELO)', 
                        quota: filteredResult.partnerShares.walter, 
                        fee: filteredResult.originationFees.walter, 
                        reimb: filteredResult.reimbursements.walter,
                        total: filteredResult.finalPayouts.walter 
                      }
                    ].map((p, i) => (
                      <tr key={i} className="text-sm hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 pl-2 font-bold text-white">{p.name}</td>
                        <td className="py-4 text-right font-mono text-slate-300">{formatCurrency(p.quota)}</td>
                        <td className="py-4 text-right font-mono text-emerald-300">+{formatCurrency(p.fee)}</td>
                        <td className={`py-4 text-right font-mono font-bold ${p.reimb > 0 ? 'text-amber-300' : 'text-slate-600'}`}>+{formatCurrency(p.reimb)}</td>
                        <td className="py-4 text-right font-mono font-black text-lg text-white">{formatCurrency(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="mt-4 pt-4 border-t border-slate-800 text-[9px] text-slate-400 flex justify-between">
                   <p>* Quota calculada após dedução da Reserva e Comissões.</p>
                   <p>** Comissão calculada sobre Receita Bruta Originada.</p>
                </div>
              </div>

              <div className="mt-12 pt-10 border-t-2 border-slate-100 grid grid-cols-2 gap-20">
                <div className="text-center"><div className="border-b border-slate-300 h-10 mb-2"></div><p className="text-[10px] font-black text-slate-400 uppercase">OneBridge Systems (CFO)</p></div>
                <div className="text-center"><div className="border-b border-slate-300 h-10 mb-2"></div><p className="text-[10px] font-black text-slate-400 uppercase">Sócio Administrador (Aprovação)</p></div>
              </div>
            </div>
            )}
            <div className="absolute bottom-10 left-0 right-0 text-center"><p className="text-[9px] text-slate-300 font-mono uppercase tracking-widest">Documento Interno Confidencial • OneBridge Stalwart LLC</p></div>
          </div>
        </div>
      </div>
    </div>
  );
};
