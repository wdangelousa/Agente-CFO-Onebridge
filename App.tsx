import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Login } from './components/Login';
import { FinancialForm } from './components/FinancialForm';
import { DistributionResults } from './components/DistributionResults';
import { PnLStatement } from './components/PnLStatement';
import { TransactionList } from './components/TransactionList';
import { CfoAssistant } from './components/CfoAssistant';
import { InvoiceModal } from './components/InvoiceModal';
import { ReportModal } from './components/ReportModal';
import { BatchProcessModal } from './components/BatchProcessModal';
import { FinancialData, DistributionResult, Partner, TransactionType, PaymentMethod, ClientType, TransactionStatus, ExpenseCategory } from './types';
import { calculateDistribution } from './utils/calculations';
import { createStoredDate, formatDisplayDate, getDateDayOfMonth, getDateMonthPart, getLocalMonthPart } from './utils/date';
import { Logo } from './components/Logo';
import { Eraser, FilePlus2, FileBarChart, Calendar, ChevronLeft, ChevronRight, History, Zap, LayoutDashboard, PenLine, Bot, Menu, LogOut, Loader2, Activity, PieChart } from 'lucide-react';
import { TransactionService } from './services/transactionService';

const INITIAL_FORM_DATA: FinancialData = {
  type: TransactionType.REVENUE,
  description: '',
  serviceType: '',
  clientType: ClientType.INDIVIDUAL,
  clientTaxId: '',
  clientAddress: '',
  clientEmail: '',
  responsibleName: '',
  grossRevenue: 0,
  amount: 0,
  externalCommission: 0,
  originator: Partner.NONE,
  currency: 'USD',
  paymentMethod: PaymentMethod.WIRE,
  paymentLink: '',
  commissionType: 'fixed',
  commissionRate: 0,
  status: TransactionStatus.PAID
};

type MobileTab = 'form' | 'dashboard' | 'cfo';
type DashboardView = 'waterfall' | 'pnl';
type SaveFeedback = { kind: 'success' | 'error'; message: string } | null;

const INITIAL_NOW = new Date();
const INITIAL_REF_MONTH = getLocalMonthPart(INITIAL_NOW);
const INITIAL_FORTNIGHT: 1 | 2 = INITIAL_NOW.getDate() <= 15 ? 1 : 2;

const getPeriodAnchorDate = (refMonth: string, fortnight: 1 | 2) => {
  const [year, month] = refMonth.split('-').map(Number);
  const day = fortnight === 1 ? 1 : 16;
  return createStoredDate(year, month, day);
};

const createFormState = (
  refMonth: string,
  fortnight: 1 | 2,
  type: TransactionType = TransactionType.REVENUE
): FinancialData => {
  const baseState: FinancialData = {
    ...INITIAL_FORM_DATA,
    type,
    currency: 'USD',
    date: getPeriodAnchorDate(refMonth, fortnight)
  };

  if (type === TransactionType.EXPENSE) {
    return {
      ...baseState,
      status: TransactionStatus.PENDING,
      category: ExpenseCategory.COGS,
      grossRevenue: 0,
      serviceType: '',
      originator: Partner.NONE
    };
  }

  return {
    ...baseState,
    status: TransactionStatus.PAID,
    category: undefined,
    linkedTransactionId: undefined,
    isReimbursable: false,
    reimbursementBeneficiary: undefined
  };
};

const isTransactionInCurrentView = (transaction: Pick<FinancialData, 'date'>, refMonth: string, fortnight: 1 | 2) => {
  if (!transaction.date) return false;
  const txMonth = getDateMonthPart(transaction.date);
  const txDay = getDateDayOfMonth(transaction.date);
  const txFortnight = txDay && txDay <= 15 ? 1 : 2;
  return txMonth === refMonth && txFortnight === fortnight;
};

