
import React, { useState, useEffect } from 'react';
import { FinancialData, InvoiceRecord, InvoiceStatus, PaymentMethod } from '../types';
import { Logo } from './Logo';
import { InvoiceService } from '../services/invoiceService';
import { X, Printer, Download, CreditCard, Smartphone, Landmark, QrCode, CheckCircle2, Loader2, Share2, PencilLine } from 'lucide-react';

interface Props {
  transaction: FinancialData | null;
  invoice: InvoiceRecord | null;
  onInvoiceSaved: (invoice: InvoiceRecord, transactionUpdate?: FinancialData) => Promise<void> | void;
  onClose: () => void;
}

export const InvoiceModal: React.FC<Props> = ({ transaction, invoice, onInvoiceSaved, onClose }) => {
  const [localInvoice, setLocalInvoice] = useState<InvoiceRecord | null>(invoice);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  
  // Client Data States (Editable directly on Invoice)
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [stakeholdersNotified, setStakeholdersNotified] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadInvoice = async () => {
      if (!transaction) return;

      const existingInvoice = invoice || (transaction.id && transaction.id !== 'manual'
        ? await InvoiceService.getOrCreateForTransaction(transaction)
        : null);

      if (!isMounted) return;

      const today = new Date();
      const due = new Date();
      due.setDate(today.getDate() + 14);
      const activeInvoice = existingInvoice;

      setLocalInvoice(activeInvoice);
      setInvoiceNumber(activeInvoice?.invoiceNumber || `OBS-${today.getFullYear()}-PREVIEW`);
      setIssueDate(activeInvoice?.issuedAt ? activeInvoice.issuedAt.split('T')[0] : today.toISOString().split('T')[0]);
      setDueDate(activeInvoice?.dueDate || due.toISOString().split('T')[0]);
      setStatus(activeInvoice?.status || 'draft');
      setClientName(activeInvoice?.clientName || transaction.description);
      setClientAddress(transaction.clientAddress || '');
      setClientTaxId(transaction.clientTaxId || '');
      setClientEmail(transaction.clientEmail || '');
      setResponsibleName(transaction.responsibleName || '');
      setServiceDescription(activeInvoice?.description || transaction.serviceType || 'Professional Services');
      setStakeholdersNotified(activeInvoice?.status === 'issued' || activeInvoice?.status === 'paid');
    };

    loadInvoice();

    return () => {
      isMounted = false;
    };
  }, [invoice, transaction]);

  useEffect(() => {
    if (transaction) {
      setStakeholdersNotified(status === 'issued' || status === 'paid');
    }
  }, [status, transaction]);

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const persistInvoice = async (nextStatus: InvoiceStatus = status) => {
    if (!transaction || !transaction.id || transaction.id === 'manual') {
      alert('Salve a receita antes de protocolar a invoice.');
      return;
    }

    setSavingInvoice(true);
    try {
      const issuedAtIso = `${issueDate}T12:00:00.000Z`;
      const saved = await InvoiceService.issueForTransaction(transaction, {
        status: nextStatus,
        issuedAt: localInvoice?.issuedAt || issuedAtIso,
        dueDate,
        clientName,
        payerName: clientName,
        description: serviceDescription,
        subtotal: transaction.grossRevenue,
        total: transaction.grossRevenue,
        currency: transaction.currency || 'USD',
      });

      const transactionUpdate = {
        ...transaction,
        invoiceId: saved.id,
        invoiceNumber: saved.invoiceNumber,
        issuedAt: saved.issuedAt,
      };

      setLocalInvoice(saved);
      setInvoiceNumber(saved.invoiceNumber);
      setStatus(saved.status);
      setStakeholdersNotified(saved.status === 'issued' || saved.status === 'paid');
      await onInvoiceSaved(saved, transactionUpdate);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar invoice localmente.');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleStatusChange = async (nextStatus: InvoiceStatus) => {
    if (!localInvoice) {
      await persistInvoice(nextStatus);
      return;
    }

    const updated = await InvoiceService.update({
      ...localInvoice,
      status: nextStatus,
      clientName,
      payerName: clientName,
      description: serviceDescription,
      dueDate,
    });
    setLocalInvoice(updated);
    setStatus(updated.status);
    await onInvoiceSaved(updated);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const statusStyles: Record<InvoiceStatus, string> = {
    draft: 'border-slate-300 bg-slate-100 text-slate-600',
    issued: 'border-[#B9824A]/40 bg-[#B9824A]/10 text-[#7A4E24]',
    paid: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    cancelled: 'border-red-300 bg-red-50 text-red-700',
  };

  const statusLabel: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    issued: 'Issued',
    paid: 'Paid',
    cancelled: 'Cancelled',
  };

  const renderPaymentInstructions = () => {
     switch (transaction.paymentMethod) {
        case PaymentMethod.ZELLE:
           return (
              <div className="bg-[#FBF7F0] p-6 rounded-lg border border-[#D8B98B]/50 print:bg-white print:border-slate-300 break-inside-avoid">
                  <h3 className="text-sm font-bold text-[#102033] uppercase mb-4 flex items-center gap-2 tracking-wide">
                    <Smartphone className="w-4 h-4 text-[#B9824A]" />
                    Zelle Payment Instructions
                  </h3>
                  <div className="space-y-2 text-sm text-slate-600">
                     <p>Please send the total amount to our verified business handle:</p>
                     <div className="font-bold text-lg text-slate-800">finance@onebridge.llc</div>
                     <p className="text-xs text-slate-500">Recipient: ONEBRIDGE STALWART LLC</p>
                  </div>
              </div>
           );
        case PaymentMethod.PARCELADO_USA:
           return (
              <div className="bg-[#F5F7FA] p-6 rounded-lg border border-slate-200 print:bg-white print:border-slate-300 break-inside-avoid">
                  <h3 className="text-sm font-bold text-[#102033] uppercase mb-4 flex items-center gap-2 tracking-wide">
                    <CreditCard className="w-4 h-4 text-[#B9824A]" />
                    Credit Card / Installments
                  </h3>
                  <div className="space-y-4 text-sm text-slate-600">
                     <p>You can pay this invoice securely via ParceladoUSA using the link below:</p>
                     <div className="print:hidden">
                        {transaction.paymentLink ? (
                           <a href={transaction.paymentLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">Pay Now with ParceladoUSA</a>
                        ) : ( <p className="text-red-500 italic">Payment link not generated.</p> )}
                     </div>
                     <div className="hidden print:block text-center border-2 border-dashed border-slate-200 p-4 rounded-lg">
                        <div className="flex flex-col gap-2 items-center">
                           <QrCode className="w-20 h-20 text-slate-800" />
                           <p className="font-bold text-slate-800">Scan to Pay Online</p>
                        </div>
                     </div>
                  </div>
              </div>
           );
        default: // WIRE
           return (
              <div className="bg-[#F7F3EC] p-6 rounded-lg border border-[#D8B98B]/60 print:bg-white print:border-slate-300 break-inside-avoid">
                 <h3 className="text-sm font-bold text-[#102033] uppercase mb-4 flex items-center gap-2 tracking-wide">
                   <Landmark className="w-4 h-4 text-[#B9824A]" />
                   Wire Transfer Instructions
                 </h3>
                 <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                   <div><span className="block text-xs text-slate-400 uppercase">Bank Name</span><span className="font-medium text-slate-900">JPMORGAN CHASE BANK</span></div>
                   <div><span className="block text-xs text-slate-400 uppercase">Account Holder</span><span className="font-medium text-slate-900">ONEBRIDGE STALWART LLC</span></div>
                   <div><span className="block text-xs text-slate-400 uppercase">Routing Number</span><span className="font-mono text-slate-900 font-bold">267084131</span></div>
                   <div><span className="block text-xs text-slate-400 uppercase">Account Number</span><span className="font-mono text-slate-900 font-bold">2905038708</span></div>
                 </div>
              </div>
           );
     }
  };

  return (
    // QA FIX: Removed overflow-hidden and absolute positioning for print media to ensure pages don't get cut off.
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071425]/70 backdrop-blur-sm print:relative print:bg-white print:p-0 print:block">
      <div className="bg-white w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col print:h-auto print:shadow-none print:w-full print:max-w-none print:rounded-none overflow-hidden print:overflow-visible">
        
        <div className="flex justify-between items-center p-5 border-b border-[#E7DED0] print:hidden bg-[#F7F3EC]">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-[#102033] flex items-center gap-2">
              Gestão de Invoice
              <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded tracking-widest uppercase">
                Local Ledger
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">Os dados abaixo foram vinculados ao lançamento. Edite clicando no texto.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#EDE7DC] p-8 print:p-0 print:bg-white print:overflow-visible relative">
          
          {stakeholdersNotified && !savingInvoice && (
             <div className="absolute inset-x-8 top-8 z-20 print:hidden">
                <div className="bg-slate-900 text-white p-8 rounded-2xl shadow-2xl border-4 border-emerald-500/30 flex flex-col items-center text-center animate-in fade-in zoom-in duration-300 backdrop-blur-md">
                    <div className="bg-emerald-500/20 p-4 rounded-full mb-4 border border-emerald-500/50">
                       <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-black tracking-tight mb-2 uppercase">Documento Protocolado</h3>
                    <p className="text-slate-400 text-sm max-w-md mb-8">
                       Esta invoice já foi oficializada internamente. Escolha como deseja prosseguir:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
                       <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-3 p-6 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all border border-slate-700">
                          <Download className="w-6 h-6 text-emerald-400" />
                          <div><p className="font-black text-sm uppercase">Baixar PDF</p></div>
                       </button>
                       <button onClick={() => handleStatusChange('paid')} disabled={status === 'paid'} className={`flex flex-col items-center justify-center gap-3 p-6 rounded-xl transition-all border ${status === 'paid' ? 'bg-emerald-900 border-emerald-700 text-emerald-200' : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500'}`}>
                          <CheckCircle2 className="w-6 h-6" />
                          <div><p className="font-black text-sm uppercase">{status === 'paid' ? 'Paga' : 'Marcar paga'}</p></div>
                       </button>
                    </div>
                    <div className="mt-8 flex justify-center gap-6">
                      <button onClick={() => setStakeholdersNotified(false)} className="text-slate-500 text-[10px] font-black uppercase tracking-widest hover:text-emerald-400 transition-colors">Voltar para Edição</button>
                      <button onClick={() => handleStatusChange('cancelled')} className="text-red-300 text-[10px] font-black uppercase tracking-widest hover:text-red-400 transition-colors">Cancelar invoice</button>
                    </div>
                </div>
             </div>
          )}

          <div className={`bg-white max-w-[210mm] mx-auto min-h-[297mm] shadow-xl p-[18mm] print:shadow-none print:m-0 print:w-full print:max-w-none print:h-auto text-slate-900 font-[Inter] border-t-[10px] border-[#102033] transition-all duration-500 print:border-t-4 print:opacity-100 print:blur-none print:scale-100 print:filter-none print:select-auto print:pointer-events-auto ${stakeholdersNotified ? 'opacity-30 blur-sm scale-95 select-none pointer-events-none' : ''}`}>
            
            {/* Header Invoice */}
            <div className="flex justify-between items-start mb-12 border-b border-[#E7DED0] pb-8">
              <div>
                <div className="scale-90 origin-top-left"><Logo variant="dark" /></div>
                <p className="mt-5 max-w-xs text-[10px] font-bold uppercase tracking-[0.22em] text-[#B9824A]">Institutional Advisory Invoice</p>
              </div>
              <div className="text-right">
                <h1 className="text-5xl font-black text-[#102033] tracking-tight uppercase mb-4 select-none">Invoice</h1>
                <div className="flex flex-col items-end gap-1">
                  <div className="print:hidden relative group">
                     <PencilLine className="w-3 h-3 absolute -left-4 top-1.5 text-slate-300 opacity-0 group-hover:opacity-100" />
                     <input type="text" value={invoiceNumber} readOnly className="text-right font-black text-xl text-slate-900 border-b border-transparent outline-none w-48 bg-transparent transition-colors placeholder-slate-300" placeholder="Invoice #" />
                  </div>
                  <div className="hidden print:block text-slate-900 text-xl font-black">{invoiceNumber}</div>
                  <div className={`mt-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${statusStyles[status]}`}>{statusLabel[status]}</div>
                  
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-2">
                    <span>Issued:</span>
                    <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="bg-transparent text-right outline-none font-mono" />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span>Due:</span>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-transparent text-right outline-none font-mono" />
                  </div>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 gap-10 mb-14 items-start sm:grid-cols-2 sm:gap-16">
              <div className="rounded-lg border border-[#E7DED0] bg-[#FBF8F2] p-5 print:bg-white">
                <h3 className="text-[10px] font-black text-[#B9824A] uppercase tracking-widest mb-4 border-b border-[#E7DED0] pb-2">From</h3>
                <p className="font-black text-slate-900 text-lg">ONEBRIDGE STALWART LLC</p>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">30 N Gould St Ste R<br />Sheridan, WY 82801<br />United States<br /><span className="font-medium text-[#7A4E24]">finance@onebridge.llc</span></p>
              </div>
              
              <div className="group relative rounded-lg border border-[#E7DED0] p-5">
                <h3 className="text-[10px] font-black text-[#B9824A] uppercase tracking-widest mb-4 border-b border-[#E7DED0] pb-2 flex items-center justify-between">
                   Bill To
                   <span className="print:hidden text-[9px] text-emerald-600 normal-case bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><PencilLine className="w-3 h-3" /> Editável</span>
                </h3>
                
                {/* Visualização de Edição Direta (WYSIWYG) */}
                <div className="space-y-1">
                   {/* Client Name */}
                   <input 
                     type="text" 
                     value={clientName} 
                     onChange={(e) => setClientName(e.target.value)} 
                     className="w-full font-black text-slate-900 text-lg border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none bg-transparent placeholder-slate-300 print:border-none print:p-0"
                     placeholder="Client Name / Company" 
                   />

                   {/* Attn */}
                   <div className="flex items-center gap-2 group/attn">
                      <span className={`text-sm font-bold text-slate-700 ${!responsibleName && 'print:hidden opacity-50'}`}>Attn:</span>
                      <input 
                        type="text" 
                        value={responsibleName} 
                        onChange={(e) => setResponsibleName(e.target.value)} 
                        className="w-full text-sm font-bold text-slate-700 border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none bg-transparent placeholder-slate-300 print:placeholder-transparent"
                        placeholder="Responsible Name (Optional)" 
                      />
                   </div>

                   {/* Tax ID */}
                   <div className="flex items-center gap-2 group/tax">
                      <span className={`text-xs text-slate-400 uppercase font-bold ${!clientTaxId && 'print:hidden opacity-50'}`}>Tax ID:</span>
                      <input 
                        type="text" 
                        value={clientTaxId} 
                        onChange={(e) => setClientTaxId(e.target.value)} 
                        className="w-full text-xs font-mono text-slate-600 border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none bg-transparent placeholder-slate-300 print:placeholder-transparent"
                        placeholder="EIN / CPF / CNPJ" 
                      />
                   </div>

                   {/* Email */}
                   <input 
                     type="email" 
                     value={clientEmail} 
                     onChange={(e) => setClientEmail(e.target.value)} 
                     className="w-full text-xs text-emerald-600 font-medium border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none bg-transparent placeholder-slate-300 print:placeholder-transparent pt-1" 
                     placeholder="client@email.com" 
                   />

                   {/* Address */}
                   <textarea 
                     value={clientAddress} 
                     onChange={(e) => setClientAddress(e.target.value)} 
                     className="w-full text-sm text-slate-500 border border-transparent hover:border-slate-200 focus:border-emerald-500 rounded p-1 -ml-1 outline-none h-20 resize-none bg-transparent placeholder-slate-300 print:placeholder-transparent mt-2 leading-relaxed overflow-hidden" 
                     placeholder="Full Address (Street, City, State, Zip, Country)"
                   />
                </div>
              </div>
            </div>

            <div className="mb-12">
              <table className="w-full text-left">
                <thead><tr className="border-b-4 border-[#102033] text-[10px] font-black text-[#102033] uppercase tracking-widest"><th className="py-4">Service Description</th><th className="py-4 text-right">Amount (USD)</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="py-6">
                        <input 
                           type="text" 
                           value={serviceDescription} 
                           onChange={(e) => setServiceDescription(e.target.value)}
                           className="w-full font-black text-slate-900 text-lg border-b border-transparent hover:border-slate-200 focus:border-emerald-500 outline-none bg-transparent"
                        />
                    </td>
                    <td className="py-6 text-right"><p className="text-2xl font-black text-slate-900">{formatCurrency(transaction.grossRevenue)}</p></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td className="pt-10 text-right font-black text-slate-400 uppercase text-xs">Total Balance Due</td>
                    <td className="pt-10 text-right"><p className="text-4xl font-black text-[#102033]">{formatCurrency(transaction.grossRevenue)}</p></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {renderPaymentInstructions()}

            <div className="mt-10 border-t border-[#E7DED0] pt-5 text-[10px] leading-relaxed text-slate-400 print:mt-8">
              <p className="font-bold uppercase tracking-widest text-slate-500">Confidentiality and Terms</p>
              <p className="mt-2">
                This invoice is issued by OneBridge Stalwart LLC for professional services rendered. Please reference the invoice number on all remittances. Amounts are due according to the stated due date unless otherwise agreed in writing.
              </p>
            </div>

            {!stakeholdersNotified && (
               <div className="mt-12 print:hidden">
                  <button 
                    onClick={() => persistInvoice('issued')}
                    disabled={savingInvoice}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-slate-950 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-[0.98]"
                  >
                     {savingInvoice ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5 text-emerald-400" />}
                     {savingInvoice ? 'SALVANDO...' : 'PROTOCOLAR INVOICE LOCAL'}
                  </button>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
