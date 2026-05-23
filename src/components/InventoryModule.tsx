import React, { useState } from 'react';
import { UserTenant, Product } from '../types';
import { translations, currencySymbols } from '../translations';
import { getProducts, editProduct } from '../db';
import { Layers, Search, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert, ArrowUpRight, Plus, Package } from 'lucide-react';
import { motion } from 'motion/react';

interface InventoryModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
  onNavigate?: (module: string) => void;
}

export default function InventoryModule({ user, onRefreshStats, onNavigate }: InventoryModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const [products, setProducts] = useState<Product[]>(() => getProducts(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'healthy'>('all');
  
  // Quick Edit Quantity
  const [adjustingProd, setAdjustingProd] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');

  const handleRefresh = () => {
    const list = getProducts(user.id);
    setProducts(list);
    onRefreshStats();
  };

  const handleQuickAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProd || isNaN(parseInt(newStock))) return;

    editProduct(user.id, {
      ...adjustingProd,
      stock: Math.max(0, parseInt(newStock)),
    });

    setAdjustingProd(null);
    setNewStock('');
    handleRefresh();
  };

  const isRtl = user.language === 'ar' || user.language === 'ur';

  // Filters
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const isCritical = p.stock <= p.minStockAlert;
    
    if (statusFilter === 'critical') return matchesSearch && isCritical;
    if (statusFilter === 'healthy') return matchesSearch && !isCritical;
    return matchesSearch;
  });

  const criticalCount = products.filter(p => p.stock <= p.minStockAlert).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            {t.inventory}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Track warehouse bin volumes, critical minimum thresholds, and direct quantity levels.</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setStatusFilter('critical')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
              statusFilter === 'critical' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Critical</span>
            {criticalCount > 0 && <span className="bg-white/25 text-white text-[9px] px-1 py-0.5 rounded-full">{criticalCount}</span>}
          </button>
          <button
            onClick={() => setStatusFilter('healthy')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
              statusFilter === 'healthy' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Healthy
          </button>
        </div>
      </div>

      {/* Top Indicators Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Critical Red Alerts</span>
            <div className="text-lg font-black text-white">{criticalCount} active alerts</div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Healthy Stock Lines</span>
            <div className="text-lg font-black text-white">{products.length - criticalCount} items</div>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Gross Vault Units</span>
            <div className="text-lg font-black text-white">
              {products.reduce((sum, p) => sum + p.stock, 0).toLocaleString()} pcs
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic guidance callout banner block */}
      {onNavigate && (
        <div className="glass p-5 rounded-2xl border-indigo-500/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex gap-3.5 items-start">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white tracking-wide">How can I add new products to Inventory?</h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                Products must be first registered under the <strong className="text-indigo-300">Products Catalog</strong> module. Once registered there, they automatically join this live warehouse inventory board where you can view low-stock alerts and adjust physical counts.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('products')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0 shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Go to Products Catalog
          </button>
        </div>
      )}

      {/* Search and results size */}
      <div className="relative">
        <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${isRtl ? 'left-3' : 'right-3'}`} />
        <input
          type="text"
          placeholder="Filter by SKU or Product Name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition"
        />
      </div>

      {/* Warehouse Listing Table */}
      <div className="bg-slate-900/20 rounded-2xl border border-slate-850 overflow-hidden shadow-xl">
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">SKU / Code</th>
                <th className="px-5 py-4">Product Display Name</th>
                <th className="px-5 py-4">Current Stock Level</th>
                <th className="px-5 py-4">Replenish Limit</th>
                <th className="px-5 py-4">{t.status}</th>
                <th className="px-5 py-4 text-right">Quick Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 italic text-slate-500">
                    No directory products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const isCritical = prod.stock <= prod.minStockAlert;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-800/20 transition">
                      <td className="px-5 py-4 font-mono text-slate-400 font-bold">{prod.sku}</td>
                      <td className="px-5 py-4 font-bold text-white max-w-xs truncate">{prod.name}</td>
                      <td className="px-5 py-4 font-black text-slate-200">
                        {prod.stock} PCs
                      </td>
                      <td className="px-5 py-4 text-slate-400">{prod.minStockAlert} PCs</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          isCritical 
                            ? 'bg-orange-950/40 text-orange-400 border-orange-500/35' 
                            : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/35'
                        }`}>
                          {isCritical ? t.statusCritical : t.statusHealthy}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            setAdjustingProd(prod);
                            setNewStock(prod.stock.toString());
                          }}
                          className="text-xs text-indigo-400 font-bold hover:underline hover:text-indigo-300 transition cursor-pointer"
                        >
                          Adjust Count
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card Deck (100% Responsive) */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-10 italic text-slate-500 text-xs text-slate-400">
              No products found in warehouse inventory.
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isCritical = prod.stock <= prod.minStockAlert;
              return (
                <div key={prod.id} className="p-4 bg-slate-900/10 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-950/60 border border-slate-800 px-1.5 py-1 rounded">
                        {prod.sku}
                      </span>
                      <h4 className="font-extrabold text-white text-sm mt-1">{prod.name}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${
                      isCritical 
                        ? 'bg-orange-950/40 text-orange-400 border-orange-500/35' 
                        : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/35'
                    }`}>
                      {isCritical ? t.statusCritical : t.statusHealthy}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-950/45 p-2.5 rounded-xl border border-slate-850">
                    <div>
                      <span className="text-[9px] text-slate-550 block uppercase font-bold">Physical Count</span>
                      <span className="text-xs font-black text-slate-300">{prod.stock} PCs</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-550 block uppercase font-bold">Alert Trigger</span>
                      <span className="text-xs text-slate-400 font-semibold font-mono">&lt;= {prod.minStockAlert} PCs</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        setAdjustingProd(prod);
                        setNewStock(prod.stock.toString());
                      }}
                      className="text-xs text-indigo-400 font-bold hover:underline hover:text-indigo-300 transition cursor-pointer flex items-center gap-1.5 bg-indigo-500/5 px-3.5 py-2 rounded-xl border border-indigo-500/15"
                    >
                      <RefreshCw className="w-3 h-3 text-indigo-400" />
                      Adjust Count
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Adjust Stock Qty Modal */}
      {adjustingProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setAdjustingProd(null)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300"
          >
            <h3 className="text-base font-extrabold text-white mb-3 flex items-center gap-1.5">
              <RefreshCw className="w-5 h-5 text-indigo-400" />
              {t.adjustStock}
            </h3>

            <p className="text-slate-400 mb-4">
              Write the new physical stock warehouse count for: <strong className="text-white">{adjustingProd.name}</strong> (SKU: <span className="font-mono text-indigo-400">{adjustingProd.sku}</span>).
            </p>

            <form onSubmit={handleQuickAdjust} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.newStockLevel} *</label>
                <input
                  type="number"
                  required
                  placeholder="50"
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProd(null)}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 font-semibold cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Update Inventory
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
