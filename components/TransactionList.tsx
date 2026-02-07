
import React, { useMemo } from 'react';
import { FinancialData, TransactionType, TransactionStatus, ExpenseCategory } from '../types';
import { Trash2, ArrowUpCircle, FileText, CheckCircle2, Clock, CalendarDays, History, Pencil, Layers, Briefcase, Link as LinkIcon, ChevronRight, Wallet, AlertCircle, Paperclip, Files } from 'lucide-react';

interface Props {
  transactions: FinancialData[];
  onRemove: (id: string) => void;
  onGenerateInvoice: (transaction: FinancialData) => void;
  onEdit: (transaction: FinancialData) => void;
}

export const TransactionList: React.FC<Props> = ({ transactions, onRemove, onGenerateInvoice, onEdit }) => {
  const formatCurrency = (val: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(val || 0);
  };

  // Helper para renderizar link de anexo
  const renderAttachmentLink = (t: FinancialData) => {
    // Normalizar lista de anexos (suporte legado + novo)
    const attachments = t.attachments || (t.attachmentUrl ? [{ url: t.attachmentUrl, name: 'Anexo' }] : []);
    
    if (attachments.length === 0) return null;

    if (attachments.length === 1) {
       return (
         <a href={attachments[0].url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Ver Anexo">
           <Paperclip className="w-4 h-4" />
         </a>
       );
    }

    return (
      <div className="relative group/attach">
        <button className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors flex items-center gap-1">
          <Files className="w-4 h-4" />
          <span className="text-[9px] font-bold">{attachments.length}</span>
        </button>
        {/* Dropdown on Hover */}
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-50 hidden group-hover/attach:block animate-in fade-in zoom-in-95 duration-100">
           <div className="p-2 space-y-1">
             <p className="text-[9px] font-bold text-slate-400 uppercase px-2 mb-1">Arquivos</p>
             {attachments.map((att, idx) => (
                <a key={idx} href={att.url} target="_blank" rel="noopener noreferrer" className="block px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded truncate">
                   {idx + 1}. {att.name || 'Documento'}
                </a>
             ))}
           </div>
        </div>
      </div>
    );
  };

  // 1. Separar Receitas e Despesas
  const revenues = useMemo(() => 
    transactions.filter(t => t.type === TransactionType.REVENUE).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime()),
  [transactions]);

  const expenses = useMemo(() => 
    transactions.filter(t => t.type === TransactionType.EXPENSE),
  [transactions]);

  // 2. Agrupar COGS por Receita Vinculada (QA Fix: Sorted by date descending)
  const expensesByRevenueId = useMemo(() => {
    const map: Record<string, FinancialData[]> = {};
    expenses.forEach(e => {
      if (e.linkedTransactionId) {
        if (!map[e.linkedTransactionId]) map[e.linkedTransactionId] = [];
        map[e.linkedTransactionId].push(e);
      }
    });
    // Sort linked expenses within their group
    Object.keys(map).forEach(key => {
        map[key].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    });
    return map;
  }, [expenses]);

  // 3. Identificar Despesas "Orfãs" ou OpEx (QA Fix: Sorted by date descending)
  const unlinkedExpenses = useMemo(() => {
    const revenueIdsInView = new Set(revenues.map(r => r.id));
    return expenses
      .filter(e => !e.linkedTransactionId || !revenueIdsInView.has(e.linkedTransactionId))
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
  }, [expenses, revenues]);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300 shadow-sm">
        <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
           <CalendarDays className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-sm font-medium">Nenhum lançamento neste período.</p>
        <p className="text-xs text-slate-300 mt-1 uppercase tracking-widest font-bold">Inicie um novo Deal</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* SEÇÃO 1: PORTFÓLIO DE DEALS (RECEITAS + CUSTOS VINCULADOS) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
             <Layers className="w-4 h-4 text-emerald-600" />
             Portfólio de Deals & Margens
          </h3>
          <span className="text-[10px] font-black uppercase text-slate-400">Unit Economics</span>
        </div>

        <div className="divide-y divide-slate-100">
          {revenues.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">Nenhuma receita registrada neste período.</div>
          ) : (
            revenues.map(revenue => {
              const linkedCosts = expensesByRevenueId[revenue.id!] || [];
              const totalCosts = linkedCosts.reduce((acc, curr) => acc + (curr.amount || 0), 0);
              const grossRevenue = revenue.grossRevenue || 0;
              const contributionMargin = grossRevenue - totalCosts;
              const marginPercent = grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0;
              const isIssued = !!revenue.issuedAt;

              return (
                <div key={revenue.id} className="group transition-all hover:bg-slate-50/50">
                  {/* Revenue Header Row */}
                  <div className="p-4 pl-2 lg:pl-4 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-0">
                    
                    {/* Col 1: Status Line & Basic Info */}
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-3 mb-1">
                          <div className={`w-1 h-8 rounded-full ${revenue.status === TransactionStatus.PAID ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
                          <div>
                            <div className="flex items-center gap-2">
                               <h4 className="font-bold text-slate-900 text-sm truncate">{revenue.description}</h4>
                               {revenue.clientType === 'Pessoa Jurídica' && <Building2Icon className="w-3 h-3 text-slate-400" />}
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-2">
                               {revenue.date?.split('T')[0].split('-').reverse().join('/')}
                               <span className="text-slate-300">•</span>
                               {revenue.serviceType || 'Serviço Geral'}
                               {isIssued && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 rounded font-bold">FATURADO</span>}
                            </p>
                          </div>
                       </div>
                    </div>

                    {/* Col 2: Financial Summary of the Deal */}
                    <div className="flex items-center justify-between lg:justify-end gap-6 lg:w-1/2 mt-2 lg:mt-0 pl-4 lg:pl-0 border-l lg:border-l-0 border-slate-100">
                       
                       {/* Costs Summary */}
                       <div className="text-right">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Custos Diretos</p>
                          <p className={`text-xs font-bold font-mono ${totalCosts > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                             {totalCosts > 0 ? '-' : ''}{formatCurrency(totalCosts)}
                          </p>
                       </div>

                       {/* Gross Revenue */}
                       <div className="text-right">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">Receita Bruta</p>
                          <p className="text-sm font-black font-mono text-emerald-600">
                             +{formatCurrency(grossRevenue)}
                          </p>
                       </div>

                       {/* Net Margin (Highlight) */}
                       <div className="text-right bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 min-w-[100px]">
                          <p className="text-[9px] font-black uppercase text-slate-500 mb-0.5">Margem Deal</p>
                          <div className="flex flex-col items-end leading-none">
                             <span className={`font-black font-mono text-sm ${contributionMargin < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                               {formatCurrency(contributionMargin)}
                             </span>
                             <span className={`text-[9px] font-bold ${marginPercent < 30 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {marginPercent.toFixed(0)}%
                             </span>
                          </div>
                       </div>

                       {/* Actions */}
                       <div className="flex gap-1 ml-2 items-center">
                          {renderAttachmentLink(revenue)}
                          <button onClick={() => onEdit(revenue)} className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          {revenue.type === TransactionType.REVENUE && (
                              <button onClick={() => onGenerateInvoice(revenue)} className={`p-1.5 rounded transition-colors ${isIssued ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-300 hover:text-emerald-500'}`}><FileText className="w-4 h-4" /></button>
                          )}
                          <button onClick={() => revenue.id && onRemove(revenue.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                  </div>

                  {/* SUB-SECTION: Linked Expenses List */}
                  {linkedCosts.length > 0 && (
                    <div className="bg-slate-50/80 border-t border-slate-100 px-4 py-2 lg:pl-12 text-xs">
                       <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 border-l-2 border-b-2 border-slate-300 rounded-bl-md"></div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Detalhamento de Custos Vinculados (Provisionados)</span>
                       </div>
                       <div className="space-y-1.5 pl-5">
                          {linkedCosts.map(cost => (
                             <div key={cost.id} className="flex items-center justify-between group/cost hover:bg-white p-1.5 rounded border border-transparent hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-2">
                                   <span className="text-[9px] font-mono text-slate-400">{cost.date?.split('T')[0].split('-').reverse().join('/').slice(0,5)}</span>
                                   {cost.status === TransactionStatus.PAID ? (
                                      <span title="Pago"><CheckCircle2 className="w-3 h-3 text-emerald-500" /></span>
                                   ) : (
                                      <span title="Provisionado"><Clock className="w-3 h-3 text-amber-500" /></span>
                                   )}
                                   <span className="text-slate-600 font-medium">{cost.description}</span>
                                   
                                   {/* Cost Attachment (Inline Icon or Count) */}
                                   {(cost.attachments?.length || (cost.attachmentUrl ? 1 : 0)) > 0 && (
                                      <a href={cost.attachments?.[0]?.url || cost.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5" title="Ver Comprovante">
                                         <Paperclip className="w-3 h-3" />
                                         {(cost.attachments?.length || 0) > 1 && <span className="text-[9px] font-bold">({cost.attachments?.length})</span>}
                                      </a>
                                   )}

                                   {cost.isReimbursable && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded flex items-center gap-1"><Wallet className="w-2.5 h-2.5" /> Reembolso: {cost.reimbursementBeneficiary?.split(' ')[0]}</span>}
                                   {cost.originator && cost.originator !== 'Nenhum (Orgânico)' && <span className="text-[9px] text-slate-400">({cost.originator.split(' ')[0]})</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                   <span className="font-mono font-bold text-red-600">-{formatCurrency(cost.amount || 0)}</span>
                                   <div className="opacity-0 group-hover/cost:opacity-100 flex gap-1">
                                      <button onClick={() => onEdit(cost)} className="text-slate-400 hover:text-amber-500"><Pencil className="w-3 h-3" /></button>
                                      <button onClick={() => cost.id && onRemove(cost.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                   </div>
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SEÇÃO 2: DESPESAS OPERACIONAIS (OPEX) E AVULSAS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
             <Briefcase className="w-4 h-4 text-purple-600" />
             Despesas Operacionais & Avulsas
          </h3>
          <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
            {unlinkedExpenses.length} Itens
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
           {unlinkedExpenses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhuma despesa operacional ou desvinculada.</div>
           ) : (
              unlinkedExpenses.map(expense => (
                 <div key={expense.id} className="p-3 pl-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3">
                       <div className={`p-1.5 rounded-lg ${expense.category === ExpenseCategory.OPEX ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                          {expense.category === ExpenseCategory.OPEX ? <Briefcase className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                       </div>
                       <div>
                          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                             {expense.description}
                             {/* Expense Attachment (Inline Icon or Count) */}
                             {(expense.attachments?.length || (expense.attachmentUrl ? 1 : 0)) > 0 && (
                                <a href={expense.attachments?.[0]?.url || expense.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5" title="Ver Comprovante">
                                   <Paperclip className="w-3.5 h-3.5" />
                                   {(expense.attachments?.length || 0) > 1 && <span className="text-[9px] font-bold">({expense.attachments?.length})</span>}
                                </a>
                             )}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                             <span>{expense.date?.split('T')[0].split('-').reverse().join('/')}</span>
                             {expense.serviceType && (
                                <span className="text-slate-500 font-medium italic border-l border-slate-200 pl-2">Ref: {expense.serviceType}</span>
                             )}
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-4">
                       {expense.status === TransactionStatus.PENDING && (
                          <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                             <Clock className="w-3 h-3" /> Pendente
                          </span>
                       )}
                       <span className="font-mono font-bold text-red-600">-{formatCurrency(expense.amount || 0)}</span>
                       <div className="flex gap-1 w-16 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(expense)} className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => expense.id && onRemove(expense.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                 </div>
              ))
           )}
        </div>
      </div>
    </div>
  );
};

// Ícone Auxiliar
const Building2Icon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
  </svg>
);
