import React, { useState } from 'react';
import { Customer, UserTenant, Invoice } from '../types';
import { getInvoices } from '../db';
import { translations } from '../translations';
import { FileText, LogOut, CheckCircle, Clock, DollarSign, Printer, Download, Globe, Coins, ShieldAlert, Award, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerPortalProps {
  customer: Customer;
  merchant: UserTenant;
  onSignOut: () => void;
  initialInvoiceId?: string | null;
}

export default function CustomerPortal({ customer, merchant, onSignOut, initialInvoiceId }: CustomerPortalProps) {
  // Pull all invoices matching this customer profile
  const invoices = getInvoices(merchant.id).filter(inv => inv.customerId === customer.id);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(() => {
    if (initialInvoiceId) {
      const match = invoices.find(inv => inv.id === initialInvoiceId);
      if (match) return match;
    }
    return null;
  });
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [receiptLang, setReceiptLang] = useState<'en' | 'ar' | 'both'>('en');

  // Ledger stats calculation
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
  const balanceDue = totalInvoiced - totalPaid;

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'paid') return inv.status === 'paid';
    if (filter === 'unpaid') return inv.status === 'unpaid';
    return true;
  });

  const currencySymbol = merchant.currency === 'USD' ? '$' : merchant.currency === 'AED' ? 'AED ' : merchant.currency === 'PKR' ? 'Rs ' : merchant.currency === 'SAR' ? 'SAR ' : merchant.currency === 'EUR' ? '€' : '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Printable Area Target block for Standard CSS Prints */}
      <div id="printable-area" className="hidden print:block text-black p-8 bg-white min-h-screen">
        {selectedInvoice && (
          <div className="space-y-6 text-xs font-sans leading-relaxed text-slate-800" dir={receiptLang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="flex justify-between items-start border-b pb-6 border-slate-200">
              <div>
                {merchant.logoUrl ? (
                  <img src={merchant.logoUrl} alt="Logo" className="max-h-12 max-w-xs object-contain mb-3" referrerPolicy="no-referrer" />
                ) : (
                  <div className="font-extrabold text-lg text-indigo-900 tracking-tight">{merchant.companyName}</div>
                )}
                <p className="font-bold text-slate-800">{merchant.companyName}</p>
                <p className="text-slate-500">{merchant.address || 'Heaquaters Office'}</p>
                <p className="text-slate-500">Phone: {merchant.phone || '-'}</p>
                {merchant.taxNumber && <p className="text-slate-900 font-bold font-mono">TRN Tax ID: {merchant.taxNumber}</p>}
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-black text-indigo-900 uppercase">
                  {receiptLang === 'en' ? 'TAX INVOICE' : receiptLang === 'ar' ? 'فاتورة ضريبية' : 'TAX INVOICE / فاتورة ضريبية'}
                </h1>
                <p className="font-mono font-black text-base text-slate-900 mt-2">{selectedInvoice.invoiceNumber}</p>
                <div className="mt-4 space-y-1 text-slate-500">
                  <p>Date: <strong className="text-slate-800 font-mono">{selectedInvoice.date}</strong></p>
                  <p>Due Date: <strong className="text-slate-800 font-mono">{selectedInvoice.dueDate}</strong></p>
                  <p>Status: <strong className="uppercase font-bold text-emerald-600">{selectedInvoice.status}</strong></p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="font-extrabold text-[10px] uppercase text-slate-400 block tracking-wider">Bill To / العميل:</span>
                <p className="font-black text-slate-900 text-sm mt-1">{customer.name}</p>
                <p className="text-slate-500 mt-1">{customer.email}</p>
                <p className="text-slate-500">{customer.phone}</p>
                <p className="text-slate-500 text-[10px]">{customer.address}</p>
              </div>
              <div className="text-right flex flex-col justify-between">
                <div>
                  <span className="font-extrabold text-[10px] uppercase text-slate-400 block tracking-wider">Default Currency / العملة:</span>
                  <span className="font-mono font-black text-sm text-indigo-950">{merchant.currency}</span>
                </div>
                {selectedInvoice.notes && (
                  <div className="text-slate-500 text-[10px] italic">
                    Note: {selectedInvoice.notes}
                  </div>
                )}
              </div>
            </div>

            <table className="w-full text-left border-collapse mt-4 text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-slate-400 font-black tracking-wider uppercase text-[9px] bg-slate-50">
                  <th className="py-2 px-3">Item / الوصف</th>
                  <th className="py-2 px-3 text-right">Price / السعر</th>
                  <th className="py-2 px-3 text-center">Qty / الكمية</th>
                  <th className="py-2 px-2 text-right">Tax (%) / الضريبة</th>
                  <th className="py-2 px-3 text-right">Total / المجموع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {selectedInvoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900">{item.productName}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{currencySymbol}{item.price.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{item.quantity}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{selectedInvoice.taxRate}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {currencySymbol}{item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-5 text-xs text-slate-900">
              <div className="w-64 space-y-2 border-t pt-4 border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal / المجموع الفرعي:</span>
                  <span className="font-mono font-bold">{currencySymbol}{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax / قيمة الضريبة ({merchant.taxRate}%):</span>
                  <span className="font-mono text-slate-700">{currencySymbol}{selectedInvoice.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed pt-2 text-sm font-black text-indigo-950">
                  <span>Grand Total / الإجمالي الكلي:</span>
                  <span className="font-mono">{currencySymbol}{selectedInvoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {merchant.invoiceNotes && (
              <div className="border-t border-slate-200 pt-6 mt-12 text-[10px] text-slate-500 leading-relaxed font-sans bg-slate-50 p-4 rounded-xl">
                <strong className="block text-slate-700 mb-1 uppercase tracking-wider">Ref wire or swift coordinates:</strong>
                {merchant.invoiceNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screen View Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden print:hidden">
        {/* Top Header navbar */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            {merchant.logoUrl ? (
              <img src={merchant.logoUrl} alt="Logo" className="max-h-10 max-w-[140px] object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-black text-sm shadow-md">
                OM
              </div>
            )}
            <div>
              <h1 className="text-sm font-black tracking-tight text-white uppercase">{merchant.companyName}</h1>
              <p className="text-[10px] text-slate-400 font-medium font-mono">BILLING & INVOICES PORTAL</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick badges */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-violet-950/40 border border-violet-800/40 text-[10px] text-violet-300 rounded-full font-bold">
              <Award className="w-3.5 h-3.5 text-violet-400" />
              Verified Client Profile
            </span>
            <button 
              onClick={onSignOut}
              className="flex items-center gap-1 text-[10px] font-bold bg-slate-800 hover:bg-rose-950/30 hover:text-rose-400 text-slate-300 py-2 px-3.5 rounded-xl border border-slate-750 transition duration-300 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOGOUT / مخرج</span>
            </button>
          </div>
        </header>

        {/* Workspace core grid split */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Welcome greeting card with stats */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/45 p-6 rounded-2xl border border-slate-850 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest bg-indigo-950/60 py-1 px-3 rounded-full border border-indigo-900/40">CUSTOMER DASHBOARD</span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-3 flex items-center gap-2">
                <span>Welcome,</span>
                <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-white bg-clip-text text-transparent">{customer.name}!</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Logged in using: <strong className="font-mono text-white">{customer.email || customer.phone}</strong></p>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full md:w-auto shrink-0 font-mono">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider flex items-center gap-1">
                  <Coins className="w-3 h-3 text-slate-400" /> Total Invoiced
                </span>
                <span className="text-xs sm:text-sm font-black text-white mt-1.5">{currencySymbol}{totalInvoiced.toFixed(2)}</span>
              </div>
              <div className="bg-emerald-950/15 p-3.5 rounded-xl border border-emerald-900/20 flex flex-col">
                <span className="text-[9px] text-emerald-500 uppercase font-black tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Total Paid
                </span>
                <span className="text-xs sm:text-sm font-black text-emerald-400 mt-1.5">{currencySymbol}{totalPaid.toFixed(2)}</span>
              </div>
              <div className="bg-amber-950/15 p-3.5 rounded-xl border border-amber-905/20 flex flex-col">
                <span className="text-[9px] text-amber-550 uppercase font-black tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" /> Balance Due
                </span>
                <span className="text-xs sm:text-sm font-black text-amber-400 mt-1.5">{currencySymbol}{balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Table index container */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-850">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  YOUR VALUED STATEMENTS & TAX INVOICES / آپ کی وصولیاں اور بلز
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Below is a log of all transactions and legal invoices matching your customer domain profile database.</p>
              </div>

              {/* Status query quick filters */}
              <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex gap-1">
                {(['all', 'paid', 'unpaid'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                      filter === f 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* List Table Grid layout */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="text-slate-500 font-extrabold text-[10px] uppercase border-b border-slate-800">
                    <th className="py-3 px-4">Invoice ID / رسید کا نمبر</th>
                    <th className="py-3 px-4">Invoice Date / بل کی تاریخ</th>
                    <th className="py-3 px-4">Due Date / آخری تاریخ</th>
                    <th className="py-3 px-4 text-right">Grand Total / کل رقم</th>
                    <th className="py-3 px-4 text-center">Status / حالت</th>
                    <th className="py-3 px-4 text-right">Actions / تدابیر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                        No invoices matches this query criteria currently.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-850/40 transition">
                        <td className="py-3 px-4 font-mono font-black text-white text-xs">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 font-mono">{inv.date}</td>
                        <td className="py-3 px-4 font-mono">{inv.dueDate}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {currencySymbol}{inv.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            inv.status === 'paid' 
                              ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-400' 
                              : 'bg-amber-950/50 border border-amber-500/30 text-amber-400'
                          }`}>
                            {inv.status === 'paid' ? 'Paid / ادا شدہ' : 'Unpaid / غیر ادا شدہ'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            className="bg-indigo-600/15 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white font-bold px-3 py-1.5 rounded-lg transition duration-300 cursor-pointer"
                          >
                            View Receipt
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Detail PDF / Print Preview Modal backdrop popup */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative overflow-hidden"
            >
              {/* Modal controls bar */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-xs">
                <span className="font-extrabold text-white">TAX RECEIPT PREVIEW</span>
                
                {/* Print and Translation options */}
                <div className="flex gap-2">
                  <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 flex">
                    <button
                      onClick={() => setReceiptLang('en')}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${receiptLang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => setReceiptLang('ar')}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${receiptLang === 'ar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      AR / عربى
                    </button>
                    <button
                      onClick={() => setReceiptLang('both')}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${receiptLang === 'both' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Dual
                    </button>
                  </div>

                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-black py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    PRINT
                  </button>

                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="bg-slate-850 hover:bg-slate-850 text-slate-300 font-bold py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    CLOSE
                  </button>
                </div>
              </div>

              {/* Invoice layout paper view */}
              <div className="flex-1 p-8 overflow-y-auto bg-white text-slate-800 font-sans" dir={receiptLang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="flex justify-between items-start border-b pb-6 border-slate-200">
                  <div>
                    {merchant.logoUrl ? (
                      <img src={merchant.logoUrl} alt="Logo" className="max-h-12 max-w-xs object-contain mb-3" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="font-extrabold text-lg text-indigo-900 tracking-tight">{merchant.companyName}</div>
                    )}
                    <h2 className="font-bold text-slate-900 leading-tight">{merchant.companyName}</h2>
                    <p className="text-slate-500 text-[11px] leading-relaxed mt-1 max-w-xs">{merchant.address || 'Operations HQ'}</p>
                    <p className="text-slate-500 text-[11px]">Contact: {merchant.phone || '-'}</p>
                    {merchant.taxNumber && <p className="text-indigo-950 font-black text-xs font-mono mt-1">VAT/TRN: {merchant.taxNumber}</p>}
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black text-indigo-950">
                      {receiptLang === 'en' ? 'TAX INVOICE' : receiptLang === 'ar' ? 'فاتورة ضريبية' : 'TAX INVOICE / فاتورة ضريبية'}
                    </h2>
                    <span className="inline-block bg-slate-100 text-slate-900 font-mono font-bold text-xs px-2.5 py-1 rounded mt-2">{selectedInvoice.invoiceNumber}</span>
                    <div className="mt-4 space-y-1 text-slate-500 text-[11px]">
                      <p>Date: <strong className="text-slate-800 font-mono">{selectedInvoice.date}</strong></p>
                      <p>Due Date: <strong className="text-slate-800 font-mono">{selectedInvoice.dueDate}</strong></p>
                      <p>Status: <strong className="uppercase font-bold text-emerald-650">{selectedInvoice.status}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-400 text-[9px] uppercase block">Client Reference / معلومات العميل:</span>
                    <p className="font-black text-slate-900 text-sm mt-1">{customer.name}</p>
                    <p className="text-slate-500">{customer.email}</p>
                    <p className="text-slate-500">{customer.phone}</p>
                    <p className="text-slate-500 leading-relaxed text-[10px] mt-1 max-w-xs">{customer.address}</p>
                  </div>
                  <div className="text-right flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-slate-400 text-[9px] uppercase block">Primary Account Currency / العملة:</span>
                      <strong className="font-mono text-indigo-950 font-black text-sm">{merchant.currency}</strong>
                    </div>
                    {selectedInvoice.notes && (
                      <p className="text-slate-500 text-[10px] italic">Comments: {selectedInvoice.notes}</p>
                    )}
                  </div>
                </div>

                {/* Items loop */}
                <table className="w-full text-left border-collapse mt-6 text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-400 font-black uppercase text-[9px] bg-slate-50">
                      <th className="py-2.5 px-3">Item Description / الوصف</th>
                      <th className="py-2.5 px-2 text-right">Unit Net / السعر</th>
                      <th className="py-2.5 px-2 text-center">Qty / الكمية</th>
                      <th className="py-2.5 px-2 text-right">Tax (%) / الضريبة</th>
                      <th className="py-2.5 px-3 text-right">Total Net / المجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{item.productName}</p>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-900">{currencySymbol}{item.price.toFixed(2)}</td>
                        <td className="py-3 px-2 text-center font-mono text-slate-900">{item.quantity}</td>
                        <td className="py-3 px-2 text-right font-mono text-slate-500">{selectedInvoice.taxRate}%</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {currencySymbol}{item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Total Summaries */}
                <div className="flex justify-end pt-5 text-xs text-slate-900">
                  <div className="w-64 space-y-2 border-t pt-4 border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Subtotal / المجموع الفرعي:</span>
                      <span className="font-mono font-bold">{currencySymbol}{selectedInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tax / قيمة الضريبة ({merchant.taxRate}%):</span>
                      <span className="font-mono text-slate-700">{currencySymbol}{selectedInvoice.taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-dashed pt-2 text-xs font-black text-indigo-950">
                      <span>Grand Total / الإجمالي الكلي:</span>
                      <strong className="font-mono text-base">{currencySymbol}{selectedInvoice.total.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {/* Remittance coordinates */}
                {merchant.invoiceNotes && (
                  <div className="border-t border-slate-200 pt-6 mt-10 text-[9px] text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl">
                    <strong className="block text-slate-705 font-bold mb-1 uppercase tracking-wider">Payment / Routing wire instructions:</strong>
                    {merchant.invoiceNotes}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
