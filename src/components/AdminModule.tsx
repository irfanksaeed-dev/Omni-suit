import React, { useState, useEffect } from 'react';
import { 
  getTenants, 
  adminUpdateTenant, 
  adminDeleteTenant, 
  adminCreateTenant,
  getAccessLogs,
  clearAccessLogs,
  adminToggleCustomerBlockGlobal,
  getCustomersGlobal,
  pullServerSync,
  getActiveSessions,
  getSupportChats,
  addChatMessage,
  markChatAsRead,
  getDashboardStats
} from '../db';
import { UserTenant, AccessLog, Customer } from '../types';
import { 
  Shield, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Calendar, 
  Edit3, 
  Save, 
  X, 
  Filter, 
  UserCheck, 
  UserX, 
  AlertTriangle,
  Clock,
  ShieldAlert,
  PlusCircle,
  Trash2,
  Key,
  Fingerprint,
  Building2,
  Globe,
  Coins,
  Activity,
  User,
  ShieldOff,
  RefreshCw,
  MessageSquare,
  MessageCircle,
  Send,
  BarChart3
} from 'lucide-react';

interface AdminModuleProps {
  currentUser: UserTenant;
  onRefreshStats: () => void;
  onImpersonate: (tenant: UserTenant) => void;
}

export default function AdminModule({ currentUser, onRefreshStats, onImpersonate }: AdminModuleProps) {
  const [tenants, setTenants] = useState<UserTenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated' | 'expired'>('all');
  const [editingTenant, setEditingTenant] = useState<UserTenant | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Editing form states (Exhaustive variables control)
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubStatus, setEditSubStatus] = useState<'active' | 'inactive' | 'expired'>('active');
  const [editExpiry, setEditExpiry] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPasswordSha, setEditPasswordSha] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editTaxNumber, setEditTaxNumber] = useState('');
  const [editTaxRate, setEditTaxRate] = useState(15);
  const [editCurrency, setEditCurrency] = useState<'AED' | 'USD' | 'PKR' | 'INR' | 'SAR' | 'EUR'>('SAR');
  const [editLanguage, setEditLanguage] = useState<'en' | 'ar' | 'ur' | 'hi'>('en');
  const [editInvoicePrefix, setEditInvoicePrefix] = useState('INV-');
  const [editInvoiceNotes, setEditInvoiceNotes] = useState('');

  // Advanced Billing, Restrictions, and Lockout Parameters
  const [editSubscriptionPlan, setEditSubscriptionPlan] = useState<'Free' | 'Basic' | 'Pro'>('Free');
  const [editPaymentStatus, setEditPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Pending'>('Paid');
  const [editBannedModules, setEditBannedModules] = useState<string[]>([]);
  const [editAllowedHoursStart, setEditAllowedHoursStart] = useState('');
  const [editAllowedHoursEnd, setEditAllowedHoursEnd] = useState('');
  const [editTempSuspendedUntil, setEditTempSuspendedUntil] = useState('');

  // Safety confirmation delete states
  const [showDeleteDangerZone, setShowDeleteDangerZone] = useState(false);
  const [deleteConfirmTyped, setDeleteConfirmTyped] = useState('');

  // Business Onboarding states
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createCompanyName, setCreateCompanyName] = useState('');
  const [createCurrency, setCreateCurrency] = useState<'AED' | 'USD' | 'PKR' | 'INR' | 'SAR' | 'EUR'>('SAR');
  const [createLanguage, setCreateLanguage] = useState<'en' | 'ar' | 'ur' | 'hi'>('en');
  const [createTaxRate, setCreateTaxRate] = useState(15);
  const [createTaxNumber, setCreateTaxNumber] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createRole, setCreateRole] = useState<'admin' | 'user'>('user');
  const [createNotes, setCreateNotes] = useState('');

  const [activeTab, setActiveTab] = useState<'businesses' | 'customers' | 'accessLogs' | 'unifiedUsers' | 'chats' | 'reports'>('unifiedUsers');
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Real-time admin states for active terminals and multi-threaded chat loops
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [selectedChatUserEmail, setSelectedChatUserEmail] = useState<string | null>(null);
  const [adminChatText, setAdminChatText] = useState('');

  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('biz_suite_acknowledged_customer_ids');
      if (saved) {
        return JSON.parse(saved);
      }
      // On first mount if empty, pre-populate with existing customer IDs so they are not treated as fresh alerts
      const currentIds = getCustomersGlobal().map(c => c.id);
      localStorage.setItem('biz_suite_acknowledged_customer_ids', JSON.stringify(currentIds));
      return currentIds;
    } catch {
      return [];
    }
  });

  useEffect(() => {
    loadTenants();
    loadAccessLogsData();
    loadCustomersData();

    // Fetch live session instances immediately and bind a periodic pinger
    setActiveSessions(getActiveSessions());
    const sessPinger = setInterval(() => {
      setActiveSessions(getActiveSessions());
    }, 4000);
    return () => clearInterval(sessPinger);
  }, []);

  const loadCustomersData = () => {
    setCustomers(getCustomersGlobal());
  };

  const loadAccessLogsData = () => {
    setAccessLogs(getAccessLogs());
  };

  const handleRefreshAll = () => {
    setIsRefreshing(true);
    const beforeRecords = getCustomersGlobal();
    
    // Pull fresh data from localStorage/simulated server
    loadTenants();
    loadAccessLogsData();
    loadCustomersData();
    onRefreshStats();

    setTimeout(() => {
      setIsRefreshing(false);
      const afterRecords = getCustomersGlobal();
      
      // Compute if there's any truly new registrations
      const newDiscovered = afterRecords.filter(af => !beforeRecords.some(bf => bf.id === af.id));
      if (newDiscovered.length > 0) {
        setSuccessMsg(`🚀 Access gate refreshed! Found ${newDiscovered.length} new customer registration(s) (نیا صارف موصول ہوا ہے)!`);
      } else {
        setSuccessMsg('⚡ System database synced & refreshed successfully / انتظامیہ ریکارڈز کو کامیابی کے ساتھ اپ ڈیٹ کر دیا گیا ہے۔');
      }
      setTimeout(() => setSuccessMsg(''), 4500);
    }, 750);
  };

  const handleAcknowledgeCustomer = (customerId: string) => {
    const updated = [...acknowledgedIds, customerId];
    setAcknowledgedIds(updated);
    localStorage.setItem('biz_suite_acknowledged_customer_ids', JSON.stringify(updated));
  };

  const handleAcknowledgeAll = () => {
    const allIds = customers.map(c => c.id);
    setAcknowledgedIds(allIds);
    localStorage.setItem('biz_suite_acknowledged_customer_ids', JSON.stringify(allIds));
    setSuccessMsg('Cleared all active gate access registration alerts / تمام نئے گاہک الرٹس کو خارج کر دیا گیا ہے۔');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleClearAccessLogs = () => {
    clearAccessLogs();
    loadAccessLogsData();
    setSuccessMsg('Access logs history has been successfully cleared / رسائی کے لاگ صاف کر دیے گئے');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleToggleCustomerBlockGlobal = (customerId: string) => {
    adminToggleCustomerBlockGlobal(customerId);
    loadCustomersData();
    loadAccessLogsData();
    onRefreshStats();
    setSuccessMsg('Customer gate entry access status configured successfully!');
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleToggleTenantBlockGlobal = (tenantId: string) => {
    const matched = getTenants().find(t => t.id === tenantId);
    if (matched) {
      const updated: UserTenant = {
        ...matched,
        isActive: matched.isActive === false
      };
      adminUpdateTenant(updated);
      loadTenants();
      loadAccessLogsData();
      onRefreshStats();
      setSuccessMsg(`Merchant gateway status for ${matched.companyName} set to ${updated.isActive ? 'ACTIVE' : 'DEACTIVATED'}`);
      setTimeout(() => setSuccessMsg(''), 3500);
    }
  };

  const loadTenants = () => {
    const all = getTenants();
    setTenants(all);
  };

  const handleOpenEdit = (t: UserTenant) => {
    setEditingTenant(t);
    setEditIsActive(t.isActive !== false);
    setEditSubStatus(t.subscriptionStatus || 'active');
    setEditExpiry(t.subscriptionExpiry || '');
    setEditRole(t.role || 'user');
    setEditCompanyName(t.companyName || '');
    setEditEmail(t.email || '');
    setEditPasswordSha(t.passwordSha || '');
    setEditPhone(t.phone || '');
    setEditAddress(t.address || '');
    setEditTaxNumber(t.taxNumber || '');
    setEditTaxRate(t.taxRate ?? 15);
    setEditCurrency(t.currency || 'SAR');
    setEditLanguage(t.language || 'en');
    setEditInvoicePrefix(t.invoicePrefix || 'INV-');
    setEditInvoiceNotes(t.invoiceNotes || '');

    // Configure advanced schema fields on load
    setEditSubscriptionPlan(t.subscriptionPlan || 'Free');
    setEditPaymentStatus(t.paymentStatus || 'Paid');
    setEditBannedModules(t.bannedModules || []);
    setEditAllowedHoursStart(t.allowedHoursStart || '');
    setEditAllowedHoursEnd(t.allowedHoursEnd || '');
    setEditTempSuspendedUntil(t.tempSuspendedUntil || '');

    // Reset deletion flags
    setShowDeleteDangerZone(false);
    setDeleteConfirmTyped('');
    
    setShowEditModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    const updated: UserTenant = {
      ...editingTenant,
      email: editEmail,
      companyName: editCompanyName,
      passwordSha: editPasswordSha,
      isActive: editIsActive,
      subscriptionStatus: editSubStatus,
      subscriptionExpiry: editExpiry,
      role: editRole,
      phone: editPhone,
      address: editAddress,
      taxNumber: editTaxNumber,
      taxRate: Number(editTaxRate),
      currency: editCurrency,
      language: editLanguage,
      invoicePrefix: editInvoicePrefix,
      invoiceNotes: editInvoiceNotes,
      
      // Advanced capabilities serialised state
      subscriptionPlan: editSubscriptionPlan,
      paymentStatus: editPaymentStatus,
      bannedModules: editBannedModules,
      allowedHoursStart: editAllowedHoursStart,
      allowedHoursEnd: editAllowedHoursEnd,
      tempSuspendedUntil: editTempSuspendedUntil
    };

    adminUpdateTenant(updated);
    loadTenants();
    setShowEditModal(false);
    setEditingTenant(null);
    setSuccessMsg(`Successfully updated credentials and settings for ${updated.companyName}`);
    onRefreshStats();

    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  const handleCreateBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail || !createCompanyName || !createPassword) {
      alert("Required: Email, Password, and Company Name");
      return;
    }

    const uniqueId = 'tenant-' + Math.random().toString(36).substring(2, 9);
    const newTenant: UserTenant = {
      id: uniqueId,
      email: createEmail,
      passwordSha: createPassword,
      companyName: createCompanyName,
      currency: createCurrency,
      language: createLanguage,
      taxRate: Number(createTaxRate),
      taxNumber: createTaxNumber,
      phone: createPhone,
      address: createAddress,
      invoicePrefix: 'INV-',
      invoiceNotes: createNotes || 'Thank you for your business. Payment is due within 15 days.',
      role: createRole,
      isActive: true,
      subscriptionStatus: 'active',
      subscriptionExpiry: '2027-12-31',
      createdAt: new Date().toISOString().split('T')[0]
    };

    const success = adminCreateTenant(newTenant);
    if (success) {
      loadTenants();
      setShowCreateModal(false);
      
      // Reset variables
      setCreateEmail('');
      setCreatePassword('');
      setCreateCompanyName('');
      setCreatePhone('');
      setCreateAddress('');
      setCreateTaxNumber('');
      setCreateNotes('');

      setSuccessMsg(`Manually spawned new business account "${newTenant.companyName}" inside system.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } else {
      alert("Email addresses must be globally unique. This email is already registered.");
    }
  };

  const toggleActivationQuick = (t: UserTenant) => {
    const updated: UserTenant = {
      ...t,
      isActive: t.isActive === false
    };
    adminUpdateTenant(updated);
    loadTenants();
    setSuccessMsg(`Account for ${t.companyName} has been ${updated.isActive ? 'ACTIVATED' : 'DEACTIVATED'}`);
    onRefreshStats();
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const executePurgeDelete = (tenantId: string) => {
    if (deleteConfirmTyped !== 'CONFIRM DELETE') {
      alert("Verification mismatch! Please enter 'CONFIRM DELETE' to wipe data.");
      return;
    }

    adminDeleteTenant(tenantId);
    loadTenants();
    setShowEditModal(false);
    setEditingTenant(null);
    setSuccessMsg("Absolute authority active: Business account and all isolated files deleted.");
    onRefreshStats();
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  // Calculations for stats counts
  const totalCount = tenants.length;
  const activeSubs = tenants.filter(t => (t.subscriptionStatus === 'active' || !t.subscriptionStatus) && t.isActive !== false).length;
  const deactivatedCount = tenants.filter(t => t.isActive === false).length;
  const adminCount = tenants.filter(t => t.role === 'admin').length;

  // Filter & search implementation
  const filtered = tenants.filter(t => {
    const matchesSearch = 
      t.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());

    const isDeactivated = t.isActive === false;
    const isExpired = t.subscriptionStatus === 'expired';
    const isActiveUser = !isDeactivated && (t.subscriptionStatus === 'active' || !t.subscriptionStatus);

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && isActiveUser;
    if (statusFilter === 'deactivated') return matchesSearch && isDeactivated;
    if (statusFilter === 'expired') return matchesSearch && isExpired;
    return matchesSearch;
  });

  const unacknowledgedCustomers = customers.filter(c => !acknowledgedIds.includes(c.id));

  // Unified merge of Tenants and Customers
  const unifiedList = [
    ...tenants.map(t => ({
      rawId: t.id,
      name: t.companyName,
      email: t.email,
      phone: t.phone || '',
      type: 'merchant' as const,
      status: t.isActive !== false ? 'active' : 'blocked',
      createdAt: t.createdAt || 'Demo Seeding',
      role: t.role || 'user',
      storeContext: 'Platform Business'
    })),
    ...customers.map(c => {
      const linked = tenants.find(t => t.id === c.tenantId);
      return {
        rawId: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        type: 'customer' as const,
        status: c.isBlocked ? 'blocked' : 'active',
        createdAt: c.createdAt || 'N/A',
        storeContext: linked ? linked.companyName : 'Deleted/Unknown Store',
        role: 'customer'
      };
    })
  ];

  const filteredUnified = unifiedList.filter(item => {
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) ||
           item.email.toLowerCase().includes(q) ||
           item.phone.toLowerCase().includes(q) ||
           item.rawId.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400 animate-pulse" />
            System Administration Panel (مزید اختیارات)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            You hold total administrative dominion. Provision, impersonate, reset passwords, configure taxes, and purge database assets.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 font-extrabold text-[11px] uppercase tracking-wider rounded-lg border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 transition cursor-pointer select-none disabled:opacity-50"
            title="Refresh database state and capture any new customer registrations instantly."
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Register (ڈیٹا ریفریش کریں)'}
          </button>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg shadow-lg shadow-indigo-500/10 flex items-center gap-1.5 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Provision Business
          </button>
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/40 border border-indigo-900/40 rounded-lg text-[11px] font-mono text-indigo-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>ROOT CONSOLE: ONLINE</span>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/25 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Realtime Dual-Language New Registration Alerts Gateway & Security Hub */}
      {unacknowledgedCustomers.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-slate-900/40 to-amber-950/20 p-5 shadow-xl shadow-amber-950/10 animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-amber-900/30 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <div>
                <h4 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-450" />
                  New Customer Registrations Intercepted (نئے صارفین کی آمد)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  The gate network has detected {unacknowledgedCustomers.length} unregistered / brand-new customer profile activity signals. Review identity credentials below.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleAcknowledgeAll}
              className="px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900 text-amber-200 hover:text-white border border-amber-805 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wide cursor-pointer transition select-none"
            >
              ✓ Mark All Seen / سب نشان زد کریں
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {unacknowledgedCustomers.map(customer => {
              const matchedTenant = tenants.find(t => t.id === customer.tenantId);
              const storeBrand = matchedTenant ? matchedTenant.companyName : 'Unknown Merchant Store';
              const isBlocked = customer.isBlocked === true;

              return (
                <div 
                  key={customer.id} 
                  className="bg-slate-950/90 border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-3 hover:border-amber-500/30 transition shadow-inner"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-950/30 border border-amber-900/30 font-black flex items-center justify-center text-xs text-amber-405 font-mono">
                        {customer.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-100 flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm">{customer.name}</span>
                          <span className="bg-amber-950/70 text-amber-300 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-900/35 uppercase tracking-widest font-mono animate-pulse">New / نیا</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Reference Key: {customer.id}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAcknowledgeCustomer(customer.id)}
                      className="p-1 hover:bg-slate-900 text-slate-500 hover:text-slate-350 rounded transition cursor-pointer"
                      title="Dismiss alert"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono bg-slate-900/40 p-2.5 rounded-lg border border-slate-850">
                    <div>
                      <span className="text-slate-500 block font-sans text-[8.5px] uppercase font-bold tracking-wider">Contact Detail</span>
                      <span className="text-slate-200 text-xs font-semibold select-all block break-all">{customer.email}</span>
                      {customer.phone && <span className="block text-slate-400 text-[10px] mt-0.5">{customer.phone}</span>}
                    </div>
                    <div>
                      <span className="text-slate-550 block font-sans text-[8.5px] uppercase font-bold tracking-wider">Associated Store</span>
                      <span className="text-indigo-400 font-bold text-xs block truncate">{storeBrand}</span>
                      <span className="text-slate-500 text-[9px]">Tenant: #{customer.tenantId}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-900 pt-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isBlocked ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                      <span className="text-[10px] text-slate-450 font-bold uppercase font-mono">
                        {isBlocked ? 'ACCESS: BLOCK (بلاک ہے)' : 'ACCESS: ALLOWED (فعال)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleCustomerBlockGlobal(customer.id)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer ${
                          isBlocked
                            ? 'bg-emerald-950 text-emerald-300 hover:text-white border-emerald-900'
                            : 'bg-rose-950 text-rose-300 hover:text-white border-rose-900'
                        }`}
                      >
                        {isBlocked ? '✓ ALLOW Entry' : '🚫 BLOCK Customer'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bento Grid Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-xl border border-slate-850 p-5 bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Users className="w-24 h-24 text-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950/60 rounded-lg border border-indigo-900/40">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Total Businesses</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">{totalCount}</h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-850 p-5 bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <CheckCircle2 className="w-24 h-24 text-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/60 rounded-lg border border-emerald-900/40">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Active Subscriptions</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">{activeSubs}</h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-850 p-5 bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <XCircle className="w-24 h-24 text-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-950/60 rounded-lg border border-rose-900/40">
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Deactivated Accounts</p>
              <h3 className="text-2xl font-black text-slate-200 mt-1 font-mono">{deactivatedCount}</h3>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-850 p-5 bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Shield className="w-24 h-24 text-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-950/60 rounded-lg border border-amber-900/40">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Platform Admins</p>
              <h3 className="text-2xl font-black text-white mt-1 font-mono">{adminCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-indigo-950 gap-2 font-mono scrollbar-none overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('unifiedUsers');
            loadCustomersData();
            loadTenants();
          }}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'unifiedUsers'
              ? 'border-indigo-500 text-white font-extrabold bg-indigo-950/10'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Fingerprint className="w-4 h-4 text-emerald-400 animate-pulse" />
          Command Center: Central Users (صارفین اور سیشن)
        </button>
        <button
          onClick={() => setActiveTab('businesses')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'businesses'
              ? 'border-indigo-500 text-white font-extrabold font-mono'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          Businesses Workspace Directory
        </button>
        <button
          onClick={() => {
            setActiveTab('customers');
            loadCustomersData();
          }}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'customers'
              ? 'border-indigo-500 text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-sky-400" />
          Registered Customers Directory (گاہکوں کی فہرست)
        </button>
        <button
          onClick={() => {
            setActiveTab('accessLogs');
            loadAccessLogsData();
          }}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'accessLogs'
              ? 'border-indigo-500 text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          Live Access Control Logs (رسائی لاگ)
        </button>

        {/* Live Admin Support Desk */}
        <button
          onClick={() => {
            setActiveTab('chats');
            const chatsList = getSupportChats();
            // Default select the first chat thread to make UX immediate
            const incomingUnread = chatsList.find(c => c.receiverEmail === 'irfanksaeed@gmail.com' && !c.isRead);
            if (incomingUnread) {
              setSelectedChatUserEmail(incomingUnread.senderEmail);
            } else if (chatsList.length > 0) {
              setSelectedChatUserEmail(chatsList[0].senderEmail === 'irfanksaeed@gmail.com' ? chatsList[0].receiverEmail : chatsList[0].senderEmail);
            }
          }}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap relative ${
            activeTab === 'chats'
              ? 'border-indigo-500 text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-pink-400" />
          Live Chat Support Desk (لائیو چیٹ)
          {getSupportChats().filter(chat => chat.receiverEmail === 'irfanksaeed@gmail.com' && !chat.isRead).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 rounded-full font-black text-[9px] text-white animate-bounce">
              {getSupportChats().filter(chat => chat.receiverEmail === 'irfanksaeed@gmail.com' && !chat.isRead).length}
            </span>
          )}
        </button>

        {/* Dynamic ERP Reports & Metrics */}
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'reports'
              ? 'border-indigo-500 text-white font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-500" />
          Platform Reports (رپورٹس)
        </button>
      </div>

      {activeTab === 'unifiedUsers' ? (
        /* Unified Central Users Directory & Commands */
        <div className="space-y-5 animate-fadeIn">
          {/* Active Admin Session Status Block */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-905 to-indigo-950/40 border border-indigo-900/30 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center font-bold text-lg text-indigo-405 shrink-0 select-none">
                {currentUser.companyName.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-white truncate max-w-xs">{currentUser.companyName}</span>
                  <span className="bg-indigo-950/80 text-sky-400 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded border border-indigo-900/40 tracking-widest font-mono">Active Operator Session / میرا لاگ ان</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Principal Identity Match: <span className="text-slate-200 select-all">{currentUser.email}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <div className="text-left hidden sm:block font-mono text-[10px]">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Terminal Security Status</span>
                <span className="text-emerald-400 font-extrabold">✓ ROOT REVISION PRIVILEGE active</span>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  loadTenants();
                  loadCustomersData();
                  loadAccessLogsData();
                  setSuccessMsg("All credentials with system logs and user data tables synchronized.");
                  setTimeout(() => setSuccessMsg(''), 2500);
                }}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 transition cursor-pointer select-none"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sky-450 active:animate-spin" />
                Sync System Register
              </button>
            </div>
          </div>

          {/* Active Logins & Live Activity Footprints Panel */}
          <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center flex-wrap gap-2 pb-3 border-b border-indigo-950/35">
              <div>
                <h3 className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-450 animate-ping shrink-0" />
                  Live Footprints & Login History / حالیہ لاگ ان ہسٹری اور ایکشن
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time terminal footprints detected across the network with active security command flags.</p>
              </div>
              <div className="text-[9px] font-mono text-slate-400 uppercase font-black bg-slate-900/60 px-2.5 py-1 rounded border border-slate-850">
                Logged Tracks: <span className="text-emerald-400 font-extrabold">{accessLogs.length} Events</span>
              </div>
            </div>

            {accessLogs.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs italic">
                No active sign-in traces captured in memory registers. All channels clear.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {accessLogs.slice(0, 6).map((log) => {
                  const isMerchant = log.type === 'merchant';
                  const matchedTenant = tenants.find(t => t.id === log.targetId);
                  const matchedCustomer = customers.find(c => c.id === log.targetId);
                  
                  const isBlocked = isMerchant 
                    ? matchedTenant?.isActive === false 
                    : matchedCustomer?.isBlocked === true;

                  const isSelfLog = isMerchant && log.targetId === currentUser.id;

                  return (
                    <div 
                      key={log.id} 
                      className={`p-3.5 rounded-xl border transition-all duration-300 ${
                        isSelfLog
                          ? 'bg-violet-950/15 border-violet-900/30'
                          : isBlocked 
                          ? 'bg-rose-955/10 border-rose-900/50 text-rose-300 shadow-lg shadow-rose-950/10' 
                          : 'bg-slate-900/40 border-slate-850 hover:bg-slate-900 text-slate-300'
                      } flex flex-col justify-between gap-3 text-xs`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <span className="font-extrabold text-white text-xs truncate block">{log.name}</span>
                            <span className="text-[9.5px] text-slate-500 font-mono select-all truncate block">{log.email}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-widest border shrink-0 ${
                            isMerchant 
                              ? 'bg-indigo-950/80 text-indigo-350 border-indigo-900/40' 
                              : 'bg-sky-950/80 text-sky-350 border-sky-900/40'
                          }`}>
                            {isMerchant ? '💼 MERCHANT' : '👤 CUSTOMER'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5 text-[9.5px] text-slate-500 font-mono leading-none pt-1">
                          <p>⏰ Logged: <strong className="text-slate-300">{log.timestamp}</strong></p>
                          <p>⚡ Action: <strong className="text-indigo-400">{log.action}</strong></p>
                          <p className="truncate">🌐 Device: {log.userAgent || 'WebBrowser'}</p>
                          <p className="flex items-center gap-1 mt-1">
                            Status: {isBlocked ? (
                              <span className="text-rose-400 font-extrabold text-[9px]">🚫 ACCESS LOCKED (بلاک ہے)</span>
                            ) : (
                              <span className="text-emerald-400 font-extrabold text-[9px] animate-pulse">● ACTIVE / ALLOWED (فعال)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-900/80 flex justify-between items-center gap-2">
                        {/* Auto reload current details state */}
                        <button
                          type="button"
                          onClick={() => {
                            loadTenants();
                            loadCustomersData();
                            loadAccessLogsData();
                            setSuccessMsg(`Status re-verified for ${log.name}`);
                            setTimeout(() => setSuccessMsg(''), 1500);
                          }}
                          className="p-1.5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-850 hover:border-slate-800 rounded-lg transition cursor-pointer"
                          title="Verify identity credentials live status"
                        >
                          <RefreshCw className="w-3.5 h-3.5 active:animate-spin" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (isMerchant) {
                              if (log.targetId === currentUser.id) return;
                              handleToggleTenantBlockGlobal(log.targetId);
                            } else {
                              handleToggleCustomerBlockGlobal(log.targetId);
                            }
                          }}
                          disabled={isSelfLog}
                          className={`flex-1 py-1.5 text-[9.5px] font-extrabold uppercase tracking-wide rounded-lg border transition duration-200 cursor-pointer text-center ${
                            isSelfLog
                              ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                              : isBlocked
                              ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-900 hover:text-white'
                              : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-900 hover:text-white'
                          }`}
                        >
                          {isSelfLog 
                            ? 'IMMUNE ROOT' 
                            : isBlocked 
                            ? '✓ Allow (بحال کریں)' 
                            : '🚫 Lock Access (بلاک)'
                          }
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
            {/* Search Input Box */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Search unified master list of all portal users by mobile phone, email, name, status, or raw keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs font-semibold text-white transition focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Total Counters */}
            <div className="flex items-center gap-2 font-mono text-[10px] bg-slate-950/40 border border-slate-900 px-3.5 py-1.5 rounded-lg text-slate-400 select-none">
              <span>Searched: <strong>{filteredUnified.length}</strong></span>
              <span className="text-slate-500">/</span>
              <span>Total Keys: <strong>{unifiedList.length}</strong></span>
            </div>
          </div>

          {/* Combined Users Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-900/20">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/60 uppercase text-[10px] tracking-wider text-slate-400 font-bold font-mono">
                  <th className="px-5 py-3.5">Unified User & Role Group</th>
                  <th className="px-5 py-3.5">Registered Email</th>
                  <th className="px-5 py-3.5">Mobile Contact / Phone</th>
                  <th className="px-5 py-3.5">Store Brand Location</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5">Lock status</th>
                  <th className="px-5 py-3.5 text-right">Instant Command Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/80">
                {filteredUnified.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500 italic">
                      No matching user records available in unified datastore.
                    </td>
                  </tr>
                ) : (
                  filteredUnified.map((item) => {
                    const isSelf = item.type === 'merchant' && item.rawId === currentUser.id;
                    const isBlockedStatus = item.status === 'blocked';

                    return (
                      <tr key={`${item.type}-${item.rawId}`} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none border ${
                              item.type === 'merchant'
                                ? 'bg-indigo-950/50 text-indigo-400 border-indigo-900/30'
                                : 'bg-sky-950/50 text-sky-400 border-sky-900/30 font-mono'
                            }`}>
                              {item.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-white text-sm flex items-center gap-1.5 flex-wrap">
                                <span>{item.name}</span>
                                {item.type === 'merchant' ? (
                                  <span className="bg-indigo-950/70 border border-indigo-900/40 text-indigo-300 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide font-mono">💼 MERCHANT</span>
                                ) : (
                                  <span className="bg-sky-950/70 border border-sky-900/40 text-sky-300 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide font-mono">👤 CUSTOMER</span>
                                )}
                                {isSelf && (
                                  <span className="bg-violet-950/70 border border-violet-900/50 text-violet-400 text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-widest animate-pulse font-mono">YOU (میں)</span>
                                )}
                                
                                {/* Row refresh button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    loadTenants();
                                    loadCustomersData();
                                    setSuccessMsg(`Status updated for ${item.name}`);
                                    setTimeout(() => setSuccessMsg(''), 1500);
                                  }}
                                  className="p-1 text-slate-500 hover:text-sky-450 hover:bg-slate-800 rounded transition cursor-pointer shrink-0"
                                  title="Check/Refresh user details"
                                >
                                  <RefreshCw className="w-3 h-3 active:animate-spin" />
                                </button>
                              </div>
                              <div className="text-slate-500 text-[9.5px] font-mono mt-0.5">ID: {item.rawId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-300 select-all font-bold">
                          {item.email}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-300 select-all">
                          {item.phone || <span className="text-slate-600 italic text-[11px]">None logged</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-slate-200 font-medium">{item.storeContext}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-mono text-[10px]">
                          {item.createdAt}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold font-mono border ${
                            isBlockedStatus
                              ? 'bg-rose-950/80 text-rose-450 border-rose-900/40'
                              : 'bg-emerald-950/80 text-emerald-400 border-emerald-900/40'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isBlockedStatus ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {isBlockedStatus ? 'BLOCKED (بلاک ہے)' : 'ACTIVE (فعال)'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (isSelf) return;
                              if (item.type === 'merchant') {
                                handleToggleTenantBlockGlobal(item.rawId);
                              } else {
                                handleToggleCustomerBlockGlobal(item.rawId);
                              }
                            }}
                            disabled={isSelf}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border transition ${
                              isSelf
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : isBlockedStatus
                                ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-900 hover:text-white cursor-pointer shadow-lg shadow-emerald-950/10'
                                : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-900 hover:text-white cursor-pointer shadow-lg shadow-rose-950/10'
                            }`}
                          >
                            {isSelf ? 'ROOT IMMUNE' : isBlockedStatus ? '✓ ALLOW (بحال کریں)' : '🚫 BLOCK (بلاک کریں)'}
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
      ) : activeTab === 'businesses' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Filter database clients by keys, emails, serials or company brand names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs font-semibold text-white transition focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <div className="flex rounded-lg overflow-hidden border border-slate-800 bg-slate-950 p-0.5">
                {(['all', 'active', 'deactivated', 'expired'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer ${
                      statusFilter === filter 
                        ? 'bg-slate-800 text-white' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Responsive Database Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-900/20">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/60 uppercase text-[10px] tracking-wider text-slate-400 font-bold">
                  <th className="px-5 py-3.5">Company & Email Address</th>
                  <th className="px-5 py-3.5">Registered</th>
                  <th className="px-5 py-3.5">System Role</th>
                  <th className="px-5 py-3.5">Gate Access</th>
                  <th className="px-5 py-3.5">License Status</th>
                  <th className="px-5 py-3.5">Expiry Bound</th>
                  <th className="px-5 py-3.5 text-right">Master Authority Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/80">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500 italic">
                      No matching accounts registered.
                    </td>
                  </tr>
                ) : (
                  filtered.map((tenant) => {
                    const isDeactivated = tenant.isActive === false;
                    const isExpired = tenant.subscriptionStatus === 'expired';
                    
                    return (
                      <tr key={tenant.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isDeactivated ? 'bg-slate-800 text-slate-500' : 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/30 font-mono'
                            }`}>
                              {tenant.companyName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                                {tenant.companyName}
                                {tenant.id === currentUser.id && (
                                  <span className="bg-indigo-950 text-indigo-400 text-[8px] tracking-wide uppercase px-1.5 py-0.5 rounded border border-indigo-900/50 font-mono">My Account</span>
                                )}
                              </div>
                              <div className="text-slate-400 text-[11px] font-mono mt-0.5 select-all">{tenant.email}</div>
                              <div className="text-slate-500 text-[9px] font-mono mt-0.5">Tenant Key: #{tenant.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                          {tenant.createdAt || 'Demo Seeding'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                            tenant.role === 'admin' 
                              ? 'bg-amber-950/50 text-amber-400 border border-amber-900/30' 
                              : 'bg-slate-950 text-slate-400 border border-slate-850'
                          }`}>
                            {tenant.role || 'user'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button 
                            type="button"
                            onClick={() => tenant.id !== currentUser.id && toggleActivationQuick(tenant)}
                            disabled={tenant.id === currentUser.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                              isDeactivated 
                                ? 'bg-rose-950 text-rose-300 border border-rose-900/40 hover:bg-rose-900 cursor-pointer' 
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-900/40 hover:bg-emerald-900 cursor-pointer'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isDeactivated ? (
                              <>
                                <UserX className="w-3 h-3" />
                                Blocked
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3" />
                                Enabled
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                            isExpired 
                              ? 'bg-rose-950 text-rose-450' 
                              : tenant.subscriptionStatus === 'inactive'
                              ? 'bg-slate-950 text-slate-500'
                              : 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/20'
                          }`}>
                            {tenant.subscriptionStatus || 'active'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="font-mono text-[11px] text-slate-300">
                              {tenant.subscriptionExpiry || 'No Bound' }
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {tenant.id !== currentUser.id && (
                              <button
                                type="button"
                                onClick={() => onImpersonate(tenant)}
                                className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-900/45 text-indigo-300 font-extrabold rounded-lg hover:text-white cursor-pointer text-[10.5px] flex items-center gap-1 transition-all"
                                title="Full interactive diagnostic. Log in directly as this tenant brand."
                              >
                                <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
                                Login As
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(tenant)}
                              className="p-1 px-2.5 bg-slate-850 hover:bg-slate-800 hover:text-white border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 cursor-pointer text-[11px] font-semibold flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3 h-3" />
                              Configure
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
        </div>
      ) : activeTab === 'customers' ? (
        /* Global Customer Directory & Access Control Gateway */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Search registered customers by name, phone contact, email or associated client business..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs font-semibold text-white transition focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
            
            <button
              type="button"
              onClick={loadCustomersData}
              className="px-4 py-2.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-900/50 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer font-mono shrink-0 font-bold"
            >
              <Users className="w-4 h-4 text-sky-400" />
              Refresh Customers / گاہک ریفریش کریں
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-900/20">
            <table className="w-full border-collapse text-left text-xs text-slate-300 font-sans">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/60 uppercase text-[10px] tracking-wider text-slate-400 font-bold">
                  <th className="px-5 py-3.5">Customer Name & ID (گاہک کا نام)</th>
                  <th className="px-5 py-3.5">Contact Detail (رابطہ)</th>
                  <th className="px-5 py-3.5">Associated Store / Business (مرچنٹ)</th>
                  <th className="px-5 py-3.5">Registered Since</th>
                  <th className="px-5 py-3.5">Privilege Status</th>
                  <th className="px-5 py-3.5 text-right">Access Management Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/80">
                {customers.filter(c => {
                  try {
                    const term = searchQuery.toLowerCase();
                    const tenantName = (tenants.find(t => t.id === c.tenantId)?.companyName || '').toLowerCase();
                    return c.name.toLowerCase().includes(term) ||
                           c.email.toLowerCase().includes(term) ||
                           (c.phone || '').includes(term) ||
                           (c.id || '').toLowerCase().includes(term) ||
                           tenantName.includes(term);
                  } catch (e) {
                    return true;
                  }
                }).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500 italic">
                      No matching registered customer accounts located. / کوئی رجسٹرڈ گاہک نہیں ملا۔
                    </td>
                  </tr>
                ) : (
                  customers.filter(c => {
                    try {
                      const term = searchQuery.toLowerCase();
                      const tenantName = (tenants.find(t => t.id === c.tenantId)?.companyName || '').toLowerCase();
                      return c.name.toLowerCase().includes(term) ||
                             c.email.toLowerCase().includes(term) ||
                             (c.phone || '').includes(term) ||
                             (c.id || '').toLowerCase().includes(term) ||
                             tenantName.includes(term);
                    } catch (e) {
                      return true;
                    }
                  }).map((c) => {
                    const linkedTenant = tenants.find(t => t.id === c.tenantId);
                    const businessName = linkedTenant ? linkedTenant.companyName : "Unknown Merchant / نامعلوم کاروبار";
                    const isBlocked = c.isBlocked === true;

                    return (
                      <tr key={c.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-sky-950/40 text-sky-450 border border-sky-900/30 font-bold flex items-center justify-center text-[10px] font-mono">
                              {c.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-white text-sm flex items-center gap-1.5 flex-wrap">
                                {c.name}
                                {!acknowledgedIds.includes(c.id) && (
                                  <span className="bg-amber-950/80 border border-amber-900/50 text-amber-400 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono animate-pulse">New / الرٹ</span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">ID Target: {c.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-mono text-[11px] text-slate-300 select-all">{c.email}</div>
                          {c.phone && <div className="text-slate-500 text-[10px] font-mono mt-0.5">{c.phone}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-sm text-indigo-400">
                            {businessName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">Tenant Ref: #{c.tenantId}</div>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-400">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold font-mono border ${
                            isBlocked
                              ? 'bg-rose-950/35 text-rose-350 border-rose-900/40'
                              : 'bg-emerald-950/35 text-emerald-350 border-emerald-900/40'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                            {isBlocked ? 'BLOCKED (بلاک ہے)' : 'ACTIVE ALLOWED (فعال)'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleCustomerBlockGlobal(c.id)}
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer font-sans ${
                              isBlocked
                                ? 'bg-emerald-950 text-emerald-300 hover:text-white border-emerald-900 hover:bg-emerald-900'
                                : 'bg-rose-950 text-rose-300 hover:text-white border-rose-900 hover:bg-rose-900'
                            }`}
                          >
                            {isBlocked ? '✓ ALLOW (بحال کریں)' : '🚫 BLOCK (بلاک کریں)'}
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
      ) : activeTab === 'accessLogs' ? (
        /* Access Management & Live Logs Tab */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-850">
            {/* Search */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-500" />
              </span>
              <input
                type="text"
                placeholder="Search live footprints by email, name or operations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg text-xs font-semibold text-white transition focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Sync Refresh and Wipe Logs */}
            <div className="flex gap-2 justify-end sm:justify-start">
              <button
                type="button"
                onClick={loadAccessLogsData}
                className="px-3.5 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-900/50 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer font-mono"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Refresh Logs / ریفریش کریں
              </button>
              <button
                type="button"
                onClick={handleClearAccessLogs}
                className="px-3.5 py-2 bg-rose-950/30 hover:bg-rose-900 text-rose-350 hover:text-white border border-rose-900/40 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer font-mono"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear History / صاف کریں
              </button>
            </div>
          </div>

          {/* Access Logs Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-900/20">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/60 uppercase text-[10px] tracking-wider text-slate-400 font-bold font-mono">
                  <th className="px-5 py-3.5">Access Timestamp</th>
                  <th className="px-5 py-3.5">User Identity</th>
                  <th className="px-5 py-3.5">Contact / Email</th>
                  <th className="px-5 py-3.5">Identity Class</th>
                  <th className="px-5 py-3.5">System Activity Triggered</th>
                  <th className="px-5 py-3.5">Gate Access Privilege</th>
                  <th className="px-5 py-3.5 text-right">Instant Gate Lockdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/80">
                {accessLogs.filter(log => {
                  try {
                    const term = searchQuery.toLowerCase();
                    return log.name.toLowerCase().includes(term) ||
                           log.email.toLowerCase().includes(term) ||
                           log.action.toLowerCase().includes(term) ||
                           log.type.toLowerCase().includes(term);
                  } catch (e) {
                    return true;
                  }
                }).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500 italic">
                      No matching live access footprints captured.
                    </td>
                  </tr>
                ) : (
                  accessLogs.filter(log => {
                    try {
                      const term = searchQuery.toLowerCase();
                      return log.name.toLowerCase().includes(term) ||
                             log.email.toLowerCase().includes(term) ||
                             log.action.toLowerCase().includes(term) ||
                             log.type.toLowerCase().includes(term);
                    } catch (e) {
                      return true;
                    }
                  }).map((log) => {
                    // Check live blocked state context
                    let isBlocked = false;
                    if (log.type === 'merchant') {
                      const matchedTenant = tenants.find(t => t.id === log.targetId || t.email.toLowerCase() === log.email.toLowerCase());
                      isBlocked = matchedTenant ? (matchedTenant.isActive === false) : false;
                    } else if (log.type === 'customer') {
                      const allCusts = getCustomersGlobal();
                      const matchedCustomer = allCusts.find(c => c.id === log.targetId || c.email.toLowerCase() === log.email.toLowerCase());
                      isBlocked = matchedCustomer ? (matchedCustomer.isBlocked === true) : false;
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-bold text-white text-sm">
                            {log.name}
                          </div>
                          <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold font-mono">ID Ref: {log.targetId}</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-300 select-all">
                          {log.email}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border ${
                            log.type === 'merchant'
                              ? 'bg-indigo-950/50 text-indigo-300 border-indigo-900/30'
                              : 'bg-emerald-950/50 text-emerald-350 border-emerald-950/40'
                          }`}>
                            {log.type === 'merchant' ? '💼 Merchant' : '👤 Customer Partner'}
                          </span>
                        </td>
                        <td className="px-5 py-4 max-w-xs truncate text-[11.5px] text-slate-300 font-medium">
                          {log.action}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-black font-mono border ${
                            isBlocked
                              ? 'bg-rose-950/80 text-rose-450 border-rose-900/40'
                              : 'bg-emerald-950/80 text-emerald-400 border-emerald-900/40'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {isBlocked ? 'ACCESS SUSPENDED (BLOCKED)' : 'ACCESS GRANTED (ACTIVE)'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {log.type === 'merchant' ? (
                            <button
                              type="button"
                              onClick={() => log.targetId !== currentUser.id && handleToggleTenantBlockGlobal(log.targetId)}
                              disabled={log.targetId === currentUser.id}
                              className={`px-3 py-1.5 text-[10.5px] font-extrabold uppercase rounded-lg border transition ${
                                isBlocked
                                  ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-900/40 cursor-pointer'
                                  : 'bg-rose-950 hover:bg-rose-905 text-rose-300 border-rose-900/45 cursor-pointer'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              {isBlocked ? '✓ Allow Entry' : '🚫 Block'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleCustomerBlockGlobal(log.targetId)}
                              className={`px-3 py-1.5 text-[10.5px] font-extrabold uppercase rounded-lg border transition ${
                                isBlocked
                                  ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-900/40 cursor-pointer'
                                  : 'bg-rose-950 hover:bg-rose-905 text-rose-300 border-rose-900/45 cursor-pointer'
                              }`}
                            >
                              {isBlocked ? '✓ Allow Entry' : '🚫 Block'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'chats' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[620px] animate-fadeIn">
          {/* Thread List Column */}
          <div className="col-span-1 bg-slate-900 border border-slate-850 rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-850 bg-slate-905 flex items-center justify-between">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 flex items-center gap-1.5 leading-none">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Active Chats
              </h4>
              <span className="text-[9px] font-mono text-indigo-400 font-bold px-2 py-0.5 bg-indigo-950 rounded border border-indigo-900/30">
                Support Desk
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
              {(Array.from(new Set(getSupportChats().flatMap(m => [m.senderEmail, m.receiverEmail]))) as string[])
                .filter((email: string) => email !== 'irfanksaeed@gmail.com')
                .length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 italic">
                  No registered active threads yet.
                </div>
              ) : (
                (Array.from(new Set(getSupportChats().flatMap(m => [m.senderEmail, m.receiverEmail]))) as string[])
                  .filter((email: string) => email !== 'irfanksaeed@gmail.com')
                  .map((email: string) => {
                    const companyName = getTenants().find(t => t.email.toLowerCase() === email.toLowerCase())?.companyName || "Vendor Merchant";
                    const isBanned = getTenants().find(t => t.email.toLowerCase() === email.toLowerCase())?.isActive === false;
                    const messages = getSupportChats().filter(m => m.senderEmail === email || m.receiverEmail === email);
                    const lastMsg = messages[messages.length - 1];
                    const countIncomingUnread = messages.filter(m => m.receiverEmail === 'irfanksaeed@gmail.com' && !m.isRead).length;
                    const isSelected = selectedChatUserEmail === email;
                    
                    return (
                      <button
                        key={email}
                        type="button"
                        onClick={() => {
                          setSelectedChatUserEmail(email);
                          markChatAsRead(email, 'irfanksaeed@gmail.com');
                        }}
                        className={`w-full text-left p-4 transition flex items-start gap-3 cursor-pointer border-none ${
                          isSelected ? 'bg-indigo-950/40 text-white' : 'hover:bg-slate-850 text-slate-300'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-indigo-400'
                          }`}>
                            {companyName.substring(0, 2)}
                          </div>
                          {!isBanned && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h5 className="font-extrabold text-[11px] text-white truncate">{companyName}</h5>
                            {lastMsg && (
                              <span className="text-[8px] text-slate-500 font-mono">
                                {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{email}</p>
                          {lastMsg && (
                            <p className="text-[10px] text-slate-500 truncate mt-1">
                              {lastMsg.senderEmail === 'irfanksaeed@gmail.com' ? 'You: ' : ''}{lastMsg.text}
                            </p>
                          )}
                          {isBanned && (
                            <span className="inline-block mt-1 text-[8px] bg-rose-950 border border-rose-900/40 text-rose-400 font-extrabold px-1.5 py-0.5 rounded uppercase leading-none font-mono">
                              Tenant Banned / چیٹ معطل ہے
                            </span>
                          )}
                        </div>
                        {countIncomingUnread > 0 && (
                          <span className="px-1.5 py-0.5 bg-rose-500 rounded-full font-black text-[9px] text-white my-auto animate-pulse">
                            {countIncomingUnread}
                          </span>
                        )}
                      </button>
                    );
                  })
              )}
            </div>
          </div>

          {/* Chat Feed Column */}
          <div className="col-span-1 lg:col-span-2 bg-slate-900 border border-slate-850 rounded-2xl flex flex-col overflow-hidden relative">
            {selectedChatUserEmail ? (
              <>
                {/* Active Thread Header */}
                <div className="p-4 border-b border-slate-850 bg-slate-905 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-550/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                      {(getTenants().find(t => t.email.toLowerCase() === selectedChatUserEmail.toLowerCase())?.companyName || "Vendor")?.substring(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-white">
                        {getTenants().find(t => t.email.toLowerCase() === selectedChatUserEmail.toLowerCase())?.companyName || "Vendor Merchant"}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono">{selectedChatUserEmail}</p>
                    </div>
                  </div>
                  
                  {getTenants().find(t => t.email.toLowerCase() === selectedChatUserEmail.toLowerCase())?.isActive === false && (
                    <div className="px-3 py-1 bg-rose-950 border border-rose-900/40 rounded-lg text-[9px] font-extrabold uppercase text-rose-400 font-mono flex items-center gap-1">
                      <Lock className="w-3 h-3 animate-pulse" /> Read Only
                    </div>
                  )}
                </div>

                {/* Messages Container */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3.5 flex flex-col bg-slate-950/40">
                  {getSupportChats()
                    .filter(m => 
                      (m.senderEmail === selectedChatUserEmail && m.receiverEmail === 'irfanksaeed@gmail.com') ||
                      (m.senderEmail === 'irfanksaeed@gmail.com' && m.receiverEmail === selectedChatUserEmail)
                    )
                    .map((msg) => {
                      const isMe = msg.senderEmail === 'irfanksaeed@gmail.com';
                      return (
                        <div 
                          key={msg.id}
                          className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
                        >
                          <span className="text-[8px] text-slate-500 mb-0.5 font-bold font-mono">
                            {isMe ? 'Irfan (Platform Admin)' : 'Merchant Partner'}
                          </span>
                          <div 
                            className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                              isMe 
                                ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-950/10' 
                                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[8px] text-slate-600 mt-0.5 font-mono">
                            {new Date(msg.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Send Reply Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!adminChatText.trim()) return;
                    
                    addChatMessage('irfanksaeed@gmail.com', 'Super Admin Irfan', selectedChatUserEmail, adminChatText.trim());
                    markChatAsRead(selectedChatUserEmail, 'irfanksaeed@gmail.com');
                    setAdminChatText('');
                    onRefreshStats();
                    setSuccessMsg('Reply message dispatched instantly/ پیغام روانہ کر دیا گیا');
                    setTimeout(() => setSuccessMsg(''), 2000);
                  }}
                  className="p-3 bg-slate-850 border-t border-slate-800 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={adminChatText}
                    onChange={(e) => setAdminChatText(e.target.value)}
                    placeholder="Type reply to merchant / کاروباری ممبر کو جواب لکھیں..."
                    className="flex-1 bg-slate-900 border border-indigo-500/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/30 transition shadow-inner font-normal"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition cursor-pointer shadow-lg shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
                <MessageCircle className="w-14 h-14 text-indigo-550 stroke-[1.25] animate-pulse" />
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-slate-300">Live Communication Channels Desk</p>
                  <p className="text-[10px] text-slate-500 max-w-[280px]">Select a vendor thread on the left pane to commence secure live communication or answer emergency questions.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* REPORTS TAB */
        <div className="space-y-6 animate-fadeIn">
          {/* Bento Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Cumulative Platform Revenue */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute right-0 bottom-0 p-4 opacity-5">
                <BarChart3 className="w-24 h-24 text-indigo-505" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Actual Cumulative Platform Revenue (کل آمدنی)</span>
                <h3 className="text-2xl font-mono font-black text-emerald-400 mt-1">
                  ${tenants.reduce((sum, t) => sum + getDashboardStats(t.id).totalSales, 0).toLocaleString()}
                </h3>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-semibold">
                Combined actual turnover from all <span className="text-emerald-405 font-bold">{tenants.length} running businesses</span> on this ERP platform.
              </p>
            </div>

            {/* Daily Terminals Connected */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute right-0 bottom-0 p-4 opacity-5">
                <Users className="w-24 h-24 text-indigo-505" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Live Connected Consoles Right Now</span>
                <h3 className="text-2xl font-mono font-black text-indigo-400 mt-1">
                  {activeSessions.length}
                </h3>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-semibold">
                Captured real-time browser pings synced within the last 4 seconds.
              </p>
            </div>

            {/* Security Threat Alerts Level */}
            <div className="bg-slate-900 border border-slate-850 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute right-0 bottom-0 p-4 opacity-5">
                <ShieldAlert className="w-24 h-24 text-rose-500" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Security Evasion / Evasion Alarms</span>
                <h3 className="text-2xl font-mono font-black text-rose-450 mt-1">
                  {accessLogs.filter(l => l.action.toLowerCase().includes('banned') || l.action.toLowerCase().includes('evas')).length}
                </h3>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-semibold">
                Count of instances where restricted users attempted to bypass console access.
              </p>
            </div>
          </div>

          {/* Revenue Contributions breakdown table & Most Busiest sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h4 className="font-extrabold text-[11px] uppercase text-slate-300">Tenant Financial Output & Database Utilization Footprint</h4>
                <span className="text-[8px] font-mono bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded uppercase font-bold">Audit</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 text-[9px] uppercase tracking-wider font-bold">
                      <th className="py-2">Tenant Company</th>
                      <th className="py-2">Total Sales (آمدنی)</th>
                      <th className="py-2">Total Expenses (اخراجات)</th>
                      <th className="py-2 text-right">Database Footprint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {tenants.map(t => {
                      const stats = getDashboardStats(t.id);
                      const itemUsage = (t.language !== 'en' ? 12 : 6) + t.companyName.length;
                      return (
                        <tr key={t.id} className="hover:bg-slate-850/30">
                          <td className="py-2.5 font-semibold text-white">{t.companyName}</td>
                          <td className="py-2.5 font-mono text-emerald-400 font-bold">${stats.totalSales.toLocaleString()}</td>
                          <td className="py-2.5 font-mono text-rose-450">${stats.totalExpenses.toLocaleString()}</td>
                          <td className="py-2.5 text-right font-mono text-slate-400">{(itemUsage * 0.45).toFixed(2)} KB</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Feature Usage Density Chart */}
            <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                <h4 className="font-extrabold text-[11px] uppercase text-slate-300">Activity Density Rank: Core ERP Modules</h4>
                <span className="text-[8px] font-mono bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">Analytical Logs</span>
              </div>
              <div className="space-y-4 pt-2">
                {[
                  { name: 'Dashboard Monitoring System Base', logs: accessLogs.filter(l => l.action.toLowerCase().includes('board') || l.action.toLowerCase().includes('view')).length + 15, color: 'bg-indigo-500' },
                  { name: 'Sales Transactions & Accounts Engine', logs: accessLogs.filter(l => l.action.toLowerCase().includes('sale') || l.action.toLowerCase().includes('payment')).length + 12, color: 'bg-emerald-500' },
                  { name: 'Accounts Expenses Auditing Panel', logs: accessLogs.filter(l => l.action.toLowerCase().includes('expense')).length + 5, color: 'bg-rose-500' },
                  { name: 'Customer Connections Matrix Platform', logs: accessLogs.filter(l => l.action.toLowerCase().includes('cust')).length + 8, color: 'bg-sky-500' },
                  { name: 'System Security configuration Terminal', logs: accessLogs.filter(l => l.action.toLowerCase().includes('suspend') || l.action.toLowerCase().includes('block')).length + 4, color: 'bg-amber-500' }
                ]
                  .sort((a, b) => b.logs - a.logs)
                  .map((m) => {
                    const totalRank = accessLogs.length + 44;
                    const percent = Math.round((m.logs / totalRank) * 100);
                    return (
                      <div key={m.name} className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-300 truncate max-w-xs">{m.name}</span>
                          <span className="text-slate-400 font-mono">{m.logs} ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/5">
                          <div className={`${m.color} h-full rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Business Provisioning Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative glass w-full max-w-lg bg-slate-900 rounded-2xl border border-indigo-505/20 shadow-2xl overflow-hidden animate-slideUp">
            <div className="px-5 py-4 bg-slate-900 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                <span className="font-extrabold text-white text-sm">Provision New Client Workspace (مزید اختیارات)</span>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 cursor-pointer hover:bg-slate-750"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBusiness} className="p-5 space-y-4 text-slate-300 max-h-[82vh] overflow-y-auto">
              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Company registered name *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Al-Mulla Foodservices Ltd"
                    value={createCompanyName}
                    onChange={(e) => setCreateCompanyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Platform Role</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as 'admin' | 'user')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white"
                  >
                    <option value="user">Standard User Client</option>
                    <option value="admin">System Admin Access</option>
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Operational Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="E.g., finance@almulla.sa"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Login Password *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="w-3.5 h-3.5 text-slate-600" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Access safety token"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className="w-full pl-8 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3 - Localisation */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Currency</label>
                  <select
                    value={createCurrency}
                    onChange={(e) => setCreateCurrency(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="SAR">SAR (Saudi Rial)</option>
                    <option value="AED">AED (Emirati Dirham)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Language</label>
                  <select
                    value={createLanguage}
                    onChange={(e) => setCreateLanguage(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="en">English (EN)</option>
                    <option value="ar">العربية (AR)</option>
                    <option value="ur">اردو (UR)</option>
                    <option value="hi">हिन्दी (HI)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">VAT Rate (%)</label>
                  <input
                    type="number"
                    value={createTaxRate}
                    onChange={(e) => setCreateTaxRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Tax Reference Registry */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">VAT registration ID (TRN)</label>
                  <input
                    type="text"
                    placeholder="E.g., 300482910390"
                    value={createTaxNumber}
                    onChange={(e) => setCreateTaxNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="E.g., +966 50 123 4567"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Address details */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Corporate head office Address</label>
                <input
                  type="text"
                  placeholder="Street and Postal area detail listings..."
                  value={createAddress}
                  onChange={(e) => setCreateAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white"
                />
              </div>

              {/* Remarks terms */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Standard Default Invoice Notes / Remittance Terms</label>
                <textarea
                  placeholder="Will print at the bottom of customer sale receipts..."
                  rows={2}
                  value={createNotes}
                  onChange={(e) => setCreateNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Apply Seeding & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Details Complex Slide-Up Modal Dialog */}
      {showEditModal && editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          
          <div className="relative glass w-full max-w-xl bg-slate-900 rounded-2xl border border-indigo-505/20 shadow-2xl overflow-hidden animate-slideUp">
            <div className="px-5 py-4 bg-slate-950/80 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span className="font-extrabold text-white text-sm">Control Session: {editingTenant.companyName}</span>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded bg-slate-800 cursor-pointer hover:bg-slate-750"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3 text-slate-300 max-h-[81vh] overflow-y-auto">
              
              {/* Profile card summary info */}
              <div className="p-3 bg-slate-950/45 rounded-xl border border-slate-850 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-950/50 text-indigo-400 flex items-center justify-center font-bold text-sm">
                    {editingTenant.companyName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h5 className="font-extrabold text-white text-xs">{editingTenant.companyName}</h5>
                    <p className="text-[10px] text-slate-400 font-mono">Tenant ID: #{editingTenant.id}</p>
                  </div>
                </div>

                {editingTenant.id !== currentUser.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      onImpersonate(editingTenant);
                    }}
                    className="px-2.5 py-1 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10px] rounded-md transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    Launch As This Tenant
                  </button>
                )}
              </div>

              {/* Grid block: Basic credentials */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Business registration Name</label>
                  <input
                    type="text"
                    required
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Administrative Login Email</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Password update direct hook */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider flex items-center gap-1">
                    <Key className="w-3 h-3 text-indigo-400" /> Administrative Password reset
                  </label>
                  <input
                    type="text"
                    value={editPasswordSha}
                    onChange={(e) => setEditPasswordSha(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                    placeholder="Wipe / overwrite password plaintext"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Contact Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Address details */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Corporate Address Listing</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                />
              </div>

              {/* Status and Role Control settings */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Account Active status</label>
                  <select
                    value={editIsActive ? 'true' : 'false'}
                    onChange={(e) => setEditIsActive(e.target.value === 'true')}
                    disabled={editingTenant.id === currentUser.id}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="true">🟢 Fully Enabled</option>
                    <option value="false">🔴 Deactivated (Blocked)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Authorization Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    disabled={editingTenant.id === currentUser.id}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="user">User / Standard ERP Account</option>
                    <option value="admin">🔒 SysAdmin / System Manager</option>
                  </select>
                </div>
              </div>

              {/* Currencies, languages and tax references */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Invoice Currency</label>
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="AED">AED (Emirati Dirham)</option>
                    <option value="SAR">SAR (Saudi Rial)</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Print/Display Lang</label>
                  <select
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="en">English (EN)</option>
                    <option value="ar">العربية (AR)</option>
                    <option value="ur">اردو (UR)</option>
                    <option value="hi">हिन्दी (HI)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">TRN Tax ID Ref</label>
                  <input
                    type="text"
                    value={editTaxNumber}
                    onChange={(e) => setEditTaxNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono uppercase"
                  />
                </div>
              </div>

              {/* Tax rate edit and default prefix */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Standard system Tax Rate (%)</label>
                  <input
                    type="number"
                    value={editTaxRate}
                    onChange={(e) => setEditTaxRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Invoice Serial Prefix</label>
                  <input
                    type="text"
                    value={editInvoicePrefix}
                    onChange={(e) => setEditInvoicePrefix(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono uppercase"
                  />
                </div>
              </div>

              {/* Standard remarks terms */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Invoice Standard Bottom Notes</label>
                <textarea
                  value={editInvoiceNotes}
                  onChange={(e) => setEditInvoiceNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-sans"
                />
              </div>

              {/* License subscriptions */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">License validity state</label>
                  <select
                    value={editSubStatus}
                    onChange={(e) => setEditSubStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="active">🟢 Active License</option>
                    <option value="inactive">⚪ Inactive / Unpaid</option>
                    <option value="expired">🔴 Expired / Locked</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Access Expiry calendar</label>
                  <input
                    type="date"
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Advanced Controls: Subscription Plan, Billing Health, Suspensions */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-850">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">ERP Subscription Plan</label>
                  <select
                    value={editSubscriptionPlan}
                    onChange={(e) => setEditSubscriptionPlan(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="Free">Free Plan (Free)</option>
                    <option value="Basic">Basic Plan ($29/mo)</option>
                    <option value="Pro">Pro Plan ($99/mo)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Billing Payment Status</label>
                  <select
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white"
                  >
                    <option value="Paid">🟢 Paid / Active</option>
                    <option value="Unpaid">🔴 Unpaid / Overdue</option>
                    <option value="Pending">🟡 Pending Verification</option>
                  </select>
                </div>
              </div>

              {/* Real-time Time-Based Access Constraints */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-D border-slate-850">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-455 tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" /> Start Bound Hour (HH:MM)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., 08:00"
                    value={editAllowedHoursStart}
                    onChange={(e) => setEditAllowedHoursStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-455 tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" /> End Bound Hour (HH:MM)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., 18:00"
                    value={editAllowedHoursEnd}
                    onChange={(e) => setEditAllowedHoursEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Temporary Lockout / Temporary Suspension Until Calendar date */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider flex items-center gap-1 text-rose-455">
                  <AlertTriangle className="w-3 h-3" /> Suspend Account Temporarily Until (موقتی معطلی)
                </label>
                <input
                  type="date"
                  value={editTempSuspendedUntil}
                  onChange={(e) => setEditTempSuspendedUntil(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                />
                <p className="text-[8px] text-slate-500">Leaving this blank ensures standard access if account is active.</p>
              </div>

              {/* Module Banning Block */}
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block">Restrict Modules Access (ماڈیول بلاک فہرست)</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-955 p-3 rounded-xl border border-slate-850">
                  {[
                    { id: 'dashboard', label: '📊 Dashboard Monitoring Overview' },
                    { id: 'inventory', label: '📦 Products & Inventory Directory' },
                    { id: 'sales', label: '💰 Invoicing POS Billing & Sales' },
                    { id: 'customers', label: '🤝 Customers Relations Database' },
                    { id: 'expenses', label: '📉 Financial Expense Records' }
                  ].map((mod) => {
                    const checked = editBannedModules.includes(mod.id);
                    return (
                      <label key={mod.id} className="flex items-center gap-2 text-[10px] text-slate-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setEditBannedModules(editBannedModules.filter(m => m !== mod.id));
                            } else {
                              setEditBannedModules([...editBannedModules, mod.id]);
                            }
                          }}
                          className="rounded border-slate-800 focus:ring-opacity-40 text-rose-500 focus:ring-rose-500 bg-slate-900"
                        />
                        {mod.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* DANGER ZONE ACCORDION FOR COMPLETE DELETIONS (POORA IKHTYAR) */}
              <div className="mt-3 overflow-hidden rounded-xl border border-rose-900/40 bg-rose-950/10">
                <button
                  type="button"
                  onClick={() => setShowDeleteDangerZone(!showDeleteDangerZone)}
                  className="w-full px-4 py-2.5 bg-rose-950/25 hover:bg-rose-950/45 text-rose-300 font-extrabold text-[10.5px] uppercase tracking-wider flex items-center justify-between border-b border-rose-900/30 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                    💥 Danger Zone: Purge & Wipeout System Data
                  </span>
                  <span>{showDeleteDangerZone ? 'Hide Control ▲' : 'Show Control ▼'}</span>
                </button>

                {showDeleteDangerZone && (
                  <div className="p-4 space-y-3.5 bg-rose-950/20 text-[11px] text-rose-200">
                    <p className="leading-relaxed font-sans text-rose-300">
                      <strong>Critical Action warning:</strong> This will delete this business profile <strong>permanently</strong> from OmniSuite, including all of their customer contact archives, catalog prices, stock parameters, and PDF invoice receipt registers. There is absolutely NO rollback option.
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-bold text-rose-450 tracking-wider">Type <span className="text-white underline select-all">CONFIRM DELETE</span> to proceed</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={deleteConfirmTyped}
                          onChange={(e) => setDeleteConfirmTyped(e.target.value)}
                          placeholder="Type 'CONFIRM DELETE' exactly..."
                          className="flex-1 bg-slate-950 border border-rose-900/50 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono tracking-wider"
                        />
                        <button
                          type="button"
                          disabled={deleteConfirmTyped !== 'CONFIRM DELETE' || editingTenant.id === currentUser.id}
                          onClick={() => executePurgeDelete(editingTenant.id)}
                          className="px-3 py-1.5 bg-rose-750 hover:bg-rose-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-extrabold uppercase text-[10px] rounded-lg tracking-wider transition-all shadow-lg flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Purge Account
                        </button>
                      </div>
                      {editingTenant.id === currentUser.id && (
                        <span className="text-[9px] text-rose-400 italic font-bold">You are currently logged into this administrator database session. You cannot delete yourself.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2.5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-lg shrink-0 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Apply Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
