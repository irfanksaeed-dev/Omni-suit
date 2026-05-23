import React, { useState, useMemo } from 'react';
import { UserTenant } from '../types';
import { translations, currencySymbols } from '../translations';
import { getSales, getExpenses, getInvoices, getProducts } from '../db';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, FileSpreadsheet, BarChart2, Calendar, ShoppingBag, PieChart as PieIcon, Coins } from 'lucide-react';

interface ReportsModuleProps {
  user: UserTenant;
}

export default function ReportsModule({ user }: ReportsModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const sales = useMemo(() => getSales(user.id), [user.id]);
  const expenses = useMemo(() => getExpenses(user.id), [user.id]);
  const products = useMemo(() => getProducts(user.id), [user.id]);

  const [activeTab, setActiveTab] = useState<'monthly' | 'yearly' | 'products'>('monthly');

  const formatMoney = (val: number) => {
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // 1. Calculate Monthly stats for 2026
  const monthlyChartData = useMemo(() => {
    // Standard names for month coordinates
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = monthNames.map((name, idx) => ({
      name,
      Sales: 0,
      Expenses: 0,
      Profit: 0,
    }));

    // Aggregate Sales of current active year (2026 is our simulated time)
    sales.forEach(sale => {
      const d = new Date(sale.date);
      if (d.getFullYear() === 2026) {
        const monthIndex = d.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          data[monthIndex].Sales += sale.amount;
        }
      }
    });

    // Aggregate Expenses
    expenses.forEach(exp => {
      const d = new Date(exp.date);
      if (d.getFullYear() === 2026) {
        const monthIndex = d.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          data[monthIndex].Expenses += exp.amount;
        }
      }
    });

    // Compute net Profit index
    data.forEach(item => {
      item.Profit = item.Sales - item.Expenses;
    });

    return data;
  }, [sales, expenses]);

  // 2. Calculate Yearly statistics
  const yearlyChartData = useMemo(() => {
    const years = ['2024', '2025', '2026'];
    const data = years.map(yr => ({
      name: yr,
      Sales: 0,
      Expenses: 0,
    }));

    sales.forEach(sale => {
      const yrStr = new Date(sale.date).getFullYear().toString();
      const idx = data.findIndex(item => item.name === yrStr);
      if (idx !== -1) {
        data[idx].Sales += sale.amount;
      }
    });

    expenses.forEach(exp => {
      const yrStr = new Date(exp.date).getFullYear().toString();
      const idx = data.findIndex(item => item.name === yrStr);
      if (idx !== -1) {
        data[idx].Expenses += exp.amount;
      }
    });

    return data;
  }, [sales, expenses]);

  // 3. Products Sales volume performance tracker
  const productChartData = useMemo(() => {
    // Generate volume map of sales descriptions matching database catalog products
    const salesVolumeMap: Record<string, number> = {};
    
    sales.forEach(sale => {
      // Find matching product keywords or direct description logs
      products.forEach(p => {
        if (sale.description.toLowerCase().includes(p.name.toLowerCase()) || 
            sale.description.toLowerCase().includes(p.sku.toLowerCase())) {
          salesVolumeMap[p.name] = (salesVolumeMap[p.name] || 0) + sale.amount;
        }
      });
    });

    const data = Object.keys(salesVolumeMap).map(key => ({
      name: key,
      value: salesVolumeMap[key],
    }));

    // If empty demo sales, fallback to catalog stock values as placeholder design
    if (data.length === 0) {
      return products.map(p => ({
        name: p.name,
        value: p.price * (p.stock > 10 ? 10 : p.stock + 1)
      })).slice(0, 4);
    }

    return data;
  }, [sales, products]);

  const COLORS = ['#6366f1', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#a855f7'];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-400" />
            {t.reports}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Visualize monthly revenue channels, cost distributions, and product traction grids.</p>
        </div>

        {/* Tab triggers */}
        <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ${
              activeTab === 'monthly' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            2026 Monthly View
          </button>
          <button
            onClick={() => setActiveTab('yearly')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ${
              activeTab === 'yearly' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Annual View
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 ${
              activeTab === 'products' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Product traction
          </button>
        </div>
      </div>

      {/* Reports Canvas Box */}
      {sales.length === 0 && expenses.length === 0 ? (
        <div className="bg-slate-900/10 border border-slate-850 p-12 rounded-2xl text-center text-xs italic text-slate-500">
          {t.noChartData}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Main Selected Graph Container */}
          <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="font-extrabold text-white text-xs uppercase text-slate-400 tracking-wider">
              {activeTab === 'monthly' && t.monthlyDistribution}
              {activeTab === 'yearly' && t.annualPerformance}
              {activeTab === 'products' && t.productSalesPerformance}
            </h3>

            {/* Recharts responsive component */}
            <div className="w-full h-80 text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'monthly' ? (
                  <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                      formatter={(val: number) => [formatMoney(val)]}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="Sales" name={t.totalSales} fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" name={t.totalExpenses} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : activeTab === 'yearly' ? (
                  <LineChart data={yearlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                      formatter={(val: number) => [formatMoney(val)]}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Line type="monotone" dataKey="Sales" name={t.totalSales} stroke="#3b82f6" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Expenses" name={t.totalExpenses} stroke="#ec4899" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={productChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {productChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      formatter={(val: number) => [formatMoney(val)]}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick numbers summary grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold block">Gross Revenue Generated</span>
              <p className="text-xl font-black text-emerald-400 mt-1">
                {formatMoney(sales.reduce((sum, s) => sum + s.amount, 0))}
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Sum of direct cash & paid invoice files.</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold block">Gross Costs Spent</span>
              <p className="text-xl font-black text-rose-400 mt-1">
                {formatMoney(expenses.reduce((sum, e) => sum + e.amount, 0))}
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Direct wages, marketing outlays & stock purchases.</p>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] text-slate-500 font-bold block">Consolidated Net Profit</span>
              <p className="text-xl font-black text-white mt-1">
                {formatMoney(sales.reduce((sum, s) => sum + s.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0))}
              </p>
              <p className="text-[9px] text-slate-400 mt-1">Operating margin percentage levels.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
