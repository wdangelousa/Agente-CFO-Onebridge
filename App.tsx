import React, { useState, useEffect, useMemo } from 'react';
import { FinancialForm } from './components/FinancialForm';
import { DistributionResults } from './components/DistributionResults';
import { PnLStatement } from './components/PnLStatement';
import { TransactionList } from './components/TransactionList';
import { CfoAssistant } from './components/CfoAssistant';
import { InvoiceModal } from './components/InvoiceModal';
import { ReportModal } from './components/ReportModal';
import { BatchProcessModal } from './components/BatchProcessModal';
import { FinancialData, InvoiceRecord, MonthlyClosingSnapshot, PeriodClosingSnapshot, Partner, TransactionType, PaymentMethod, ClientType, TransactionStatus, ExpenseCategory } from './types';
import { calculateDistribution } from './utils/calculations';
import { createStoredDate, formatDisplayDate, getDateMonthPart, getIsoDatePart, getLocalMonthPart } from './utils/date';
import { PeriodHalf, getCurrentSemiMonthlyPeriod, getPeriodFromMonthAndHalf, getPreviousSemiMonthlyPeriod, getSemiMonthlyPeriodForDate, isDateInPeriod } from './utils/periods';
import { Logo } from './components/Logo';
import { Eraser, FilePlus2, FileBarChart, Calendar, ChevronLeft, ChevronRight, History, Zap, LayoutDashboard, PenLine, Bot, Activity, PieChart, LockKeyhole, Download, Upload, RotateCcw, FlaskConical } from 'lucide-react';
import { TransactionService } from './services/transactionService';
import { MonthlyClosingService } from './services/monthlyClosingService';
import { PeriodClosingService } from './services/periodClosingService';
import { LocalBackupService } from './services/localBackupService';
import { InvoiceService } from './services/invoiceService';
import { DemoDataService } from './services/demoDataService';

// Dev-only: demo data seeding is hidden in production builds and is never
// triggered automatically — it only runs from the manual button below.
const IS_DEV = import.meta.env.DEV;

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
const ACTIVE_PERIOD_STORAGE_KEY = 'onebridge:active-period';

const INITIAL_NOW = new Date();
const INITIAL_REF_MONTH = getLocalMonthPart(INITIAL_NOW);
const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

const readStoredPeriod = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(ACTIVE_PERIOD_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as { refMonth?: string };
    const hasValidMonth = typeof parsed.refMonth === 'string' && /^\d{4}-\d{2}$/.test(parsed.refMonth);

    if (!hasValidMonth) {
      return null;
    }

    return {
      refMonth: parsed.refMonth
    };
  } catch {
    return null;
  }
};

const getInitialPeriod = () => {
  return readStoredPeriod() || {
    refMonth: INITIAL_REF_MONTH
  };
};

const getPeriodAnchorDate = (refMonth: string) => {
  const [year, month] = refMonth.split('-').map(Number);
  return createStoredDate(year, month, 1);
};

