
import React, { useState, useMemo, useEffect } from 'react';
import { DistributionResult, FinancialData, TransactionType } from '../types';
import { calculateDistribution } from '../utils/calculations';
import { buildIsoDate, formatDisplayDate, getIsoDatePart, getLastDayOfMonth } from '../utils/date';
import { Logo } from './Logo';
import { X, Printer, CalendarRange, AlertCircle, ArrowUpCircle, Calendar, DollarSign } from 'lucide-react';

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

  const fortnightDates = useMemo(() => {
    const [year, month] = referenceMonth.split('-').map(Number);
    const lastDay = getLastDayOfMonth(year, month);
    return {
      f1: `${buildIsoDate(year, month, 1)} a ${buildIsoDate(year, month, 15)}`,
      f2: `${buildIsoDate(year, month, 16)} a ${buildIsoDate(year, month, lastDay)}`
    };
  }, [referenceMonth]);

  useEffect(() => {
    recalculateDates(periodType, referenceMonth, fortnightMode);
  }, [periodType, referenceMonth, fortnightMode]);

  const recalculateDates = (type: ReportPeriod, refMonth: string, mode: 1 | 2) => {
    const [year, monthNum] = refMonth.split('-').map(Number);

    let start = '';
    let end = '';

    if (type === ReportPeriod.QUINZENAL) {
      if (mode === 1) {
        start = buildIsoDate(year, monthNum, 1);
        end = buildIsoDate(year, monthNum, 15);
      } else {
        start = buildIsoDate(year, monthNum, 16);
        end = buildIsoDate(year, monthNum, getLastDayOfMonth(year, monthNum));
      }
    } else if (type === ReportPeriod.MENSAL) {
      start = buildIsoDate(year, monthNum, 1);
      end = buildIsoDate(year, monthNum, getLastDayOfMonth(year, monthNum));
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
      const tDate = getIsoDatePart(t.date);
      return tDate >= startDate && tDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

  const filteredResult = useMemo(() => calculateDistribution(filteredTransactions), [filteredTransactions]);

  const handlePrint = () => window.print();
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm print:static print:block print:overflow-visible print:bg-white print:p-0">
      <div className="bg-white w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden print:block print:h-auto print:w-full print:max-w-none print:rounded-none print:shadow-none print:overflow-visible">

        {/* Controls Bar */}
        <div className="p-5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80 flex flex-wrap gap-6 items-end print:hidden shadow-sm">

          {/* Period Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">Escopo</label>
            <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200/80 shadow-sm">
              {Object.values(ReportPeriod).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodType(p)}
                  className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${periodType === p ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">Mês de Referência</label>
            <input
              type="month"
              value={referenceMonth}
              onChange={(e) => { setReferenceMonth(e.target.value); onPeriodChange(e.target.value, fortnightMode); }}
              className="px-4 py-2 bg-white border border-slate-300/80 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-slate-900/50 outline-none shadow-sm"
            />
          </div>

          {/* Fortnight Selector */}
          {periodType === ReportPeriod.QUINZENAL && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">Seleção da Quinzena</label>
              <div className="flex gap-3">
                <button
                  onClick={() => handleFortnightChange(1)}
                  className={`px-5 py-2 text-[10px] font-bold rounded-xl border transition-all flex flex-col items-center shadow-sm ${fortnightMode === 1 ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white border-slate-300/80 text-slate-600 hover:border-slate-400 hover:bg-slate-50'}`}
                >
                  <span>1ª Quinzena</span>
                  <span className="opacity-70 mt-0.5">{fortnightDates.f1}</span>
                </button>
                <button
                  onClick={() => handleFortnightChange(2)}
                  className={`px-5 py-2 text-[10px] font-bold rounded-xl border transition-all flex flex-col items-center shadow-sm ${fortnightMode === 2 ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white border-slate-300/80 text-slate-600 hover:border-slate-400 hover:bg-slate-50'}`}
                >
                  <span>2ª Quinzena</span>
                  <span className="opacity-70 mt-0.5">{fortnightDates.f2}</span>
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="ml-auto flex gap-3">
            <button
              onClick={handlePrint}
              disabled={filteredTransactions.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg transition-all disabled:bg-slate-300 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="flex-1 overflow-auto bg-slate-100/50 p-4 sm:p-8 print:block print:overflow-visible print:bg-white print:p-0">
          <div className="bg-white w-full lg:w-[210mm] lg:min-h-[297mm] mx-auto shadow-xl p-6 sm:p-10 lg:p-[20mm] text-slate-900 relative print:m-0 print:h-auto print:w-full print:max-w-none print:min-h-0 print:shadow-none print:p-[12mm]">

            {/* Header */}
            <div className="flex justify-between items-start mb-12 border-b-4 border-slate-900 pb-6">
              <div className="scale-90 origin-top-left"><Logo variant="dark" /></div>
              <div className="text-right">
                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">Relatório Financeiro</h1>
                <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mt-1.5">Demonstrativo de Fechamento</p>
                <div className="mt-5 flex flex-col items-end text-xs font-bold text-slate-500">
                  <div className="flex items-center gap-2.5 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-200/80 shadow-sm">
                    <Calendar className="w-3.5 h-3.5 text-slate-600" />
                    <span className="tabular-nums">{formatDisplayDate(startDate)} até {formatDisplayDate(endDate)}</span>
                  </div>
                  <p className="mt-2.5 text-[10px] text-slate-400 font-mono uppercase">BATCH ID: {crypto.randomUUID().split('-')[0].toUpperCase()}</p>
                </div>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                <div className="bg-slate-50 p-8 rounded-3xl mb-6">
                  <AlertCircle className="w-20 h-20 opacity-30" />
                </div>
                <p className="text-2xl font-black uppercase tracking-widest">Sem lançamentos</p>
                <p className="text-sm text-slate-400 mt-2">Nenhuma transação encontrada no período selecionado</p>
              </div>
            ) : (
              <div className="space-y-10 print:space-y-8">

                {/* Summary Cards */}
                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-3 break-inside-avoid sm:grid-cols-2 lg:grid-cols-6 print:grid-cols-6 print:gap-2">
                  <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2 print:col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Receita</p>
                    <div className="flex min-w-0 items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="min-w-0 text-base sm:text-lg lg:text-[17px] font-black text-slate-900 tabular-nums whitespace-nowrap leading-tight tracking-tight">{formatCurrency(filteredResult.grossTotalBookkeeping)}</p>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2 print:col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Custos Variáveis</p>
                    <div className="flex min-w-0 items-center gap-2">
                      <DollarSign className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <p className="min-w-0 text-base sm:text-lg lg:text-[17px] font-black text-red-600 tabular-nums whitespace-nowrap leading-tight tracking-tight">{formatCurrency(filteredResult.totalCOGS)}</p>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2 print:col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Despesas OpEx</p>
                    <div className="flex min-w-0 items-center gap-2">
                      <DollarSign className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <p className="min-w-0 text-base sm:text-lg lg:text-[17px] font-black text-red-600 tabular-nums whitespace-nowrap leading-tight tracking-tight">{formatCurrency(filteredResult.totalOpEx)}</p>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 lg:col-span-3 print:col-span-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Líquido</p>
                    <div className="flex min-w-0 items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="min-w-0 text-base sm:text-lg lg:text-[17px] font-black text-emerald-600 tabular-nums whitespace-nowrap leading-tight tracking-tight">{formatCurrency(filteredResult.safetyMargin)}</p>
                    </div>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-slate-900 bg-slate-900 p-4 text-white shadow-sm sm:col-span-2 sm:p-5 lg:col-span-3 print:col-span-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Reserva (12%)</p>
                    <div className="flex min-w-0 items-center gap-2">
                      <DollarSign className="w-4 h-4 text-white flex-shrink-0" />
                      <p className="min-w-0 text-base sm:text-lg lg:text-[17px] font-black tabular-nums whitespace-nowrap leading-tight tracking-tight">{formatCurrency(filteredResult.companyReserve)}</p>
                    </div>
                  </div>
                </div>

                {/* Transactions Table */}
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                      <ArrowUpCircle className="w-4 h-4 text-emerald-700" />
                    </div>
                    Detalhamento de Transações
                  </h3>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm print:overflow-visible print:rounded-none print:shadow-none">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-b from-slate-50 to-white text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200/80 text-left">
                          <th className="px-5 py-3 font-bold">Data</th>
                          <th className="px-5 py-3 font-bold">Descrição / Serviço</th>
                          <th className="px-5 py-3 text-right font-bold">Valor USD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/80">
                        {filteredTransactions.map((t, idx) => (
                          <React.Fragment key={t.id}>
                            <tr className={`text-xs group transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-slate-50/40' : 'bg-slate-50/30 hover:bg-slate-50/60'}`}>
                              <td className="px-5 py-3.5 text-slate-500 font-mono tabular-nums">{formatDisplayDate(t.date)}</td>
                              <td className="px-5 py-3.5">
                                <p className="font-bold text-slate-800 mb-0.5">{t.description}</p>
                                <p className="text-[10px] text-slate-400">{t.serviceType || 'Operacional'}</p>
                              </td>
                              <td className={`px-5 py-3.5 text-right font-bold tabular-nums ${t.type === TransactionType.REVENUE ? 'text-emerald-700' : 'text-red-700'}`}>
                                {t.type === TransactionType.REVENUE ? '+' : '-'}{formatCurrency(t.type === TransactionType.REVENUE ? t.grossRevenue : t.amount)}
                              </td>
                            </tr>
                            {t.type === TransactionType.REVENUE && t.externalCommission && t.externalCommission > 0 && (
                              <tr className="text-xs bg-red-50/40">
                                <td className="px-5 py-3.5 text-slate-400 font-mono tabular-nums">{formatDisplayDate(t.date)}</td>
                                <td className="px-5 py-3.5">
                                  <p className="font-bold text-slate-700 mb-0.5">Comissão Externa: {t.externalCommissionDescription || 'Parceiro'}</p>
                                  <p className="text-[10px] text-slate-400">Ref: {t.description}</p>
                                </td>
                                <td className="px-5 py-3.5 text-right font-bold text-red-600 tabular-nums">
                                  -{formatCurrency(t.externalCommission)}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Distribution Table */}
                <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-lg break-inside-avoid print:rounded-xl print:shadow-none">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-6 border-b border-slate-700/60 pb-5 flex items-center gap-2.5">
                    <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                      <CalendarRange className="w-4 h-4 text-emerald-400" />
                    </div>
                    Distribuição Detalhada (Memória de Cálculo)
                  </h3>

                  <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/40">
                    <table className="w-full">
                      <thead>
                        <tr className="text-[9px] font-bold text-slate-400 uppercase text-right border-b border-slate-700/60">
                          <th className="pb-4 text-left pl-3 text-slate-300 font-black">Sócio / Entidade</th>
                          <th className="pb-4 text-slate-400 font-black">Quota (33%)</th>
                          <th className="pb-4 text-emerald-400 font-black">Comissão (10%)</th>
                          <th className="pb-4 text-amber-400 font-black">Reembolsos</th>
                          <th className="pb-4 text-white font-black">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/40">
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
                          <tr key={i} className="text-sm hover:bg-slate-700/30 transition-colors">
                            <td className="py-4 pl-3 font-bold text-white">{p.name}</td>
                            <td className="py-4 text-right font-mono text-slate-300 tabular-nums">{formatCurrency(p.quota)}</td>
                            <td className="py-4 text-right font-mono text-emerald-300 tabular-nums">+{formatCurrency(p.fee)}</td>
                            <td className={`py-4 text-right font-mono font-bold tabular-nums ${p.reimb > 0 ? 'text-amber-300' : 'text-slate-600'}`}>+{formatCurrency(p.reimb)}</td>
                            <td className="py-4 text-right font-mono font-black text-lg text-white tabular-nums">{formatCurrency(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 pt-5 border-t border-slate-700/40 text-[9px] text-slate-400 flex justify-between">
                    <p>* Quota calculada após dedução da Reserva e Comissões.</p>
                    <p>** Comissão calculada sobre Receita Bruta Originada.</p>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="mt-16 pt-10 border-t-2 border-slate-200/80 grid grid-cols-2 gap-24 break-inside-avoid">
                  <div className="text-center">
                    <div className="border-b-2 border-slate-300/80 h-12 mb-3"></div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">OneBridge Systems (CFO)</p>
                  </div>
                  <div className="text-center">
                    <div className="border-b-2 border-slate-300/80 h-12 mb-3"></div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Sócio Administrador (Aprovação)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200/80 text-center">
              <p className="text-[9px] text-slate-300 font-mono uppercase tracking-widest">Documento Interno Confidencial • OneBridge Stalwart LLC</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
