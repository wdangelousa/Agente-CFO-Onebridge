import React, { useState } from 'react';
import { FinancialData, DistributionResult } from '../types';
import { getCFOAnalysis } from '../services/geminiService';
import { Bot, RefreshCw, Sparkles } from 'lucide-react';

interface Props {
  data: FinancialData;
  result: DistributionResult;
  periodLabel: string;
}

export const CfoAssistant: React.FC<Props> = ({ data, result, periodLabel }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const response = await getCFOAnalysis(data, result, periodLabel);
    setAnalysis(response);
    setLoading(false);
  };

  return (
    <div className="bg-white text-slate-700 rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[#F8F9FA]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm">
             <Bot className="w-5 h-5 text-[#1A1C22]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1C22]">CFO Virtual AI</h2>
            <p className="text-xs text-[#6C757D]">Contexto: {periodLabel}</p>
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || (result.grossTotalBookkeeping === 0 && result.provisionedFlow === 0)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            loading || (result.grossTotalBookkeeping === 0 && result.provisionedFlow === 0)
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-[#D7FF3E] hover:bg-[#cbe830] text-[#1A1C22] shadow-lg shadow-yellow-500/10'
          }`}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading ? 'Analisando...' : 'Gerar Parecer'}
        </button>
      </div>

      <div className="p-6 flex-grow overflow-auto font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {analysis ? (
          <div className="prose prose-sm prose-slate max-w-none prose-p:text-slate-600 prose-strong:text-slate-900 prose-strong:font-bold">
            <p className="whitespace-pre-wrap">{analysis}</p>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="p-4 bg-slate-50 rounded-full">
               <Bot className="w-8 h-8 opacity-20 text-slate-600" />
            </div>
            <p className="text-center max-w-xs text-slate-400 text-xs">
              Solicite uma análise estratégica baseada nos dados financeiros do período de {periodLabel}.
            </p>
          </div>
        )}
      </div>
      
      <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center uppercase tracking-wider">
         OneBridge Stalwart LLC • Internal Use Only • Confidential
      </div>
    </div>
  );
};