const createFormState = (
  refMonth: string,
  type: TransactionType = TransactionType.REVENUE
): FinancialData => {
  const baseState: FinancialData = {
    ...INITIAL_FORM_DATA,
    type,
    currency: 'USD',
    date: getPeriodAnchorDate(refMonth),
    competenceMonth: refMonth
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

export default function App() {
  const initialPeriod = getInitialPeriod();

  // App Data State
  const [refMonth, setRefMonth] = useState(initialPeriod.refMonth);
  // Official closing is semi-monthly; this selects which half of refMonth is the
  // official period in focus. Defaults to the half containing today.
  const [selectedHalf, setSelectedHalf] = useState<PeriodHalf>(() => getCurrentSemiMonthlyPeriod().half);
  const [formData, setFormData] = useState<FinancialData>(() => createFormState(initialPeriod.refMonth));
  const [allTransactions, setAllTransactions] = useState<FinancialData[]>([]);
  const [periodClosings, setPeriodClosings] = useState<PeriodClosingSnapshot[]>([]);
  // Legacy monthly closings are preserved for reference only; not official.
  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosingSnapshot[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
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

  useEffect(() => {
    const loadLocalData = async () => {
      setLoadingData(true);
      try {
        const [transactions, periods, legacyClosings, localInvoices] = await Promise.all([
          TransactionService.fetchAll(),
          PeriodClosingService.fetchAll(),
          MonthlyClosingService.fetchAll(),
          InvoiceService.fetchAll(),
        ]);
        setAllTransactions(transactions);
        setPeriodClosings(periods);
        setMonthlyClosings(legacyClosings);
        setInvoices(localInvoices);
      } catch (error) {
        console.error("Failed to load local data", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadLocalData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        ACTIVE_PERIOD_STORAGE_KEY,
        JSON.stringify({ refMonth })
      );
    } catch {
      // Ignore storage failures and keep the in-memory period selection.
    }
  }, [refMonth]);

  useEffect(() => {
    setFormData(prev => {
      const isEditing = !!prev.id && prev.id !== 'manual';
      const hasDraftContent = !!prev.description.trim() || (prev.grossRevenue || 0) > 0 || (prev.amount || 0) > 0 || (prev.attachments?.length || 0) > 0;

      if (isEditing || hasDraftContent) {
        return prev;
      }

      return { ...prev, date: getPeriodAnchorDate(refMonth), competenceMonth: refMonth };
    });
  }, [refMonth]);

  const transactions = useMemo(() => {
    return allTransactions.filter(t => {
      const tMonth = t.competenceMonth || getDateMonthPart(t.date);
      return tMonth === refMonth;
    });
  }, [allTransactions, refMonth]);

  const revenueTransactions = useMemo(() => {
    return transactions.filter(t => t.type === TransactionType.REVENUE);
  }, [transactions]);

  const result = useMemo(() => calculateDistribution(transactions), [transactions]);

  const pendingInvoicesCount = useMemo(() => {
    return transactions.filter(t => {
      if (t.type !== TransactionType.REVENUE) return false;
      const invoice = invoices.find((item) => t.id && item.transactionIds.includes(t.id));
      return !invoice || invoice.status === 'draft' || invoice.status === 'cancelled';
    }).length;
  }, [invoices, transactions]);

  // Official semi-monthly period in focus (refMonth + selected half).
  const currentPeriod = useMemo(
    () => getPeriodFromMonthAndHalf(refMonth, selectedHalf),
    [refMonth, selectedHalf]
  );

  // Official closing operates on transactions dated within the period only.
  const periodTransactions = useMemo(
    () => allTransactions.filter((t) => isDateInPeriod(t.date, currentPeriod)),
    [allTransactions, currentPeriod]
  );

  const periodResult = useMemo(
    () => calculateDistribution(periodTransactions),
    [periodTransactions]
  );

  const currentClosing = useMemo(() => {
    return periodClosings.find((closing) => closing.periodKey === currentPeriod.periodKey) || null;
  }, [periodClosings, currentPeriod]);

  const closingDiffersFromLive = useMemo(() => {
    if (!currentClosing) return false;
    return Math.abs(currentClosing.totalRevenue - periodResult.realizedRevenue) > 0.01
      || Math.abs(currentClosing.totalCOGS - periodResult.totalCOGS) > 0.01
      || Math.abs(currentClosing.totalOpEx - periodResult.totalOpEx) > 0.01
      || Math.abs(currentClosing.externalCommissions - periodResult.externalCommissions) > 0.01
      || Math.abs(currentClosing.originationFee - periodResult.originationFee) > 0.01
      || Math.abs(currentClosing.reserve - periodResult.companyReserve) > 0.01
      || Math.abs(currentClosing.distributableProfit - periodResult.distributableBalance) > 0.01;
  }, [currentClosing, periodResult]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>([INITIAL_REF_MONTH]);
    allTransactions.forEach((transaction) => {
      const month = transaction.competenceMonth || getDateMonthPart(transaction.date);
      if (month) months.add(month);
    });
    periodClosings.forEach((closing) => months.add(closing.monthKey));
    monthlyClosings.forEach((closing) => months.add(closing.month));
    months.add(refMonth);
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [allTransactions, periodClosings, monthlyClosings, refMonth]);

  const handleAddTransaction = async (openInvoice: boolean = false) => {
    try {
      setSaveFeedback(null);

      let savedTransaction: FinancialData;

      if (formData.id && formData.id !== 'manual') {
        const updated = await TransactionService.update(formData);
        setAllTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
        savedTransaction = updated;
        setSaveFeedback({
          kind: 'success',
          message: updated.type === TransactionType.EXPENSE
            ? `Despesa atualizada com sucesso. Data registrada: ${formatDisplayDate(updated.date)}.`
            : 'Receita atualizada com sucesso.'
        });
      } else {
        const newTransactionPayload = {
          ...formData,
          date: formData.date || getPeriodAnchorDate(refMonth),
          competenceMonth: formData.competenceMonth || getDateMonthPart(formData.date) || refMonth
        };

        const created = await TransactionService.create(newTransactionPayload);
        setAllTransactions(prev => [...prev, created]);
        savedTransaction = created;

        if (created.type === TransactionType.EXPENSE) {
          const locationMessage = created.linkedTransactionId
            ? 'Ela aparece em "Custos Vinculados" no deal correspondente.'
            : 'Ela já está visível na lista do período.';

          setSaveFeedback({
            kind: 'success',
            message: `Despesa salva com sucesso. Data registrada: ${formatDisplayDate(created.date)}. ${locationMessage}`
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

      const targetMonth = savedTransaction.competenceMonth || getDateMonthPart(savedTransaction.date);
      if (targetMonth && targetMonth !== refMonth) {
        setRefMonth(targetMonth);
      }
      // Focus the official period that contains the saved transaction's date.
      const savedPeriod = getSemiMonthlyPeriodForDate(savedTransaction.date || getPeriodAnchorDate(targetMonth || refMonth));
      setSelectedHalf(savedPeriod.half);
      if (periodClosings.some((closing) => closing.periodKey === savedPeriod.periodKey)) {
        setSaveFeedback({
          kind: 'error',
          message: 'Esta quinzena possui um fechamento oficial salvo. A visão ao vivo pode diferir do fechamento.'
        });
      }

      const nextMonth = targetMonth || refMonth;
      setFormData(createFormState(nextMonth, formData.type));
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
    if (transaction.date) {
      const transactionPeriod = getSemiMonthlyPeriodForDate(transaction.date);
      if (periodClosings.some((closing) => closing.periodKey === transactionPeriod.periodKey)) {
        setSaveFeedback({
          kind: 'error',
          message: 'Esta quinzena possui um fechamento oficial salvo. Editar lançamentos pode criar diferença entre a visão ao vivo e o fechamento.'
        });
      }
    }
    setFormData(transaction);
    setActiveTab('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setSaveFeedback(null);
    setFormData(createFormState(refMonth, formData.type));
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
      setFormData(createFormState(refMonth, formData.type));
      setFormResetToken(prev => prev + 1);
    }
  };

  const periodLabel = useMemo(() => {
    const [year, month] = refMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${capitalizedMonth} ${year}`;
  }, [refMonth]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    let [year, month] = refMonth.split('-').map(Number);
    if (direction === 'prev') {
      month--;
      if (month === 0) {
        month = 12;
        year--;
      }
    } else {
      month++;
      if (month === 13) {
        month = 1;
        year++;
      }
    }
    setRefMonth(`${year}-${month.toString().padStart(2, '0')}`);
  };

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    return refMonth === getLocalMonthPart(now);
  }, [refMonth]);

  const handleClosePeriod = async () => {
    if (periodTransactions.length === 0) {
      alert('Não há lançamentos nesta quinzena para fechar.');
      return;
    }

    const existingText = currentClosing ? ' Isso substituirá o fechamento oficial existente desta quinzena.' : '';
    if (!confirm(`Fechar quinzena ${currentPeriod.label}?${existingText}`)) return;

    const notes = prompt('Notas opcionais do fechamento:', currentClosing?.notes || '') || undefined;
    const closing = await PeriodClosingService.closePeriod(currentPeriod, periodTransactions, periodResult, notes);
    setPeriodClosings(prev => [...prev.filter(item => item.periodKey !== currentPeriod.periodKey), closing]);
    setSaveFeedback({ kind: 'success', message: `Fechamento quinzenal oficial (${currentPeriod.label}) salvo localmente.` });
  };

  const handleExportAll = async () => {
    const json = await LocalBackupService.exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `onebridge-cfo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAll = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        await LocalBackupService.importAll(await file.text());
        const [transactions, periods, legacyClosings, localInvoices] = await Promise.all([
          TransactionService.fetchAll(),
          PeriodClosingService.fetchAll(),
          MonthlyClosingService.fetchAll(),
          InvoiceService.fetchAll(),
        ]);
        setAllTransactions(transactions);
        setPeriodClosings(periods);
        setMonthlyClosings(legacyClosings);
        setInvoices(localInvoices);
        setSaveFeedback({ kind: 'success', message: 'Backup importado com sucesso.' });
      } catch (error) {
        console.error(error);
        setSaveFeedback({ kind: 'error', message: 'Não foi possível importar o backup.' });
      }
    };
    input.click();
  };

  const handleResetLocalData = async () => {
    if (!confirm('Apagar todas as transações, fechamentos e opções locais? Esta ação não pode ser desfeita.')) return;

    await LocalBackupService.resetAll();
    setAllTransactions([]);
    setPeriodClosings([]);
    setMonthlyClosings([]);
    setInvoices([]);
    setFormData(createFormState(refMonth, formData.type));
    setFormResetToken(prev => prev + 1);
    setSaveFeedback({ kind: 'success', message: 'Dados locais reiniciados.' });
  };

  const handleSeedDemoData = async () => {
    if (!IS_DEV) return;
    if (!confirm('Substituir TODOS os dados locais por dados de demonstração (2 meses)? Esta ação não pode ser desfeita.')) return;

    try {
      await DemoDataService.seed();
      const [seededTransactions, periods, legacyClosings, localInvoices] = await Promise.all([
        TransactionService.fetchAll(),
        PeriodClosingService.fetchAll(),
        MonthlyClosingService.fetchAll(),
        InvoiceService.fetchAll(),
      ]);
      setAllTransactions(seededTransactions);
      setPeriodClosings(periods);
      setMonthlyClosings(legacyClosings);
      setInvoices(localInvoices);
      setRefMonth(DemoDataService.OPEN_MONTH_KEY);
      setFormData(createFormState(DemoDataService.OPEN_MONTH_KEY, formData.type));
      setFormResetToken(prev => prev + 1);
      setSaveFeedback({ kind: 'success', message: 'Dados de demonstração carregados (2 meses, invoices e fechamento incluídos).' });
    } catch (error) {
      console.error(error);
      setSaveFeedback({ kind: 'error', message: 'Não foi possível carregar os dados de demonstração.' });
    }
  };

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
                <select
                  value={refMonth}
                  onChange={(event) => setRefMonth(event.target.value)}
                  className="hidden lg:block bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 outline-none"
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
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
              <button onClick={handleExportAll} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 text-[#6C757D] hover:text-[#1A1C22] text-xs rounded-lg border border-transparent hover:border-slate-200 transition-all">
                <Download className="w-3 h-3" /> Exportar
              </button>
              <button onClick={handleImportAll} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-100 text-[#6C757D] hover:text-[#1A1C22] text-xs rounded-lg border border-transparent hover:border-slate-200 transition-all">
                <Upload className="w-3 h-3" /> Importar
              </button>
              <button onClick={handleResetLocalData} className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 text-xs rounded-lg border border-transparent hover:border-red-100 transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
              {IS_DEV && (
                <button onClick={handleSeedDemoData} title="Dev only: substitui os dados locais por um cenário de demonstração" className="flex items-center gap-2 px-3 py-1.5 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 text-xs rounded-lg border border-dashed border-indigo-200 hover:border-indigo-300 transition-colors">
                  <FlaskConical className="w-3 h-3" /> Demo
                </button>
              )}
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
              <button onClick={handleExportAll} className="p-2 text-[#6C757D] hover:bg-slate-100 rounded-lg">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8">

          {loadingData && (
            <div className="mb-4 p-2 bg-blue-50 text-blue-600 rounded-lg text-center text-xs">
              Carregando dados locais...
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

          <div className="mb-6 overflow-hidden rounded-xl border border-[#D8B98B]/40 bg-white shadow-sm">
            <div className="border-b border-[#E7DED0] bg-[#102033] px-5 py-4 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#D8B98B]">Resumo Gerencial Mensal · Não é fechamento oficial</p>
                  <h1 className="mt-1 text-xl font-black tracking-tight">{periodLabel}</h1>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Receita realizada', result.realizedRevenue],
                    ['Lucro bruto', result.grossMargin],
                    ['Lucro operacional', result.netIncome],
                    ['Distribuível', result.distributableBalance],
                  ].map(([label, value]) => (
                    <div key={label as string} className="min-w-[120px] rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-300">{label as string}</p>
                      <p className="mt-1 font-mono text-sm font-black text-white">{formatCurrency(value as number)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="p-5">
                <div className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase">
                  {currentClosing ? <LockKeyhole className="w-4 h-4 text-[#B9824A]" /> : <Calendar className="w-4 h-4 text-slate-500" />}
                  Fechamento Quinzenal (Oficial)
                </div>

                {/* Semi-monthly period selector */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {(['H1', 'H2'] as PeriodHalf[]).map((half) => (
                      <button
                        key={half}
                        onClick={() => setSelectedHalf(half)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${selectedHalf === half ? 'bg-[#102033] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        {half === 'H1' ? '1ª Quinzena (1–15)' : '2ª Quinzena (16–fim)'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { const p = getCurrentSemiMonthlyPeriod(); setRefMonth(p.monthKey); setSelectedHalf(p.half); }}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
                  >
                    Período atual
                  </button>
                  <button
                    onClick={() => { const prev = getPreviousSemiMonthlyPeriod(currentPeriod); setRefMonth(prev.monthKey); setSelectedHalf(prev.half); }}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-md border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
                  >
                    Período anterior
                  </button>
                </div>

                <p className="mt-2 text-xs font-bold text-slate-700">{currentPeriod.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {currentClosing
                    ? `Fechado em ${formatDisplayDate(currentClosing.closedAt)}. Oficial: ${formatCurrency(currentClosing.distributableProfit)} distribuível.`
                    : 'Esta quinzena ainda não possui fechamento oficial salvo.'}
                </p>
                {currentClosing && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-600 lg:grid-cols-4">
                    <span>Live receita: {formatCurrency(periodResult.realizedRevenue)}</span>
                    <span>Oficial receita: {formatCurrency(currentClosing.totalRevenue)}</span>
                    <span>Live distrib.: {formatCurrency(periodResult.distributableBalance)}</span>
                    <span>Oficial distrib.: {formatCurrency(currentClosing.distributableProfit)}</span>
                  </div>
                )}
                {closingDiffersFromLive && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                    A visão ao vivo difere do fechamento oficial salvo.
                  </div>
                )}
                <p className="mt-3 text-[10px] font-semibold text-amber-700">
                  Local-first mode: seus dados ficam salvos neste navegador. Exporte backups regulares para preservar o histórico financeiro.
                </p>
              </div>
              <div className="px-5 pb-5 lg:pb-0">
                <div className="mb-3 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                  <span>Reserva: <b className="text-slate-900">{formatCurrency(periodResult.companyReserve)}</b></span>
                  <span>Payables: <b className="text-slate-900">{formatCurrency(periodResult.pendingPayables)}</b></span>
                  <span>Invoices pendentes: <b className="text-slate-900">{pendingInvoicesCount}</b></span>
                  <span>Transações (quinzena): <b className="text-slate-900">{periodTransactions.length}</b></span>
                </div>
                <button
                  onClick={handleClosePeriod}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#102033] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#071425] lg:w-auto"
                >
                  <LockKeyhole className="w-4 h-4 text-[#D8B98B]" /> Fechar quinzena
                </button>
              </div>
            </div>
          </div>

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
                  invoices={invoices}
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
                invoices={invoices}
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

      <InvoiceModal
        transaction={selectedInvoiceTransaction}
        invoice={invoices.find((invoice) => selectedInvoiceTransaction?.id && invoice.transactionIds.includes(selectedInvoiceTransaction.id)) || null}
        onInvoiceSaved={async (invoice, transactionUpdate) => {
          setInvoices(prev => [...prev.filter(item => item.id !== invoice.id), invoice]);
          if (transactionUpdate) {
            const updated = await TransactionService.update(transactionUpdate);
            setAllTransactions(prev => prev.map(transaction => transaction.id === updated.id ? updated : transaction));
            setSelectedInvoiceTransaction(updated);
          }
        }}
        onClose={() => setSelectedInvoiceTransaction(null)}
      />
      {isReportModalOpen && (
        <ReportModal
          result={periodResult}
          transactions={allTransactions}
          periodClosings={periodClosings}
          onClose={() => setIsReportModalOpen(false)}
          initialMonth={refMonth}
          initialHalf={selectedHalf}
          onPeriodChange={(month) => { setRefMonth(month); }}
        />
      )}
      {isBatchModalOpen && (
        <BatchProcessModal
          transactions={transactions}
          invoices={invoices}
          onClose={() => setIsBatchModalOpen(false)}
          onComplete={async (updated, updatedInvoices) => {
            await TransactionService.upsertMany(updated);
            await InvoiceService.replaceAll(updatedInvoices);
            setInvoices(updatedInvoices);
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
