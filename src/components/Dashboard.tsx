import React, { useState } from 'react';
import { UserTenant, DashboardStats } from '../types';
import { translations, currencySymbols } from '../translations';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, FileText, PlusCircle, 
  ShoppingBag, Share2, Copy, Check, ExternalLink, ShieldCheck, RefreshCw,
  X, Search, Calendar, Briefcase, Award, Eye
} from 'lucide-react';
import { 
  getDashboardStats, getSales, getInvoices, getProducts, resetTenantData,
  getExpenses, getCustomers, getPurchases 
} from '../db';
import { motion } from 'motion/react';
import ConfirmModal from './ConfirmModal';

interface DashboardProps {
  user: UserTenant;
  stats: DashboardStats;
  onNavigate: (module: string) => void;
}

export default function Dashboard({ user, stats, onNavigate }: DashboardProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];
  
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  
  // Interactive KPI and row detailed selection state
  const [detailModal, setDetailModal] = useState<{
    type: 'sale' | 'invoice' | 'product' | 'kpi_sales' | 'kpi_expenses' | 'kpi_profit' | 'kpi_customers' | 'best_seller';
    data: any;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const openDetailModal = (type: 'sale' | 'invoice' | 'product' | 'kpi_sales' | 'kpi_expenses' | 'kpi_profit' | 'kpi_customers' | 'best_seller', data: any) => {
    setSearchQuery('');
    setDetailModal({ type, data });
  };

  const handleResetConfirm = () => {
    resetTenantData(user.id);
    setShowResetModal(false);
    window.location.reload();
  };

  // Dynamically derive short code from Tenant ID suffix
  const shortCodePart = user.id.startsWith('tenant-') ? user.id.replace('tenant-', '') : user.id;
  const rawShortCode = `OMNI-${shortCodePart.toUpperCase()}`;

  const copyToClipboard = (text: string): boolean => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      console.warn("Navigator clipboard blocked, using fallback", err);
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback copy failed:", err);
      return false;
    }
  };

  const handleCopyLink = () => {
    const magicLinkUrl = `${window.location.origin}/?tenantId=${user.id}`;
    copyToClipboard(magicLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    copyToClipboard(rawShortCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const recentSales = getSales(user.id).slice(-4).reverse();
  const recentInvoices = getInvoices(user.id).slice(-4).reverse();
  const criticalProducts = getProducts(user.id).filter(p => p.stock <= p.minStockAlert);

  // Dynamic Best Selling Products derivation
  const bestSellers = React.useMemo(() => {
    const allInvoices = getInvoices(user.id);
    const productSalesMap: Record<string, { id: string; name: string; quantity: number; revenue: number }> = {};
    
    allInvoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            id: item.productId,
            name: item.productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].revenue += item.total;
      });
    });
    
    // Sort by quantity sold descending
    return Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // top 5 best sellers
  }, [user.id, stats]);

  const formatMoney = (val: number) => {
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isRtl = user.language === 'ar' || user.language === 'ur';

  // Container configuration for animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Top Welcome Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center glass p-5 rounded-2xl border-indigo-500/15 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {t.welcomeUser}, {user.companyName}!
          </h2>
          <p className="text-xs text-indigo-300 mt-1">
            Running isolated Multi-tenant Space ID: <span className="font-mono text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-500/10">{user.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-550/25 hover:border-rose-500 text-rose-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer shadow-lg transition"
            title="Wipe sales, purchases, cost listings, expenses and invoice records"
            type="button"
          >
            <RefreshCw className="w-4 h-4 text-rose-400" />
            Reset Ledger
          </button>

          <button 
            onClick={() => onNavigate('invoices')}
            className="flex items-center gap-1.5 accent-gradient hover:opacity-90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer shadow-lg transition"
          >
            <PlusCircle className="w-4 h-4" />
            {t.createInvoice}
          </button>
        </div>
      </div>

      {/* KPI Stats Block Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales KPI */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => openDetailModal('kpi_sales', null)}
          className="glass p-5 rounded-2xl border-l-4 border-l-indigo-500 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.03] hover:border-indigo-500/40 transition-all duration-300 cursor-pointer"
          title="Click to view full sales details & records"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.totalSales}</span>
              <span className="text-[9px] text-indigo-400 bg-indigo-950/60 px-1 py-0.2 rounded border border-indigo-900 border-dashed group-hover:bg-indigo-900 group-hover:text-white transition-colors">Details</span>
            </div>
            <div className="text-2xl font-black text-white">{formatMoney(stats.totalSales)}</div>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
            <TrendingUp className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
        </motion.div>

        {/* Total Expenses KPI */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => openDetailModal('kpi_expenses', null)}
          className="glass p-5 rounded-2xl border-l-4 border-l-rose-500 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.03] hover:border-rose-500/40 transition-all duration-300 cursor-pointer"
          title="Click to view full expense logs & details"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.totalExpenses}</span>
              <span className="text-[9px] text-rose-450 bg-rose-950/60 px-1 py-0.2 rounded border border-rose-900 border-dashed group-hover:bg-rose-900 group-hover:text-white transition-colors">Details</span>
            </div>
            <div className="text-2xl font-black text-white">{formatMoney(stats.totalExpenses)}</div>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 group-hover:bg-rose-500/20 transition-all">
            <TrendingDown className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
        </motion.div>

        {/* Net Profit KPI */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => openDetailModal('kpi_profit', null)}
          className="glass p-5 rounded-2xl border-l-4 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.03] transition-all duration-300 cursor-pointer"
          style={{ 
            borderLeftColor: stats.profit >= 0 ? '#10b981' : '#f43f5e',
          }}
          title="Click to view Profit & Loss ledger summary statement"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.netProfit}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded border border-dashed transition-colors ${
                stats.profit >= 0 
                  ? 'text-emerald-450 bg-emerald-950/60 border-emerald-900 group-hover:bg-emerald-900 group-hover:text-white' 
                  : 'text-rose-450 bg-rose-950/60 border-rose-900 group-hover:bg-rose-900 group-hover:text-white'
              }`}>Details</span>
            </div>
            <div className={`text-2xl font-black ${stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatMoney(stats.profit)}
            </div>
          </div>
          <div className={`p-3 rounded-xl transition-all ${
            stats.profit >= 0 
              ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/20'
          }`}>
            <DollarSign className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
        </motion.div>

        {/* Total Customers KPI */}
        <motion.div 
          variants={itemVariants} 
          onClick={() => openDetailModal('kpi_customers', null)}
          className="glass p-5 rounded-2xl border-l-4 border-l-blue-500 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.03] hover:border-blue-500/40 transition-all duration-300 cursor-pointer"
          title="Click to view Active Customer profiles directory"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.customersCount}</span>
              <span className="text-[9px] text-blue-400 bg-blue-950/60 px-1 py-0.2 rounded border border-blue-900 border-dashed group-hover:bg-blue-900 group-hover:text-white transition-colors">Details</span>
            </div>
            <div className="text-2xl font-black text-white">{stats.customerCount}</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition-all">
            <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
        </motion.div>
      </div>

      {/* Low Stock Warnings widget if present */}
      {stats.lowStockCount > 0 && (
        <motion.div 
          variants={itemVariants}
          className="bg-orange-950/30 border border-orange-500/30 p-4 rounded-xl flex items-center gap-3 shadow-md"
        >
          <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
          <div className="flex-1 text-xs text-orange-200 font-medium">
            🚩 <strong>{t.lowStockStockAlert}:</strong> You have <strong>{stats.lowStockCount}</strong> product items running critically low on stock level! Click Warehouse on the sidebar to adjust counts immediately.
          </div>
          <button 
            onClick={() => onNavigate('inventory')}
            className="text-xs font-bold text-orange-400 hover:underline cursor-pointer"
          >
            {t.adjustStock}
          </button>
        </motion.div>
      )}

      {/* Feed Layout columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales block */}
        <motion.div 
          variants={itemVariants}
          className="glass p-5 rounded-2xl shadow-lg space-y-4 border-indigo-500/10"
        >
          <div className="flex justify-between items-center pb-2 border-b border-indigo-500/10">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              Recent Income & Sales
            </h3>
            <button 
              onClick={() => onNavigate('sales')} 
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-semibold cursor-pointer"
            >
              {t.view}
            </button>
          </div>

          <div className="space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic font-sans">No transactions recorded yet.</p>
            ) : (
              recentSales.map((sale) => (
                <div 
                  key={sale.id} 
                  onClick={() => openDetailModal('sale', sale)}
                  className="bg-white/3 p-3 rounded-xl border border-white/5 flex justify-between items-center text-xs hover:bg-white/5 hover:border-indigo-400/40 cursor-pointer transition-all duration-200"
                  title="Click to inspect this transaction's ledger detail receipt"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-white max-w-[180px] truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {sale.customerName}
                    </p>
                    <p className="text-[10px] text-indigo-200/60">{sale.date} • <span className="text-indigo-300 capitalize text-[9px] font-mono bg-indigo-950/55 border border-indigo-500/10 px-1 py-0.2 rounded">{sale.paymentMethod}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-emerald-400">+{formatMoney(sale.amount)}</p>
                    <p className="text-[9px] text-slate-400 truncate max-w-[100px]">{sale.description || sale.category}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Invoices block */}
        <motion.div 
          variants={itemVariants}
          className="glass p-5 rounded-2xl shadow-lg space-y-4 border-indigo-500/10"
        >
          <div className="flex justify-between items-center pb-2 border-b border-indigo-500/10">
            <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              Pending & Settled Invoices
            </h3>
            <button 
              onClick={() => onNavigate('invoices')} 
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-semibold cursor-pointer"
            >
              {t.view}
            </button>
          </div>

          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center italic font-sans font-medium">No invoices drafted yet.</p>
            ) : (
              recentInvoices.map((inv) => (
                <div 
                  key={inv.id} 
                  onClick={() => openDetailModal('invoice', inv)}
                  className="bg-white/3 p-3 rounded-xl border border-white/5 flex justify-between items-center text-xs hover:bg-white/5 hover:border-indigo-400/40 cursor-pointer transition-all duration-200"
                  title="Click to inspect this invoice's details, tax statement and items list"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-white text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded">{inv.invoiceNumber}</span>
                      <p className="font-bold text-slate-300 truncate max-w-[140px]">{inv.customerName}</p>
                    </div>
                    <p className="text-[9px] text-slate-400">{t.dueDate}: {inv.dueDate}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-extrabold text-white">{formatMoney(inv.total)}</p>
                      <p className="text-[9px] text-slate-500">{inv.items.length} items</p>
                    </div>
                    <span className={`px-2 py-0.5 font-bold rounded text-[9px] uppercase ${
                      inv.status === 'paid' 
                        ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-400' 
                        : inv.status === 'unpaid' 
                        ? 'bg-yellow-950/60 border border-yellow-500/30 text-yellow-500' 
                        : 'bg-red-950/60 border border-red-500/30 text-red-500'
                    }`}>
                      {t[inv.status]}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Critical Stock list if warnings exist */}
      {stats.lowStockCount > 0 && (
        <motion.div 
          variants={itemVariants}
          className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-lg space-y-3"
        >
          <h3 className="font-extrabold text-white text-xs uppercase text-orange-400 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Stock Replenishment Required List
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {criticalProducts.map(prod => (
              <div 
                key={prod.id} 
                onClick={() => openDetailModal('product', prod)}
                className="bg-slate-950/60 border border-slate-900/80 p-3 rounded-xl flex items-center justify-between text-xs hover:border-orange-500/45 cursor-pointer hover:bg-slate-950 transition-all duration-200"
                title="Click to inspect low stock alert for this product item"
              >
                <div>
                  <p className="font-bold text-white">{prod.name}</p>
                  <p className="text-[10px] font-mono text-slate-400">SKU: {prod.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-rose-400">{prod.stock} / {prod.minStockAlert}</p>
                  <p className="text-[9px] text-slate-500">In Hand</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Best Selling Products performance widget */}
      <motion.div 
        variants={itemVariants}
        className="glass p-5 rounded-2xl border border-indigo-500/10 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-indigo-500/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-yellow-500/10 rounded-xl text-yellow-500">
              <span className="text-sm font-sans">🏆</span>
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5 flex-wrap">
                Best Selling Products Performance
              </h3>
              <p className="text-[10px] text-slate-400">Displays live ranking of top-performing items based on quantity sold in invoice logs.</p>
            </div>
          </div>
          <span className="text-[9px] font-mono text-slate-550 font-semibold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 uppercase">Top Sales Rank</span>
        </div>

        {bestSellers.length === 0 ? (
          <div className="bg-slate-950/40 p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500 italic">
            No product sales record details to analyze best sellers. Log invoice sales to view trends.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Progression Meters List */}
            <div className="space-y-3.5">
              {bestSellers.map((item, index) => {
                const maxQty = bestSellers[0]?.quantity || 1;
                const percentage = Math.round((item.quantity / maxQty) * 100);
                const prodRef = getProducts(user.id).find(p => p.id === item.id);
                
                return (
                  <div 
                    key={item.id} 
                    onClick={() => openDetailModal('best_seller', { item, product: prodRef })}
                    className="space-y-1 cursor-pointer p-1.5 rounded-lg hover:bg-slate-900/30 border border-transparent hover:border-indigo-500/10 transition-all duration-200 group"
                    title="Click to view analytical breakdown, sales margins, and trends for this product"
                  >
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] ${
                          index === 0 ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30' :
                          index === 1 ? 'bg-slate-400/15 text-slate-300 border border-slate-400/30' :
                          'bg-indigo-950/50 text-indigo-400 border border-indigo-900/40'
                        }`}>
                          #{index + 1}
                        </span>
                        <span className="text-white font-bold group-hover:text-indigo-400">{item.name}</span>
                      </div>
                      <span className="text-indigo-400 font-mono font-bold text-[11px]">{item.quantity} sold</span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          index === 0 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                          index === 1 ? 'bg-gradient-to-r from-indigo-500 to-sky-400' :
                          'bg-indigo-605'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Performance Analytics Highlight Box */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850/80 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">🥇 HIGHEST PERFORMER STATS</span>
                <div className="text-white text-sm font-black truncate">{bestSellers[0]?.name}</div>
                <div className="text-slate-400 text-[11px] leading-relaxed">
                  This item is currently driving the majority of customer demand with <strong className="text-white">{bestSellers[0]?.quantity} units sold</strong>, generating an aggregate revenue of <strong className="text-emerald-400 font-mono">{formatMoney(bestSellers[0]?.revenue || 0)}</strong>.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-950 text-[10px] text-indigo-350 font-semibold flex items-center gap-1 mt-3">
                <span>⚡ Monitor warehouse inventory counts to ensure continuous availability.</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Dynamic 1-Click Secure Sharing Desk */}
      <motion.div 
        variants={itemVariants}
        className="glass p-5 rounded-2xl border border-indigo-500/10 shadow-xl space-y-4"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-500/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5 flex-wrap">
                Share Secure Workspace Access Desk
              </h3>
              <p className="text-[10px] text-slate-400">Distribute secure access links or short codes directly to your managers or staff terminals.</p>
            </div>
          </div>
          <span className="text-[8px] font-mono bg-indigo-950/40 text-indigo-400 px-2 py-0.5 rounded border border-indigo-900/30 uppercase font-black tracking-widest flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" /> Isolated
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Unique Short Code */}
          <div className="bg-slate-950/65 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <span>ERP Tenant Short Code</span>
              </div>
              <p className="text-[10px] text-slate-500">A clean code for quick manual sign-in on any terminal.</p>
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <span className="flex-1 bg-slate-900 border border-slate-800 text-sm font-black text-white font-mono px-3.5 py-2 rounded-lg text-center tracking-widest bg-gradient-to-r from-slate-950 to-slate-900">
                {rawShortCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2.5 bg-indigo-650 hover:bg-indigo-500 hover:text-white rounded-lg text-indigo-300 transition cursor-pointer shrink-0 border border-indigo-500/10 flex items-center justify-center"
                title="Copy Code"
                type="button"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Card 2: 1-Click Direct Magic URL Link */}
          <div className="bg-slate-950/65 p-4 rounded-xl border border-slate-850 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <span>Direct Magic Access Link</span>
              </div>
              <p className="text-[10px] text-slate-500">By-passes credential fields to load workspace immediately.</p>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/?tenantId=${user.id}`}
                className="flex-1 bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400 px-3.5 py-2 rounded-lg truncate text-center"
              />
              <button
                onClick={handleCopyLink}
                className="p-2.5 bg-indigo-650 hover:bg-indigo-500 hover:text-white rounded-lg text-indigo-300 transition cursor-pointer shrink-0 border border-indigo-500/10 flex items-center justify-center"
                title="Copy Link"
                type="button"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic usage instructions footer alerts */}
        <div className="pt-2 bg-slate-950/30 p-3.5 rounded-xl border border-slate-900/40 text-[10px] text-slate-400 space-y-1 leading-relaxed">
          <p className="font-semibold text-slate-350 flex items-center gap-1">
            💡 How to use:
          </p>
          <ul className="list-disc leading-relaxed pl-4 space-y-0.5 mt-1 font-medium text-slate-400">
            <li>Your employees, partners or branch devices can enter the Short Code <strong className="text-indigo-300 font-mono tracking-wider">{rawShortCode}</strong> directly in the <strong>"Magic Share Code" login tab</strong> on the main sign-in screen securely.</li>
          </ul>
        </div>
      </motion.div>

      {/* Interactive Detail Popup Cards Overlay Modal (Dashboard me Kisi bhi cheez par click krny se uski details Ani chahye) */}
      {detailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-2xl text-slate-200 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-250">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 bg-slate-900 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <span className="text-indigo-400 font-semibold p-1.5 bg-indigo-950/50 border border-indigo-900/30 rounded-xl">
                  {detailModal.type === 'sale' && <ShoppingBag className="w-4 h-4 text-emerald-400" />}
                  {detailModal.type === 'invoice' && <FileText className="w-4 h-4 text-indigo-400" />}
                  {detailModal.type === 'product' && <PlusCircle className="w-4 h-4 text-orange-400" />}
                  {detailModal.type === 'kpi_sales' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                  {detailModal.type === 'kpi_expenses' && <TrendingDown className="w-4 h-4 text-rose-400" />}
                  {detailModal.type === 'kpi_profit' && <DollarSign className="w-4 h-4 text-yellow-400" />}
                  {detailModal.type === 'kpi_customers' && <Users className="w-4 h-4 text-blue-400" />}
                  {detailModal.type === 'best_seller' && <Award className="w-4 h-4 text-yellow-500" />}
                </span>
                <h3 className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wide">
                  {detailModal.type === 'sale' && "Sale Transaction Receipt"}
                  {detailModal.type === 'invoice' && "Invoice Document Details"}
                  {detailModal.type === 'product' && "Product Profile Sheet"}
                  {detailModal.type === 'kpi_sales' && "Total Sales List"}
                  {detailModal.type === 'kpi_expenses' && "Total Expense Listing"}
                  {detailModal.type === 'kpi_profit' && "P&L Statement Summary"}
                  {detailModal.type === 'kpi_customers' && "Active Customers Register"}
                  {detailModal.type === 'best_seller' && "Best Seller Performance Analytics"}
                </h3>
              </div>
              <button 
                onClick={() => setDetailModal(null)}
                className="p-1 px-2.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition duration-150 cursor-pointer text-[11px] flex items-center gap-1 bg-white/5 border border-white/15"
              >
                <X className="w-4 h-4 text-rose-400" /> Close
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed font-sans max-h-[65vh]">
              
              {/* Type 1: Sale Details */}
              {detailModal.type === 'sale' && (() => {
                const sale = detailModal.data;
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2 flex-wrap gap-2">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Transaction ID</p>
                          <p className="font-mono text-white text-[11px] font-bold">{sale.id}</p>
                        </div>
                        <span className="text-[9px] font-mono px-2 py-0.5 font-bold uppercase rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                          Income Logged
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase">Customer Partner/Name</p>
                          <p className="text-white font-bold text-sm mt-0.5">{sale.customerName}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase">Amount Received</p>
                          <p className="text-emerald-400 font-black text-lg mt-0.5">{formatMoney(sale.amount)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase">Billing Date</p>
                          <p className="text-slate-300 font-semibold mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            {sale.date}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase">Payment Method</p>
                          <p className="text-slate-200 font-bold mt-0.5 capitalize">{sale.paymentMethod}</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-800 pt-3">
                        <p className="text-slate-500 text-[10px] uppercase">Description / Category</p>
                        <div className="text-slate-300 mt-1 font-medium italic bg-slate-950/50 p-2.5 rounded border border-slate-850">
                          {sale.description || "No description provided."} 
                          <span className="text-indigo-400 text-[10px] block font-mono not-italic mt-1.5 font-bold">Category: {sale.category}</span>
                        </div>
                      </div>
                    </div>

                    {sale.invoiceId && (
                      <div className="flex items-center justify-between bg-indigo-950/30 border border-indigo-900/30 p-3.5 rounded-xl">
                        <div className="text-indigo-300 text-[11px]">
                          💡 This transaction is linked with Invoice <strong className="font-mono text-white">{sale.invoiceId}</strong>.
                        </div>
                        <button 
                          onClick={() => {
                            const foundInvoice = getInvoices(user.id).find(i => i.id === sale.invoiceId);
                            if (foundInvoice) {
                              openDetailModal('invoice', foundInvoice);
                            }
                          }}
                          className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-500 hover:text-white rounded-lg text-white font-bold cursor-pointer transition text-[10.5px]"
                        >
                          View Invoice
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('sales');
                        }} 
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-indigo-400 hover:text-indigo-300 rounded-xl font-bold cursor-pointer transition border border-slate-800 text-xs flex items-center gap-1.5"
                      >
                        Go to Sales Module <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Type 2: Invoice Details */}
              {detailModal.type === 'invoice' && (() => {
                const inv = detailModal.data;
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 font-sans">
                      {/* Top Header Mock Invoice UI */}
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3 flex-wrap gap-2">
                        <div>
                          <p className="text-indigo-405 font-mono text-[11px] font-black underline decoration-indigo-500/30">{inv.invoiceNumber}</p>
                          <p className="text-white text-base font-extrabold mt-1">{user.companyName}</p>
                          <p className="text-slate-400 text-[10px]">{user.address || "Main Branch Office"}</p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border ${
                            inv.status === 'paid' 
                              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400' 
                              : inv.status === 'unpaid' 
                              ? 'bg-yellow-950/60 border-yellow-500/30 text-yellow-500' 
                              : 'bg-red-950/60 border-red-500/30 text-red-500'
                          }`}>
                            {inv.status}
                          </span>
                          <p className="text-slate-400 text-[10px] mt-2">Placed: {inv.date}</p>
                          <p className="text-rose-450 text-[10.5px] font-semibold">Due: {inv.dueDate}</p>
                        </div>
                      </div>

                      {/* Customer Bill To */}
                      <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl">
                        <p className="text-slate-500 text-[9px] uppercase tracking-wider">BILLED TO CUSTOMER (بل کردہ کسٹمر):</p>
                        <p className="text-slate-200 font-extrabold text-[12px] mt-0.5">{inv.customerName}</p>
                        <p className="text-slate-400 text-[10px] mt-1">Customer ID Ref: {inv.customerId}</p>
                      </div>

                      {/* Items table */}
                      <div className="space-y-2">
                        <p className="text-slate-500 text-[10px] uppercase">PRODUCT ITEMS DETAIL:</p>
                        <div className="bg-slate-950/60 rounded-xl border border-slate-850 overflow-hidden">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-900 border-b border-slate-850 text-slate-400">
                              <tr>
                                <th className="p-2 py-1.5">Product Name</th>
                                <th className="p-2 py-1.5 text-center">Qty</th>
                                <th className="p-2 py-1.5 text-right font-mono">Price</th>
                                <th className="p-2 py-1.5 text-right font-mono">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850 text-slate-300">
                              {inv.items && inv.items.length > 0 ? (
                                inv.items.map((item: any, i: number) => (
                                  <tr key={i}>
                                    <td className="p-2 py-2 font-bold text-white">{item.productName}</td>
                                    <td className="p-2 py-2 text-center font-bold text-indigo-300">{item.quantity}</td>
                                    <td className="p-2 py-2 text-right font-mono">{formatMoney(item.price)}</td>
                                    <td className="p-2 py-2 text-right font-mono text-emerald-400 font-bold">{formatMoney(item.total)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-slate-500 italic">No products attached to invoice ledger.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Invoice Totals calculation details */}
                      <div className="flex justify-end pt-1">
                        <div className="w-56 space-y-1.5 text-right border-t border-slate-800 pt-3">
                          <div className="flex justify-between text-slate-400 items-center">
                            <span>Subtotal:</span>
                            <span className="font-mono text-white text-[11.5px]">{formatMoney(inv.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400 items-center">
                            <span>Sales Tax ({inv.taxRate}%):</span>
                            <span className="font-mono text-white text-[11.5px]">{formatMoney(inv.taxAmount)}</span>
                          </div>
                          {inv.discount > 0 && (
                            <div className="flex justify-between text-rose-300 items-center">
                              <span>Discount (ڈسکاؤنٹ):</span>
                              <span className="font-mono text-rose-400">-{formatMoney(inv.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-base border-t border-slate-800 pt-2 font-extrabold text-white">
                            <span className="text-xs">GRAND TOTAL:</span>
                            <span className="font-mono text-emerald-400 text-lg">{formatMoney(inv.total)}</span>
                          </div>
                        </div>
                      </div>

                      {inv.notes && (
                        <div className="border-t border-slate-800 pt-3">
                          <p className="text-slate-500 text-[10px] uppercase">Notes & Terms (شرائط):</p>
                          <div className="text-slate-400 mt-1 italic leading-normal bg-slate-950/40 p-2.5 rounded border border-slate-850">{inv.notes}</div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('invoices');
                        }} 
                        className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-indigo-400 hover:text-indigo-300 rounded-xl font-bold cursor-pointer transition text-xs flex items-center gap-1.5"
                      >
                        Navigate to Invoices Module <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Type 3: Product Details */}
              {detailModal.type === 'product' && (() => {
                const prod = detailModal.data;
                const profitMarginValue = prod.price - prod.cost;
                const markupPercent = prod.cost > 0 ? Math.round((profitMarginValue / prod.cost) * 100) : 0;
                const stockHealth = prod.stock <= prod.minStockAlert;
                
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
                      
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3 flex-wrap gap-2">
                        <div>
                          <p className="text-indigo-400 font-mono text-[10.5px] font-bold">SKU CODE: {prod.sku}</p>
                          <h4 className="text-white text-lg font-black mt-1">{prod.name}</h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold border flex items-center gap-1 ${
                          stockHealth 
                            ? 'bg-rose-950/80 border-rose-500/30 text-rose-450 animate-pulse' 
                            : 'bg-emerald-950/80 border-emerald-500/30 text-emerald-450'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${stockHealth ? 'bg-rose-400 animate-ping' : 'bg-emerald-400'}`} />
                          {stockHealth ? 'CRITICAL LOW STOCK LEVEL' : 'STOCK HEALTHY'}
                        </span>
                      </div>

                      {/* Stock Level meter */}
                      <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
                        <div className="flex justify-between items-center text-[11px] mb-1">
                          <span className="text-slate-400 font-bold">In-Hand Store Units:</span>
                          <span className="text-white font-mono font-black text-sm">{prod.stock} Units</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${stockHealth ? 'bg-gradient-to-r from-rose-600 to-orange-450' : 'bg-gradient-to-r from-emerald-650 to-green-400'}`}
                            style={{ width: `${Math.min(100, Math.max(12, (prod.stock / (prod.minStockAlert * 3 || 10)) * 100))}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-500 flex justify-between pt-1">
                          <span>Replenish Alert Mark: <strong>{prod.minStockAlert} Units</strong></span>
                          <span>{stockHealth ? '⚠️ Under minimum benchmark' : '✓ Normal abundance'}</span>
                        </div>
                      </div>

                      {/* Pricing block */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-850">
                          <p className="text-[9.5px] uppercase text-slate-450">Purchased Average Cost</p>
                          <p className="text-white font-mono font-black text-sm mt-0.5">{formatMoney(prod.cost)}</p>
                        </div>
                        <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-850">
                          <p className="text-[9.5px] uppercase text-[#73A5C6]">Store Selling Price</p>
                          <p className="text-white font-mono font-black text-sm mt-0.5">{formatMoney(prod.price)}</p>
                        </div>
                        <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-850">
                          <p className="text-[9.5px] uppercase text-emerald-450">Profit Margin Mark</p>
                          <div className="text-emerald-450 font-mono font-black text-sm mt-0.5 flex items-center justify-between">
                            <span>+{formatMoney(profitMarginValue)}</span>
                            <span className="text-[9.5px] text-emerald-500 font-bold">({markupPercent}%)</span>
                          </div>
                        </div>
                      </div>

                      {/* Description and metadata */}
                      <div className="space-y-1">
                        <p className="text-slate-500 text-[10px] uppercase">PRODUCT SPECIFICATION / NOTES:</p>
                        <p className="text-slate-350 bg-slate-950/40 border border-slate-850 rounded-xl p-3 leading-relaxed italic">
                          {prod.description || "No supplemental details or warranty instructions logged for this product."}
                        </p>
                        <span className="text-[9px] font-mono text-slate-550 block pt-1">Added: {prod.createdAt ? prod.createdAt.split('T')[0] : "Legacy catalog"}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-850/40">
                      <div className="text-[10px] text-slate-500">
                        Need to restock inventory counts?
                      </div>
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('inventory');
                        }} 
                        className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-orange-450 hover:text-orange-400 rounded-xl font-bold cursor-pointer transition text-xs flex items-center gap-1.5"
                      >
                        Adjust Stock in Warehouse <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Type 4: Total Sales KPI detailing list */}
              {detailModal.type === 'kpi_sales' && (() => {
                const rawSalesList = getSales(user.id);
                const filteredSales = rawSalesList.filter(s => 
                  s.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (s.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  s.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  s.category.toLowerCase().includes(searchQuery.toLowerCase())
                ).reverse();

                return (
                  <div className="space-y-4">
                    {/* Filter card summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-center">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black">All Inflow</p>
                        <p className="text-white text-sm font-extrabold">{rawSalesList.length} Sales</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black">Volume Total</p>
                        <p className="text-emerald-400 text-sm font-black">{formatMoney(stats.totalSales)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black">Average Sale</p>
                        <p className="text-indigo-400 text-sm font-bold">
                          {rawSalesList.length ? formatMoney(stats.totalSales / rawSalesList.length) : formatMoney(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black">Latest</p>
                        <p className="text-slate-350 text-[10px] font-mono leading-tight truncate">{rawSalesList[rawSalesList.length - 1]?.date || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Search bar inside modal */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Search sales by Customer name, category, payment type..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Search results list */}
                    <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                      {filteredSales.length === 0 ? (
                        <p className="text-center py-6 text-slate-500 italic">No matching sales records found.</p>
                      ) : (
                        filteredSales.map(sale => (
                          <div 
                            key={sale.id}
                            onClick={() => openDetailModal('sale', sale)}
                            className="bg-slate-900/50 hover:bg-slate-950 border border-slate-850/60 rounded-xl p-3 flex justify-between items-center hover:border-indigo-500/40 cursor-pointer transition"
                            title="Click for full sale receipt details"
                          >
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-200 flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                {sale.customerName}
                              </p>
                              <p className="text-[10px] text-slate-450">{sale.date} • <span className="uppercase text-[9px] text-indigo-400 tracking-wider font-semibold font-mono">{sale.paymentMethod}</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-400 font-extrabold text-xs">+{formatMoney(sale.amount)}</p>
                              <p className="text-[9.5px] text-slate-505 font-medium">{sale.category}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-850/40">
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('sales');
                        }} 
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-indigo-400 hover:text-indigo-300 rounded-xl border border-slate-800 font-bold cursor-pointer transition text-xs"
                      >
                        Open Sales Entry Module
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Type 5: Total Expenses KPI details list */}
              {detailModal.type === 'kpi_expenses' && (() => {
                const rawExpensesList = getExpenses(user.id);
                const filteredExpenses = rawExpensesList.filter(e => 
                  e.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  e.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (e.description || '').toLowerCase().includes(searchQuery.toLowerCase())
                ).reverse();

                return (
                  <div className="space-y-4">
                    {/* Summary statistics bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900 border border-slate-800 p-3.5 rounded-xl text-center">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black font-semibold">Outflow Items</p>
                        <p className="text-white text-sm font-extrabold">{rawExpensesList.length} Logged</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black">Total Cost Output</p>
                        <p className="text-rose-450 text-sm font-black">{formatMoney(stats.totalExpenses)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black">Average Expense</p>
                        <p className="text-indigo-400 text-sm font-bold">
                          {rawExpensesList.length ? formatMoney(stats.totalExpenses / rawExpensesList.length) : formatMoney(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase font-black">Status</p>
                        <p className="text-emerald-400 text-[10.5px] uppercase font-mono tracking-wider font-extrabold leading-tight">✓ Audited</p>
                      </div>
                    </div>

                    {/* Search bar inside modal */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Search expenses by Category, Vendor recipient, or details..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* Expense lists scrolling area */}
                    <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                      {filteredExpenses.length === 0 ? (
                        <p className="text-center py-6 text-slate-500 italic">No matching expense logs found.</p>
                      ) : (
                        filteredExpenses.map(exp => (
                          <div 
                            key={exp.id}
                            className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 flex justify-between items-center"
                          >
                            <div className="space-y-1">
                              <p className="font-extrabold text-slate-200 text-xs">
                                {exp.recipient}
                              </p>
                              <p className="text-[10px] text-slate-450">{exp.date} • <span className="text-[9.5px] text-slate-400 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-850">{exp.category}</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-rose-450 font-black text-xs">-{formatMoney(exp.amount)}</p>
                              <p className="text-[9.5px] text-slate-500 truncate max-w-[150px] italic">{exp.description || 'No description'}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-850/40">
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('expenses');
                        }} 
                        className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl font-bold cursor-pointer transition text-xs"
                      >
                        Log Expense Entry Module
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Type 6: KPI Net Profit statement */}
              {detailModal.type === 'kpi_profit' && (() => {
                const totalIncome = stats.totalSales;
                const totalCost = stats.totalExpenses;
                const marginPercentage = totalIncome > 0 ? ((stats.profit / totalIncome) * 100).toFixed(1) : '0';
                
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-3.5">
                      <h4 className="font-black text-white text-xs uppercase tracking-wider text-slate-400">Ledger P&L Balance Sheet</h4>
                      
                      <div className="space-y-2 divide-y divide-slate-850">
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-400 font-medium">Total Revenue (Gross Receipts):</span>
                          <span className="text-white font-mono font-black text-base">{formatMoney(totalIncome)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-400 font-medium">Minus Total Operating Expenses:</span>
                          <span className="text-rose-400 font-mono font-bold text-sm">-{formatMoney(totalCost)}</span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                          <span className="text-white font-extrabold">Net Operating Surplus profit:</span>
                          <span className={`font-mono font-black text-lg ${stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-405'}`}>
                            {formatMoney(stats.profit)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-slate-400">
                        <p className="text-[10px] uppercase font-bold text-indigo-400">Aggregate Operating Margin Value:</p>
                        <p className="text-[11.5px] leading-relaxed mt-1">
                          Your business domain operates at a net profit margin capacity of <strong className="text-white font-mono text-xs">{marginPercentage}%</strong>. Keep operating expenses low to optimize net cash return. 
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-[#0b101c]/90 border border-slate-900 p-3.5 rounded-xl">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-400 block pb-1 border-b border-white/5">🏆 Income Stream Highs</span>
                        {getSales(user.id).slice(-3).reverse().map((s, i) => (
                          <div key={i} className="flex justify-between text-[10px] pt-1.5">
                            <span className="truncate text-slate-350 max-w-[120px]">{s.customerName}</span>
                            <span className="text-emerald-400 font-mono font-bold">{formatMoney(s.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-[#0b101c]/90 border border-slate-900 p-3.5 rounded-xl">
                        <span className="text-[9px] uppercase tracking-wider font-bold text-rose-450 block pb-1 border-b border-white/5 font-semibold">💸 Expense Outflows</span>
                        {getExpenses(user.id).slice(-3).reverse().map((e, i) => (
                          <div key={i} className="flex justify-between text-[10px] pt-1.5">
                            <span className="truncate text-slate-350 max-w-[120px]">{e.recipient}</span>
                            <span className="text-rose-400 font-mono font-bold">-{formatMoney(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('reports');
                        }} 
                        className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 hover:text-white text-white rounded-xl font-bold cursor-pointer transition text-xs flex items-center gap-1.5"
                      >
                        Open Full Profit Reports <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Type 7: Customer Profiles Directory list */}
              {detailModal.type === 'kpi_customers' && (() => {
                const rawCustomersList = getCustomers(user.id);
                const filteredCustomers = rawCustomersList.filter(c => 
                  c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (c.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (c.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (c.address || '').toLowerCase().includes(searchQuery.toLowerCase())
                );

                return (
                  <div className="space-y-4">
                    {/* Summary metrics header */}
                    <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex justify-around text-center">
                      <div>
                        <p className="text-[9.5px] text-slate-500 uppercase font-black">Registered Customers</p>
                        <p className="text-white text-base font-extrabold mt-0.5">{rawCustomersList.length} Profiles</p>
                      </div>
                      <span className="w-px bg-slate-850 self-stretch" />
                      <div>
                        <p className="text-[9.5px] text-slate-500 uppercase font-black">Security status</p>
                        <p className="text-emerald-400 text-sm font-bold mt-1">Multi-tenant Clean</p>
                      </div>
                    </div>

                    {/* Search query field */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input 
                        type="text" 
                        placeholder="Search customers by Name, Email, Phone number, or billing town..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-850 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Customer directory dynamic lists scrolling area */}
                    <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                      {filteredCustomers.length === 0 ? (
                        <p className="text-center py-6 text-slate-500 italic">No customer profiles found matching filters.</p>
                      ) : (
                        filteredCustomers.map(customer => {
                          const customerInvoiceLogs = getInvoices(user.id).filter(i => i.customerId === customer.id);
                          const isBlocked = customer.isBlocked === true;
                          return (
                            <div 
                              key={customer.id}
                              className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 space-y-2 hover:border-blue-500/20 hover:bg-slate-900 transition duration-150"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-extrabold text-[#74A3CE] text-sm">{customer.name}</p>
                                  <p className="text-[10px] text-slate-450 font-mono">IDRef: {customer.id}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[8px] tracking-wider uppercase font-black ${
                                  isBlocked 
                                    ? 'bg-rose-950/60 border border-rose-500/20 text-rose-450' 
                                    : 'bg-emerald-950/60 border border-emerald-500/20 text-emerald-400'
                                }`}>
                                  {isBlocked ? 'Blocked (معطل)' : 'Active (سرگرم)'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] text-slate-350 border-t border-slate-950 pt-2 leading-relaxed">
                                <div>📞 Phone: <strong className="text-white font-mono">{customer.phone || 'N/A'}</strong></div>
                                <div>✉ Email: <strong className="text-white font-semibold">{customer.email || 'No email registered'}</strong></div>
                                <div className="sm:col-span-2">🏠 Billing Address: <strong className="text-white">{customer.address || 'Address undefined'}</strong></div>
                              </div>

                              <div className="flex justify-between items-center text-[10px] bg-slate-950/60 px-2.5 py-1.5 rounded-lg border border-slate-850">
                                <span className="text-slate-400">Invoices on Ledger: <strong>{customerInvoiceLogs.length} bills</strong></span>
                                <span className="text-slate-400 font-medium">Registered: <strong>{customer.createdAt ? customer.createdAt.split('T')[0] : 'Legend list'}</strong></span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-850/40">
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('customers');
                        }} 
                        className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-indigo-400 rounded-xl font-bold cursor-pointer transition text-xs"
                      >
                        Adjust Customer Accounts
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Type 8: Best Seller individual analytics details */}
              {detailModal.type === 'best_seller' && (() => {
                const { item, product } = detailModal.data;
                const totalIncome = item.revenue;
                const estMargin = product ? (product.price - product.cost) * item.quantity : 0;
                
                return (
                  <div className="space-y-4">
                    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 font-sans">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🏆</span>
                        <div>
                          <p className="text-yellow-500 font-mono text-[9px] uppercase tracking-wider font-extrabold bg-yellow-950/40 px-2 py-0.5 rounded border border-yellow-900 w-max">TOP PRODUCT</p>
                          <h4 className="text-white text-base font-black mt-1">{item.name}</h4>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-850">
                          <p className="text-[10px] text-slate-500 uppercase font-black">Units Sold on Ledger</p>
                          <p className="text-indigo-400 font-black text-xl mt-1">{item.quantity} Units</p>
                        </div>
                        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-850">
                          <p className="text-[10px] text-slate-500 uppercase font-black font-semibold">Grand Income Contribution</p>
                          <p className="text-[#10b981] font-black text-xl mt-1">{formatMoney(totalIncome)}</p>
                        </div>
                      </div>

                      {product ? (
                        <div className="border-t border-slate-800 pt-3 space-y-3">
                          <p className="text-slate-500 text-[9.5px] uppercase font-bold text-slate-400">PRODUCT UNIT ATTRIBUTES:</p>
                          <div className="grid grid-cols-3 gap-2.5 text-center text-[11px] text-slate-300">
                            <div className="bg-slate-950 p-2 rounded border border-slate-900">
                              <span>Unit Cost: <strong>{formatMoney(product.cost)}</strong></span>
                            </div>
                            <div className="bg-slate-950 p-2 rounded border border-slate-900">
                              <span>Retail Price: <strong>{formatMoney(product.price)}</strong></span>
                            </div>
                            <div className="bg-slate-950 p-2 rounded border border-slate-900">
                              <span>Margin: <strong className="text-emerald-400">+{formatMoney(product.price - product.cost)}</strong></span>
                            </div>
                          </div>

                          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-1 text-slate-400">
                            <p className="text-[10px] uppercase font-bold text-yellow-505">🏆 Net Cash Inflow Contribution:</p>
                            <p className="text-[11.5px] leading-relaxed">
                              This top-selling list item contributed an estimated total gross profit surplus surplus of <strong className="text-white font-mono">{formatMoney(estMargin)}</strong> towards your active multi-tenant space ledger statement balance!
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-950/20 border border-yellow-900/30 p-3 rounded-xl text-yellow-450 text-[11px]">
                          ⚠️ Note: Core catalog attributes have evolved since invoice logs were completed. Unit cost parameters are unavailable.
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button 
                        onClick={() => {
                          setDetailModal(null);
                          onNavigate('inventory');
                        }} 
                        className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-indigo-400 rounded-xl font-bold cursor-pointer transition text-xs flex items-center gap-1"
                      >
                        Warehouse Management desk <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-850 text-right flex justify-between items-center text-[10.5px] text-slate-500">
              <span className="font-mono text-slate-550 font-semibold uppercase">OMNI-SUITE Isolated Multi-tenant system</span>
              <button 
                onClick={() => setDetailModal(null)} 
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg hover:text-white transition duration-150 cursor-pointer font-bold border border-slate-700"
              >
                Close (بند کریں)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Wipe Data Safety Check Portal */}
      <ConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(null as any)}
        onConfirm={handleResetConfirm}
        title="Reset Tenant Ledger Ledger?"
        message="This is a highly dangerous operation! This will permanently delete ALL registered customers, product listings, sales revenue sheets, supplier purchase logs, operations expenses, and dynamic generated invoices for your tenant workspace. Click Confirm or Reset below to wipe clean."
        language={user.language}
      />
    </motion.div>
  );
}
