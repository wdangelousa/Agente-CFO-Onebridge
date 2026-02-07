import React, { useState, useEffect } from 'react';
import { FinancialData, Partner, TransactionType, ClientType, TransactionStatus, ExpenseCategory, FinancialAttachment } from '../types';
import { getExchangeRate } from '../services/exchangeService';
import { supabase } from '../supabaseClient';
import { Calculator, TrendingDown, TrendingUp, PlusCircle, FileText, Building2, UserCircle, Save, X, Wallet, CheckCircle2, Clock, Briefcase, Layers, Link as LinkIcon, AlertCircle, PencilLine, Info, Users, Percent, DollarSign, Upload, Paperclip, Loader2, Trash2, File as FileIcon, Image as ImageIcon } from 'lucide-react';

interface Props {
  data: FinancialData;
  revenueOptions: FinancialData[]; // Lista de receitas disponíveis para vínculo
  onChange: (data: FinancialData) => void;
  onAdd: (openInvoice?: boolean) => void;
  onCancel: () => void;
}

const SERVICES_LIST = [
  "Abertura Conta Bancária", "Abertura Delaware", "Abertura Flórida", "Abertura Off Shore B.V.I",
  "Abertura Wyoming", "Agente Registrado DE", "Agente Registrado FL", "Agente Registrado WY",
  "Apostilamento e Tradução", "Business Plan", "Compliance Anual Flórida", "Compliance B.V.I",
  "Compliance Delaware CORP", "Compliance Delaware LLC", "Compliance Wyoming",
  "Consultoria Contadores (hora)", "Customização Documentos", "Dissolução Delaware",
  "Dissolução Flórida", "Dissolução Wyoming", "Mudanças/Amendments", "Planej.Tributário Avançado",
  "Planej.Tributário Básico", "Registro Marca USPTO p/ classe", "Visto EB-1", "Visto EB-2",
  "Visto EB-3", "Visto E-2", "Visto L-1", "Visto O-1", "Visto - RFE", "Visto - Appeal / Motion", "Visto - Refile"
];

const EXPENSE_TYPES = [
  "Taxa Governamental (Filing Fee)", "Apostilamento", "Tradução Juramentada", "Certidão de Good Standing",
  "Honorários Parceiros", "Marketing / Ads", "Software / Assinaturas", "Reembolso de Viagem", "Material de Escritório", "Contabilidade"
];

