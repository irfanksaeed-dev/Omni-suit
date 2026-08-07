import React, { useState, useEffect } from 'react';
import { UserTenant, PurchaseRecord } from '../types';
import { translations, currencySymbols } from '../translations';
import { getPurchases, addPurchase, deletePurchase, editPurchase, getProducts } from '../db';
import { Plus, Search, Trash2, Calendar, User, DollarSign, Filter, CreditCard, Tag, Layers, RefreshCw, ShoppingCart } from 'lucide-react';
import { motion } from 'motion/react';
import ConfirmModal from './ConfirmModal';

interface PurchasesModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function PurchasesModule({ user, onRefreshStats }: PurchasesModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const [purchases, setPurchases] = useState<PurchaseRecord[]>(() => getPurchases(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form states for creating/editing
  const [supplierName, setSupplierName] = useState('');
  const [itemName, setItemName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | 'pending'>('paid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank' | 'other'>('cash');

  const products = getProducts(user.id);

  const handleRefresh = () => {
    const list = getPurchases(user.id);
    setPurchases(list);
    onRefreshStats();
  };

  useEffect(() => {
    window.addEventListener('db-update', handleRefresh);
    return () => {
      window.removeEventListener('db-update', handleRefresh);
    };
  }, []);

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName || !itemName || !quantity || !unitCost) return;

    const qtyVal = parseInt(quantity) || 0;
    const costVal = parseFloat(unitCost) || 0;

    addPurchase(user.id, {
      supplierName,
      itemName,
      sku,
      quantity: qtyVal,
      unitCost: costVal,
      totalCost: qtyVal * costVal,
      date,
      paymentStatus,
      paymentMethod,
    });

    // Reset forms
    setSupplierName('');
    setItemName('');
    setSku('');
    setQuantity('');
    setUnitCost('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentStatus('paid');
    setPaymentMethod('cash');
    setShowAddModal(false);
    
    handleRefresh();
  };

  const filteredPurchases = purchases.filter(pur => {
    const matchesSearch = 
      pur.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      pur.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pur.sku && pur.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || pur.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30';
      case 'unpaid': return 'bg-rose-950/40 text-rose-400 border border-rose-500/30';
      default: return 'bg-amber-950/40 text-amber-400 border border-amber-500/30';
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
            <ShoppingCart className="w-5 h-5 text-indigo-400" />
            Purchase Records
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Record business inventory purchases from suppliers, track costs, and auto-increment stock levels.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Supplier Purchase
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-8 relative">
          <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${isRtl ? 'left-3' : 'right-3'}`} />
          <input
            type="text"
            placeholder="Search by supplier, item description, sku code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition"
          />
        </div>
        
        <div className="md:col-span-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="all">All Payment Statuses</option>
            <option value="paid">Settled / Paid</option>
            <option value="unpaid">Unpaid / Due</option>
            <option value="pending">Pending Settlement</option>
          </select>
        </div>
      </div>

      {/* Purchases Grid Display */}
      <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-350">
            <thead className="bg-slate-950/40 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-850">
              <tr>
                <th className="px-5 py-4">Transaction / Date</th>
                <th className="px-5 py-4">Supplier Profile</th>
                <th className="px-5 py-4">Merchandise Item / SKU</th>
                <th className="px-5 py-4">Qty & Cost</th>
                <th className="px-5 py-4">Aggregate Total</th>
                <th className="px-5 py-4">Status & Method</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 italic text-slate-500 text-xs">
                    No purchase history registered. Click "Add Supplier Purchase" to enter logs.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((pur) => {
                  return (
                    <tr key={pur.id} className="hover:bg-slate-800/20 transition">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-slate-500 block text-[9px] uppercase tracking-wide font-extrabold">ID: #{pur.id.substring(4, 9).toUpperCase()}</span>
                        <span className="text-slate-350 flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {pur.date}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-extrabold text-white block truncate max-w-[150px]">{pur.supplierName}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-200 block truncate max-w-[150px]">{pur.itemName}</span>
                        {pur.sku ? (
                          <span className="text-[10px] text-indigo-400 font-mono tracking-tight block">SKU: {pur.sku}</span>
                        ) : (
                          <span className="text-[9px] text-slate-600 block italic">No Catalog Link</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono">
                        <span className="text-slate-300 font-bold block">{pur.quantity} Pcs</span>
                        <span className="text-[10px] text-slate-500 font-medium">x {formatMoney(pur.unitCost)} Unit</span>
                      </td>
                      <td className="px-5 py-4 font-mono font-black text-white shrink-0">
                        {formatMoney(pur.totalCost)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap space-y-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold block text-center max-w-[70px] ${getStatusColor(pur.paymentStatus)}`}>
                          {pur.paymentStatus}
                        </span>
                        <span className="text-[9px] text-slate-400 capitalize block font-mono text-center max-w-[70px] bg-slate-950 py-0.5 rounded border border-slate-900">
                          {pur.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => setDeleteId(pur.id)}
                          className="text-rose-400 hover:text-rose-300 p-2 hover:bg-rose-500/10 rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 inline-block" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Supplier Purchase Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative overflow-hidden text-xs text-slate-300 flex flex-col max-h-[92vh]"
          >
            <h3 className="text-base font-extrabold text-white mb-3 flex items-center gap-1.5 shrink-0">
              <ShoppingCart className="w-5 h-5 text-indigo-400" />
              Add Supplier Purchase Log
            </h3>
            
            <p className="text-slate-400 mb-4 shrink-0">
              Track warehouse merchandise acquisitions. Entering a valid product SKU automatically adds quantity increments into the Live Inventory tracking ledger.
            </p>

            <form onSubmit={handleCreatePurchase} className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="font-bold text-slate-450 block mb-0.5">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Wholesale Supply Co."
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
                
                <div className="space-y-0.5">
                  <label className="font-bold text-slate-450 block mb-0.5">Item Name / Desc *</label>
                  <input
                    type="text"
                    required
                    placeholder="Premium Aluminum Chairs"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="font-bold text-slate-450 block mb-0.5">Product Link (by Product SKU)</label>
                  <select
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value);
                      const selectedProd = products.find(p => p.sku === e.target.value);
                      if (selectedProd) {
                        setItemName(selectedProd.name);
                        setUnitCost(selectedProd.cost.toString());
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-white transition cursor-pointer"
                  >
                    <option value="">-- Choose Catalog SKU to Sync Inventory --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.sku}>
                        {p.name} (SKU: {p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="font-bold text-slate-450 block mb-0.5">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <label className="font-bold text-slate-450 block mb-0.5">Acquisition Qty *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="100"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono text-sm"
                  />
                </div>
                
                <div className="space-y-0.5">
                  <label className="font-bold text-slate-450 block mb-0.5">Unit Supplier Cost ({symbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="25.50"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-mono text-sm"
                  />
                </div>
              </div>

              {quantity && unitCost && (
                <div className="bg-indigo-950/30 border border-indigo-900/50 p-3 rounded-xl flex justify-between items-center text-[11px] text-indigo-300 font-mono">
                  <span>Aggregate Total Supplier Cost:</span>
                  <span className="font-black text-sm text-indigo-400">{formatMoney((parseFloat(quantity) || 0) * (parseFloat(unitCost) || 0))}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide mb-0.5">Payment Settlement</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/85">
                    {(['paid', 'unpaid', 'pending'] as const).map((stat) => (
                      <button
                        key={stat}
                        type="button"
                        onClick={() => setPaymentStatus(stat)}
                        className={`py-1 rounded text-[9px] uppercase font-bold cursor-pointer transition text-center ${
                          paymentStatus === stat
                            ? stat === 'paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60' :
                              stat === 'unpaid' ? 'bg-rose-950 text-rose-400 border border-rose-700/60' :
                              'bg-amber-950 text-amber-400 border border-amber-700/60'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {stat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide mb-0.5">Settlement Method</span>
                  <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800/85">
                    {(['cash', 'card', 'bank', 'other'] as const).map((meth) => (
                      <button
                        key={meth}
                        type="button"
                        onClick={() => setPaymentMethod(meth)}
                        className={`py-1 rounded text-[9px] uppercase font-bold cursor-pointer transition text-center ${
                          paymentMethod === meth
                            ? 'bg-indigo-950 text-indigo-400 border border-indigo-700/60'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {meth}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Handlers */}
              <div className="flex gap-2.5 justify-end pt-4 border-t border-slate-800/50">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-350 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
                >
                  Log Purchase & Sync Stock
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Portal */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deletePurchase(user.id, deleteId);
            setDeleteId(null);
            handleRefresh();
          }
        }}
        message="Are you sure you want to delete this purchase record? Note that this will also roll back the quantity additions from the Product warehouse inventory stock tracking automatically. This action is permanent."
        language={user.language}
      />
    </div>
  );
}