export default function App() {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // App Data State
  const [refMonth, setRefMonth] = useState(INITIAL_REF_MONTH);
  const [fortnight, setFortnight] = useState<1 | 2>(INITIAL_FORTNIGHT);
  const [formData, setFormData] = useState<FinancialData>(() => createFormState(INITIAL_REF_MONTH, INITIAL_FORTNIGHT));
  const [allTransactions, setAllTransactions] = useState<FinancialData[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>(null);
  const [formResetToken, setFormResetToken] = useState(0);

  // Mobile Navigation State
  const [activeTab, setActiveTab] = useState<MobileTab>('form');

  // Dashboard View Mode (New)
  const [dashboardView, setDashboardView] = useState<DashboardView>('waterfall');

  const [selectedInvoiceTransaction, setSelectedInvoiceTransaction] = useState<FinancialData | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Auth Effect com Tratamento de Erro Robusto
  useEffect(() => {
    const initSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        setSession(data.session);
      } catch (error) {
        console.warn("Sessão não iniciada:", error);
        setSession(null);
      } finally {
        setLoadingAuth(false);
      }
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Transactions on Session Change
  useEffect(() => {
    if (session) {
      const loadTransactions = async () => {
        setLoadingData(true);
        try {
          const data = await TransactionService.fetchAll();
          setAllTransactions(data);
        } catch (error) {
          console.error("Failed to load transactions", error);
        } finally {
          setLoadingData(false);
        }
      };
      loadTransactions();
    }
  }, [session]);

  useEffect(() => {
    setFormData(prev => {
      const isEditing = !!prev.id && prev.id !== 'manual';
      const hasDraftContent = !!prev.description.trim() || (prev.grossRevenue || 0) > 0 || (prev.amount || 0) > 0 || (prev.attachments?.length || 0) > 0;

      if (isEditing || hasDraftContent) {
        return prev;
      }

      return { ...prev, date: getPeriodAnchorDate(refMonth, fortnight) };
    });
  }, [refMonth, fortnight]);

  const transactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (!t.date) return false;
      const tMonth = getDateMonthPart(t.date);
      const tDay = getDateDayOfMonth(t.date);
      const tFortnight = tDay && tDay <= 15 ? 1 : 2;
      return tMonth === refMonth && tFortnight === fortnight;
    });
  }, [allTransactions, refMonth, fortnight]);

  const revenueTransactions = useMemo(() => {
    return transactions.filter(t => t.type === TransactionType.REVENUE);
  }, [transactions]);

  const result = useMemo(() => calculateDistribution(transactions), [transactions]);

  const pendingInvoicesCount = useMemo(() => {
    return transactions.filter(t => t.type === TransactionType.REVENUE && !t.issuedAt).length;
  }, [transactions]);

  const handleAddTransaction = async (openInvoice: boolean = false) => {
    try {
      setSaveFeedback(null);

      if (formData.id && formData.id !== 'manual') {
        const updated = await TransactionService.update(formData);
        setAllTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
        setSaveFeedback({
          kind: 'success',
          message: updated.type === TransactionType.EXPENSE
            ? `Despesa atualizada com sucesso. Data registrada: ${formatDisplayDate(updated.date)}.`
            : 'Receita atualizada com sucesso.'
        });
      } else {
        const newTransactionPayload = {
          ...formData,
          date: formData.date || getPeriodAnchorDate(refMonth, fortnight)
        };

        const created = await TransactionService.create(newTransactionPayload);
        setAllTransactions(prev => [...prev, created]);

        const isVisibleNow = isTransactionInCurrentView(created, refMonth, fortnight);

        if (created.type === TransactionType.EXPENSE) {
          const savedDateMessage = `Data registrada: ${formatDisplayDate(created.date)}.`;
          const locationMessage = created.linkedTransactionId && isVisibleNow
            ? 'Ela aparece em "Custos Vinculados" no deal correspondente.'
            : isVisibleNow
              ? 'Ela já está visível na lista do período atual.'
              : 'Ela pode estar fora do filtro atual.';

          setSaveFeedback({
            kind: 'success',
            message: `Despesa salva com sucesso. ${savedDateMessage} ${locationMessage}`
          });
        } else {
          setSaveFeedback({
            kind: 'success',
            message: openInvoice
              ? 'Receita salva e pronta para emissão de invoice.'
              : 'Receita adicionada ao lote atual com sucesso.'
          });
        }

        if (openInvoice && formData.type === TransactionType.REVENUE) {
          setSelectedInvoiceTransaction(created);
        }
      }

      setFormData(createFormState(refMonth, fortnight, formData.type));
      setFormResetToken(prev => prev + 1);
      if (window.innerWidth < 1024) {
        setActiveTab('dashboard');
      }
    } catch (error) {
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : 'Tente novamente.';

      setSaveFeedback({
        kind: 'error',
        message: `Erro ao salvar transação. ${errorMessage}`
      });
      alert("Erro ao salvar transação. Tente novamente.");
      console.error(error);
    }
  };

  const handleEditTransaction = (transaction: FinancialData) => {
    setSaveFeedback(null);
    setFormData(transaction);
    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setSaveFeedback(null);
    setFormData(createFormState(refMonth, fortnight, formData.type));
    setFormResetToken(prev => prev + 1);
  };

  const handleRemoveTransaction = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;

    // Optimistic UI
    const previousTransactions = [...allTransactions];
    setAllTransactions(prev => prev.filter(t => t.id !== id));

    try {
      await TransactionService.delete(id);
      if (formData.id === id) {
        handleCancelEdit();
      }
    } catch (error) {
      console.error("Error removing transaction", error);
      alert("Erro ao excluir. Tente novamente.");
      setAllTransactions(previousTransactions); // Rollback
    }
  };

  const handleClearForm = () => {
    if (confirm('Limpar os dados do formulário atual?')) {
      setSaveFeedback(null);
      setFormData(createFormState(refMonth, fortnight, formData.type));
      setFormResetToken(prev => prev + 1);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const periodLabel = useMemo(() => {
    const [year, month] = refMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return fortnight === 1 ? `1ª Quin: 01-15 ${capitalizedMonth}` : `2ª Quin: 16-fim ${capitalizedMonth}`;
  }, [refMonth, fortnight]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    let [year, month] = refMonth.split('-').map(Number);
    let newFortnight: 1 | 2 = fortnight;
    if (direction === 'prev') {
      if (fortnight === 2) newFortnight = 1;
      else { newFortnight = 2; month--; if (month === 0) { month = 12; year--; } }
    } else {
      if (fortnight === 1) newFortnight = 2;
      else { newFortnight = 1; month++; if (month === 13) { month = 1; year++; } }
    }
    setRefMonth(`${year}-${month.toString().padStart(2, '0')}`);
    setFortnight(newFortnight);
  };

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    return refMonth === getLocalMonthPart(now) && fortnight === (now.getDate() <= 15 ? 1 : 2);
  }, [refMonth, fortnight]);

  // Auth Loading Screen
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center">
        <div className="scale-125 mb-8 animate-pulse"><Logo variant="dark" /></div>
        <Loader2 className="w-8 h-8 text-[#1A1C22] animate-spin" />
        <p className="text-[#6C757D] text-xs mt-4 font-medium">Carregando...</p>
      </div>
    );
  }

  // Not Authenticated -> Show Login
  if (!session) {
    return <Login />;
  }

  // Authenticated -> Show Dashboard
  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 lg:pb-12 print:bg-white print:pb-0 font-sans">
      <div className="print:hidden">
        {/* Responsive Header - CLEAN WHITE VERSION */}
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-20 flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-0">
              <div className="scale-75 lg:scale-100 origin-left">
                <Logo variant="dark" />
              </div>
              <div className="hidden md:block w-px h-8 bg-slate-200 mx-6"></div>

              {/* Mobile/Desktop Period Navigator */}
              <div className="flex items-center gap-1 lg:gap-4 bg-[#F8F9FA] p-1 rounded-xl border border-slate-200">
                <button onClick={() => navigatePeriod('prev')} className="p-1 lg:p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-700 transition-all"><ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5" /></button>
                <div className="flex flex-col items-center min-w-[110px] lg:min-w-[180px]">
                  <p className="hidden lg:flex text-[9px] text-[#6C757D] tracking-widest uppercase font-bold items-center gap-1">{isCurrentPeriod ? 'Período Atual' : <span className="text-amber-500 flex items-center gap-1"><History className="w-2.5 h-2.5" /> Histórico</span>}</p>
                  <div className="text-[#1A1C22] font-black text-[10px] lg:text-xs tracking-tight uppercase whitespace-nowrap">{periodLabel}</div>
                </div>
                <button onClick={() => navigatePeriod('next')} className="p-1 lg:p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-700 transition-all"><ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" /></button>
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-4">
              {pendingInvoicesCount > 0 && (
                <button
                  onClick={() => setIsBatchModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#D7FF3E] hover:bg-[#cbe830] text-[#1A1C22] text-xs font-black rounded-xl shadow-lg shadow-yellow-500/10 transition-all animate-pulse"
                >
                  <Zap className="w-4 h-4" /> LOTE ({pendingInvoicesCount})
                </button>
              )}
              <button onClick={() => setSelectedInvoiceTransaction({ ...INITIAL_FORM_DATA, id: 'manual' })} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 text-[#6C757D] hover:text-[#1A1C22] text-xs rounded-lg border border-transparent hover:border-slate-200 transition-all font-medium">
                <FilePlus2 className="w-4 h-4 text-[#1A1C22]" /> Nova Invoice
              </button>
              <button onClick={() => setIsReportModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1C22] hover:bg-black text-white text-xs font-bold rounded-lg shadow-md transition-all">
                <FileBarChart className="w-4 h-4" /> Relatório
              </button>
              <button onClick={handleClearForm} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 text-[#6C757D] hover:text-[#1A1C22] text-xs rounded-lg border border-transparent hover:border-slate-200 transition-all">
                <Eraser className="w-3 h-3" /> Limpar
              </button>

              <div className="w-px h-6 bg-slate-200 mx-1"></div>

              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 text-xs rounded-lg border border-transparent hover:border-red-100 transition-colors" title="Sair do Sistema">
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Actions (Condensed) */}
            <div className="flex lg:hidden items-center gap-2">
              {pendingInvoicesCount > 0 && (
                <button onClick={() => setIsBatchModalOpen(true)} className="p-2 bg-[#D7FF3E] text-[#1A1C22] rounded-lg animate-pulse border border-[#D7FF3E]">
                  <Zap className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setIsReportModalOpen(true)} className="p-2 text-[#6C757D] hover:bg-slate-100 rounded-lg">
                <FileBarChart className="w-5 h-5" />
              </button>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">

          {loadingData && (
            <div className="mb-4 p-2 bg-blue-50 text-blue-600 rounded-lg text-center text-xs">
              Sincronizando dados...
            </div>
          )}

          {saveFeedback && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-xs font-medium ${
                saveFeedback.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {saveFeedback.message}
            </div>
          )}

          {/* Dashboard View Switcher (Desktop & Mobile if tab is dashboard) */}
          {(activeTab === 'dashboard' || window.innerWidth >= 1024) && (
            <div className="mb-6 flex items-center justify-center lg:justify-end">
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => setDashboardView('waterfall')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${dashboardView === 'waterfall' ? 'bg-[#D7FF3E] text-[#1A1C22] shadow-sm' : 'text-[#6C757D] hover:text-[#1A1C22]'}`}
                >
                  <PieChart className="w-3.5 h-3.5" />
                  Distribuição (Sócio)
                </button>
                <button
                  onClick={() => setDashboardView('pnl')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${dashboardView === 'pnl' ? 'bg-[#1A1C22] text-white shadow-sm' : 'text-[#6C757D] hover:text-[#1A1C22]'}`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  DRE / US P&L
                </button>
              </div>
            </div>
          )}

          {/* Mobile: Conditional Rendering based on Tab */}
          <div className="lg:hidden">
            {activeTab === 'form' && (
              <FinancialForm
                data={formData}
                resetToken={formResetToken}
                revenueOptions={revenueTransactions}
                onChange={setFormData}
                onAdd={handleAddTransaction}
                onCancel={handleCancelEdit}
              />
            )}
            {activeTab === 'dashboard' && (
              <div className="flex flex-col gap-6">
                {dashboardView === 'waterfall' ? (
                  <DistributionResults result={result} onGenerateReport={() => setIsReportModalOpen(true)} periodLabel={periodLabel} />
                ) : (
                  <PnLStatement transactions={transactions} periodLabel={periodLabel} />
                )}
                <TransactionList
                  transactions={transactions}
                  onRemove={handleRemoveTransaction}
                  onGenerateInvoice={setSelectedInvoiceTransaction}
                  onEdit={handleEditTransaction}
                />
              </div>
            )}
            {activeTab === 'cfo' && (
              <div className="h-[calc(100vh-140px)]">
                <CfoAssistant data={formData} result={result} periodLabel={periodLabel} />
              </div>
            )}
          </div>

          {/* Desktop: Full Grid Layout */}
          <div className="hidden lg:grid grid-cols-12 gap-6 mb-6">
            <div className="col-span-4 space-y-6">
              <FinancialForm
                data={formData}
                resetToken={formResetToken}
                revenueOptions={revenueTransactions}
                onChange={setFormData}
                onAdd={handleAddTransaction}
                onCancel={handleCancelEdit}
              />
            </div>
            <div className="col-span-8 flex flex-col gap-6">
              {dashboardView === 'waterfall' ? (
                <DistributionResults result={result} onGenerateReport={() => setIsReportModalOpen(true)} periodLabel={periodLabel} />
              ) : (
                <PnLStatement transactions={transactions} periodLabel={periodLabel} />
              )}
              <TransactionList
                transactions={transactions}
                onRemove={handleRemoveTransaction}
                onGenerateInvoice={setSelectedInvoiceTransaction}
                onEdit={handleEditTransaction}
              />
            </div>
          </div>

          <div className="hidden lg:block h-[300px]">
            <CfoAssistant data={formData} result={result} periodLabel={periodLabel} />
          </div>
        </main>

        {/* Mobile Bottom Navigation - Clean White */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-2 pb-safe z-50 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === 'form' ? 'text-[#1A1C22]' : 'text-[#6C757D] hover:text-[#1A1C22]'}`}
          >
            <PenLine className={`w-6 h-6 ${activeTab === 'form' ? 'text-[#1A1C22]' : ''}`} />
            <span className="text-[10px] font-bold uppercase">Lançar</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'text-[#1A1C22]' : 'text-[#6C757D] hover:text-[#1A1C22]'}`}
          >
            <LayoutDashboard className={`w-6 h-6 ${activeTab === 'dashboard' ? 'text-[#1A1C22]' : ''}`} />
            <span className="text-[10px] font-bold uppercase">Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('cfo')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === 'cfo' ? 'text-[#1A1C22]' : 'text-[#6C757D] hover:text-[#1A1C22]'}`}
          >
            <Bot className={`w-6 h-6 ${activeTab === 'cfo' ? 'text-[#1A1C22]' : ''}`} />
            <span className="text-[10px] font-bold uppercase">CFO AI</span>
          </button>
        </div>
      </div>

      <InvoiceModal transaction={selectedInvoiceTransaction} onClose={() => setSelectedInvoiceTransaction(null)} />
      {isReportModalOpen && (
        <ReportModal
          result={result}
          transactions={allTransactions}
          onClose={() => setIsReportModalOpen(false)}
          initialMonth={refMonth}
          initialFortnight={fortnight}
          onPeriodChange={(m, f) => { setRefMonth(m); setFortnight(f as 1 | 2); }}
        />
      )}
      {isBatchModalOpen && (
        <BatchProcessModal
          transactions={transactions}
          onClose={() => setIsBatchModalOpen(false)}
          onComplete={(updated) => {
            setAllTransactions(prev => {
              const otherTransactions = prev.filter(t => !transactions.find(ct => ct.id === t.id));
              return [...otherTransactions, ...updated];
            });
          }}
        />
      )}
    </div>
  );
}
