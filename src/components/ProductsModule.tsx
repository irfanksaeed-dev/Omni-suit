import React, { useState } from 'react';
import { UserTenant, Product } from '../types';
import { translations, currencySymbols } from '../translations';
import { getProducts, addProduct, editProduct, deleteProduct, getNextProductId } from '../db';
import { Plus, Search, Trash2, Edit2, Package, Tag, Layers, MessageSquareDashed, Percent } from 'lucide-react';
import { motion } from 'motion/react';
import ConfirmModal from './ConfirmModal';

interface ProductsModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function ProductsModule({ user, onRefreshStats }: ProductsModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const [products, setProducts] = useState<Product[]>(() => getProducts(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('5');

  const handleRefresh = () => {
    const list = getProducts(user.id);
    setProducts(list);
    onRefreshStats();
  };

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || isNaN(parseFloat(price))) return;

    const dataPayload = {
      name,
      sku: sku || 'SKU-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      description,
      price: parseFloat(price),
      cost: parseFloat(cost) || 0,
      stock: parseInt(stock) || 0,
      minStockAlert: parseInt(minStockAlert) || 5,
    };

    if (editingItem) {
      editProduct(user.id, {
        ...editingItem,
        ...dataPayload,
      });
      setEditingItem(null);
    } else {
      addProduct(user.id, dataPayload);
    }

    // Reset Fields
    setName('');
    setSku('');
    setDescription('');
    setPrice('');
    setCost('');
    setStock('');
    setMinStockAlert('5');
    setShowAddModal(false);
    handleRefresh();
  };

  const handleStartEdit = (prod: Product) => {
    setEditingItem(prod);
    setName(prod.name);
    setSku(prod.sku);
    setDescription(prod.description);
    setPrice(prod.price.toString());
    setCost(prod.cost.toString());
    setStock(prod.stock.toString());
    setMinStockAlert(prod.minStockAlert.toString());
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatMoney = (val: number) => {
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isRtl = user.language === 'ar' || user.language === 'ur';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-400" />
            {t.products}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Control pricing catalog lines, purchase cost margin margins, and unique identification SKUs.</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setName('');
            setSku('');
            setDescription('');
            setPrice('');
            setCost('');
            setStock('');
            setMinStockAlert('5');
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t.addProduct}
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
        <div className="relative flex-1">
          <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${isRtl ? 'left-3' : 'right-3'}`} />
          <input
            type="text"
            placeholder={t.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition"
          />
        </div>
        <div className="bg-slate-950/40 text-[10px] text-slate-400 font-mono border border-slate-900 rounded-xl px-3.5 py-2">
          Master Catalog Size: <strong>{filteredProducts.length} items</strong>
        </div>
      </div>

      {/* Products table list */}
      <div className="bg-slate-900/20 rounded-2xl border border-slate-850 overflow-hidden shadow-xl">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">{t.sku}</th>
                <th className="px-5 py-4">{t.productName}</th>
                <th className="px-5 py-4 text-right">Selling Price</th>
                <th className="px-5 py-4 text-right">Unit Cost</th>
                <th className="px-5 py-4 text-right">Margin</th>
                <th className="px-5 py-4 text-right">Stock Count</th>
                <th className="px-5 py-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 italic text-slate-500">
                    No products added to catalog yet.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const profit = prod.price - prod.cost;
                  const profitPercentage = prod.price > 0 ? (profit / prod.price) * 100 : 0;
                  const isLow = prod.stock <= prod.minStockAlert;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-800/20 transition">
                      <td className="px-5 py-4 font-mono font-semibold text-slate-400">{prod.sku}</td>
                      <td className="px-5 py-4 font-bold text-white max-w-xs">
                        <div>
                          <p className="truncate" title={prod.name}>{prod.name}</p>
                          <p className="text-[10px] text-indigo-400 font-mono mt-0.5" title="Product ID">ID: {prod.id}</p>
                          <p className="text-[10px] text-slate-500 font-normal truncate mt-0.5" title={prod.description}>{prod.description || 'No description field'}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-200">{formatMoney(prod.price)}</td>
                      <td className="px-5 py-4 text-right text-slate-400">{formatMoney(prod.cost)}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className={`font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatMoney(profit)}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {profitPercentage.toFixed(0)}% Margin
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          isLow 
                            ? 'bg-orange-950/40 text-orange-400 border border-orange-500/35' 
                            : 'bg-slate-850 text-slate-300'
                        }`}>
                          {prod.stock} Units
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => handleStartEdit(prod)}
                            className="p-1 px-2 hover:bg-indigo-500/10 hover:text-indigo-400 text-slate-400 rounded transition cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(prod.id)}
                            className="p-1 px-2 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card stacked views */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center italic text-slate-500 text-xs">No catalog products found.</div>
          ) : (
            filteredProducts.map((prod) => {
              const isLow = prod.stock <= prod.minStockAlert;
              const profitPct = prod.price > 0 ? ((prod.price - prod.cost) / prod.price) * 100 : 0;
              return (
                <div key={prod.id} className="p-4 bg-slate-950/20 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">{prod.sku}</span>
                        <span className="text-[9px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900/40 px-1.5 py-0.5 rounded">ID: {prod.id}</span>
                      </div>
                      <h4 className="font-extrabold text-white text-sm mt-1">{prod.name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-200 block text-xs">{formatMoney(prod.price)}</span>
                      <span className="text-[10px] text-[emerald-400] font-black">{profitPct.toFixed(0)}% Margin</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate">{prod.description || 'No description writeup'}</p>

                  <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-slate-900">
                    <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                      isLow 
                        ? 'bg-orange-950/50 border border-orange-500/30 text-orange-400' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      In-Stock: {prod.stock} units
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleStartEdit(prod)}
                        className="text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(prod.id)}
                        className="text-rose-400 font-bold hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300"
          >
            <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-1.5">
              <Package className="w-5 h-5 text-indigo-400" />
              {editingItem ? t.editProduct : t.addProduct}
            </h3>

            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850/80 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Product ID / پروڈکٹ آئی ڈی :</span>
                <span className="font-mono text-sm font-extrabold text-indigo-400">
                  {editingItem ? editingItem.id : getNextProductId(user.id)}
                </span>
                <span className="text-[9px] text-slate-500 block italic leading-none">(Auto-generated & cannot be edited)</span>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.productName} *</label>
                <input
                  type="text"
                  required
                  placeholder="MacBook Pro M3 Max"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">{t.sku}</label>
                  <input
                    type="text"
                    placeholder="MAC-M3-MAX"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-400">Stock In-hand *</label>
                  <input
                    type="number"
                    required
                    placeholder="25"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1">
                  <label className="font-bold text-slate-400">Buying Cost *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="60.00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="font-bold text-slate-400">Selling Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="99.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>

                <div className="col-span-1 space-y-1">
                  <label className="font-bold text-slate-400">Alert Limit *</label>
                  <input
                    type="number"
                    required
                    placeholder="5"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.description}</label>
                <textarea
                  placeholder="Details of memory, accessories or licensing block terms..."
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
                  {editingItem ? t.save : t.add}
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
            deleteProduct(user.id, deleteId);
            handleRefresh();
          }
        }}
        message="Are you sure you want to delete this product catalog item? If there are invoices referencing this catalog item, historical invoice figures are retained intact. This action cannot be undone."
        language={user.language}
      />
    </div>
  );
}
