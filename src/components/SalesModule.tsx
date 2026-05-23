import React, { useState } from 'react';
import { UserTenant, Sale } from '../types';
import { translations, currencySymbols } from '../translations';
import { getSales, addSale, editSale, deleteSale, getCustomers } from '../db';
import { Plus, Search, Trash2, Calendar, FileSpreadsheet, DollarSign, Filter, ReceiptText } from 'lucide-react';
import { motion } from 'motion/react';
import ConfirmModal from './ConfirmModal';

interface SalesModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function SalesModule({ user, onRefreshStats }: SalesModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const [sales, setSales] = useState<Sale[]>(() => getSales(user.id));
  const [customers, setCustomers] = useState(() => getCustomers(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Product Sales');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank' | 'other'>('cash');

  const handleRefresh = () => {
    const list = getSales(user.id);
    setSales(list);
    setCustomers(getCustomers(user.id));
    onRefreshStats();
  };

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !amount || parseFloat(amount) <= 0) return;

    addSale(user.id, {
      customerName,
      amount: parseFloat(amount),
      category,
      description,
      date,
      paymentMethod,
    });

    // Reset fields
    setCustomerName('');
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('cash');
    setShowAddModal(false);
    handleRefresh();
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  // Categories list
  const categories = ['Product Sales', 'Consulting', 'Services', 'Subscriptions', 'Other'];

  // Filters
  const filteredSales = sales.filter(s => {
    const cust = customers.find(c => c.name.toLowerCase() === s.customerName.toLowerCase());
    const matchesPhone = cust && cust.phone ? cust.phone.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const matchesSearch = s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          matchesPhone;
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatMoney = (val: number) => {
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isRtl = user.language === 'ar' || user.language === 'ur';

  return (
    <div className="space-y-6">
      {/* Module Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-indigo-400" />
            {t.sales}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Record and monitor all revenue flow channels and direct cash receipts.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t.addSale}
        </button>
      </div>

      {/* Filters Bench */}
      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${isRtl ? 'left-3' : 'right-3'}`} />
          <input
            type="text"
            placeholder={t.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
          >
            <option value="all">{t.all} Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Total stats under current filters */}
        <div className="bg-slate-950/60 rounded-xl px-4 py-2 border border-slate-900 flex items-center justify-between text-xs">
          <span className="text-slate-400">Filtered Revenue Total:</span>
          <span className="font-extrabold text-emerald-400">
            {formatMoney(filteredSales.reduce((sum, s) => sum + s.amount, 0))}
          </span>
        </div>
      </div>

      {/* Listing layout */}
      <div className="bg-slate-900/20 rounded-2xl border border-slate-850 overflow-hidden shadow-xl">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">{t.date}</th>
                <th className="px-5 py-4">Customer Name</th>
                <th className="px-5 py-4">{t.category}</th>
                <th className="px-5 py-4">{t.description}</th>
                <th className="px-5 py-4">{t.paymentMethod}</th>
                <th className="px-5 py-4 text-right">{t.amount}</th>
                <th className="px-5 py-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 italic text-slate-500">
                    No matching sales transactions found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/20 transition">
                    <td className="px-5 py-4 whitespace-nowrap font-mono text-slate-400">{sale.date}</td>
                    <td className="px-5 py-4 font-bold text-white whitespace-nowrap">{sale.customerName}</td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="bg-slate-800 text-indigo-200 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700">{sale.category}</span>
                    </td>
                    <td className="px-5 py-4 max-w-xs truncate" title={sale.description}>{sale.description || '-'}</td>
                    <td className="px-5 py-4 whitespace-nowrap capitalize">
                      <span className="bg-indigo-950/50 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-black text-emerald-400 whitespace-nowrap">
                      {formatMoney(sale.amount)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(sale.id)}
                        className="p-1 px-2 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 inline-block" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Layout stack */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center italic text-slate-500 text-xs">No transactions match the selected criteria.</div>
          ) : (
            filteredSales.map((sale) => (
              <div key={sale.id} className="p-4 bg-slate-950/20 flex flex-col gap-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">{sale.date}</span>
                    <h4 className="font-extrabold text-white text-sm mt-1">{sale.customerName}</h4>
                  </div>
                  <span className="font-black text-sm text-emerald-400">{formatMoney(sale.amount)}</span>
                </div>
                
                <div className="text-xs text-slate-400">{sale.description || 'No description'}</div>

                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-900">
                  <div className="flex gap-1.5">
                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{sale.category}</span>
                    <span className="bg-indigo-950/40 text-indigo-300 px-1.5 py-0.5 rounded uppercase">{sale.paymentMethod}</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(sale.id)}
                    className="text-rose-400 font-bold hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Sale Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden text-xs text-slate-300"
          >
            <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-1.5">
              <ReceiptText className="w-5 h-5 text-indigo-400" />
              {t.addSale}
            </h3>

            <form onSubmit={handleCreateSale} className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-400">Customer Name *</label>
                  <button
                    type="button"
                    onClick={() => setCustomerName('Walk-In Customer')}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-extrabold flex items-center gap-1 transition uppercase tracking-wider"
                  >
                    🚶 Quick Walk-In
                  </button>
                </div>
                <input
                  type="text"
                  required
                  list="sales-customers-datalist"
                  placeholder="ACME Corporation (or search by phone)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none"
                />
                <datalist id="sales-customers-datalist">
                  <option value="Walk-In Customer">🚶 Walk-In Customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.phone ? `${c.name} (${c.phone})` : c.name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">Total Amount ({symbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="99.99"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-400">{t.date} *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">{t.category}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-400">{t.paymentMethod}</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                  >
                    <option value="cash">{t.cash}</option>
                    <option value="card">{t.card}</option>
                    <option value="bank">{t.bank}</option>
                    <option value="other">{t.other}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.description}</label>
                <textarea
                  placeholder="Record custom comments or payment terms..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-20 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none resize-none"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition font-semibold cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
                >
                  {t.addSale}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteSale(user.id, deleteId);
            handleRefresh();
          }
        }}
        message="Are you sure you want to delete this sale transaction? This action is permanent and cannot be undone."
        language={user.language}
      />
    </div>
  );
}
