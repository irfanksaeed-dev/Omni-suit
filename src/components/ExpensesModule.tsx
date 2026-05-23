import React, { useState } from 'react';
import { UserTenant, Expense } from '../types';
import { translations, currencySymbols } from '../translations';
import { getExpenses, addExpense, deleteExpense } from '../db';
import { Plus, Search, Trash2, Tag, Calendar, User, DollarSign, Filter, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';
import ConfirmModal from './ConfirmModal';

interface ExpensesModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function ExpensesModule({ user, onRefreshStats }: ExpensesModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const [expenses, setExpenses] = useState<Expense[]>(() => getExpenses(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form fields
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Operations');
  const [description, setDescription] = useState('');
  const [recipient, setRecipient] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleRefresh = () => {
    const list = getExpenses(user.id);
    setExpenses(list);
    onRefreshStats();
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0 || !recipient) return;

    addExpense(user.id, {
      amount: parseFloat(amount),
      category,
      description,
      recipient,
      date,
    });

    setAmount('');
    setRecipient('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('Operations');
    setShowAddModal(false);
    handleRefresh();
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const categories = [
    'Operations',
    'Marketing',
    'Salaries',
    'Rent',
    'Utilities',
    'Inventory Purchase',
    'Other'
  ];

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.recipient.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exp.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Salaries': return 'bg-purple-950/40 text-purple-400 border border-purple-500/30';
      case 'Rent': return 'bg-indigo-950/40 text-indigo-400 border border-indigo-500/30';
      case 'Marketing': return 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/30';
      case 'Utilities': return 'bg-amber-950/40 text-amber-400 border border-amber-500/30';
      case 'Inventory Purchase': return 'bg-rose-950/40 text-rose-400 border border-rose-500/30';
      default: return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  const formatMoney = (val: number) => {
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isRtl = user.language === 'ar' || user.language === 'ur';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            {t.expenses}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Control operational overhead outlays, payroll, utilities, and stock purchases.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t.addExpense}
        </button>
      </div>

      {/* Filters */}
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
              <option key={cat} value={cat}>
                {t[`category${cat.replace(/\s+/g, '')}`] || cat}
              </option>
            ))}
          </select>
        </div>

        {/* Total Expense Summary */}
        <div className="bg-slate-950/60 rounded-xl px-4 py-2 border border-slate-900 flex items-center justify-between text-xs">
          <span className="text-slate-400">Filtered Outlay Total:</span>
          <span className="font-extrabold text-rose-400">
            {formatMoney(filteredExpenses.reduce((sum, e) => sum + e.amount, 0))}
          </span>
        </div>
      </div>

      {/* Grid List representation */}
      <div className="bg-slate-900/20 rounded-2xl border border-slate-850 overflow-hidden shadow-xl">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">{t.date}</th>
                <th className="px-5 py-4">{t.recipient}</th>
                <th className="px-5 py-4">{t.category}</th>
                <th className="px-5 py-4">{t.description}</th>
                <th className="px-5 py-4 text-right">{t.amount}</th>
                <th className="px-5 py-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 italic text-slate-500">
                    No matching expenses logged yet.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/20 transition">
                    <td className="px-5 py-4 whitespace-nowrap font-mono text-slate-400">{exp.date}</td>
                    <td className="px-5 py-4 font-bold text-white whitespace-nowrap flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      {exp.recipient}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getCategoryColor(exp.category)}`}>
                        {t[`category${exp.category.replace(/\s+/g, '')}`] || exp.category}
                      </span>
                    </td>
                    <td className="px-5 py-4 max-w-xs truncate" title={exp.description}>{exp.description || '-'}</td>
                    <td className="px-5 py-4 text-right font-black text-rose-400 whitespace-nowrap">
                      {formatMoney(exp.amount)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDelete(exp.id)}
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

        {/* Mobile View card layout */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center italic text-slate-500 text-xs">No matching expenses found.</div>
          ) : (
            filteredExpenses.map((exp) => (
              <div key={exp.id} className="p-4 bg-slate-950/20 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">{exp.date}</span>
                    <h4 className="font-extrabold text-white text-sm mt-1">{exp.recipient}</h4>
                  </div>
                  <span className="font-black text-rose-400">{formatMoney(exp.amount)}</span>
                </div>

                <p className="text-xs text-slate-400">{exp.description || 'No notes field provided'}</p>

                <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-slate-900">
                  <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold ${getCategoryColor(exp.category)}`}>
                    {t[`category${exp.category.replace(/\s+/g, '')}`] || exp.category}
                  </span>
                  <button 
                    onClick={() => handleDelete(exp.id)}
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

      {/* Add Expenses Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300"
          >
            <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-1.5">
              <CreditCard className="w-5 h-5 text-indigo-400" />
              {t.addExpense}
            </h3>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.recipient} / Vendor *</label>
                <input
                  type="text"
                  required
                  placeholder="Amazon Web Services"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">Amount ({symbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="250.00"
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

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.category}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {t[`category${cat.replace(/\s+/g, '')}`] || cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.description}</label>
                <textarea
                  placeholder="Brief justification comments of this payout..."
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
                  {t.addExpense}
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
            deleteExpense(user.id, deleteId);
            handleRefresh();
          }
        }}
        message="Are you sure you want to delete this expense record? This action is permanent and cannot be undone."
        language={user.language}
      />
    </div>
  );
}