export const FinancialForm: React.FC<Props> = ({ data, revenueOptions, onChange, onAdd, onCancel }) => {
  const [loadingRate, setLoadingRate] = useState(false);
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [inputAmount, setInputAmount] = useState<string>(''); 
  const [commissionMode, setCommissionMode] = useState<'fixed' | 'percentage'>(data.commissionType || 'fixed');
  
  // Upload State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isExpense = data.type === TransactionType.EXPENSE;
  const isCompany = data.clientType === ClientType.COMPANY;
  const isEditing = !!data.id && data.id !== 'manual';
  const isCOGS = data.category === ExpenseCategory.COGS;
  const isLinked = !!data.linkedTransactionId;

  // QA Check: Verify if linked transaction exists in current options
  const isExternalLink = isLinked && !revenueOptions.some(r => r.id === data.linkedTransactionId);

  useEffect(() => {
    if (data.originalAmount) {
      setInputAmount(data.originalAmount.toString());
    } else {
      setInputAmount('');
    }
    setCommissionMode(data.commissionType || 'fixed');
  }, [data.id, data.type]);

  // Recalculate External Commission if Gross Revenue changes while in Percentage Mode
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

  // --- REFACTORED UPLOAD LOGIC ---
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
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        newAttachments.push({
          name: file.name,
          url: publicUrlData.publicUrl,
          type: file.type,
          size: file.size
        });

        processedCount++;
        setUploadProgress(Math.round((processedCount / totalFiles) * 100));
      }

      // Update state: combine existing attachments with new ones
      const existingAttachments = data.attachments || (data.attachmentUrl ? [{
        name: 'Documento Original',
        url: data.attachmentUrl,
        type: 'legacy'
      }] : []);

      onChange({ 
        ...data, 
        attachments: [...existingAttachments, ...newAttachments],
        attachmentUrl: undefined // Clear legacy field if we are using the new array
      });

    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadError('Falha ao enviar um ou mais arquivos. Tente novamente.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset input value to allow re-uploading same file if needed
      if (event.target) event.target.value = ''; 
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    if (!data.attachments) return;
    const updated = data.attachments.filter((_, idx) => idx !== indexToRemove);
    onChange({ ...data, attachments: updated });
  };

  // Normalize attachments for display (handling legacy single url)
  const displayAttachments = data.attachments || (data.attachmentUrl ? [{ name: 'Anexo', url: data.attachmentUrl, type: 'file' }] : []);

  // Logic to handle linking revenue
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

  const isValidRevenue = !isExpense && (data.grossRevenue || 0) > 0 && data.description.trim().length > 0;
  const isValidExpense = isExpense && (data.amount || 0) > 0 && data.description.trim().length > 0 && (
      (!isCOGS || (isCOGS && data.originator !== Partner.NONE)) &&
      (!data.isReimbursable || (data.isReimbursable && !!data.reimbursementBeneficiary && data.reimbursementBeneficiary !== Partner.NONE))
  );

  const isValid = (isValidRevenue || isValidExpense) && !!data.date;

  return (
    <div className={`bg-white p-4 lg:p-6 rounded-xl shadow-sm border h-full flex flex-col transition-colors ${isEditing ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-6 text-[#1A1C22] border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isExpense ? 'bg-red-50' : 'bg-[#D7FF3E]/20'}`}>
            <Calculator className={`w-5 h-5 ${isExpense ? 'text-red-600' : 'text-[#1A1C22]'}`} />
          </div>
          <h2 className="text-lg font-bold">{isEditing ? 'Editando' : 'Novo Lançamento'}</h2>
        </div>
        {isEditing && (
          <span className="text-[10px] font-black uppercase bg-amber-100 text-amber-600 px-2 py-1 rounded">Modo Edição</span>
        )}
      </div>

      <div className="flex bg-[#F8F9FA] p-1 rounded-lg mb-6">
        <button onClick={() => handleTypeChange(TransactionType.REVENUE)} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${data.type === TransactionType.REVENUE ? 'bg-white text-[#1A1C22] shadow-sm ring-1 ring-[#1A1C22]' : 'text-[#6C757D] hover:text-[#1A1C22]'}`}>
          <TrendingUp className="w-4 h-4" /> Receita
        </button>
        <button onClick={() => handleTypeChange(TransactionType.EXPENSE)} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${data.type === TransactionType.EXPENSE ? 'bg-white text-red-700 shadow-sm ring-1 ring-red-200' : 'text-[#6C757D] hover:text-slate-700'}`}>
          <TrendingDown className="w-4 h-4" /> Despesa
        </button>
      </div>

      <div className="space-y-5 flex-grow overflow-y-auto px-1 scrollbar-hide">
        
        {/* Date & Status Row - Responsive Stack */}
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-1/3">
               <label className="text-xs font-bold text-[#6C757D] uppercase mb-1 block">Data</label>
               <input 
                 type="date" 
                 value={data.date ? data.date.split('T')[0] : ''} 
                 onChange={(e) => onChange({...data, date: new Date(e.target.value).toISOString()})}
                 className="w-full px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold text-[#1A1C22] outline-none focus:ring-2 focus:ring-[#D7FF3E]"
               />
            </div>
            <div className="flex-1">
               <label className="text-xs font-bold text-[#6C757D] uppercase mb-1 block">Status</label>
               <div className="flex gap-2">
                  <button onClick={() => onChange({...data, status: TransactionStatus.PAID})} className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded-lg text-xs font-bold transition-all ${data.status === TransactionStatus.PAID ? 'bg-[#D7FF3E]/20 border-[#D7FF3E] text-[#1A1C22]' : 'bg-white border-slate-200 text-[#6C757D] hover:border-slate-300'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isExpense ? 'Pago' : 'Recebido'}
                  </button>
                  <button onClick={() => onChange({...data, status: TransactionStatus.PENDING})} className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded-lg text-xs font-bold transition-all ${data.status === TransactionStatus.PENDING ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-white border-slate-200 text-[#6C757D] hover:border-slate-300'}`}>
                    <Clock className="w-3.5 h-3.5" />
                    {isExpense ? 'Pendente' : 'A Receber'}
                  </button>
               </div>
            </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
           <label className="text-xs font-bold text-[#6C757D] uppercase">Moeda</label>
           <div className="flex bg-[#F8F9FA] p-0.5 rounded-lg border border-slate-200">
              <button onClick={() => handleCurrencyChange('USD')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${data.currency === 'USD' ? 'bg-white shadow-sm text-[#1A1C22]' : 'text-[#6C757D]'}`}>USD</button>
              <button onClick={() => handleCurrencyChange('BRL')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${data.currency === 'BRL' ? 'bg-white shadow-sm text-[#1A1C22]' : 'text-[#6C757D]'}`}>BRL</button>
           </div>
        </div>

        {!isExpense ? (
          // --- REVENUE FORM ---
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#6C757D] uppercase mb-1">Serviço Prestado</label>
              <select value={data.serviceType || ''} onChange={(e) => onChange({...data, serviceType: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-[#D7FF3E]">
                <option value="" disabled>Selecione...</option>
                {SERVICES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div className="bg-[#F8F9FA] p-4 rounded-xl border border-slate-200 space-y-3">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-[#1A1C22] uppercase tracking-widest flex items-center gap-1.5"><FileText className="w-3 h-3" /> Cliente</h3>
                  <div className="flex bg-white/50 p-0.5 rounded border border-slate-200">
                    <button onClick={() => onChange({...data, clientType: ClientType.INDIVIDUAL})} className={`p-1 rounded ${!isCompany ? 'bg-white text-[#1A1C22] shadow-xs' : 'text-[#6C757D]'}`}><UserCircle className="w-3.5 h-3.5" /></button>
                    <button onClick={() => onChange({...data, clientType: ClientType.COMPANY})} className={`p-1 rounded ${isCompany ? 'bg-white text-[#1A1C22] shadow-xs' : 'text-[#6C757D]'}`}><Building2 className="w-3.5 h-3.5" /></button>
                  </div>
               </div>
               <input type="text" value={data.description} onChange={(e) => onChange({...data, description: e.target.value})} placeholder={isCompany ? "Razão Social" : "Nome do Cliente"} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#D7FF3E] bg-white" />
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
               <div className="flex items-center justify-between">
                 <h3 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5"><Users className="w-3 h-3" /> Comissionamento Externo</h3>
                 <div className="flex bg-white/50 p-0.5 rounded border border-indigo-200">
                   <button onClick={() => handleCommissionModeChange('fixed')} className={`p-1 rounded ${commissionMode === 'fixed' ? 'bg-white text-indigo-600 shadow-xs' : 'text-indigo-300'}`} title="Valor Fixo"><DollarSign className="w-3.5 h-3.5" /></button>
                   <button onClick={() => handleCommissionModeChange('percentage')} className={`p-1 rounded ${commissionMode === 'percentage' ? 'bg-white text-indigo-600 shadow-xs' : 'text-indigo-300'}`} title="Porcentagem"><Percent className="w-3.5 h-3.5" /></button>
                 </div>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                 <div className="col-span-1">
                   <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                     {commissionMode === 'percentage' ? 'Taxa (%)' : 'Valor ($)'}
                   </label>
                   {commissionMode === 'percentage' ? (
                     <div className="relative">
                       <input 
                         type="number" 
                         value={data.commissionRate || ''} 
                         onChange={(e) => onChange({...data, commissionRate: parseFloat(e.target.value)})}
                         placeholder="0%" 
                         className="w-full px-2 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-center font-bold text-indigo-800 bg-white" 
                       />
                       <span className="absolute right-2 top-2 text-indigo-300 text-xs">%</span>
                     </div>
                   ) : (
                     <div className="relative">
                       <input 
                         type="number" 
                         value={data.externalCommission || ''} 
                         onChange={(e) => onChange({...data, externalCommission: parseFloat(e.target.value)})}
                         placeholder="$0.00" 
                         className="w-full px-2 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-center font-bold text-indigo-800 bg-white" 
                       />
                       <span className="absolute left-2 top-2 text-indigo-300 text-xs">$</span>
                     </div>
                   )}
                 </div>
                 <div className="col-span-2">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                      {commissionMode === 'percentage' ? 'Valor Calculado' : 'Total Previsto'}
                    </label>
                    <div className="w-full px-3 py-2 bg-indigo-100 rounded-lg text-sm font-black text-indigo-900 text-right border border-indigo-200">
                       ${(data.externalCommission || 0).toFixed(2)}
                    </div>
                 </div>
               </div>
               <div>
                 <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1.5">Beneficiário / Serviço Vinculado</label>
                 <input 
                   type="text" 
                   value={data.externalCommissionDescription || ''} 
                   onChange={(e) => onChange({...data, externalCommissionDescription: e.target.value})} 
                   placeholder="Ex: Parceiro João - Indicação Comercial" 
                   className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700" 
                 />
               </div>
            </div>
          </div>
        ) : (
          // --- EXPENSE FORM ---
          <div className="space-y-4">
             <div>
                <label className="block text-xs font-bold text-[#6C757D] uppercase mb-2">Classificação da Despesa</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <button 
                     onClick={() => onChange({...data, category: ExpenseCategory.COGS, linkedTransactionId: undefined})}
                     className={`p-3 rounded-lg border text-left transition-all ${data.category === ExpenseCategory.COGS ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                   >
                      <div className="flex items-center gap-2 mb-1">
                         <Layers className={`w-4 h-4 ${data.category === ExpenseCategory.COGS ? 'text-blue-600' : 'text-slate-400'}`} />
                         <span className={`text-xs font-black uppercase ${data.category === ExpenseCategory.COGS ? 'text-blue-700' : 'text-slate-600'}`}>COGS / Direto</span>
                      </div>
                      <p className="text-[9px] text-[#6C757D] leading-tight">Taxas governamentais, filing fees, custos vinculados.</p>
                   </button>
                   
                   <button 
                     onClick={() => onChange({...data, category: ExpenseCategory.OPEX, linkedTransactionId: undefined, originator: Partner.NONE, serviceType: ''})}
                     className={`p-3 rounded-lg border text-left transition-all ${data.category === ExpenseCategory.OPEX ? 'bg-purple-50 border-purple-500 ring-1 ring-purple-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                   >
                      <div className="flex items-center gap-2 mb-1">
                         <Briefcase className={`w-4 h-4 ${data.category === ExpenseCategory.OPEX ? 'text-purple-600' : 'text-slate-400'}`} />
                         <span className={`text-xs font-black uppercase ${data.category === ExpenseCategory.OPEX ? 'text-purple-700' : 'text-slate-600'}`}>OpEx / Geral</span>
                      </div>
                      <p className="text-[9px] text-[#6C757D] leading-tight">Software, marketing, aluguel, despesas fixas.</p>
                   </button>
                </div>
             </div>

             {isCOGS && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                    <label className="block text-xs font-bold text-blue-600 uppercase mb-1 flex items-center gap-1.5">
                       <LinkIcon className="w-3.5 h-3.5" /> Vinculação de Receita
                    </label>
                    <div className="relative mb-3">
                      <select 
                        value={data.linkedTransactionId || 'manual'} 
                        onChange={(e) => handleRevenueLink(e.target.value)}
                        className={`w-full px-3 py-2.5 border rounded-lg text-xs bg-white outline-none focus:ring-2 transition-all ${!isLinked ? 'border-blue-300 text-slate-600' : 'border-blue-500 text-blue-800 font-bold'}`}
                      >
                         <option value="manual">Sem vínculo (Outro período / Manual)</option>
                         <optgroup label="Receitas deste período">
                           {revenueOptions.map(rev => (
                             <option key={rev.id} value={rev.id}>
                                {rev.date?.split('T')[0].split('-').reverse().join('/')} • {rev.description} (${rev.grossRevenue})
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
                      <div className="animate-in fade-in duration-200">
                         <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Referência do Cliente / Serviço (Manual)
                         </label>
                         <div className="relative">
                           <input 
                              type="text" 
                              value={data.serviceType || ''} 
                              onChange={(e) => onChange({...data, serviceType: e.target.value})}
                              placeholder="Ex: Ref. Cliente João Silva - Visto EB2"
                              className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                           />
                           <PencilLine className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                         </div>
                      </div>
                    )}
                </div>
             )}

            <div>
              <label className="block text-xs font-bold text-[#6C757D] uppercase mb-1">Descrição do Gasto</label>
              <input type="text" list="expense-list" value={data.description} onChange={(e) => onChange({...data, description: e.target.value})} placeholder="Ex: Taxa Wyoming..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 shadow-xs" />
              <datalist id="expense-list">{EXPENSE_TYPES.map(e => <option key={e} value={e} />)}</datalist>
            </div>

            <div className={`p-4 rounded-xl border transition-all ${data.isReimbursable ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                      <Wallet className={`w-4 h-4 ${data.isReimbursable ? 'text-amber-600' : 'text-slate-400'}`} />
                      <span className={`text-xs font-bold uppercase ${data.isReimbursable ? 'text-amber-700' : 'text-slate-500'}`}>Reembolso a Sócio?</span>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={!!data.isReimbursable} onChange={(e) => onChange({...data, isReimbursable: e.target.checked, reimbursementBeneficiary: e.target.checked ? data.reimbursementBeneficiary : undefined})} />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                   </label>
                </div>
                {data.isReimbursable && (
                   <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <select 
                        value={data.reimbursementBeneficiary || ''} 
                        onChange={(e) => onChange({...data, reimbursementBeneficiary: e.target.value as Partner})} 
                        className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 transition-colors ${!data.reimbursementBeneficiary ? 'border-red-300 bg-red-50 text-red-600 focus:ring-red-500' : 'border-amber-300 bg-white text-slate-700 focus:ring-amber-500'}`}
                      >
                         <option value="" disabled>Selecione OBRIGATORIAMENTE...</option>
                         {Object.values(Partner).filter(p => p !== Partner.NONE).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {!data.reimbursementBeneficiary && <p className="text-[10px] text-red-500 mt-1 font-bold">* Seleção obrigatória para processar o reembolso.</p>}
                   </div>
                )}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-[#6C757D] uppercase mb-1">{isExpense ? 'Valor Total da Saída' : 'Valor Total da Fatura'} ({data.currency})</label>
          <div className="relative">
            <div className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">{data.currency === 'USD' ? '$' : 'R$'}</div>
            <input type="number" step="0.01" value={inputAmount} onChange={(e) => handleMainAmountChange(e.target.value)} className={`w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg font-bold text-lg outline-none transition-all ${isExpense ? 'focus:ring-red-500 text-red-700' : 'focus:ring-[#D7FF3E] text-[#1A1C22] shadow-inner'}`} placeholder="0.00" />
          </div>
        </div>

        {(!isExpense || (isCOGS && !isLinked)) && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                   {isExpense ? 'Originador Vinculado (Opcional)' : 'Originador (Vendedor)'}
                </label>
                <select value={data.originator} onChange={(e) => onChange({...data, originator: e.target.value as Partner})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-slate-400">
                  <option value={Partner.NONE} disabled>Selecione...</option>
                  {Object.values(Partner).filter(p => p !== Partner.NONE).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {isExpense && (
                   <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                     <Info className="w-3 h-3" />
                     Informativo: O custo é absorvido pela empresa, não afeta a comissão individual do sócio.
                   </p>
                )}
            </div>
        )}
        
        {isCOGS && isLinked && data.originator && (
           <div className="flex items-center gap-2 bg-blue-50 p-2 rounded border border-blue-100">
              <LinkIcon className="w-3 h-3 text-blue-500" />
              <p className="text-[10px] text-blue-700">
                 Custo atribuído automaticamente a: <strong>{data.originator.split(' ')[0]}</strong>
              </p>
           </div>
        )}

        {/* --- REFACTORED UPLOAD SECTION --- */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-bold text-[#6C757D] uppercase mb-2">Comprovantes / Documentos</label>
          
          <div className="relative mb-4">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
              accept="image/*,.pdf"
              multiple // Allow multiple files
            />
            <label 
              htmlFor="file-upload" 
              className={`flex flex-col items-center justify-center gap-2 w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${uploading ? 'bg-slate-50 border-slate-300 opacity-80 cursor-not-allowed' : 'border-slate-300 hover:border-[#D7FF3E] hover:bg-[#D7FF3E]/10'}`}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-[#1A1C22]" />
                  <div className="w-full max-w-[200px] mt-2">
                     <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Enviando...</span>
                        <span>{uploadProgress}%</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#D7FF3E] transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                     </div>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-slate-400" />
                  <div className="text-center">
                    <span className="block text-sm font-bold text-[#6C757D]">Clique para Anexar</span>
                    <span className="text-[10px] text-slate-400">PDF, Imagens (Múltiplos arquivos permitidos)</span>
                  </div>
                </>
              )}
            </label>
          </div>

          {uploadError && (
             <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {uploadError}
             </div>
          )}

          {/* List of Attached Files */}
          {displayAttachments.length > 0 && (
            <div className="space-y-2">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Arquivos Anexados ({displayAttachments.length})</p>
               <div className="grid grid-cols-1 gap-2">
                 {displayAttachments.map((file, idx) => {
                    const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.url || file.name);

                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg group hover:border-[#D7FF3E] transition-colors">
                         <div className="flex items-center gap-3 overflow-hidden">
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center">
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
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-[#1A1C22] truncate" title={file.name}>{file.name}</span>
                              <div className="flex items-center gap-2">
                                 <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#6C757D] hover:underline flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" /> Visualizar
                                 </a>
                                 {file.size && <span className="text-[9px] text-slate-400 border-l border-slate-300 pl-2">{(file.size / 1024).toFixed(0)} KB</span>}
                              </div>
                            </div>
                         </div>
                         <button 
                           onClick={() => removeAttachment(idx)}
                           className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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

      {isEditing ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm transition-all active:scale-95">
             <X className="w-4 h-4" /> Cancelar
          </button>
          <button onClick={() => onAdd(false)} disabled={!isValid || uploading} className={`flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95 ${isValid && !uploading ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}>
             <Save className="w-4 h-4" /> Atualizar
          </button>
        </div>
      ) : (
        <button onClick={() => onAdd(false)} disabled={!isValid || uploading} className={`mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all shadow-lg active:scale-95 ${isValid && !uploading ? (isExpense ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#D7FF3E] hover:bg-[#cbe830] text-[#1A1C22] shadow-yellow-500/10') : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}>
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
          {uploading ? 'Aguarde o Upload...' : 'Adicionar ao Lote'}
        </button>
      )}
    </div>
  );
};