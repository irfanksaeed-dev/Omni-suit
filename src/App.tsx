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
  markChatAsRead,
  getInvoices,
  resolveTenantByCode,
  provisionGuestPassTenant,
  isGuestPassExpired,
  getGuestPassRemainingHours,
  requestGuestUpgradeToPermanent,
  isTenantAccessExpired,
  getCustomersGlobal,
  updateTenantSettings
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
import PurchasesModule from './components/PurchasesModule';
import AIAgentWidget from './components/AIAgentWidget';
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
  RefreshCw,
  ShoppingCart,
  Mail,
  Home,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getBaseAppUrl, copyTextToClipboard, openExternalLink, buildWhatsAppLink } from './utils/links';

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

const APP_LANGUAGES: { id: Language; label: string; flag: string; nativeName: string }[] = [
  { id: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
  { id: 'ar', label: 'العربية', flag: '🇸🇦', nativeName: 'Arabic' },
  { id: 'ur', label: 'اردو', flag: '🇵🇰', nativeName: 'Urdu' },
  { id: 'bn', label: 'বাংলা', flag: '🇧🇩', nativeName: 'Bangla' },
  { id: 'hi', label: 'हिन्दी', flag: '🇮🇳', nativeName: 'Hindi' },
];

export default function App() {
  const [user, setUser] = useState<UserTenant | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  
  // App-wide data pulling/refresh status
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Mobile drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Interface Language with localStorage persistence
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('biz_suite_language');
      if (saved && ['en', 'ar', 'ur', 'bn', 'hi'].includes(saved)) {
        return saved as Language;
      }
    } catch (e) {
      // ignore
    }
    return 'en';
  });

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem('biz_suite_language', newLang);
    } catch (e) {
      // ignore
    }
    if (user) {
      const updatedUser: UserTenant = { ...user, language: newLang };
      setUser(updatedUser);
      setActiveUser(updatedUser);
      updateTenantSettings({ language: newLang });
    }
  };

  // Customer session states
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [customerTenant, setCustomerTenant] = useState<UserTenant | null>(null);
  const [initialInvoiceId, setInitialInvoiceId] = useState<string | null>(null);

  // Admin original credentials backup for impersonation mode
  const [impersonatingFrom, setImpersonatingFrom] = useState<UserTenant | null>(null);

  // Loading sync state for first mount
  const [loadingSync, setLoadingSync] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // 24-Hour Guest Upgrade Request Modal States
  const [showGuestUpgradeModal, setShowGuestUpgradeModal] = useState(false);
  const [upgradeCompanyName, setUpgradeCompanyName] = useState('');
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePhone, setUpgradePhone] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleOpenGuestUpgradeModal = () => {
    if (user) {
      setUpgradeCompanyName(user.companyName === 'Guest Explorer (24h Pass)' ? '' : user.companyName);
      setUpgradeEmail(user.email.startsWith('guest-') ? '' : user.email);
      setUpgradePhone(user.phone || '');
      setUpgradePassword('');
      setUpgradeNotes('');
      setUpgradeMsg(null);
    }
    setShowGuestUpgradeModal(true);
  };

  const handleSubmitGuestUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!upgradeCompanyName.trim()) {
      setUpgradeMsg({ type: 'error', text: 'Please provide your business or company name.' });
      return;
    }
    if (!upgradeEmail.trim()) {
      setUpgradeMsg({ type: 'error', text: 'Please provide your email address for permanent login.' });
      return;
    }

    setUpgradeSubmitting(true);
    const res = requestGuestUpgradeToPermanent(user.id, {
      companyName: upgradeCompanyName.trim(),
      email: upgradeEmail.trim().toLowerCase(),
      phone: upgradePhone.trim(),
      password: upgradePassword.trim() || undefined,
      notes: upgradeNotes.trim()
    });

    setUpgradeSubmitting(false);
    if (res.success && res.updatedUser) {
      setUser(res.updatedUser);
      setActiveUser(res.updatedUser);
      setUpgradeMsg({ 
        type: 'success', 
        text: '🎉 آپ کی مستقل رسائی کی درخواست سپر ایڈمن (عرفان سعید) کو کامیابی سے بھیج دی گئی ہے۔ منظوری ملتے ہی آپ کا یہ اکاؤنٹ اور سارا ڈیٹا مستقل ہو جائے گا۔' 
      });
      setTimeout(() => {
        setShowGuestUpgradeModal(false);
        setUpgradeMsg(null);
      }, 3500);
    } else {
      setUpgradeMsg({ type: 'error', text: res.message || 'Failed to submit upgrade request.' });
    }
  };

  function processUrlAndSessionParams() {
    // Check for Magic direct login links
    const params = new URLSearchParams(window.location.search);
    const paramTenantId = params.get('tenantId');
    const paramCode = params.get('code') || params.get('shortcode') || params.get('shortCode') || params.get('sharecode') || params.get('shareCode');
    const paramAutologin = params.get('autologin');
    const paramCustEmail = params.get('customerEmail');
    const paramCustPhone = params.get('customerPhone');
    const paramInvoiceId = params.get('invoiceId');
    const paramMode = params.get('mode');
    const paramAction = params.get('action');

    if (paramInvoiceId) {
      setInitialInvoiceId(paramInvoiceId);
    }

    // Support pathname-based auto-login (e.g. /OMNI-T7TYFJF or /t7tyfjf)
    let pathCode = '';
    if (typeof window !== 'undefined' && window.location) {
      const pathname = (window.location.pathname || '').replace(/^\//, '').trim();
      // Only process as direct shortcode if it has a length of 5+ and doesn't match a known system module route name
      if (pathname && pathname.length >= 5 && !['dashboard', 'admin', 'customers', 'products', 'invoices', 'sales', 'expenses', 'purchases'].includes(pathname.toLowerCase())) {
        pathCode = pathname;
      }
    }

    // Support query keys that are direct short codes themselves (e.g. ?OMNI-T7TYFJF or ?t7tyfjf)
    let queryKeyCode = '';
    for (const key of params.keys()) {
      if (key && (key.toUpperCase().startsWith('OMNI-') || key.toLowerCase().startsWith('tenant-') || key.length === 7)) {
        queryKeyCode = key;
        break;
      }
    }

    let actionDone = false;

    const isRegisterInvite = paramMode === 'register' || 
      paramMode === 'signup' || 
      paramAction === 'signup' || 
      paramAction === 'register' || 
      params.get('register') === 'true' || 
      params.get('signup') === 'true' || 
      params.has('invite') ||
      params.has('inviteToken') ||
      params.has('token') ||
      params.has('inv');

    const isVisitMode = paramMode === 'visit' || 
      paramMode === 'guest' || 
      paramMode === 'trial' || 
      paramMode === 'visitor' ||
      params.get('visit') === 'true' || 
      params.get('guest') === 'true' || 
      params.get('trial') === 'true' || 
      params.has('visitor_pass') || 
      params.has('pass') ||
      params.has('visitPass') ||
      params.has('guestPass');

    if (isVisitMode || isRegisterInvite) {
      // Strictly require email registration or login: reset active user session so authentication screen is displayed
      setActiveUser(null);
      setUser(null);
      actionDone = true;
    }

    // Check if there is any tenant identifier provided (via tenantId / code parameters, path code, or search key code)
    const rawSearchCode = (paramTenantId || paramCode || pathCode || queryKeyCode || '').trim();
    if (!actionDone && rawSearchCode) {
      const matched = resolveTenantByCode(rawSearchCode, getTenants());
      if (matched && matched.isActive !== false && matched.isApproved !== false) {
        logAccess('merchant', matched.id, matched.companyName, matched.email, 'Accessed ERP workspace via magic direct link/shortcode');
        setActiveUser(matched);
        setUser(matched);
        setLang(matched.language);
        setStats(getDashboardStats(matched.id));
        
        // Clean URL to home root for clean aesthetic and prevention of stale login loops
        window.history.replaceState({}, document.title, window.location.origin + '/');
        actionDone = true;
      }
    }

    if (!actionDone && paramAutologin) {
      const matched = getTenants().find(t => t.email.toLowerCase() === paramAutologin.toLowerCase() && t.isActive !== false);
      if (matched) {
        logAccess('merchant', matched.id, matched.companyName, matched.email, 'Accessed ERP workspace via login email signature link');
        setActiveUser(matched);
        setUser(matched);
        setLang(matched.language);
        setStats(getDashboardStats(matched.id));
        if (matched.email.toLowerCase() === 'irfanksaeed@gmail.com') {
          setActiveModule('admin');
        }
        window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
        actionDone = true;
      }
    } else if (paramInvoiceId || paramCustEmail || paramCustPhone) {
      if (paramInvoiceId) {
        // Direct public access to specific invoice! Anyone can open it.
        const tenants = getTenants();
        let foundInv: any = null;
        let foundTenant: any = null;
        for (const t of tenants) {
          const invs = getInvoices(t.id);
          const i = invs.find(inv => inv.id === paramInvoiceId);
          if (i) {
            foundInv = i;
            foundTenant = t;
            break;
          }
        }
        if (foundInv && foundTenant) {
          // Attempt to find actual registered customer matching the invoice to load their full portal if possible
          let matchedCustomer: Customer | undefined;
          if (foundInv.customerId) {
            const allCustsStr = localStorage.getItem('biz_suite_customers');
            if (allCustsStr) {
              try {
                const parsed = JSON.parse(allCustsStr) as Customer[];
                matchedCustomer = parsed.find(c => c.id === foundInv.customerId && c.tenantId === foundTenant.id);
              } catch (e) {}
            }
          }

          const guestCustomer: Customer = matchedCustomer || {
            id: 'guest-' + foundInv.id,
            tenantId: foundTenant.id,
            name: foundInv.customerName || 'Customer / گاہک',
            email: paramCustEmail || 'guest@portal.guest',
            phone: paramCustPhone || '',
            address: 'Direct Link Access',
            createdAt: foundInv.createdAt,
            isApproved: true,
          };
          logAccess('customer', guestCustomer.id, guestCustomer.name, guestCustomer.email || 'None', `Accessed Invoice ${foundInv.invoiceNumber} via direct public link`);
          setActiveCustomer(guestCustomer);
          setCustomerTenant(foundTenant);
          setLang(foundTenant.language);
          window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
          actionDone = true;
        }
      }

      if (!actionDone && (paramCustEmail || paramCustPhone)) {
        const searchVal = paramCustEmail || paramCustPhone || '';
        const matches = searchVal ? customerLoginLookup(searchVal) : [];
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
  }

  async function initAndSync(forceOffline = false) {
    if (forceOffline) {
      initializeDatabase();
      processUrlAndSessionParams();
      setSyncError(null);
      setLoadingSync(false);
      return;
    }

    setSyncError(null);
    setIsRetrying(true);

    try {
      // Set up simple 3-second abort signal
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 3000);

      const res = await fetch(getApiUrl('/api/db'), { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const cloudDb = await res.json();
        const SYNC_KEYS = [
          'biz_suite_tenants',
          'biz_suite_customers',
          'biz_suite_products',
          'biz_suite_invoices',
          'biz_suite_sales',
          'biz_suite_expenses',
          'biz_suite_access_logs',
          'biz_suite_support_chats',
          'biz_suite_active_sessions',
          'biz_suite_purchases',
          'biz_suite_custom_invites'
        ];
        SYNC_KEYS.forEach(key => {
          if (cloudDb && cloudDb[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(cloudDb[key]));
          }
        });
      } else {
        throw new Error(`Server returned error status ${res.status}`);
      }

      initializeDatabase();

      // Non-blocking POST sync
      try {
        const dbData: Record<string, any> = {};
        const SYNC_KEYS = [
          'biz_suite_tenants',
          'biz_suite_customers',
          'biz_suite_products',
          'biz_suite_invoices',
          'biz_suite_sales',
          'biz_suite_expenses',
          'biz_suite_access_logs',
          'biz_suite_support_chats',
          'biz_suite_active_sessions',
          'biz_suite_purchases',
          'biz_suite_custom_invites'
        ];
        SYNC_KEYS.forEach(key => {
          const val = localStorage.getItem(key);
          if (val) {
            dbData[key] = JSON.parse(val);
          }
        });
        
        const postController = new AbortController();
        const postTimeout = setTimeout(() => postController.abort(), 2000);
        fetch(getApiUrl('/api/db'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dbData),
          signal: postController.signal
        }).then(() => clearTimeout(postTimeout)).catch(() => clearTimeout(postTimeout));
      } catch (err) {}

      processUrlAndSessionParams();
      setLoadingSync(false);
    } catch (err: any) {
      console.warn('Unable to pull cloud database. Continuing with offline local storage fallback:', err.message || err);
      
      // Auto-fallback to local DB storage so direct links still work flawlessly even offline
      try {
        initializeDatabase();
        processUrlAndSessionParams();
      } catch (innerErr) {
        console.error("Critical inner local database initialisation failure:", innerErr);
      }
      
      // Stop the loader and proceed
      setLoadingSync(false);
    } finally {
      setIsRetrying(false);
    }
  }

  // Load and initialize database & parse URL magic login parameters
  useEffect(() => {
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

    let ticksSinceLastActiveSessionPing = 0;

    const interval = setInterval(async () => {
      // 1. Fetch fresh JSON DB from server to capture live chat and block changes
      await pullServerSync();

      // 2. Ping active session online status - update server only every 60 seconds (15 ticks of 4s) to conserve Firestore quota
      ticksSinceLastActiveSessionPing++;
      if (ticksSinceLastActiveSessionPing >= 15) {
        updateActiveSession(user.id, user.email, user.companyName, activeModule);
        ticksSinceLastActiveSessionPing = 0;
      }

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

  // Update customer active session online status periodically
  useEffect(() => {
    if (!activeCustomer || !customerTenant) return;

    // Direct initial call
    updateActiveSession(
      activeCustomer.id,
      activeCustomer.email,
      activeCustomer.name,
      'Customer Portal'
    );

    let ticksSinceLastActiveSessionPing = 0;
    const interval = setInterval(async () => {
      // Pull fresh data to capture any block updates or messaging updates
      await pullServerSync();

      ticksSinceLastActiveSessionPing++;
      if (ticksSinceLastActiveSessionPing >= 15) {
        updateActiveSession(
          activeCustomer.id,
          activeCustomer.email,
          activeCustomer.name,
          'Customer Portal'
        );
        ticksSinceLastActiveSessionPing = 0;
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeCustomer, customerTenant]);

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
      setTimeout(() => {
        setStats(getDashboardStats(user.id));
      }, 0);
    }
  };

  useEffect(() => {
    const handleDbUpdate = () => {
      if (user) {
        setTimeout(() => {
          setStats(getDashboardStats(user.id));
        }, 0);
      }
    };
    window.addEventListener('db-update', handleDbUpdate);
    return () => {
      window.removeEventListener('db-update', handleDbUpdate);
    };
  }, [user]);

  const handleAuthSuccess = (authenticatedUser: UserTenant) => {
    setUser(authenticatedUser);
    handleLanguageChange(authenticatedUser.language);
    setStats(getDashboardStats(authenticatedUser.id));
    setActiveModule('dashboard');
  };

  const handleUpdateUser = (updatedUser: UserTenant) => {
    setUser(updatedUser);
    handleLanguageChange(updatedUser.language);
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans tracking-tight text-slate-100 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="text-center space-y-6 max-w-md w-full px-6 py-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden"
        >
          {syncError && (
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" />
          )}

          <div className="relative flex justify-center">
            {syncError ? (
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="font-extrabold text-lg text-white">
              {syncError ? "Secure Cloud Sync Interrupted" : "Connecting Secure Cloud"}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {syncError 
                ? "The secure network link timed out or is temporarily unavailable. Your local work is safely cached and fully operational."
                : "Negotiating ERP records and merchant isolation..."
              }
            </p>
            {syncError && (
              <p className="text-[11px] font-mono text-amber-500 bg-amber-500/5 py-1 px-3 rounded-md inline-block max-w-full truncate mt-1">
                {syncError}
              </p>
            )}
          </div>

          {syncError ? (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => initAndSync(true)}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold font-sans transition-all duration-150 border border-slate-700/50 shadow-sm cursor-pointer"
              >
                Proceed Offline (Local Cache)
              </button>
              <button
                onClick={() => initAndSync(false)}
                disabled={isRetrying}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white disabled:opacity-50 rounded-xl text-xs font-bold font-sans shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isRetrying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Retry Connection
              </button>
            </div>
          ) : null}
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
          handleLanguageChange(tenant.language);
        }}
        initialLanguage={lang}
        onLanguageChange={handleLanguageChange}
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

  // Super Admin Approval Pending Screen for regular tenants
  if (user && user.isApproved === false && user.email.toLowerCase() !== 'irfanksaeed@gmail.com') {
    const waApprovalMsg = encodeURIComponent(
      `Salam Super Admin Irfan Saeed!\n\nI have registered my business on Biz Suite ERP and require account approval for entry.\n\n🏢 Business: ${user.companyName}\n✉️ Email: ${user.email}\n📱 Phone: ${user.phone || 'N/A'}\n🆔 Account ID: ${user.id}\n\nPlease review and approve my account in the Admin Console. Thank you!`
    );

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-lg w-full glass p-6 sm:p-8 rounded-3xl border border-amber-500/40 text-center space-y-6 shadow-2xl relative overflow-hidden"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 animate-pulse" />

          <div className="w-18 h-18 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-4xl border border-amber-500/40 shadow-inner">
            ⏳
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full text-xs font-mono font-black uppercase tracking-wider">
              🔒 Super Admin Review Required
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Business Registration Pending Approval
            </h2>
            <p className="text-sm text-amber-300 font-bold font-urdu leading-relaxed">
              آپ کی بزنس رجسٹریشن سپر ایڈمن (عرفان سعید) کی منظوری کے لیے زیر التواء ہے
            </p>
          </div>

          <div className="bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-white/10 text-xs text-slate-300 space-y-2.5 text-left font-mono">
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-slate-400 font-sans">Business Name:</span>
              <span className="text-white font-bold">{user.companyName}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-slate-400 font-sans">Registered Email:</span>
              <span className="text-indigo-300 font-bold select-all">{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-slate-400 font-sans">Contact Phone:</span>
                <span className="text-emerald-400 font-bold">{user.phone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Access Status:</span>
              <span className="text-amber-400 font-black uppercase">Pending Approval Gate</span>
            </div>
            
            <p className="text-[11.5px] text-slate-400 font-sans leading-relaxed pt-2 border-t border-white/5">
              Security Protocol Notice: Every new business registration is reviewed by Super Admin Irfan Saeed. Once approved in the Admin Console, your account will be immediately active.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              onClick={async () => {
                try {
                  await pullServerSync();
                } catch (e) {}
                const refreshed = getTenants().find(t => t.id === user.id);
                if (refreshed && refreshed.isApproved) {
                  setActiveUser(refreshed);
                  setUser(refreshed);
                  setLang(refreshed.language);
                  setStats(getDashboardStats(refreshed.id));
                  setActiveModule('dashboard');
                } else {
                  alert("⏳ Status: Still pending Super Admin approval.\n\nآپ کا اکاؤنٹ ابھی منظور نہیں ہوا ہے۔ براہ کرم عرفان سعید سے واٹس ایپ یا ای میل پر رابطہ کریں۔");
                }
              }}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-xl shadow-indigo-950/50 cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 text-indigo-200" />
              <span>🔄 Check Approval Status / منظوری کا اسٹیٹس چیک کریں</span>
            </button>

            <a
              href={`https://wa.me/?text=${waApprovalMsg}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-emerald-100" />
              <span>💬 Message Super Admin on WhatsApp</span>
            </a>

            <a
              href={`mailto:irfanksaeed@gmail.com?subject=${encodeURIComponent(`Biz Suite Registration Approval - ${user.companyName}`)}&body=${encodeURIComponent(`Salam Irfan Saeed,\n\nPlease approve my business registration on Biz Suite ERP:\n\nBusiness: ${user.companyName}\nEmail: ${user.email}\nPhone: ${user.phone || 'N/A'}\nID: ${user.id}\n\nThank you!`)}`}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-indigo-300 hover:text-white font-bold rounded-xl text-xs uppercase tracking-wider transition border border-indigo-500/20 flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4 text-indigo-400" />
              <span>✉️ Email Super Admin (irfanksaeed@gmail.com)</span>
            </a>

            <button
              onClick={handleSignOut}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer border border-white/5"
            >
              ← Log Out / واپس لاگ ان پر جائیں
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

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
                {isBanned && "Account Blocked / اکاؤنٹ بلاک ہے"}
                {isSuspended && "Account Temporarily Suspended"}
                {isTimeRestricted && "Access Hours Restricted"}
              </h2>
              <p className="text-xs text-rose-400 font-medium">
                آپ کا اکاؤنٹ سپر ایڈمن کی جانب سے بلاک یا معطل کر دیا گیا ہے
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-5 rounded-2xl border border-rose-500/10 space-y-4">
            <h3 className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Rule Enforcement Details / تفصیلات
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isBanned && "Your business subscription has been blocked by Super Admin. All read/write privileges are locked until unlocked by administration."}
              {isSuspended && `Your account accessibility has been suspended temporarily. Access will automatically restore after the suspension period ends on: ${new Date(user.tempSuspendedUntil!).toLocaleDateString()}.`}
              {isTimeRestricted && `Security rules permit active terminal operations strictly between daily window: ${user.allowedHoursStart} and ${user.allowedHoursEnd}. Your device terminal is currently outside permitted hours.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                const refreshed = getTenants().find(t => t.id === user.id);
                if (refreshed && refreshed.isActive !== false) {
                  setActiveUser(refreshed);
                  setUser(refreshed);
                } else {
                  alert("🚫 Account is still blocked by Super Admin.");
                }
              }}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 font-extrabold text-xs text-white uppercase tracking-wider text-center rounded-xl transition shadow-lg cursor-pointer"
            >
              🔄 Re-check Status / اسٹیٹس چیک کریں
            </button>
            <button
              onClick={handleSignOut}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-750 font-bold text-xs text-slate-300 rounded-xl transition border border-white/5 uppercase tracking-wider cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 24-Hour Guest Pass Expiration Screen
  if (user && isGuestPassExpired(user)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass p-8 rounded-3xl border border-amber-500/30 text-center space-y-5 shadow-2xl relative overflow-hidden"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-3xl border border-amber-500/30">
            ⏱️
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white tracking-tight">
              24-Hour Guest Pass Expired
            </h2>
            <p className="text-xs text-amber-300 font-medium">
              آپ کا 24 گھنٹے کا وزٹ ٹرائل پاس ختم ہو چکا ہے
            </p>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            This temporary 24-hour sandbox trial has concluded. To keep all your created invoices, items, and sales records and get permanent access, submit an upgrade request for Super Admin permission.
          </p>

          {user.guestUpgradeRequested ? (
            <div className="bg-amber-950/60 border border-amber-500/40 p-4 rounded-2xl text-left space-y-2">
              <div className="text-xs font-black text-amber-300 flex items-center gap-2">
                <span className="animate-spin">⏳</span> Upgrade Request Pending Approval
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                آپ کی درخواست سپر ایڈمن (عرفان سعید) کو موصول ہو چکی ہے۔ جیسے ہی ایڈمن منظور کریں گے، آپ کا اکاؤنٹ فوراً مستقل ہو جائے گا۔
              </p>
              <button
                onClick={() => {
                  const refreshed = getTenants().find(t => t.id === user.id);
                  if (refreshed && (!refreshed.isGuestPass || (refreshed.guestExpiresAt && new Date(refreshed.guestExpiresAt).getTime() > Date.now()))) {
                    setActiveUser(refreshed);
                    setUser(refreshed);
                  } else {
                    alert("⏳ Your request is still awaiting Super Admin approval.");
                  }
                }}
                className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
              >
                🔄 Check Approval Status / اسٹیٹس چیک کریں
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleOpenGuestUpgradeModal}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-950/40 cursor-pointer"
              >
                🌟 Request Permanent Access (مستقل رسائی کی اجازت لیں)
              </button>
              <button
                onClick={() => {
                  setActiveUser(null);
                  setUser(null);
                  window.location.href = '/?mode=register';
                }}
                className="w-full py-3 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
              >
                🚀 Register New Workspace (نیا مستقل اکاؤنٹ بنائیں)
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setActiveUser(null);
              setUser(null);
              window.location.href = '/';
            }}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer border border-white/5"
          >
            ← Return to Login Screen (لاگ اِن اسکرین پر جائیں)
          </button>
        </motion.div>
      </div>
    );
  }

  // Tenant Subscription / Access Validity Expiration Screen
  if (user && !user.isGuestPass && isTenantAccessExpired(user)) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass p-8 rounded-3xl border border-rose-500/30 text-center space-y-5 shadow-2xl relative overflow-hidden"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-3xl border border-rose-500/30">
            ⏳
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white tracking-tight">
              Access License Period Expired
            </h2>
            <p className="text-xs text-rose-300 font-medium font-mono">
              آپ کے بزنس اکاؤنٹ کی رسائی کی مدت ختم ہو چکی ہے
            </p>
          </div>

          <div className="bg-rose-950/40 border border-rose-900/50 p-4 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span>🏢 Business:</span>
              <strong className="text-white">{user.companyName}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>📧 Account:</span>
              <span className="font-mono text-slate-300">{user.email}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>⏰ Expiry Date:</span>
              <span className="font-mono text-rose-300 font-bold">{user.subscriptionExpiry || 'Expired'}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Your workspace access permission period granted by Super Admin has concluded. All your business records, invoices, and customers are safely preserved.
          </p>

          <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-indigo-300">📞 Contact Super Admin for Renewal / Extension:</p>
            <p className="text-white font-mono font-bold">irfanksaeed@gmail.com</p>
            <p className="text-[10px] text-slate-500">Irfan Saeed • Global Platform Administrator</p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={async () => {
                await pullServerSync();
                const fresh = getTenants().find(t => t.id === user.id);
                if (fresh && !isTenantAccessExpired(fresh)) {
                  setActiveUser(fresh);
                  setUser(fresh);
                } else {
                  alert("⏳ Access license is still marked as expired. Please confirm with Super Admin Irfan Saeed.");
                }
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <RefreshCw className="w-4 h-4" />
              🔄 Refresh & Check License Status / اسٹیٹس چیک کریں
            </button>

            <button
              onClick={() => {
                setActiveUser(null);
                setUser(null);
                window.location.href = '/';
              }}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer border border-white/5"
            >
              ← Return to Login Screen (لاگ اِن اسکرین پر جائیں)
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';
  const activeUser: UserTenant = { ...user, language: lang };

  // Toggle layout direction inside HTML body
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.className = isRtl ? 'rtl-layout' : '';

  // Master menu items specification - only Super Admin / Admin role has access to global platform admin panel
  const isSuperAdmin = user.email.toLowerCase() === 'irfanksaeed@gmail.com' || user.email.toLowerCase() === 'admin@business.com' || user.role === 'admin';
  const isAdmin = isSuperAdmin;

  // Calculate total pending registrations awaiting Super Admin decision
  const pendingApprovalsCount = isAdmin
    ? getTenants().filter(t => t.isApproved === false && t.email.toLowerCase() !== 'irfanksaeed@gmail.com').length +
      getCustomersGlobal().filter(c => c.isApproved === false).length
    : 0;

  const menuItems = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
    { id: 'sales', label: t.sales, icon: Receipt },
    { id: 'expenses', label: t.expenses, icon: CreditCard },
    { id: 'customers', label: t.customers, icon: Users },
    { id: 'products', label: t.products, icon: Package },
    { id: 'invoices', label: t.invoices, icon: FileText },
    { id: 'inventory', label: t.inventory, icon: Layers },
    { id: 'purchases', label: t.purchases || 'Purchases', icon: ShoppingCart },
    { id: 'reports', label: t.reports, icon: BarChart2 },
    ...(isAdmin ? [{ 
      id: 'admin', 
      label: pendingApprovalsCount > 0 ? `${t.adminPanel || 'Admin'} (${pendingApprovalsCount})` : (t.adminPanel || 'Admin Console'), 
      icon: Shield 
    }] : []),
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

      {/* 24-Hour Guest Visitor Pass Indicator Banner */}
      {user.isGuestPass && !impersonatingFrom && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-b border-amber-500/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-bold select-text sticky top-0 z-50 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
              24-Hour Visit Pass
            </span>
            <span className="text-amber-200 text-xs">
              ⏱️ Time Remaining: <span className="text-white font-mono font-black">{getGuestPassRemainingHours(user).hours}h {getGuestPassRemainingHours(user).minutes}m</span>
            </span>
            {user.guestUpgradeRequested ? (
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 animate-pulse">
                <span>⏳</span> Permanent Upgrade Request Pending Super Admin Approval (منظوری زیر التواء ہے)
              </span>
            ) : (
              <span className="hidden sm:inline text-slate-400 text-[11px]">
                • Evaluating live sandbox. Want to keep all data permanently?
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user.guestUpgradeRequested ? (
              <button
                onClick={() => {
                  const refreshed = getTenants().find(t => t.id === user.id);
                  if (refreshed && !refreshed.isGuestPass) {
                    setActiveUser(refreshed);
                    setUser(refreshed);
                    alert("🎉 Super Admin has approved your permanent workspace!");
                  } else {
                    alert("⏳ Your request is currently pending Super Admin approval.");
                  }
                }}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition shadow-md cursor-pointer"
              >
                🔄 Check Approval Status
              </button>
            ) : (
              <button
                onClick={handleOpenGuestUpgradeModal}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg text-[10px] uppercase tracking-wider transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <span>🌟</span> Request Permanent Access (مستقل اجازت لیں)
              </button>
            )}

            <button
              onClick={() => {
                setActiveUser(null);
                setUser(null);
                window.location.href = '/?mode=register';
              }}
              className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer border border-white/5"
              title="Create a brand new empty workspace"
            >
              🚀 New Workspace
            </button>
          </div>
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
          {/* Super Admin Pending Approvals Notification Badge on Mobile Header */}
          {isAdmin && pendingApprovalsCount > 0 && (
            <button
              onClick={() => setActiveModule('admin')}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-black uppercase tracking-wider animate-bounce flex items-center gap-1 cursor-pointer shadow-lg"
              title="View Pending Registration Approvals"
            >
              <span>⏳</span>
              <span>{pendingApprovalsCount} Pending</span>
            </button>
          )}

          {/* Quick Stats Summary on Header */}
          <span className="hidden sm:inline-block text-[10px] text-indigo-300 font-mono px-2 py-0.5 bg-indigo-950/50 rounded border border-indigo-900/40">
            {stats.lowStockCount > 0 ? `🚩 Alerts: ${stats.lowStockCount}` : 'Healthy Stock'}
          </span>
          
          {/* Mobile Language Switcher */}
          <select
            value={lang}
            onChange={(e) => handleLanguageChange(e.target.value as Language)}
            className="bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg px-1.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
            title="Switch Language"
          >
            {APP_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.flag} {l.label}
              </option>
            ))}
          </select>

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
                    {item.id === 'admin' && pendingApprovalsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] animate-pulse">
                        ⏳ {pendingApprovalsCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick 5-Language Switcher */}
          <div className="px-4 py-2 border-t border-indigo-500/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                <Globe className="w-3 h-3 text-indigo-400" />
                <span>
                  {lang === 'ar' ? 'اللغة' : lang === 'ur' ? 'زبان منتخب کریں' : lang === 'bn' ? 'ভাষা নির্বাচন' : lang === 'hi' ? 'भाषा चुनें' : 'Language'}
                </span>
              </span>
              <span className="text-[9px] font-mono font-bold text-indigo-300 uppercase">{lang}</span>
            </div>
            <div className="grid grid-cols-5 gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/5">
              {APP_LANGUAGES.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleLanguageChange(opt.id)}
                  title={`${opt.flag} ${opt.label} (${opt.nativeName})`}
                  className={`flex flex-col items-center justify-center py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    lang === opt.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="text-sm leading-none">{opt.flag}</span>
                  <span className="text-[8px] font-bold mt-0.5 uppercase tracking-tighter">{opt.id}</span>
                </button>
              ))}
            </div>
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
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Entire App'}</span>
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
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto pb-24 lg:pb-8">
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
                    <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                      Your business subscription plan has restricted access to this module. Please contact your system administrator (Irfan) to revise billing parameters and permissions.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveModule('dashboard')}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-755 text-xs font-bold text-slate-200 rounded-xl transition border border-white/5 cursor-pointer"
                  >
                    Return to Dashboard
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
                        <span>{lang === 'ur' ? 'ڈیش بورڈ پر واپس جائیں' : lang === 'ar' ? 'العودة للوحة التحكم' : lang === 'bn' ? 'ড্যাশবোর্ডে ফিরে যান' : lang === 'hi' ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}</span>
                      </button>
                    </div>
                  )}
                  {activeModule === 'dashboard' && (
                    <Dashboard user={activeUser} stats={stats} onNavigate={setActiveModule} language={lang} />
                  )}
                  {activeModule === 'sales' && (
                    <SalesModule user={activeUser} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'expenses' && (
                    <ExpensesModule user={activeUser} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'customers' && (
                    <CustomersModule user={activeUser} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'products' && (
                    <ProductsModule user={activeUser} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'invoices' && (
                    <InvoicesModule user={activeUser} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'inventory' && (
                    <InventoryModule user={activeUser} onRefreshStats={handleRefreshStats} onNavigate={setActiveModule} />
                  )}
                  {activeModule === 'purchases' && (
                    <PurchasesModule user={activeUser} onRefreshStats={handleRefreshStats} />
                  )}
                  {activeModule === 'reports' && (
                    <ReportsModule user={activeUser} />
                  )}
                  {activeModule === 'admin' && isAdmin && (
                    <AdminModule 
                      currentUser={activeUser} 
                      onRefreshStats={handleRefreshStats} 
                      onImpersonate={(tenant) => {
                        localStorage.setItem('biz_suite_original_admin', JSON.stringify(activeUser));
                        setActiveUser(tenant);
                        setUser(tenant);
                        handleLanguageChange(tenant.language);
                        setStats(getDashboardStats(tenant.id));
                        setImpersonatingFrom(activeUser);
                        setActiveModule('dashboard');
                      }}
                    />
                  )}
                  {activeModule === 'settings' && (
                    <SettingsModule user={activeUser} onUpdateUser={handleUpdateUser} />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* 4. Responsive Mobile Bottom Navigation Bar (Ultra-responsive 1-tap links for Mobile) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-lg border-t border-indigo-900/50 z-40 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
        <button
          type="button"
          onClick={() => {
            setActiveModule('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] ${
            activeModule === 'dashboard'
              ? 'text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.dashboard}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule('sales');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] ${
            activeModule === 'sales'
              ? 'text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.sales}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule('inventory');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] ${
            activeModule === 'inventory'
              ? 'text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.inventory}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule('invoices');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] ${
            activeModule === 'invoices'
              ? 'text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.invoices}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveModule('customers');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] ${
            activeModule === 'customers'
              ? 'text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.customers}</span>
        </button>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setActiveModule('admin');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all cursor-pointer min-w-[50px] relative ${
              activeModule === 'admin'
                ? 'text-amber-400 font-bold bg-amber-950/70 border border-amber-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] tracking-tight">{t.adminPanel || 'Admin'}</span>
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-bounce" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer min-w-[50px]"
          >
            <Menu className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] tracking-tight">More</span>
          </button>
        )}
      </nav>

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
                        <p className="text-xs font-semibold text-slate-300">No Messages Yet</p>
                        <p className="text-[10px] text-slate-500 leading-normal max-w-[200px] mx-auto">
                          Send a support appeal or query directly to Super Admin Irfan. Message history is fully persistent.
                        </p>
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
                    placeholder="Type a message..."
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

      {/* 24-Hour Guest Upgrade Request Modal */}
      {showGuestUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 relative overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Top golden accent line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-500" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl border border-amber-500/30 shrink-0">
                  🌟
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    Request Permanent Access Permission
                  </h3>
                  <p className="text-xs text-amber-300 font-medium">
                    سپر ایڈمن (عرفان سعید) سے مستقل اکاؤنٹ کی منظوری حاصل کریں
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuestUpgradeModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-white/5">
              💡 <strong>تمام ڈیٹا محفوظ رہے گا:</strong> مستقل رسائی کی منظوری کے بعد آپ کی ٹرائل کے دوران بنائی گئی تمام انوائسز، پراڈکٹس، سیلز اور کسٹمرز مستقل اکاؤنٹ میں منتقل ہو جائیں گی۔
            </p>

            {upgradeMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium ${
                  upgradeMsg.type === 'success'
                    ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/70 border border-rose-500/40 text-rose-300'
                }`}
              >
                {upgradeMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitGuestUpgrade} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Business / Company Name (کاروبار یا دکان کا نام) *
                </label>
                <input
                  type="text"
                  required
                  value={upgradeCompanyName}
                  onChange={(e) => setUpgradeCompanyName(e.target.value)}
                  placeholder="e.g. Al-Madina Traders / Saeed Electronics"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Permanent Login Email (ای میل) *
                  </label>
                  <input
                    type="email"
                    required
                    value={upgradeEmail}
                    onChange={(e) => setUpgradeEmail(e.target.value)}
                    placeholder="your-email@company.com"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    WhatsApp / Phone (فون یا واٹس ایپ)
                  </label>
                  <input
                    type="text"
                    value={upgradePhone}
                    onChange={(e) => setUpgradePhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Custom Password (نیا پاس ورڈ سیٹ کریں)
                </label>
                <input
                  type="password"
                  value={upgradePassword}
                  onChange={(e) => setUpgradePassword(e.target.value)}
                  placeholder="Set your account password (optional)"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Message / Notes for Super Admin (عرفان سعید کے نام پیغام)
                </label>
                <textarea
                  rows={2}
                  value={upgradeNotes}
                  onChange={(e) => setUpgradeNotes(e.target.value)}
                  placeholder="Explain your business type or requested subscription duration..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-medium"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="submit"
                  disabled={upgradeSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-950/40 cursor-pointer disabled:opacity-50"
                >
                  {upgradeSubmitting ? 'Submitting Request...' : '🚀 Submit Request to Super Admin (درخواست بھیجیں)'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuestUpgradeModal(false)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer border border-white/5"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. Embedded Grounded AI Assistant Agent */}
      <AIAgentWidget user={user} />

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
            margin: 0 auto !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
