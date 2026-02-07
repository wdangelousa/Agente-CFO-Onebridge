import React from 'react';
import { DistributionResult } from '../types';
import { Landmark, Users, Calendar, TrendingUp, TrendingDown, AlertTriangle, FileBarChart, Clock, Wallet, ShieldAlert, ShieldCheck, Layers, Briefcase, ArrowRight } from 'lucide-react';

interface Props {
  result: DistributionResult;
  onGenerateReport: () => void;
  periodLabel: string;
}

export const DistributionResults: React.FC<Props> = ({ result, onGenerateReport, periodLabel }) => {

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const isLiquidityRisk = result.safetyMargin < 0;
  const hasPendingPayables = result.pendingPayables > 0.01;

  const payouts = [
    { name: 'Evandro (Profiscal)', pct: '33.34%', val: result.finalPayouts.evandro, reimbursement: result.reimbursements?.evandro },
    { name: 'Julia/Samuel (Elevated)', pct: '33.33%', val: result.finalPayouts.juliaSamuel, reimbursement: result.reimbursements?.juliaSamuel },
    { name: 'Walter (Moraes D\'Angelo)', pct: '33.33%', val: result.finalPayouts.walter, reimbursement: result.reimbursements?.walter }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="p-4 lg:p-6 bg-[#F8F9FA] border-b border-slate-200 flex justify-between items-start">
        <div>
          <h2 className="text-base lg:text-lg font-bold text-[#1A1C22] flex items-center gap-2">
            <Wallet className="w-4 h-4 lg:w-5 lg:h-5 text-[#1A1C22]" />
            Caixa Disponível
          </h2>
          <div className="flex items-center gap-2 mt-1.5 px-2 py-1 bg-white text-[#6C757D] rounded-md border border-slate-200 w-fit">
             <Calendar className="w-3 h-3 lg:w-3.5 lg:h-3.5 text-[#1A1C22]" />
             <span className="text-[10px] lg:text-xs font-bold uppercase tracking-tight truncate max-w-[150px] lg:max-w-none">{periodLabel}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-[10px] uppercase font-black text-slate-400 mb-0.5">Saldo Realizado (Cash Basis)</p>
            <p className={`text-xl lg:text-2xl font-black font-mono leading-none ${isLiquidityRisk ? 'text-red-600' : 'text-[#1A1C22]'}`}>
              {formatCurrency(result.safetyMargin)}
            </p>
          </div>
        </div>
      </div>

      {isLiquidityRisk && (
        <div className="bg-red-50 border-b border-red-100 p-3 flex items-center justify-center gap-2 animate-pulse">
           <ShieldAlert className="w-5 h-5 text-red-600" />
           <p className="text-xs font-bold text-red-700 uppercase">Alerta: Caixa Negativo (Realizado)</p>
        </div>
      )}

      {/* Seção de Alerta de Pendências (Não afeta o saldo acima, mas alerta sobre futuro) */}
      {hasPendingPayables && (
         <div className="bg-amber-50 border-b border-amber-100 p-3 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
               <Clock className="w-4 h-4 text-amber-600" />
               <p className="text-xs font-bold text-amber-800 uppercase">Contas a Pagar (Provisionado)</p>
            </div>
            <p className="text-xs font-mono font-bold text-amber-700">-{formatCurrency(result.pendingPayables)}</p>
         </div>
      )}

      <div className="p-4 lg:p-6 flex-grow flex flex-col gap-6 overflow-y-auto">
        
        {/* Waterfall Breakdown */}
        <div className="space-y-2">
           {/* Revenue */}
           <div className="flex justify-between items-center p-3 bg-[#D7FF3E]/10 rounded-lg border border-[#D7FF3E]/30">
             <div className="flex items-center gap-2 text-[#1A1C22] font-bold text-xs uppercase">
               <TrendingUp className="w-4 h-4" /> Receita Realizada (Paga)
             </div>
             <span className="font-bold font-mono text-[#1A1C22]">{formatCurrency(result.realizedRevenue)}</span>
           </div>
           
           {/* COGS */}
           <div className="flex justify-between items-center px-3 py-2 text-[#6C757D] text-xs">
             <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-blue-400" /> (-) Custos Diretos Pagos
             </div>
             <span className="font-mono text-red-500">-{formatCurrency(result.totalCOGS)}</span>
           </div>

           {/* OpEx */}
           <div className="flex justify-between items-center px-3 py-2 text-[#6C757D] text-xs border-b border-slate-100 pb-3 mb-2">
             <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-purple-400" /> (-) Despesas OpEx Pagas
             </div>
             <span className="font-mono text-red-500">-{formatCurrency(result.totalOpEx)}</span>
           </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-[#6C757D]">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold uppercase">Reserva (12%)</span>
            </div>
            <span className="font-mono font-bold text-[#1A1C22]">{formatCurrency(result.companyReserve)}</span>
          </div>

          <div className="flex justify-between items-center py-2 border-b border-slate-100">
             <div className="flex items-center gap-2 text-[#6C757D]">
              <Users className="w-4 h-4 text-slate-400" />
              <div className="flex flex-col">
                 <span className="text-xs font-bold uppercase">Taxa de Originação (10%)</span>
                 <span className="text-[9px] text-slate-400">Sobre Receita Realizada</span>
              </div>
            </div>
            <span className="font-mono font-bold text-[#1A1C22]">{formatCurrency(result.originationFee)}</span>
          </div>
        </div>

        {/* Partners */}
        <div className="space-y-3 mt-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
             <ArrowRight className="w-3 h-3" /> Distribuição Efetiva
          </h3>
          {payouts.map((partner, idx) => (
             <div key={idx} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${isLiquidityRisk ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                <div>
                   <p className="text-xs font-bold text-[#1A1C22]">{partner.name}</p>
                   <div className="flex gap-2 text-[9px] text-slate-400 mt-0.5">
                     <span>Quota: {formatCurrency(partner.val - (partner.reimbursement || 0))}</span>
                     {(partner.reimbursement || 0) > 0 && <span className="text-amber-600 font-bold">+ Reembolso: {formatCurrency(partner.reimbursement || 0)}</span>}
                   </div>
                </div>
                <div className="text-right">
                   <p className={`text-sm font-black font-mono ${isLiquidityRisk ? 'text-slate-400' : 'text-[#1A1C22]'}`}>{formatCurrency(partner.val)}</p>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};