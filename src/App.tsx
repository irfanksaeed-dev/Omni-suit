import React, { useState, useEffect } from 'react';
import { 
  initializeDatabase, 
  getActiveUser, 
  getDashboardStats, 
  setActiveUser, 
  getTenants, 
  customerLoginLookup, 
  logAccess,
  updateActiveSession,
  pullServerSync,
  getSupportChats,
  addChatMessage,
  markChatAsRead
} from './db';
import { UserTenant, Customer, DashboardStats, Language } from './types';
import { translations } from './translations';
import AuthScreen from './components/AuthScreen';
import CustomerPortal from './components/CustomerPortal';
import Dashboard from './components/Dashboard';
import SalesModule from './components/SalesModule';
import ExpensesModule from './components/ExpensesModule';
import CustomersModule from './components/CustomersModule';
import ProductsModule from './components/ProductsModule';
import InvoicesModule from './components/InvoicesModule';
import InventoryModule from './components/InventoryModule';
import ReportsModule from './components/ReportsModule';
import SettingsModule from './components/SettingsModule';
import AdminModule from './components/AdminModule';
import { 
  LayoutDashboard, 
  Receipt, 
  CreditCard, 
  Users, 
  Package, 
  FileText, 
  Layers, 
  BarChart2, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Building2,
  Globe,
  Shield,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  AlertTriangle,
  Clock,
  MessageCircle,
  ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function getApiUrl(path: string): string {
  let origin = '';
  try {
    if (typeof window !== 'undefined' && window.location) {
      origin = window.location.origin;
      if (origin === 'null' || !origin) {
        const url = new URL(window.location.href);
        if (url.origin && url.origin !== 'null') {
          origin = url.origin;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return (origin && origin !== 'null') ? `${origin}${path}` : path;
}

export default function App() {
  const [user, setUser] = useState<UserTenant | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  
  // App-wide data pulling/refresh status
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Interface Language
  const [lang, setLang] = useState<Language>('en');

  // Customer session states
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [customerTenant, setCustomerTenant] = useState<UserTenant | null>(null);
  const [initialInvoiceId, setInitialInvoiceId] = useState<string | null>(null);

  // Admin original credentials backup for impersonation mode
  const [impersonatingFrom, setImpersonatingFrom] = useState<UserTenant | null>(null);

  // Loading sync state for first mount
  const [loadingSync, setLoadingSync] = useState(true);

  // Load and initialize database & parse URL magic login parameters
  useEffect(() => {
    async function initAndSync() {
      try {
        const res = await fetch(getApiUrl('/api/db'));
        if (res.ok) {
          const cloudDb = await res.json();
          const SYNC_KEYS = [
            'biz_suite_tenants',
            'biz_suite_customers',
            'biz_suite_products',
            'biz_suite_invoices',
            'biz_suite_sales',
            'biz_suite_expenses',
            'biz_suite_access_logs'
          ];
          SYNC_KEYS.forEach(key => {
            if (cloudDb && cloudDb[key] !== undefined) {
              localStorage.setItem(key, JSON.stringify(cloudDb[key]));
            }
          });
        }
      } catch (err: any) {
        console.warn('Unable to pull cloud database. Continuing with offline local storage fallback:', err.message || err);
      }

      initializeDatabase();

      // Ensure any first-time automatically seeded records (or newly-created tenant profiles) are synced back to the persistent file on the server
      try {
        const dbData: Record<string, any> = {};
        const SYNC_KEYS = [
          'biz_suite_tenants',
          'biz_suite_customers',
          'biz_suite_products',
          'biz_suite_invoices',
          'biz_suite_sales',
          'biz_suite_expenses',
          'biz_suite_access_logs'
        ];
        SYNC_KEYS.forEach(key => {
          const val = localStorage.getItem(key);
          if (val) {
            dbData[key] = JSON.parse(val);
          }
        });
        await fetch(getApiUrl('/api/db'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dbData)
        });
      } catch (err: any) {
        console.warn('Initialization backup cloud synchronization is currently offline:', err.message || err);
      }

      // Check for Magic direct login links
      const params = new URLSearchParams(window.location.search);
      const paramTenantId = params.get('tenantId');
      const paramAutologin = params.get('autologin');
      const paramCustEmail = params.get('customerEmail');
      const paramCustPhone = params.get('customerPhone');
      const paramInvoiceId = params.get('invoiceId');

      if (paramInvoiceId) {
        setInitialInvoiceId(paramInvoiceId);
      }

      let actionDone = false;

      if (paramTenantId) {
        const matched = getTenants().find(t => t.id === paramTenantId && t.isActive !== false);
        if (matched) {
          logAccess('merchant', matched.id, matched.companyName, matched.email, 'Accessed ERP workspace via magic direct link');
          setActiveUser(matched);
          setUser(matched);
          setLang(matched.language);
          setStats(getDashboardStats(matched.id));
          // Remove parameters from URL bar silently
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
          actionDone = true;
        }
      } else if (paramAutologin) {
        const matched = getTenants().find(t => t.email.toLowerCase() === paramAutologin.toLowerCase() && t.isActive !== false);
        if (matched) {
          logAccess('merchant', matched.id, matched.companyName, matched.email, 'Accessed ERP workspace via login email signature link');
          setActiveUser(matched);
          setUser(matched);
          setLang(matched.language);
          setStats(getDashboardStats(matched.id));
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
          actionDone = true;
        }
      } else if (paramCustEmail || paramCustPhone) {
        const searchVal = paramCustEmail || paramCustPhone || '';
        const matches = customerLoginLookup(searchVal);
        const activeMatches = matches.filter(m => !m.customer.isBlocked);
        if (activeMatches.length > 0) {
          const first = activeMatches[0];
          logAccess('customer', first.customer.id, first.customer.name, first.customer.email, `Accessed customer portal via magic identifier link (${first.tenant.companyName})`);
          setActiveCustomer(first.customer);
          setCustomerTenant(first.tenant);
          setLang(first.tenant.language);
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
          actionDone = true;
        }
      }

      if (!actionDone) {
        const active = getActiveUser();
        if (active) {
          logAccess('merchant', active.id, active.companyName, active.email, 'Opened/Resumed persistent cloud ERP session');
          setUser(active);
          setLang(active.language);
          setStats(getDashboardStats(active.id));
        }
      }

      // Restore impersonation backup context on full reload
      const storedBackup = localStorage.getItem('biz_suite_original_admin');
      if (storedBackup) {
        try {
          setImpersonatingFrom(JSON.parse(storedBackup));
        } catch (e) {
          console.error(e);
        }
      }

      setLoadingSync(false);
    }

    initAndSync();
  }, []);

  // Live Chat support states for standard merchants and customers
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Periodically check sessions, pull database, and update active state
  useEffect(() => {
    if (!user) {
      setChatMessages([]);
      setUnreadChatCount(0);
      return;
    }

    // Direct initialization
    updateActiveSession(user.id, user.email, user.companyName, activeModule);
    setChatMessages(getSupportChats());

    const interval = setInterval(async () => {
      // 1. Fetch fresh JSON DB from server to capture live chat and block changes
      await pullServerSync();

      // 2. Ping active session online status
      updateActiveSession(user.id, user.email, user.companyName, activeModule);

      // 3. Keep tenants list synchronized
      const tenantsList = getTenants();
      const freshMe = tenantsList.find(t => t.id === user.id);
      if (freshMe) {
        setUser(prev => {
          if (!prev) return null;
          if (JSON.stringify(prev) !== JSON.stringify(freshMe)) {
            return freshMe; // Instantly react to block status updates
          }
          return prev;
        });
      }

      // 4. Update Chat message histories for Live support
      const allChats = getSupportChats();
      setChatMessages(allChats);

      // Count unread incoming messages (sender is NOT me and receiver is me and isRead is false)
      const unread = allChats.filter(msg => 
        msg.receiverEmail === user.email && !msg.isRead
      ).length;
      setUnreadChatCount(unread);

    }, 4000); // 4-second precise intervals for responsive multi-user experiences

    return () => clearInterval(interval);
  }, [user, activeModule]);

  // Read message handler upon expanding chat panel
  useEffect(() => {
    if (user && isChatOpen) {
      if (user.email === 'irfanksaeed@gmail.com') {
        // Super admin read occurs when selecting a tenant thread inside AdminModule
      } else {
        markChatAsRead('irfanksaeed@gmail.com', user.email);
        setChatMessages(getSupportChats());
        setUnreadChatCount(0);
      }
    }
  }, [isChatOpen, user]);

  // Restrict and Log attempted accesses to blocked modules
  useEffect(() => {
    if (!user) return;
    const isSpecialAdmin = user.email.toLowerCase() === 'irfanksaeed@gmail.com';
    if (!isSpecialAdmin && user.bannedModules?.includes(activeModule)) {
      // Log as potential evasion/suspicious activity immediately
      logAccess(
        'merchant',
        user.id,
        user.companyName,
        user.email,
        `⚠️ Suspicious Evasion Alert: Tried to bypass security limits & enter banned section: [${activeModule.toUpperCase()}]`
      );
    }
  }, [activeModule, user]);

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chatText.trim()) return;

    // Normal merchant user sends to Irfan
    const adminEmail = 'irfanksaeed@gmail.com';
    addChatMessage(user.email, user.companyName || 'Merchant', adminEmail, chatText.trim());
    
    setChatText('');
    setChatMessages(getSupportChats());
  };

  const handleStopImpersonating = () => {
    const backup = localStorage.getItem('biz_suite_original_admin');
    if (backup) {
      try {
        const adminUser = JSON.parse(backup) as UserTenant;
        setActiveUser(adminUser);
        setUser(adminUser);
        setLang(adminUser.language);
        setStats(getDashboardStats(adminUser.id));
        setImpersonatingFrom(null);
        localStorage.removeItem('biz_suite_original_admin');
        setActiveModule('admin'); // Instantly navigate back to SysAdmin
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Update Stats when transactions change
  const handleRefreshStats = () => {
    if (user) {
      setStats(getDashboardStats(user.id));
    }
  };

  const handleAuthSuccess = (authenticatedUser: UserTenant) => {
    setUser(authenticatedUser);
    setLang(authenticatedUser.language);
    setStats(getDashboardStats(authenticatedUser.id));
    setActiveModule('dashboard');
  };

  const handleUpdateUser = (updatedUser: UserTenant) => {
    setUser(updatedUser);
    setLang(updatedUser.language);
    setStats(getDashboardStats(updatedUser.id));
  };

  const handleSignOut = () => {
    setActiveUser(null);
    setUser(null);
    setStats(null);
  };

  const handleAppRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Refresh global and tenant isolations from cloud database
      await pullServerSync();
      initializeDatabase();

      // 2. Query fresh database stats
      if (user) {
        const tenantsList = getTenants();
        const freshUser = tenantsList.find(t => t.id === user.id);
        if (freshUser) {
          setUser(freshUser);
          setLang(freshUser.language);
        }
        setStats(getDashboardStats(user.id));
      }
    } catch (err) {
      console.error("App pull/refresh error:", err);
    } finally {
      // Small tactile delay to let the animation spin nicely
      setTimeout(() => {
        setIsRefreshing(false);
      }, 750);
    }
  };

  // Loading overlay while completing negotiation with central store
  if (loadingSync) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans tracking-tight text-slate-100">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="text-center space-y-6 max-w-sm px-6"
        >
          <div className="relative flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center col-span-1">
              <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="font-extrabold text-base text-white">Connecting Secure Cloud</h2>
            <p className="text-xs text-slate-400">Negotiating ERP records and merchant isolation...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // If a customer is logged in, show their Portal
  if (activeCustomer && customerTenant) {
    return (
      <CustomerPortal 
        customer={activeCustomer} 
        merchant={customerTenant} 
        initialInvoiceId={initialInvoiceId}
        onSignOut={() => {
          setActiveCustomer(null);
          setCustomerTenant(null);
          setInitialInvoiceId(null);
        }} 
      />
    );
  }

  if (!user || !stats) {
    return (
      <AuthScreen 
        onAuthSuccess={handleAuthSuccess} 
        onCustomerAuthSuccess={(customer, tenant) => {
          setActiveCustomer(customer);
          setCustomerTenant(tenant);
          setLang(tenant.language);
        }}
        initialLanguage={lang}
        onLanguageChange={setLang}
      />
    );
  }

  const checkTimeRestriction = () => {
    if (user.allowedHoursStart && user.allowedHoursEnd) {
      try {
        const now = new Date();
        const currentMin = now.getHours() * 60 + now.getMinutes();
        
        const [sh, sm] = user.allowedHoursStart.split(':').map(Number);
        const [eh, em] = user.allowedHoursEnd.split(':').map(Number);
        
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        
        if (startMin <= endMin) {
          return currentMin < startMin || currentMin > endMin;
        } else {
          // Overnight window support
          return currentMin > endMin && currentMin < startMin;
        }
      } catch (e) {
        console.error('Time parsing error:', e);
      }
    }
    return false;
  };

  const isBanned = user.isActive === false;
  const isSuspended = !!(user.tempSuspendedUntil && new Date(user.tempSuspendedUntil).getTime() > Date.now());
  const isTimeRestricted = checkTimeRestriction();
  
  const isCurrentlyBlocked = user.email.toLowerCase() !== 'irfanksaeed@gmail.com' && (isBanned || isSuspended || isTimeRestricted);

  if (isCurrentlyBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans tracking-tight text-slate-100 p-6 selection:bg-rose-500 selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,63,94,0.06),transparent_60%)] pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-lg bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl space-y-8 relative overflow-hidden"
        >
          {/* Neon Alert Border Ring */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
          
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h2 className="font-extrabold text-xl text-white tracking-tight">
                {isBanned && "Account Suspended & Blocked (اکاؤنٹ معطل ہے)"}
                {isSuspended && "Account Temporarily Suspended (اکاؤنٹ عارضی معطل ہے)"}
                {isTimeRestricted && "Access Hours Restricted (رسائی ممنوع ہے)"}
              </h2>
              <p className="text-xs text-rose-400 font-medium">
                Surity & subscription rules are managed in real-time by the central administration.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-5 rounded-2xl border border-rose-500/10 space-y-4">
            <h3 className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Rule Enforcement Details / ضوابط کی تفصیلات
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isBanned && "Your business subscription has been permanently deactivated or locked by system administration due to billing terms, policy non-compliance, or suspended tenant parameters."}
              {isSuspended && `Your account accessibility has been suspended temporarily. Access will automatically restore after the suspension period ends on: ${new Date(user.tempSuspendedUntil!).toLocaleDateString()}.`}
              {isTimeRestricted && `Security rules permit active terminal operations strictly between daily window: ${user.allowedHoursStart} and ${user.allowedHoursEnd}. Your device terminal is currently outside permitted hours.`}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
              {isBanned && "آپ کا بزنس اکاؤنٹ انتظامیہ کی جانب سے بلاک کر دیا گیا ہے۔ ادائیگی کے مسائل یا ڈومین ضوابط کی خلاف ورزی کی وجہ سے رسائی معطل ہو چکی ہے۔"}
              {isSuspended && `آپ کا اکاؤنٹ عارضی طور پر معطل ہے۔ معطلی کے ختم ہونے کی تاریخ: ${new Date(user.tempSuspendedUntil!).toLocaleDateString()}`}
              {isTimeRestricted && `سیکورٹی قوانین کے تحت آپ کا ادارہ صرف اوقات کار یعنی ${user.allowedHoursStart} سے ${user.allowedHoursEnd} تک ہی سسٹم کھول سکتا ہے۔`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a 
              href="mailto:irfanksaeed@gmail.com?subject=OmniSuite%20ERP%20Support%20Appeal"
              className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 font-extrabold text-xs text-white uppercase tracking-wider text-center rounded-xl transition shadow-lg shadow-rose-950/20"
            >
              Contact Support (Irfan)
            </a>
            <button
              onClick={handleSignOut}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-750 font-bold text-xs text-slate-300 rounded-xl transition border border-white/5 uppercase tracking-wider cursor-pointer"
            >
              Sign Out / لاگ آؤٹ کریں
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';

  // Toggle layout direction inside HTML body
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.className = isRtl ? 'rtl-layout' : '';

  // Master menu items specification
  const isAdmin = user.role === 'admin' || user.email === 'admin@business.com' || user.email === 'irfanksaeed@gmail.com';

  const menuItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'sales', label: t.sales, icon: Receipt },
    { id: 'expenses', label: t.expenses, icon: CreditCard },
    { id: 'customers', label: t.customers, icon: Users },
    { id: 'products', label: t.products, icon: Package },
    { id: 'invoices', label: t.invoices, icon: FileText },
    { id: 'inventory', label: t.inventory, icon: Layers },
    { id: 'reports', label: t.reports, icon: BarChart2 },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: Shield }] : []),
    { id: 'settings', label: t.companySettings, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* Full-width administrative master impersonation banner */}
      {impersonatingFrom && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-[11px] font-black shadow-xl select-text sticky top-0 z-50 animate-pulse border-b border-amber-500/20">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[13px] shrink-0">⚠️</span>
            <span>
              IMPERSONATOR MODE: Viewing workspace of <span className="underline font-black">{user.companyName}</span> ({user.email}). Standard isolations apply.
            </span>
          </div>
          <button
            onClick={handleStopImpersonating}
            className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-amber-300 font-extrabold rounded-md text-[9px] uppercase tracking-wider transition cursor-pointer"
          >
            ← Close & Safe Return
          </button>
        </div>
      )}

      {/* 1. Mobile top header bar */}
      <header className="lg:hidden bg-slate-900/95 border-b border-slate-850 px-4 py-3 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold tracking-tight text-white text-sm truncate max-w-[150px]">
            {user.companyName}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Quick Stats Summary on Header */}
          <span className="hidden sm:inline-block text-[10px] text-indigo-300 font-mono px-2 py-0.5 bg-indigo-950/50 rounded border border-indigo-900/40">
            {stats.lowStockCount > 0 ? `🚩 Alerts: ${stats.lowStockCount}` : 'Healthy Stock'}
          </span>
          
          <button
            onClick={handleAppRefresh}
            disabled={isRefreshing}
            className="p-2 bg-indigo-650/30 hover:bg-indigo-600/50 border border-indigo-500/25 text-indigo-300 rounded-lg cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center shrink-0"
            title="Refresh entire app"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 bg-slate-800 hover:bg-slate-755 text-slate-300 rounded-lg cursor-pointer"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main split viewport layout */}
      <div className="flex-1 flex flex-row relative">
        
        {/* 2. Sidebar Layout panel (Collapsible on mobile via drawer, fixed on desktop) */}
        <aside 
          className={`
            fixed lg:static inset-y-0 ${isRtl ? 'right-0' : 'left-0'} lg:translate-x-0 w-64 sidebar-gradient flex flex-col justify-between z-50 duration-300 transform
            ${isSidebarOpen ? 'translate-x-0' : isRtl ? 'translate-x-[260px]' : '-translate-x-[260px]'}
          `}
        >
          {/* Brand area */}
          <div>
            <div className="p-5 border-b border-indigo-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl accent-gradient flex items-center justify-center shadow-lg shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="truncate">
                  <h1 className="font-bold text-base text-white tracking-tight leading-none">OmniSuite</h1>
                  <span className="text-[9px] text-slate-350/60 font-mono tracking-wider">PRO ERP TENANT</span>
                </div>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1.5 bg-white/5 hover:bg-white/15 text-slate-300 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Menu List */}
            <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[70vh]">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveModule(item.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer
                      ${isActive 
                        ? 'active-nav text-white' 
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }
                      ${isRtl ? 'flex-row-reverse text-right border-l-0 border-r-4' : 'text-left'}
                    `}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} />
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User profile & Sign out */}
          <div className="p-4 border-t border-indigo-500/10 space-y-3 bg-white/3">
            <div className="glass rounded-xl p-3 flex items-center gap-3 border-indigo-500/20">
              <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {user.email.substring(0, 2).toUpperCase()}
              </div>
              <div className="truncate text-xs">
                <p className="font-bold text-white leading-none truncate">{user.companyName}</p>
                <p className="text-[9px] text-indigo-300/80 uppercase tracking-tighter mt-1 font-mono">TENANT ID: #{user.id.substring(0, 6)}</p>
              </div>
            </div>

            <button
              onClick={handleAppRefresh}
              disabled={isRefreshing}
              className={`
                w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-350 hover:text-white block text-xs font-bold rounded-xl border border-indigo-500/20 shadow-md shadow-indigo-950/25 transition-all cursor-pointer disabled:opacity-50
                ${isRtl ? 'flex-row-reverse' : ''}
              `}
              title="Queries fresh ERP records and coordinates live synchronization with persistent store"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? (isRtl ? 'ریفریش ہو رہا ہے...' : 'Refreshing...') : (isRtl ? 'ایپ ریفریش کریں' : 'Refresh Entire App')}</span>
            </button>

            <button
              onClick={handleSignOut}
              className={`
                w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-rose-950/20 hover:text-rose-400 text-slate-300 block text-xs font-bold rounded-xl border border-white/5 transition cursor-pointer
                ${isRtl ? 'flex-row-reverse' : ''}
              `}
            >
              <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{t.signOut}</span>
            </button>
          </div>
        </aside>

        {/* Modal Backdrop overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-35"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* 3. Main Workspace content display area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {user.bannedModules?.includes(activeModule) && user.email.toLowerCase() !== 'irfanksaeed@gmail.com' ? (
                <div className="bg-slate-900 border border-amber-500/20 rounded-3xl p-10 flex flex-col items-center text-center space-y-6 max-w-2xl mx-auto shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-amber-500 to-yellow-500" />
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                    <Lock className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-extrabold text-lg text-white tracking-tight">Access Restricted</h2>
                    <h3 className="text-sm font-semibold text-amber-550 font-urdu leading-none">مخصوص ماڈیول بلاک ہے</h3>
                    <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                      Your business subscription plan has restricted access to this module. Please contact your system administrator (Irfan) to revise billing parameters and permissions.
                    </p>
                    <p className="text-xs text-slate-500 font-urdu leading-normal">
                      انتظامیہ کی طرف سے آپ کا یہ مخصوص سیکشن معطل کر دیا گیا ہے۔ بحالی کے لیے سپورٹ چیٹ یا ای میل پر رابطہ کریں۔
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveModule('dashboard')}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-755 text-xs font-bold text-slate-200 rounded-xl transition border border-white/5 cursor-pointer"
                  >
                    Return to Dashboard / ڈیش بورڈ پر جائیں
                  </button>
                </div>
              ) : (
                <>
                  {activeModule !== 'dashboard' && (
                    <div className={`mb-5 flex ${isRtl ? 'justify-end animate-fade-in' : 'justify-start animate-fade-in'}`}>
                      <button
                        onClick={() => setActiveModule('dashboard')}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/30 text-xs font-semibold text-slate-350 hover:text-indigo-400 hover:bg-slate-850/50 transition-all cursor-pointer shadow-md shadow-slate-950/30 ${isRtl ? 'flex-row-reverse' : ''}`}
                        type="button"
                      >
                        <span className="text-sm font-semibold">←</span>
                        <span>{isRtl ? 'ڈیش بورڈ پر واپس جائیں' : 'Back to Dashboard'}</span>
                      </button>
                    </div>
                  )}
                  {activeModule === 'dashboard' && (
                    <Dashboard user={user} stats={stats} onNavigate={setActiveModule} />
                  )}
                  {activeModule === 'sales' && (
                    <SalesModule user={user} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'expenses' && (
                    <ExpensesModule user={user} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'customers' && (
                    <CustomersModule user={user} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'products' && (
                    <ProductsModule user={user} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'invoices' && (
                    <InvoicesModule user={user} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'inventory' && (
                    <InventoryModule user={user} onRefreshStats={handleRefreshStats} onNavigate={setActiveModule} />
                  )}
                  {activeModule === 'reports' && (
                    <ReportsModule user={user} />
                  )}
                  {activeModule === 'admin' && isAdmin && (
                    <AdminModule 
                      currentUser={user} 
                      onRefreshStats={handleRefreshStats} 
                      onImpersonate={(tenant) => {
                        localStorage.setItem('biz_suite_original_admin', JSON.stringify(user));
                        setActiveUser(tenant);
                        setUser(tenant);
                        setLang(tenant.language);
                        setStats(getDashboardStats(tenant.id));
                        setImpersonatingFrom(user);
                        setActiveModule('dashboard');
                      }}
                    />
                  )}
                  {activeModule === 'settings' && (
                    <SettingsModule user={user} onUpdateUser={handleUpdateUser} />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* 4. Live Floating Chat Widget (Disabled inside Super Admin's own terminal interface to avoid layout conflict) */}
      {user.email !== 'irfanksaeed@gmail.com' && (
        <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50`}>
          <AnimatePresence>
            {isChatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                className="w-80 md:w-96 h-[480px] bg-slate-900 border border-indigo-500/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 select-text"
              >
                {/* Header */}
                <div className="bg-slate-850 p-4 border-b border-indigo-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">OmniSuite live Support Desk</h4>
                      <p className="text-[10px] text-indigo-300 font-medium">Chat is active with Irfan</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Chat History Container */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col bg-slate-950/40">
                  {chatMessages.filter(msg => 
                    (msg.senderEmail === user.email && msg.receiverEmail === 'irfanksaeed@gmail.com') ||
                    (msg.senderEmail === 'irfanksaeed@gmail.com' && msg.receiverEmail === user.email)
                  ).length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
                      <MessageSquare className="w-10 h-10 text-slate-600 stroke-[1.5]" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-300">No Messages Yet / چیٹ خالی ہے</p>
                        <p className="text-[10px] text-slate-500 leading-normal max-w-[200px] mx-auto">
                          Send a support appeal or query directly to Super Admin Irfan. Message history is fully persistent.
                        </p>
                        <p className="text-[10px] text-slate-550 font-urdu leading-tight">سپر ایڈمن عرفان کو پیغام ارسال کرنے کے لیے نیچے کمنٹ باکس میں لکھیں۔</p>
                      </div>
                    </div>
                  ) : (
                    chatMessages
                      .filter(msg => 
                        (msg.senderEmail === user.email && msg.receiverEmail === 'irfanksaeed@gmail.com') ||
                        (msg.senderEmail === 'irfanksaeed@gmail.com' && msg.receiverEmail === user.email)
                      )
                      .map((msg) => {
                        const isMe = msg.senderEmail === user.email;
                        return (
                          <div 
                            key={msg.id}
                            className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                          >
                            <span className="text-[8px] text-slate-500 mb-0.5 font-bold font-mono uppercase tracking-wider">
                              {isMe ? 'You' : 'Super Admin (Irfan)'}
                            </span>
                            <div 
                              className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                                isMe 
                                  ? 'bg-indigo-650 text-white rounded-tr-none shadow-md shadow-indigo-950/20' 
                                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                              }`}
                            >
                              {msg.text}
                            </div>
                            <span className="text-[8px] text-slate-600 mt-0.5 font-mono">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Chat Footer */}
                <form 
                  onSubmit={handleSendChatMessage}
                  className="p-3 bg-slate-850 border-t border-indigo-500/10 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    placeholder="Type a message (پیغام لکھیں)..."
                    className="flex-1 bg-slate-900 border border-indigo-500/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/30 transition shadow-inner font-normal"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer shrink-0 shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl relative cursor-pointer border border-indigo-400/20"
          >
            {isChatOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center border-2 border-slate-950 shadow-md">
                {unreadChatCount}
              </span>
            )}
          </motion.button>
        </div>
      )}

      {/* Embedded CSS rules for printable invoices */}
      <style>{`
        @media print {
          /* Hide standard elements during browser prints */
          body * {
            visibility: hidden;
          }
          header, aside, main > div > *:not(#printable-area), #printable-area button, .fixed {
            display: none !important;
          }
          #printable-area, #printable-area * {
            visibility: visible !important;
          }
          #printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  );
}
