import React, { useState, useEffect } from 'react';
import { FinancialData, Partner, TransactionType, ClientType, TransactionStatus, ExpenseCategory, FinancialAttachment } from '../types';
import { getExchangeRate } from '../services/exchangeService';
import { formatDisplayDate, getIsoDatePart, getDateMonthPart, serializeDateInput } from '../utils/date';
import { ConfigOption, ConfigOptionsService, CONFIG_OPTION_TYPES, ConfigOptionType } from '../services/configOptionsService';
import { SelectOrCreateInput } from './SelectOrCreateInput';
import { Calculator, TrendingDown, TrendingUp, PlusCircle, FileText, Building2, UserCircle, Save, X, Wallet, CheckCircle2, Clock, Briefcase, Layers, Link as LinkIcon, PencilLine, Info, Users, Percent, DollarSign, Upload, Paperclip, Loader2, Trash2, File as FileIcon } from 'lucide-react';

interface Props {
  data: FinancialData;
  resetToken: number;
  revenueOptions: FinancialData[];
  onChange: (data: FinancialData) => void;
  onAdd: (openInvoice?: boolean) => void;
  onCancel: () => void;
}

export const FinancialForm: React.FC<Props> = ({ data, resetToken, revenueOptions, onChange, onAdd, onCancel }) => {
  const [loadingRate, setLoadingRate] = useState(false);
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [inputAmount, setInputAmount] = useState<string>('');
  const [commissionMode, setCommissionMode] = useState<'fixed' | 'percentage'>(data.commissionType || 'fixed');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [serviceOptions, setServiceOptions] = useState<ConfigOption[]>([]);
  const [expenseOptions, setExpenseOptions] = useState<ConfigOption[]>([]);
  const [originatorOptions, setOriginatorOptions] = useState<ConfigOption[]>([]);
  const [reimbursementPartyOptions, setReimbursementPartyOptions] = useState<ConfigOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const isExpense = data.type === TransactionType.EXPENSE;
  const isCompany = data.clientType === ClientType.COMPANY;
  const isEditing = !!data.id && data.id !== 'manual';
  const isCOGS = data.category === ExpenseCategory.COGS;
  const isLinked = !!data.linkedTransactionId;
  const isExternalLink = isLinked && !revenueOptions.some(r => r.id === data.linkedTransactionId);

  useEffect(() => {
    if (data.originalAmount) {
      setInputAmount(data.originalAmount.toString());
    } else {
      setInputAmount('');
    }
    setCommissionMode(data.commissionType || 'fixed');
  }, [data.id, data.type, resetToken]);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);

      try {
        await ConfigOptionsService.seedDefaultOptions();

        const [services, expenses, originators, reimbursementParties] = await Promise.all([
          ConfigOptionsService.listOptions(CONFIG_OPTION_TYPES.SERVICE_MODALITY),
          ConfigOptionsService.listOptions(CONFIG_OPTION_TYPES.EXPENSE_DESCRIPTION),
          ConfigOptionsService.listOptions(CONFIG_OPTION_TYPES.ORIGINATOR),
          ConfigOptionsService.listOptions(CONFIG_OPTION_TYPES.REIMBURSEMENT_PARTY),
        ]);

        setServiceOptions(services);
        setExpenseOptions(expenses);
        setOriginatorOptions(originators);
        setReimbursementPartyOptions(reimbursementParties);
      } catch (error) {
        console.error('Erro ao carregar opções configuráveis:', error);
        setOptionsError('Não foi possível carregar as opções salvas.');
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  useEffect(() => {
    if (commissionMode === 'percentage' && data.type === TransactionType.REVENUE) {
      const calculated = (data.grossRevenue * (data.commissionRate || 0)) / 100;
      if (Math.abs(calculated - (data.externalCommission || 0)) > 0.01) {
        onChange({ ...data, externalCommission: parseFloat(calculated.toFixed(2)) });
      }
    }
  }, [data.grossRevenue, data.commissionRate, commissionMode]);

  const handleCommissionModeChange = (mode: 'fixed' | 'percentage') => {
    setCommissionMode(mode);
    onChange({
      ...data,
      commissionType: mode,
      externalCommission: 0,
      commissionRate: 0
    });
  };

  const fetchRate = async () => {
    setLoadingRate(true);
    const rate = await getExchangeRate();
    if (rate) {
      setCurrentRate(rate);
      if (inputAmount && data.currency === 'BRL') {
        updateMainAmount(parseFloat(inputAmount), rate);
      }
    }
    setLoadingRate(false);
  };

  const handleCurrencyChange = (currency: 'USD' | 'BRL') => {
    onChange({
      ...data,
      currency,
      exchangeRate: undefined,
      originalAmount: 0,
      grossRevenue: 0,
      amount: 0
    });
    setInputAmount('');
    if (currency === 'BRL') fetchRate();
  };

  const updateMainAmount = (val: number, rate?: number) => {
    const isBRL = data.currency === 'BRL';
    const effectiveRate = rate || currentRate || 1;
    const usdValue = isBRL ? parseFloat((val / effectiveRate).toFixed(2)) : val;

    if (data.type === TransactionType.REVENUE) {
      onChange({
        ...data,
        grossRevenue: usdValue,
        originalAmount: val,
        exchangeRate: isBRL ? effectiveRate : undefined,
        exchangeSource: isBRL ? 'AwesomeAPI' : undefined
      });
    } else {
      onChange({
        ...data,
        amount: usdValue,
        originalAmount: val,
        exchangeRate: isBRL ? effectiveRate : undefined,
        exchangeSource: isBRL ? 'AwesomeAPI' : undefined
      });
    }
  };

  const handleMainAmountChange = (val: string) => {
    setInputAmount(val);
    updateMainAmount(parseFloat(val) || 0);
  };

  const handleTypeChange = (newType: TransactionType) => {
    if (newType === TransactionType.REVENUE) {
      onChange({
        ...data,
        type: newType,
        status: TransactionStatus.PAID,
        isReimbursable: false,
        category: undefined,
        linkedTransactionId: undefined,
        serviceType: '',
        amount: 0,
      });
    } else {
      onChange({
        ...data,
        type: newType,
        status: TransactionStatus.PENDING,
        category: ExpenseCategory.COGS,
        grossRevenue: 0,
        serviceType: '',
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    const files: File[] = Array.from(event.target.files);
    const totalFiles = files.length;
    const newAttachments: FinancialAttachment[] = [];
    let processedCount = 0;

    try {
      for (const file of files) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo local.'));
          reader.readAsDataURL(file);
        });

        newAttachments.push({
          name: file.name,
          url: dataUrl,
          type: file.type,
          size: file.size
        });

        processedCount++;
        setUploadProgress(Math.round((processedCount / totalFiles) * 100));
      }

      const existingAttachments = data.attachments || (data.attachmentUrl ? [{
        name: 'Documento Original',
        url: data.attachmentUrl,
        type: 'legacy'
      }] : []);

      onChange({
        ...data,
        attachments: [...existingAttachments, ...newAttachments],
        attachmentUrl: undefined
      });

    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadError('Falha ao enviar um ou mais arquivos. Tente novamente.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (event.target) event.target.value = '';
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!data.attachments) return;
    const updated = data.attachments.filter((_, idx) => idx !== indexToRemove);
    onChange({ ...data, attachments: updated });
  };

  const displayAttachments = data.attachments || (data.attachmentUrl ? [{ name: 'Anexo', url: data.attachmentUrl, type: 'file' }] : []);

  const handleRevenueLink = (revId: string) => {
    if (!revId || revId === 'manual') {
      onChange({
        ...data,
        linkedTransactionId: undefined,
        originator: Partner.NONE,
        description: isEditing ? data.description : ''
      });
      return;
    }

    const rev = revenueOptions.find(r => r.id === revId);
    if (rev) {
      onChange({
        ...data,
        linkedTransactionId: rev.id,
        originator: rev.originator,
        serviceType: `Ref: ${rev.description}`
      });
    }
  };

  const optionLabels = (options: ConfigOption[], currentValue?: string) => {
    const labels = options.map((option) => option.label);
    const normalizedCurrent = ConfigOptionsService.normalizeOptionLabel(currentValue || '');

    if (normalizedCurrent && !labels.some((label) => ConfigOptionsService.normalizeOptionLabel(label) === normalizedCurrent)) {
      return [...labels, currentValue || ''];
    }

    return labels;
  };

  const createConfigOption = async (
    type: ConfigOptionType,
    label: string,
    setOptions: React.Dispatch<React.SetStateAction<ConfigOption[]>>
  ) => {
    const created = await ConfigOptionsService.createOption(type, label);
    setOptions((current) => {
      const withoutDuplicate = current.filter(
        (option) => ConfigOptionsService.normalizeOptionLabel(option.label) !== ConfigOptionsService.normalizeOptionLabel(created.label)
      );
      return [...withoutDuplicate, created].sort((a, b) => a.label.localeCompare(b.label));
    });
    return created.label;
  };

  const isValidRevenue = !isExpense && (data.grossRevenue || 0) > 0 && data.description.trim().length > 0;
  const isValidExpense = isExpense && (data.amount || 0) > 0 && data.description.trim().length > 0 && (
    (!isCOGS || (isCOGS && data.originator !== Partner.NONE)) &&
    (!data.isReimbursable || (data.isReimbursable && !!data.reimbursementBeneficiary && data.reimbursementBeneficiary !== Partner.NONE))
  );

  const isValid = (isValidRevenue || isValidExpense) && !!data.date;
  const validationIssues: string[] = [];

  if (!data.date) validationIssues.push('defina a data');

  if (isExpense) {
    if ((data.amount || 0) <= 0) validationIssues.push('informe o valor da despesa');
    if (!data.description.trim()) validationIssues.push('descreva o gasto');
    if (isCOGS && data.originator === Partner.NONE) validationIssues.push('selecione o originador ou vincule uma receita');
    if (data.isReimbursable && (!data.reimbursementBeneficiary || data.reimbursementBeneficiary === Partner.NONE)) {
      validationIssues.push('escolha o sócio do reembolso');
    }
  } else {
    if ((data.grossRevenue || 0) <= 0) validationIssues.push('informe o valor da receita');
    if (!data.description.trim()) validationIssues.push('preencha o cliente');
  }

  const validationMessage = validationIssues.length > 0
    ? `Para continuar, ${validationIssues.join(' • ')}.`
    : null;

  return (
    <div className={`bg-white p-4 sm:p-6 lg:p-8 rounded-2xl shadow-sm border h-full flex flex-col transition-all ${isEditing ? 'border-amber-300/80 ring-2 ring-amber-100/50' : 'border-slate-200/80'}`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-7 pb-6 border-b border-slate-200/60">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-xl ${isExpense ? 'bg-red-50' : 'bg-[#D7FF3E]/20'} shadow-sm`}>
            <Calculator className={`w-5 h-5 ${isExpense ? 'text-red-600' : 'text-[#1A1C22]'}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{isEditing ? 'Editando Lançamento' : 'Novo Lançamento'}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Preencha os dados financeiros</p>
          </div>
        </div>
        {isEditing && (
          <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-700 px-3.5 py-1.5 rounded-lg border border-amber-200/50">
            Modo Edição
          </span>
        )}
      </div>

      {/* Type Selector */}
      <div className="flex bg-slate-50/80 p-1.5 rounded-xl mb-7 border border-slate-200/80 shadow-sm">
        <button
          onClick={() => handleTypeChange(TransactionType.REVENUE)}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 text-sm font-semibold rounded-lg transition-all ${data.type === TransactionType.REVENUE ? 'bg-white text-[#1A1C22] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
        >
          <TrendingUp className="w-4 h-4" /> Receita
        </button>
        <button
          onClick={() => handleTypeChange(TransactionType.EXPENSE)}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 text-sm font-semibold rounded-lg transition-all ${data.type === TransactionType.EXPENSE ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
        >
          <TrendingDown className="w-4 h-4" /> Despesa
        </button>
      </div>

      {/* Form Fields */}
      <div className="space-y-6 flex-grow overflow-y-auto px-0.5 scrollbar-hide">

        {/* Date & Status */}
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="w-full sm:w-1/3">
            <label className="text-xs font-bold text-slate-600 uppercase mb-2.5 block tracking-wide">Data</label>
            <input
              type="date"
              value={getIsoDatePart(data.date)}
              onChange={(e) => {
                const date = serializeDateInput(e.target.value);
                onChange({ ...data, date, competenceMonth: getDateMonthPart(date) });
              }}
              className="w-full px-4 py-3 border border-slate-300/80 rounded-xl text-sm font-semibold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-[#D7FF3E]/50 focus:border-[#D7FF3E] transition-all shadow-sm"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-600 uppercase mb-2.5 block tracking-wide">Status</label>
            <div className="flex gap-3">
              <button
                onClick={() => onChange({ ...data, status: TransactionStatus.PAID })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-xl text-xs font-bold transition-all shadow-sm ${data.status === TransactionStatus.PAID ? 'bg-[#D7FF3E]/20 border-[#D7FF3E] text-[#1A1C22]' : 'bg-white border-slate-300/80 text-slate-600 hover:border-slate-400 hover:bg-slate-50/50'}`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isExpense ? 'Pago' : 'Recebido'}
              </button>
              <button
                onClick={() => onChange({ ...data, status: TransactionStatus.PENDING })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-xl text-xs font-bold transition-all shadow-sm ${data.status === TransactionStatus.PENDING ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-white border-slate-300/80 text-slate-600 hover:border-slate-400 hover:bg-slate-50/50'}`}
              >
                <Clock className="w-4 h-4" />
                {isExpense ? 'Pendente' : 'A Receber'}
              </button>
            </div>
          </div>
        </div>

        {/* Currency */}
        <div className="flex items-center justify-between pt-2 pb-3 border-t border-slate-100/60">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Moeda</label>
          <div className="flex bg-slate-50/80 p-1.5 rounded-xl border border-slate-200/80 shadow-sm">
            <button
              onClick={() => handleCurrencyChange('USD')}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${data.currency === 'USD' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              USD
            </button>
            <button
              onClick={() => handleCurrencyChange('BRL')}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${data.currency === 'BRL' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              BRL
            </button>
          </div>
        </div>

        {!isExpense ? (
          // REVENUE FORM
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2.5 tracking-wide">Serviço Prestado</label>
              <SelectOrCreateInput
                value={data.serviceType || ''}
                options={optionLabels(serviceOptions, data.serviceType)}
                onChange={(value) => onChange({ ...data, serviceType: value })}
                onCreate={(label) => createConfigOption(CONFIG_OPTION_TYPES.SERVICE_MODALITY, label, setServiceOptions)}
                loading={loadingOptions}
                error={optionsError}
                placeholder="Selecione ou digite um serviço"
              />
            </div>

            <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" /> Cliente
                </h3>
                <div className="flex bg-white p-1.5 rounded-lg border border-slate-200/80 shadow-sm">
                  <button
                    onClick={() => onChange({ ...data, clientType: ClientType.INDIVIDUAL })}
                    className={`p-2 rounded-lg transition-all ${!isCompany ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    title="Pessoa Física"
                  >
                    <UserCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onChange({ ...data, clientType: ClientType.COMPANY })}
                    className={`p-2 rounded-lg transition-all ${isCompany ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    title="Pessoa Jurídica"
                  >
                    <Building2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={data.description}
                onChange={(e) => onChange({ ...data, description: e.target.value })}
                placeholder={isCompany ? "Razão Social" : "Nome do Cliente"}
                className="w-full px-4 py-3.5 border border-slate-300/80 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#D7FF3E]/50 focus:border-[#D7FF3E] bg-white transition-all font-medium shadow-sm"
              />
            </div>

            <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-200/50 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" /> Comissionamento Externo
                </h3>
                <div className="flex bg-white p-1.5 rounded-lg border border-indigo-200/80 shadow-sm">
                  <button
                    onClick={() => handleCommissionModeChange('fixed')}
                    className={`p-2 rounded-lg transition-all ${commissionMode === 'fixed' ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                    title="Valor Fixo"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCommissionModeChange('percentage')}
                    className={`p-2 rounded-lg transition-all ${commissionMode === 'percentage' ? 'bg-indigo-100 text-indigo-700' : 'text-indigo-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                    title="Porcentagem"
                  >
                    <Percent className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">
                    {commissionMode === 'percentage' ? 'Taxa (%)' : 'Valor ($)'}
                  </label>
                  {commissionMode === 'percentage' ? (
                    <div className="relative">
                      <input
                        type="number"
                        value={data.commissionRate || ''}
                        onChange={(e) => onChange({ ...data, commissionRate: parseFloat(e.target.value) })}
                        placeholder="0"
                        className="w-full px-3 py-3 border border-indigo-200/80 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400/50 text-center font-bold text-indigo-900 bg-white transition-all shadow-sm"
                      />
                      <span className="absolute right-3 top-3 text-indigo-400 text-xs font-bold">%</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        value={data.externalCommission || ''}
                        onChange={(e) => onChange({ ...data, externalCommission: parseFloat(e.target.value) })}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-3 border border-indigo-200/80 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400/50 text-center font-bold text-indigo-900 bg-white transition-all shadow-sm"
                      />
                      <span className="absolute left-3 top-3 text-indigo-400 text-xs font-bold">$</span>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">
                    {commissionMode === 'percentage' ? 'Valor Calculado' : 'Total Previsto'}
                  </label>
                  <div className="w-full px-4 py-3 bg-indigo-100/80 rounded-xl text-sm font-bold text-indigo-900 text-right border border-indigo-200/50 shadow-sm">
                    ${(data.externalCommission || 0).toFixed(2)}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wide">Beneficiário / Serviço Vinculado</label>
                <input
                  type="text"
                  value={data.externalCommissionDescription || ''}
                  onChange={(e) => onChange({ ...data, externalCommissionDescription: e.target.value })}
                  placeholder="Ex: Parceiro João - Indicação Comercial"
                  className="w-full px-4 py-3 border border-indigo-200/80 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-400/50 bg-white text-slate-700 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>
        ) : (
          // EXPENSE FORM
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-3 tracking-wide">Classificação da Despesa</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => onChange({ ...data, category: ExpenseCategory.COGS, linkedTransactionId: undefined })}
                  className={`p-4 rounded-xl border text-left transition-all shadow-sm ${data.category === ExpenseCategory.COGS ? 'bg-blue-50 border-blue-400' : 'bg-white border-slate-200/80 hover:bg-slate-50/50 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <Layers className={`w-5 h-5 ${data.category === ExpenseCategory.COGS ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold uppercase ${data.category === ExpenseCategory.COGS ? 'text-blue-800' : 'text-slate-600'}`}>
                      COGS / Direto
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">Taxas governamentais, filing fees, custos vinculados.</p>
                </button>

                <button
                  onClick={() => onChange({ ...data, category: ExpenseCategory.OPEX, linkedTransactionId: undefined, originator: Partner.NONE, serviceType: '' })}
                  className={`p-4 rounded-xl border text-left transition-all shadow-sm ${data.category === ExpenseCategory.OPEX ? 'bg-purple-50 border-purple-400' : 'bg-white border-slate-200/80 hover:bg-slate-50/50 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <Briefcase className={`w-5 h-5 ${data.category === ExpenseCategory.OPEX ? 'text-purple-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-bold uppercase ${data.category === ExpenseCategory.OPEX ? 'text-purple-800' : 'text-slate-600'}`}>
                      OpEx / Geral
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">Software, marketing, aluguel, despesas fixas.</p>
                </button>
              </div>
            </div>

            {isCOGS && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200 p-5 bg-blue-50/50 rounded-xl border border-blue-200/50 shadow-sm">
                <label className="block text-xs font-bold text-blue-700 uppercase mb-3 flex items-center gap-2 tracking-wide">
                  <LinkIcon className="w-4 h-4" /> Vinculação de Receita
                </label>
                <div className="relative mb-4">
                  <select
                    value={data.linkedTransactionId || 'manual'}
                    onChange={(e) => handleRevenueLink(e.target.value)}
                    className={`w-full px-4 py-3.5 border rounded-xl text-sm bg-white outline-none focus:ring-2 transition-all shadow-sm ${!isLinked ? 'border-blue-200/80 text-slate-600 focus:ring-blue-300/50' : 'border-blue-400 text-blue-900 font-semibold focus:ring-blue-400/50'}`}
                  >
                    <option value="manual">Sem vínculo (Outro período / Manual)</option>
                    <optgroup label="Receitas deste período">
                      {revenueOptions.map(rev => (
                        <option key={rev.id} value={rev.id}>
                          {formatDisplayDate(rev.date)} • {rev.description} (${rev.grossRevenue})
                        </option>
                      ))}
                    </optgroup>
                    {isExternalLink && (
                      <optgroup label="Vínculo Externo">
                        <option value={data.linkedTransactionId} disabled>Receita de Outro Período (ID: ...{data.linkedTransactionId?.slice(-4)})</option>
                      </optgroup>
                    )}
                  </select>
                </div>

                {!isLinked && (
                  <div className="animate-in fade-in duration-150">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-2 tracking-wide">
                      Referência do Cliente / Serviço (Manual)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={data.serviceType || ''}
                        onChange={(e) => onChange({ ...data, serviceType: e.target.value })}
                        placeholder="Ex: Ref. Cliente João Silva - Visto EB2"
                        className="w-full pl-10 pr-4 py-3 border border-slate-300/80 rounded-xl text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200/50 transition-all shadow-sm"
                      />
                      <PencilLine className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2.5 tracking-wide">Descrição do Gasto</label>
              <SelectOrCreateInput
                value={data.description}
                options={optionLabels(expenseOptions, data.description)}
                onChange={(value) => onChange({ ...data, description: value })}
                onCreate={(label) => createConfigOption(CONFIG_OPTION_TYPES.EXPENSE_DESCRIPTION, label, setExpenseOptions)}
                placeholder="Ex: Taxa Wyoming..."
                loading={loadingOptions}
                error={optionsError}
                accentClassName="focus:ring-red-400/50 focus:border-red-400"
              />
            </div>

            <div className={`p-5 rounded-xl border transition-all shadow-sm ${data.isReimbursable ? 'bg-amber-50 border-amber-300/80' : 'bg-slate-50/80 border-slate-200/80'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <Wallet className={`w-5 h-5 ${data.isReimbursable ? 'text-amber-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-bold uppercase ${data.isReimbursable ? 'text-amber-800' : 'text-slate-600'}`}>Reembolso a Sócio?</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={!!data.isReimbursable}
                    onChange={(e) => onChange({ ...data, isReimbursable: e.target.checked, reimbursementBeneficiary: e.target.checked ? data.reimbursementBeneficiary : undefined })}
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              {data.isReimbursable && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                  <SelectOrCreateInput
                    value={data.reimbursementBeneficiary || ''}
                    options={optionLabels(reimbursementPartyOptions, data.reimbursementBeneficiary)}
                    onChange={(value) => onChange({ ...data, reimbursementBeneficiary: value })}
                    onCreate={(label) => createConfigOption(CONFIG_OPTION_TYPES.REIMBURSEMENT_PARTY, label, setReimbursementPartyOptions)}
                    loading={loadingOptions}
                    error={optionsError}
                    placeholder="Selecione obrigatoriamente..."
                    accentClassName={!data.reimbursementBeneficiary ? 'focus:ring-red-400/50 focus:border-red-400' : 'focus:ring-amber-400/50 focus:border-amber-400'}
                  />
                  {!data.reimbursementBeneficiary && (
                    <p className="text-[10px] text-red-600 mt-2.5 font-semibold flex items-center gap-1.5">
                      <Info className="w-3 h-3" /> Seleção obrigatória para processar o reembolso.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="pt-3 border-t border-slate-100/60">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-2.5 tracking-wide">
            {isExpense ? 'Valor Total da Saída' : 'Valor Total da Fatura'} ({data.currency})
          </label>
          <div className="relative">
            <div className="absolute left-5 top-4 text-slate-500 font-bold text-lg">
              {data.currency === 'USD' ? '$' : 'R$'}
            </div>
            <input
              type="number"
              step="0.01"
              value={inputAmount}
              onChange={(e) => handleMainAmountChange(e.target.value)}
              className={`w-full pl-12 pr-5 py-4 border border-slate-300/80 rounded-xl font-bold text-xl outline-none transition-all shadow-sm ${isExpense ? 'focus:ring-2 focus:ring-red-400/50 focus:border-red-400 text-red-700' : 'focus:ring-2 focus:ring-[#D7FF3E]/50 focus:border-[#D7FF3E] text-slate-900'}`}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Originator */}
        {(!isExpense || (isCOGS && !isLinked)) && (
          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 shadow-sm">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-2.5 tracking-wide">
              {isExpense ? 'Originador Vinculado (Opcional)' : 'Originador (Vendedor)'}
            </label>
            <SelectOrCreateInput
              value={data.originator === Partner.NONE ? '' : data.originator}
              options={optionLabels(originatorOptions, data.originator === Partner.NONE ? undefined : data.originator)}
              onChange={(value) => onChange({ ...data, originator: value || Partner.NONE })}
              onCreate={(label) => createConfigOption(CONFIG_OPTION_TYPES.ORIGINATOR, label, setOriginatorOptions)}
              loading={loadingOptions}
              error={optionsError}
              placeholder="Selecione ou digite um originador"
              accentClassName="focus:ring-slate-400/50 focus:border-slate-400"
            />
            {isExpense && (
              <p className="text-[10px] text-slate-500 mt-2.5 flex items-center gap-1.5 leading-relaxed">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                Informativo: O custo é absorvido pela empresa, não afeta a comissão individual do sócio.
              </p>
            )}
          </div>
        )}

        {isCOGS && isLinked && data.originator && (
          <div className="flex items-center gap-2.5 bg-blue-50 p-3.5 rounded-xl border border-blue-200/50 shadow-sm">
            <LinkIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <p className="text-xs text-blue-800 font-medium">
              Custo atribuído automaticamente a: <strong>{data.originator.split(' ')[0]}</strong>
            </p>
          </div>
        )}

        {/* Upload */}
        <div className="pt-3 border-t border-slate-100/60">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-3.5 tracking-wide">Comprovantes / Documentos</label>

          <div className="relative mb-5">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
              accept="image/*,.pdf"
              multiple
            />
            <label
              htmlFor="file-upload"
              className={`flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all shadow-sm ${uploading ? 'bg-slate-50/80 border-slate-300/80 opacity-70 cursor-not-allowed' : 'border-slate-300/80 hover:border-[#D7FF3E] hover:bg-[#D7FF3E]/5'}`}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                  <div className="w-full max-w-[220px] mt-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1.5">
                      <span>Enviando...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#D7FF3E] transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-7 h-7 text-slate-400" />
                  <div className="text-center">
                    <span className="block text-sm font-semibold text-slate-700">Clique para Anexar</span>
                    <span className="text-xs text-slate-500 mt-1">PDF, Imagens (Múltiplos arquivos permitidos)</span>
                  </div>
                </>
              )}
            </label>
          </div>

          {uploadError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200/50 rounded-xl flex items-start gap-2.5 text-xs text-red-700 shadow-sm">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {displayAttachments.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">
                Arquivos Anexados ({displayAttachments.length})
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {displayAttachments.map((file, idx) => {
                  const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.url || file.name);

                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl group hover:border-slate-300 transition-all shadow-sm">
                      <div className="flex items-center gap-3.5 overflow-hidden flex-1">
                        <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200/80 bg-white flex items-center justify-center">
                          {isImage ? (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileIcon className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-semibold text-slate-800 truncate" title={file.name}>{file.name}</span>
                          <div className="flex items-center gap-2.5 mt-0.5">
                            <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                              <Paperclip className="w-3 h-3" /> Visualizar
                            </a>
                            {file.size && <span className="text-[10px] text-slate-400 border-l border-slate-300 pl-2">{(file.size / 1024).toFixed(0)} KB</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-all flex-shrink-0"
                        title="Remover anexo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {isEditing ? (
        <div className="mt-7 grid grid-cols-2 gap-4 pt-6 border-t border-slate-100/60">
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-2 py-3.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-sm"
          >
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button
            onClick={() => onAdd(false)}
            disabled={!isValid || uploading}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${isValid && !uploading ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-sm'}`}
          >
            <Save className="w-4 h-4" /> Atualizar
          </button>
        </div>
      ) : (
        <div className="mt-7">
          <button
            onClick={() => onAdd(false)}
            disabled={!isValid || uploading}
            className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-[0.98] ${isValid && !uploading ? (isExpense ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20' : 'bg-[#D7FF3E] hover:bg-[#cbe830] text-[#1A1C22] shadow-yellow-500/10') : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-sm'}`}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
            {uploading ? 'Aguarde o Upload...' : isExpense ? 'Registrar Despesa' : 'Adicionar ao Lote'}
          </button>

          {!isValid && !uploading && validationMessage && (
            <p className="mt-3 text-[11px] font-medium text-amber-700">
              {validationMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
