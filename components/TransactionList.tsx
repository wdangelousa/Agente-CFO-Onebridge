
import React, { useMemo } from 'react';
import { FinancialData, TransactionType, TransactionStatus, ExpenseCategory } from '../types';
import { Trash2, FileText, CheckCircle2, Clock, Pencil, Layers, Briefcase, Paperclip, Files } from 'lucide-react';

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
    const attachments = t.attachments || (t.attachmentUrl ? [{ url: t.attachmentUrl, name: 'Anexo' }] : []);

    if (attachments.length === 0) return null;

    if (attachments.length === 1) {
      return (
        <a
          href={attachments[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all duration-150"
          title="Ver Anexo"
        >
          <Paperclip className="w-4 h-4" />
        </a>
      );
    }

    return (
      <div className="relative group/attach">
        <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all duration-150 flex items-center gap-1.5">
          <Files className="w-4 h-4" />
          <span className="text-[10px] font-semibold text-slate-500">{attachments.length}</span>
        </button>
        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 hidden group-hover/attach:block animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Arquivos Anexados</p>
            {attachments.map((att, idx) => (
              <a
                key={idx}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors truncate font-medium"
              >
                {idx + 1}. {att.name || 'Documento'}
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const revenues = useMemo(() =>
    transactions.filter(t => t.type === TransactionType.REVENUE).sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime()),
    [transactions]);

  const expenses = useMemo(() =>
    transactions.filter(t => t.type === TransactionType.EXPENSE),
    [transactions]);

  const expensesByRevenueId = useMemo(() => {
    const map: Record<string, FinancialData[]> = {};
    expenses.forEach(e => {
      if (e.linkedTransactionId) {
        if (!map[e.linkedTransactionId]) map[e.linkedTransactionId] = [];
        map[e.linkedTransactionId].push(e);
      }
    });
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
    });
    return map;
  }, [expenses]);

  const unlinkedExpenses = useMemo(() => {
    const revenueIdsInView = new Set(revenues.map(r => r.id));
    return expenses
      .filter(e => !e.linkedTransactionId || !revenueIdsInView.has(e.linkedTransactionId))
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
  }, [expenses, revenues]);

  const linkedExpensesCount = expenses.length - unlinkedExpenses.length;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="bg-slate-50/80 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Layers className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-600 mb-1">Nenhum lançamento neste período</p>
        <p className="text-xs text-slate-400">Inicie um novo Deal para começar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* SEÇÃO 1: PORTFÓLIO DE DEALS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Layers className="w-4.5 h-4.5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Portfólio de Deals</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Receitas e Margens de Contribuição</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg">
              Unit Economics
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="divide-y divide-slate-100/80">
          {revenues.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm font-medium">Nenhuma receita registrada neste período.</div>
          ) : (
            revenues.map((revenue, idx) => {
              const linkedCosts = expensesByRevenueId[revenue.id!] || [];
              const totalCosts = linkedCosts.reduce((acc, curr) => acc + (curr.amount || 0), 0);
              const grossRevenue = revenue.grossRevenue || 0;
              const contributionMargin = grossRevenue - totalCosts;
              const marginPercent = grossRevenue > 0 ? (contributionMargin / grossRevenue) * 100 : 0;
              const isIssued = !!revenue.issuedAt;

              return (
                <div
                  key={revenue.id}
                  className={`group transition-all duration-150 ${idx % 2 === 0 ? 'bg-white hover:bg-slate-50/40' : 'bg-slate-50/30 hover:bg-slate-50/60'}`}
                >
                  {/* Revenue Row */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">

                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 sm:gap-4">
                        {/* Status Indicator */}
                        <div className={`w-1.5 h-12 sm:h-14 rounded-full flex-shrink-0 ${revenue.status === TransactionStatus.PAID ? 'bg-gradient-to-b from-emerald-500 to-emerald-600' : 'bg-gradient-to-b from-amber-400 to-amber-500'}`}></div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-bold text-slate-900 text-sm sm:text-base truncate leading-tight mr-1">{revenue.description}</h4>
                            {isIssued && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold border border-emerald-200/50 whitespace-nowrap">
                                FATURADO
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                            <span className="font-medium tabular-nums whitespace-nowrap">
                              {revenue.date?.split('T')[0].split('-').reverse().join('/')}
                            </span>
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="text-slate-600 font-medium truncate max-w-full sm:max-w-[200px]">{revenue.serviceType || 'Serviço Geral'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Financial Data */}
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-6 gap-y-3 pl-4 border-l border-slate-200/60 lg:border-l-0 lg:pl-0 mt-2 lg:mt-0">

                      {/* Custos */}
                      <div className="text-right">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-wide">Custos</p>
                        <p className={`text-sm font-bold font-mono tabular-nums ${totalCosts > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                          {totalCosts > 0 ? '-' : ''}{formatCurrency(totalCosts)}
                        </p>
                      </div>

                      {/* Receita */}
                      <div className="text-right">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 mb-1 tracking-wide">Receita</p>
                        <p className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-600">
                          +{formatCurrency(grossRevenue)}
                        </p>
                      </div>

                      {/* Margem (Destaque) */}
                      <div className="text-right bg-gradient-to-br from-slate-50 to-slate-100/50 px-3 sm:px-5 py-2 sm:py-3 rounded-xl border border-slate-200/80 shadow-sm min-w-[100px] sm:min-w-[120px]">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-wide">Margem</p>
                        <div className="flex flex-col items-end">
                          <span className={`font-bold font-mono text-sm sm:text-base tabular-nums ${contributionMargin < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {formatCurrency(contributionMargin)}
                          </span>
                          <span className={`text-[9px] font-bold mt-0.5 ${marginPercent < 30 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {marginPercent.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 items-center ml-auto sm:ml-2">
                        {renderAttachmentLink(revenue)}
                        <button
                          onClick={() => onEdit(revenue)}
                          className="p-1.5 sm:p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50/50 rounded-lg transition-all duration-150"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {revenue.type === TransactionType.REVENUE && (
                          <button
                            onClick={() => onGenerateInvoice(revenue)}
                            className={`p-1.5 sm:p-2 rounded-lg transition-all duration-150 ${isIssued ? 'text-emerald-600 hover:bg-emerald-50/50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50'}`}
                            title="Gerar Invoice"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => revenue.id && onRemove(revenue.id)}
                          className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-all duration-150"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custos Vinculados */}
                  {linkedCosts.length > 0 && (
                    <div className="bg-gradient-to-b from-slate-50/40 to-slate-50/60 border-t border-slate-200/60 px-6 py-4 lg:pl-16">
                      <div className="flex items-center gap-2.5 mb-3.5">
                        <div className="w-4 h-4 border-l-2 border-b-2 border-slate-300 rounded-bl-md"></div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Custos Vinculados</span>
                      </div>
                      <div className="space-y-2 pl-6">
                        {linkedCosts.map((cost, costIdx) => (
                          <div
                            key={cost.id}
                            className={`flex items-center justify-between group/cost px-3 py-2.5 rounded-lg border transition-all duration-150 ${costIdx % 2 === 0 ? 'bg-white/80 border-transparent hover:border-slate-200/80' : 'bg-slate-50/50 border-transparent hover:border-slate-200/80'} hover:shadow-sm`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-[10px] font-mono text-slate-400 tabular-nums flex-shrink-0 w-10">
                                {cost.date?.split('T')[0].split('-').reverse().join('/').slice(0, 5)}
                              </span>
                              {cost.status === TransactionStatus.PAID ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" title="Pago" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Provisionado" />
                              )}
                              <span className="text-sm text-slate-700 font-medium truncate">{cost.description}</span>

                              {(cost.attachments?.length || (cost.attachmentUrl ? 1 : 0)) > 0 && (
                                <a
                                  href={cost.attachments?.[0]?.url || cost.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700 flex items-center gap-1 flex-shrink-0 transition-colors"
                                  title="Ver Comprovante"
                                >
                                  <Paperclip className="w-3.5 h-3.5" />
                                  {(cost.attachments?.length || 0) > 1 && (
                                    <span className="text-[9px] font-bold">({cost.attachments?.length})</span>
                                  )}
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <span className="font-mono font-bold text-sm text-red-600 tabular-nums">
                                -{formatCurrency(cost.amount || 0)}
                              </span>
                              <div className="opacity-0 group-hover/cost:opacity-100 flex gap-1 transition-opacity">
                                <button
                                  onClick={() => onEdit(cost)}
                                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50/50 rounded transition-all"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => cost.id && onRemove(cost.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50/50 rounded transition-all"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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

      {/* SEÇÃO 2: DESPESAS OPERACIONAIS */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-xl">
                <Briefcase className="w-4.5 h-4.5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wide">Despesas Operacionais</h3>
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">OpEx e Despesas Desvinculadas</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg tracking-wider">
              {unlinkedExpenses.length} {unlinkedExpenses.length === 1 ? 'Item' : 'Itens'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="divide-y divide-slate-100/80 max-h-[500px] overflow-y-auto">
          {unlinkedExpenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm font-medium">
              <p>Nenhuma despesa operacional registrada.</p>
              {linkedExpensesCount > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  {linkedExpensesCount} {linkedExpensesCount === 1 ? 'custo vinculado aparece' : 'custos vinculados aparecem'} nos deals acima.
                </p>
              )}
            </div>
          ) : unlinkedExpenses.map((expense, idx) => (
            <div
              key={expense.id}
              className={`p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-150 group ${idx % 2 === 0 ? 'bg-white hover:bg-slate-50/40' : 'bg-slate-50/30 hover:bg-slate-50/60'}`}
            >
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                {/* Icon */}
                <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 ${expense.category === ExpenseCategory.OPEX ? 'bg-purple-50' : 'bg-blue-50'}`}>
                  {expense.category === ExpenseCategory.OPEX ? (
                    <Briefcase className="w-4 h-4 text-purple-600" />
                  ) : (
                    <Layers className="w-4 h-4 text-blue-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-slate-800 truncate leading-tight mr-1">
                      {expense.description}
                    </p>
                    {(expense.attachments?.length || (expense.attachmentUrl ? 1 : 0)) > 0 && (
                      <a
                        href={expense.attachments?.[0]?.url || expense.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 flex items-center gap-1 flex-shrink-0 transition-colors"
                        title="Ver Comprovante"
                      >
                        <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        {(expense.attachments?.length || 0) > 1 && (
                          <span className="text-[9px] font-bold">({expense.attachments?.length})</span>
                        )}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="font-medium tabular-nums whitespace-nowrap">
                      {expense.date?.split('T')[0].split('-').reverse().join('/')}
                    </span>
                    {expense.serviceType && (
                      <>
                        <span className="text-slate-300 hidden sm:inline">•</span>
                        <span className="text-slate-600 font-medium italic truncate max-w-full sm:max-w-[200px]">Ref: {expense.serviceType}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Value & Actions */}
              <div className="flex items-center justify-end gap-3 sm:gap-5 flex-shrink-0 pl-11 sm:pl-0">
                {expense.status === TransactionStatus.PENDING && (
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 sm:px-3 py-1 rounded-lg border border-amber-200/50 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> <span className="hidden sm:inline">Pendente</span>
                  </span>
                )}
                <span className="font-mono font-bold text-sm text-red-600 min-w-[80px] sm:min-w-[100px] text-right tabular-nums">
                  -{formatCurrency(expense.amount || 0)}
                </span>
                <div className="flex gap-1 w-auto sm:w-20 justify-end transition-opacity">
                  <button
                    onClick={() => onEdit(expense)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50/50 rounded-lg transition-all duration-150"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => expense.id && onRemove(expense.id)}
                    className="p-1.5 sm:p-2 text-slate-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-all duration-150"
                    title="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
          }
        </div>
      </div>
    </div>
  );
};
