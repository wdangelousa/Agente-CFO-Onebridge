
import React, { useState, useEffect } from 'react';
import { FinancialData, InvoiceRecord, TransactionType } from '../types';
import { InvoiceService } from '../services/invoiceService';
import { CheckCircle2, Loader2, Send, Users, X, Zap, FileText } from 'lucide-react';

interface Props {
  transactions: FinancialData[];
  invoices: InvoiceRecord[];
  onComplete: (updatedTransactions: FinancialData[], updatedInvoices: InvoiceRecord[]) => void;
  onClose: () => void;
}

interface ProcessState {
  id: string;
  client: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  stakeholdersNotified: boolean;
  invoiceNumber?: string;
}

export const BatchProcessModal: React.FC<Props> = ({ transactions, invoices, onComplete, onClose }) => {
  const [processList, setProcessList] = useState<ProcessState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalProcessed, setTotalProcessed] = useState(0);

  useEffect(() => {
    const list = transactions
      .filter(t => {
        if (t.type !== TransactionType.REVENUE) return false;
        const invoice = invoices.find((item) => t.id && item.transactionIds.includes(t.id));
        return !invoice || invoice.status === 'draft' || invoice.status === 'cancelled';
      })
      .map(t => ({
        id: t.id!,
        client: t.description,
        status: 'pending' as const,
        stakeholdersNotified: false,
        invoiceNumber: invoices.find((item) => t.id && item.transactionIds.includes(t.id))?.invoiceNumber
      }));
    setProcessList(list);
  }, [invoices, transactions]);

  const runAutomation = async () => {
    setIsProcessing(true);
    const updatedTransactions = [...transactions];
    const newProcessList = [...processList];

    for (let i = 0; i < newProcessList.length; i++) {
      setCurrentStep(i);
      const item = newProcessList[i];
      item.status = 'processing';
      setProcessList([...newProcessList]);

      const originalTx = updatedTransactions.find(t => t.id === item.id);
      if (!originalTx) continue;

      try {
        const invoice = await InvoiceService.issueForTransaction(originalTx, { status: 'issued' });
        item.invoiceNumber = invoice.invoiceNumber;
        item.stakeholdersNotified = true;

        originalTx.issuedAt = invoice.issuedAt;
        originalTx.invoiceNumber = invoice.invoiceNumber;
        originalTx.invoiceId = invoice.id;
        
        item.status = 'completed';
        setTotalProcessed(prev => prev + 1);
      } catch (e) {
        item.status = 'error';
      }
      setProcessList([...newProcessList]);
    }

    setIsProcessing(false);
    onComplete(updatedTransactions, await InvoiceService.fetchAll());
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Motor de Emissão em Lote</h2>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Protocolo Interno Automático</p>
            </div>
          </div>
          {!isProcessing && (
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {processList.length === 0 ? (
            <div className="text-center py-12">
               <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
               <p className="font-bold text-slate-700">Lote Processado!</p>
               <p className="text-sm text-slate-500">Todas as receitas do período já possuem protocolo de invoice.</p>
            </div>
          ) : (
            processList.map((item, idx) => (
              <div key={item.id} className={`p-4 rounded-xl border transition-all ${item.status === 'processing' ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-100' : 'border-slate-100 bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                    <span className="font-bold text-slate-800">{item.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
                    {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  <span className={`text-[10px] font-black uppercase tracking-widest ${item.status === 'completed' ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {item.status === 'completed' ? `Protocolado ${item.invoiceNumber || ''}` : item.status}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase ${item.stakeholdersNotified ? 'text-emerald-600' : 'text-slate-300'}`}>
                    <Users className="w-3 h-3" /> Notificação Stakeholders (OK)
                  </div>
                  <div className={`flex items-center gap-1.5 text-[9px] font-bold uppercase ${item.status === 'completed' ? 'text-blue-600' : 'text-slate-300'}`}>
                    <FileText className="w-3 h-3" /> Documento Gerado (OK)
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200">
          {processList.length > 0 && !isProcessing && totalProcessed === 0 && (
            <button 
              onClick={runAutomation}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
              EMITIR PROTOCOLOS DE {processList.length} INVOICES
            </button>
          )}

          {totalProcessed > 0 && !isProcessing && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                 <p className="text-sm font-bold text-emerald-800">
                   {totalProcessed} Invoices protocoladas com sucesso!
                 </p>
                 <p className="text-xs text-emerald-600 mt-1">
                   Os sócios foram notificados. O envio para os clientes deve ser feito manualmente.
                 </p>
              </div>
              <button 
                onClick={onClose}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-sm shadow-xl transition-all active:scale-95"
              >
                CONCLUÍDO
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-2 animate-pulse">
               <p className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em]">Sincronizando dados e protocolando lote...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
