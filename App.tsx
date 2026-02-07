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
import { FinancialData, DistributionResult, Partner, TransactionType, PaymentMethod, ClientType, TransactionStatus } from './types';
import { calculateDistribution } from './utils/calculations';
import { Logo } from './components/Logo';
import { Eraser, FilePlus2, FileBarChart, Calendar, ChevronLeft, ChevronRight, History, Zap, LayoutDashboard, PenLine, Bot, Menu, LogOut, Loader2, Activity, PieChart } from 'lucide-react';

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

export default function App() {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // App Data State
  const [formData, setFormData] = useState<FinancialData>(INITIAL_FORM_DATA);
  const [allTransactions, setAllTransactions] = useState<FinancialData[]>(() => {
    const saved = localStorage.getItem('onebridge_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [refMonth, setRefMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [fortnight, setFortnight] = useState<1 | 2>(new Date().getDate() <= 15 ? 1 : 2);
  
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

  useEffect(() => {
    localStorage.setItem('onebridge_transactions', JSON.stringify(allTransactions));
  }, [allTransactions]);

  const transactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date);
      const tMonth = t.date.slice(0, 7);
      const tFortnight = tDate.getDate() <= 15 ? 1 : 2;
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

  const handleAddTransaction = (openInvoice: boolean = false) => {
    if (formData.id && formData.id !== 'manual') {
      setAllTransactions(prev => prev.map(t => t.id === formData.id ? { ...formData, date: t.date } : t));
    } else {
      const [year, month] = refMonth.split('-').map(Number);
      const day = fortnight === 1 ? 1 : 16;
      const date = new Date(year, month - 1, day, 12, 0, 0);

      const newTransaction = {
        ...formData,
        id: crypto.randomUUID(),
        date: date.toISOString()
      };
      
      setAllTransactions(prev => [...prev, newTransaction]);
      
      if (openInvoice && formData.type === TransactionType.REVENUE) {
        setSelectedInvoiceTransaction(newTransaction);
      }
    }

    setFormData({ ...INITIAL_FORM_DATA, type: formData.type, currency: 'USD' });
    if (window.innerWidth < 1024) {
      setActiveTab('dashboard');
    }
  };

  const handleEditTransaction = (transaction: FinancialData) => {
    setFormData(transaction);
    setActiveTab('form'); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setFormData({ ...INITIAL_FORM_DATA, type: formData.type, currency: 'USD' });
  };

  const handleRemoveTransaction = (id: string) => {
    setAllTransactions(prev => prev.filter(t => t.id !== id));
    if (formData.id === id) {
      handleCancelEdit();
    }
  };

  const handleClearForm = () => {
    if (confirm('Limpar os dados do formulário atual?')) {
      setFormData({ ...INITIAL_FORM_DATA, type: formData.type, currency: 'USD' });
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
    return refMonth === now.toISOString().slice(0, 7) && fortnight === (now.getDate() <= 15 ? 1 : 2);
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