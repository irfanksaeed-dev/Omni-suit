import React, { useState } from 'react';
import { UserTenant, DashboardStats } from '../types';
import { translations, currencySymbols } from '../translations';
import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, FileText, PlusCircle, ShoppingBag, Share2, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { getDashboardStats, getSales, getInvoices, getProducts } from '../db';
import { motion } from 'motion/react';

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

  // Dynamically derive short code from Tenant ID suffix
  const shortCodePart = user.id.startsWith('tenant-') ? user.id.replace('tenant-', '') : user.id;
  const rawShortCode = `OMNI-${shortCodePart.toUpperCase()}`;

  const handleCopyLink = () => {
    const magicLinkUrl = `${window.location.origin}/?tenantId=${user.id}`;
    navigator.clipboard.writeText(magicLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(rawShortCode);
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
  }, [user.id]);

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
        <div className="flex gap-2">
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
          className="glass p-5 rounded-2xl border-l-4 border-l-indigo-500 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.totalSales}</span>
            <div className="text-2xl font-black text-white">{formatMoney(stats.totalSales)}</div>
          </div>
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Total Expenses KPI */}
        <motion.div 
          variants={itemVariants} 
          className="glass p-5 rounded-2xl border-l-4 border-l-rose-500 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.totalExpenses}</span>
            <div className="text-2xl font-black text-white">{formatMoney(stats.totalExpenses)}</div>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
            <TrendingDown className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Net Profit KPI */}
        <motion.div 
          variants={itemVariants} 
          className="glass p-5 rounded-2xl border-l-4 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
          style={{ borderLeftColor: stats.profit >= 0 ? '#10b981' : '#f43f5e' }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.netProfit}</span>
            <div className={`text-2xl font-black ${stats.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatMoney(stats.profit)}
            </div>
          </div>
          <div className={`p-3 rounded-xl ${stats.profit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Total Customers KPI */}
        <motion.div 
          variants={itemVariants} 
          className="glass p-5 rounded-2xl border-l-4 border-l-blue-500 flex items-center justify-between shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl" />
          <div className="space-y-1">
            <span className="text-xs text-indigo-200/60 font-semibold uppercase tracking-wider">{t.customersCount}</span>
            <div className="text-2xl font-black text-white">{stats.customerCount}</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
            <Users className="w-5 h-5" />
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
              <p className="text-xs text-slate-500 py-6 text-center italic">No transactions recorded yet.</p>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id} className="bg-white/3 p-3 rounded-xl border border-white/5 flex justify-between items-center text-xs hover:bg-white/5 transition-all">
                  <div className="space-y-0.5">
                    <p className="font-bold text-white max-w-[180px] truncate">{sale.customerName}</p>
                    <p className="text-[10px] text-indigo-200/60">{sale.date} • <span className="text-indigo-300 capitalize text-[9px] font-mono">{sale.paymentMethod}</span></p>
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
              <p className="text-xs text-slate-500 py-6 text-center italic font-sans">No invoices drafted yet.</p>
            ) : (
              recentInvoices.map((inv) => (
                <div key={inv.id} className="bg-white/3 p-3 rounded-xl border border-white/5 flex justify-between items-center text-xs hover:bg-white/5 transition-all">
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
              <div key={prod.id} className="bg-slate-950/60 border border-slate-900/80 p-3 rounded-xl flex items-center justify-between text-xs">
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
                <span className="text-yellow-500 font-bold text-xs font-urdu">(سب سے زیادہ بکنے والی مصنوعات)</span>
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
                
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] ${
                          index === 0 ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30' :
                          index === 1 ? 'bg-slate-400/15 text-slate-300 border border-slate-400/30' :
                          'bg-indigo-950/50 text-indigo-400 border border-indigo-900/40'
                        }`}>
                          #{index + 1}
                        </span>
                        <span className="text-white font-bold">{item.name}</span>
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

      {/* Dynamic 1-Click Secure Sharing Desk (بزنس شیئرنگ ڈیسک) */}
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
                <span className="text-indigo-400 font-medium text-xs font-urdu">(آسان شیئر لنکس اور کوڈز)</span>
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
                <span className="text-indigo-300 font-urdu font-semibold">مخصوص شارٹ کوڈ</span>
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
                <span className="text-indigo-300 font-urdu font-semibold">براہ راست میجک لنک</span>
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
            💡 How to use / استعمال کرنے کا طریقہ:
          </p>
          <ul className="list-disc leading-relaxed pl-4 space-y-0.5 mt-1 font-medium text-slate-400">
            <li>Your employees, partners or branch devices can enter the Short Code <strong className="text-indigo-300 font-mono tracking-wider">{rawShortCode}</strong> directly in the <strong>"Magic Share Code" login tab</strong> on the main sign-in screen securely.</li>
            <li>ملازمین، منیجرز یا دیگر کاروباری آلات کو سائن اِن پیج پر موجود <strong>"Magic Share Code"</strong> والے سیکشن میں بس یہ کوڈ <strong className="text-indigo-300 font-mono tracking-wider">{rawShortCode}</strong> لکھنے کی ضرورت ہے، پاس ورڈ کے بغیر مکمل رسائی ممکن ہوگی۔</li>
          </ul>
        </div>
      </motion.div>
    </motion.div>
  );
}
