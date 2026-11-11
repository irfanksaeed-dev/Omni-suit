import React, { useState, useEffect } from 'react';
import { 
  getTenants, 
  adminUpdateTenant, 
  adminDeleteTenant, 
  adminCreateTenant,
  getAccessLogs,
  clearAccessLogs,
  adminToggleCustomerBlockGlobal,
  adminToggleCustomerApprovalGlobal,
  getCustomersGlobal,
  pullServerSync,
  pushServerSync,
  getActiveSessions,
  getSupportChats,
  addChatMessage,
  markChatAsRead,
  getDashboardStats,
  getRequireAdminApprovalSetting,
  setRequireAdminApprovalSetting,
  grantGuestPermanentAccess,
  dismissGuestUpgradeRequest,
  getCustomInvites,
  createCustomInvite,
  revokeCustomInvite,
  deleteCustomInvite,
  clearInactiveCustomInvites,
  updateCustomInvite,
  adminUpdateTenantAccessTime,
  adminExtendTenantSubscription,
  adminResetTenantPassword
} from '../db';
import { UserTenant, AccessLog, Customer, CustomInvite, Language } from '../types';
import { getBaseAppUrl, copyTextToClipboard, openExternalLink, buildWhatsAppLink, buildMailtoLink } from '../utils/links';
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
  BarChart3,
  Share2,
  Copy,
  Check,
  Crown,
  Sparkles,
  Link2,
  ExternalLink,
  Timer,
  CalendarDays,
  MailCheck,
  Mail,
  Phone,
  Zap,
  Lock,
  Unlock
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
  const [editTaxRate, setEditTaxRate] = useState<number | string>(15);
  const [editCurrency, setEditCurrency] = useState<'AED' | 'USD' | 'PKR' | 'INR' | 'SAR' | 'EUR'>('SAR');
  const [editLanguage, setEditLanguage] = useState<Language>('en');
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
  const [createLanguage, setCreateLanguage] = useState<Language>('en');
  const [createTaxRate, setCreateTaxRate] = useState<number | string>(15);
  const [createTaxNumber, setCreateTaxNumber] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createRole, setCreateRole] = useState<'admin' | 'user'>('user');
  const [createNotes, setCreateNotes] = useState('');

  const [activeTab, setActiveTab] = useState<'businesses' | 'customers' | 'accessLogs' | 'unifiedUsers' | 'chats' | 'reports'>('unifiedUsers');
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [isSyncingRegister, setIsSyncingRegister] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  
  // Real-time admin states for active terminals and multi-threaded chat loops
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [selectedChatUserEmail, setSelectedChatUserEmail] = useState<string | null>(null);
  const [adminChatText, setAdminChatText] = useState('');
  const [copiedSignup, setCopiedSignup] = useState(false);
  const [copiedVisit, setCopiedVisit] = useState(false);
  const [requireApproval, setRequireApproval] = useState<boolean>(() => getRequireAdminApprovalSetting());

  // Custom Direct Invites & Link Generator states
  const [customInvites, setCustomInvites] = useState<CustomInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCompanyName, setInviteCompanyName] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteDurationType, setInviteDurationType] = useState('permanent');
  const [inviteCustomDate, setInviteCustomDate] = useState('');
  const [inviteHoursStart, setInviteHoursStart] = useState('');
  const [inviteHoursEnd, setInviteHoursEnd] = useState('');
  const [lastCreatedInvite, setLastCreatedInvite] = useState<CustomInvite | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [inviteCreating, setInviteCreating] = useState(false);

  // Tenant Access Time & Validity Control Modal states
  const [timeModalTenant, setTimeModalTenant] = useState<UserTenant | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [timeModalExpiry, setTimeModalExpiry] = useState('');
  const [timeModalIsPermanent, setTimeModalIsPermanent] = useState(false);
  const [timeModalHoursStart, setTimeModalHoursStart] = useState('');
  const [timeModalHoursEnd, setTimeModalHoursEnd] = useState('');
  const [timeModalSuspendedUntil, setTimeModalSuspendedUntil] = useState('');
  const [timeModalStatus, setTimeModalStatus] = useState<'active' | 'inactive' | 'expired'>('active');
  const [timeModalSubmitting, setTimeModalSubmitting] = useState(false);

  const loadCustomInvitesData = () => {
    setCustomInvites(getCustomInvites());
  };

  const handleGenerateCustomInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      alert("Please enter target email address for this invite.");
      return;
    }
    setInviteCreating(true);
    const newInv = createCustomInvite({
      email: inviteEmail.trim(),
      companyName: inviteCompanyName.trim() || undefined,
      phone: invitePhone.trim() || undefined,
      durationType: inviteDurationType,
      customDate: inviteCustomDate || undefined,
      allowedHoursStart: inviteHoursStart || undefined,
      allowedHoursEnd: inviteHoursEnd || undefined
    });
    setInviteCreating(false);
    setLastCreatedInvite(newInv);
    loadCustomInvitesData();
    setSuccessMsg(`⚡ Generated custom direct invite link for "${newInv.email}" (${newInv.durationLabel})!`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleCopyCustomInviteLink = async (inviteId: string) => {
    const link = `${getBaseAppUrl()}/?inviteToken=${inviteId}`;
    const success = await copyTextToClipboard(link);
    if (success) {
      setCopiedInviteId(inviteId);
      setSuccessMsg("✓ Invite link copied to clipboard!");
      setTimeout(() => {
        setCopiedInviteId(null);
        setSuccessMsg('');
      }, 2500);
    }
  };

  const handleRevokeCustomInvite = (inviteId: string) => {
    revokeCustomInvite(inviteId);
    loadCustomInvitesData();
    setSuccessMsg("🚫 Invite token revoked successfully.");
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeleteCustomInvite = (inviteId: string) => {
    deleteCustomInvite(inviteId);
    loadCustomInvitesData();
    if (lastCreatedInvite?.id === inviteId) {
      setLastCreatedInvite(null);
    }
    setSuccessMsg("🗑️ Invite link deleted permanently from database.");
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleClearInactiveInvites = () => {
    const count = clearInactiveCustomInvites();
    loadCustomInvitesData();
    if (lastCreatedInvite && (lastCreatedInvite.status === 'revoked' || (lastCreatedInvite.expiresAt && new Date(lastCreatedInvite.expiresAt).getTime() < Date.now()))) {
      setLastCreatedInvite(null);
    }
    setSuccessMsg(`🧹 Cleaned up ${count} inactive/expired custom invite link(s).`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleOpenTimeModal = (tenant: UserTenant) => {
    setTimeModalTenant(tenant);
    setTimeModalExpiry(tenant.subscriptionExpiry || '');
    setTimeModalIsPermanent(!tenant.subscriptionExpiry && !tenant.isGuestPass);
    setTimeModalHoursStart(tenant.allowedHoursStart || '');
    setTimeModalHoursEnd(tenant.allowedHoursEnd || '');
    setTimeModalSuspendedUntil(tenant.tempSuspendedUntil || '');
    setTimeModalStatus(tenant.subscriptionStatus || (tenant.isActive !== false ? 'active' : 'inactive'));
    setShowTimeModal(true);
  };

  const handleQuickExtendTenant = (extension: '24h' | '7d' | '30d' | '90d' | '180d' | '365d' | 'permanent') => {
    if (!timeModalTenant) return;
    setTimeModalSubmitting(true);
    const updated = adminExtendTenantSubscription(timeModalTenant.id, extension);
    setTimeModalSubmitting(false);
    if (updated) {
      setTimeModalTenant(updated);
      setTimeModalExpiry(updated.subscriptionExpiry || '');
      setTimeModalIsPermanent(!updated.subscriptionExpiry);
      setTimeModalStatus('active');
      loadTenants();
      setSuccessMsg(`✓ Successfully adjusted access for "${updated.companyName}"! Expiry: ${updated.subscriptionExpiry || 'Permanent / Lifetime'}`);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleSaveTimeModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeModalTenant) return;
    setTimeModalSubmitting(true);
    const updated = adminUpdateTenantAccessTime(timeModalTenant.id, {
      subscriptionExpiry: timeModalIsPermanent ? undefined : (timeModalExpiry || undefined),
      isPermanent: timeModalIsPermanent,
      allowedHoursStart: timeModalHoursStart || undefined,
      allowedHoursEnd: timeModalHoursEnd || undefined,
      tempSuspendedUntil: timeModalSuspendedUntil || undefined,
      subscriptionStatus: timeModalStatus,
      isActive: timeModalStatus !== 'inactive'
    });
    setTimeModalSubmitting(false);
    if (updated) {
      loadTenants();
      setShowTimeModal(false);
      setSuccessMsg(`✓ Updated access validity and time controls for "${updated.companyName}" successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleToggleRequireApproval = (val: boolean) => {
    setRequireApproval(val);
    setRequireAdminApprovalSetting(val);
    setSuccessMsg(
      val
        ? '🔒 Super Admin Approval is now REQUIRED for all new permanent registrations.'
        : '⚡ Instant Auto-Approval is now enabled for all new registrations.'
    );
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleApproveTenantQuick = (tenant: UserTenant) => {
    const updated: UserTenant = {
      ...tenant,
      isApproved: true,
      isActive: true,
    };
    adminUpdateTenant(updated);
    loadTenants();
    loadAccessLogsData();
    onRefreshStats();
    setSuccessMsg(`✓ Approved registration for "${tenant.companyName}" (${tenant.email})! Workspace is now unlocked.`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleRejectTenantQuick = (tenant: UserTenant) => {
    const action = window.confirm(
      `Reject Registration Request?\n\nCompany: ${tenant.companyName}\nEmail: ${tenant.email}\n\nClick OK to Reject & Remove this registration request, or Cancel to keep pending.`
    );
    if (action) {
      adminDeleteTenant(tenant.id);
      loadTenants();
      loadAccessLogsData();
      onRefreshStats();
      setSuccessMsg(`🚫 Registration request for "${tenant.companyName}" (${tenant.email}) has been rejected and removed.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleDenyAndBlockTenant = (tenant: UserTenant) => {
    const updated: UserTenant = {
      ...tenant,
      isApproved: false,
      isActive: false,
    };
    adminUpdateTenant(updated);
    loadTenants();
    loadAccessLogsData();
    onRefreshStats();
    setSuccessMsg(`🚫 Access denied and blocked for "${tenant.companyName}" (${tenant.email}).`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleQuickResetPassword = (tenant: UserTenant) => {
    const newPass = window.prompt(
      `🔑 Reset Password for:\nCompany: ${tenant.companyName}\nEmail: ${tenant.email}\n\nCurrent Password: ${tenant.passwordSha || 'N/A'}\n\nEnter new password:`,
      tenant.passwordSha || 'pass123'
    );
    if (newPass && newPass.trim()) {
      adminResetTenantPassword(tenant.id, newPass.trim());
      loadTenants();
      setSuccessMsg(`✓ Password updated successfully for "${tenant.email}"! New password: ${newPass.trim()}`);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  const handleToggleRoleQuick = (tenant: UserTenant) => {
    const nextRole = tenant.role === 'admin' ? 'user' : 'admin';
    const updated: UserTenant = {
      ...tenant,
      role: nextRole
    };
    adminUpdateTenant(updated);
    loadTenants();
    setSuccessMsg(`✓ Role updated for "${tenant.email}" to: ${nextRole.toUpperCase()}`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRejectCustomerQuick = (customerId: string) => {
    const cust = customers.find(c => c.id === customerId);
    if (!cust) return;
    const action = window.confirm(`Reject customer registration for "${cust.name}" (${cust.email})?`);
    if (action) {
      const updated = customers.filter(c => c.id !== customerId);
      localStorage.setItem('biz_suite_customers', JSON.stringify(updated));
      loadCustomersData();
      onRefreshStats();
      setSuccessMsg(`🚫 Customer registration for "${cust.name}" has been rejected.`);
      setTimeout(() => setSuccessMsg(''), 3500);
    }
  };

  const handleApproveAllPending = () => {
    const all = getTenants();
    let count = 0;
    all.forEach(t => {
      if (t.isApproved === false) {
        t.isApproved = true;
        t.isActive = true;
        adminUpdateTenant(t);
        count++;
      }
    });
    const allCust = getCustomersGlobal();
    allCust.forEach(c => {
      if (c.isApproved === false) {
        c.isApproved = true;
        count++;
      }
    });
    localStorage.setItem('biz_suite_customers', JSON.stringify(allCust));
    loadTenants();
    loadCustomersData();
    onRefreshStats();
    setSuccessMsg(`✓ Approved all ${count} pending registration(s)!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleGrantGuestPermanent = (tenant: UserTenant) => {
    const updated = grantGuestPermanentAccess(tenant.id);
    if (updated) {
      loadTenants();
      loadAccessLogsData();
      onRefreshStats();
      setSuccessMsg(`🎉 Granted permanent access to "${tenant.companyName}" (${tenant.email})! All invoices and sandbox data converted to permanent storage.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  const handleDismissGuestUpgrade = (tenant: UserTenant) => {
    dismissGuestUpgradeRequest(tenant.id);
    loadTenants();
    setSuccessMsg(`Dismissed upgrade request for "${tenant.companyName}".`);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleCopySignupLink = async () => {
    const signupUrl = `${getBaseAppUrl()}/?mode=register`;
    const success = await copyTextToClipboard(signupUrl);
    if (success) {
      setCopiedSignup(true);
      setSuccessMsg("✓ Registration signup link copied to clipboard!");
      setTimeout(() => {
        setCopiedSignup(false);
        setSuccessMsg('');
      }, 2500);
    }
  };

  const handleCopyVisitLink = async () => {
    const visitUrl = `${getBaseAppUrl()}/?mode=visit`;
    const success = await copyTextToClipboard(visitUrl);
    if (success) {
      setCopiedVisit(true);
      setSuccessMsg("✓ 24-Hour Guest Trial link copied to clipboard!");
      setTimeout(() => {
        setCopiedVisit(false);
        setSuccessMsg('');
      }, 2500);
    }
  };

  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('biz_suite_acknowledged_customer_ids');
      if (saved) {
        return JSON.parse(saved);
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('biz_suite_acknowledged_customer_ids');
      if (!saved) {
        const currentIds = getCustomersGlobal().map(c => c.id);
        localStorage.setItem('biz_suite_acknowledged_customer_ids', JSON.stringify(currentIds));
        setAcknowledgedIds(currentIds);
      }
    } catch {
      // ignore
    }

    loadTenants();
    loadAccessLogsData();
    loadCustomersData();
    loadCustomInvitesData();

    // Fetch live session instances immediately and bind a periodic pinger to fetch local storage updates (auto-synced with cloud server in App.tsx)
    setActiveSessions(getActiveSessions());
    const sessPinger = setInterval(() => {
      setActiveSessions(getActiveSessions());
      setAccessLogs(getAccessLogs());
      setCustomers(getCustomersGlobal());
      setTenants(getTenants());
      setCustomInvites(getCustomInvites());
    }, 4000);
    return () => clearInterval(sessPinger);
  }, []);

  const loadCustomersData = () => {
    setCustomers(getCustomersGlobal());
  };

  const loadAccessLogsData = async () => {
    setIsRefreshingLogs(true);
    try {
      await pullServerSync();
    } catch (e) {
      console.warn("Background cloud database synchronization is currently offline.", e);
    } finally {
      setIsRefreshingLogs(false);
    }
    setAccessLogs(getAccessLogs());
  };

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    const beforeRecords = getCustomersGlobal();
    
    // Push and Pull real cloud/server-side state instantly
    await pushServerSync();
    await pullServerSync();
    
    // Pull fresh data from synced localStorage
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
        setSuccessMsg(`🚀 Access gate refreshed! Found ${newDiscovered.length} new customer registration(s)!`);
      } else {
        setSuccessMsg('⚡ System database synced & refreshed successfully!');
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
    setSuccessMsg('Cleared all active gate access registration alerts.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleClearAccessLogs = () => {
    clearAccessLogs();
    loadAccessLogsData();
    setSuccessMsg('Access logs history has been successfully cleared.');
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

  const handleToggleCustomerApprovalGlobal = (customerId: string) => {
    adminToggleCustomerApprovalGlobal(customerId);
    loadCustomersData();
    onRefreshStats();
    setSuccessMsg('Customer approval status updated successfully!');
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

  const handleDeleteTenantQuick = (t: UserTenant) => {
    if (window.confirm(`⚠️ EXTREME ACTION: Are you sure you want to completely PURGE and delete "${t.companyName}" (ID: ${t.id})? All invoices, inventory, and databases under this namespace will be permanently lost!`)) {
      adminDeleteTenant(t.id);
      loadTenants();
      setSuccessMsg(`Fully purged and deleted brand workspace for "${t.companyName}".`);
      onRefreshStats();
      setTimeout(() => setSuccessMsg(''), 4550);
    }
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
  const pendingTenants = tenants.filter(t => t.isApproved === false);
  const pendingCustomers = customers.filter(c => c.isApproved === false);
  const totalPending = pendingTenants.length + pendingCustomers.length;

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
      storeContext: 'Platform Business',
      isApproved: t.isApproved !== false,
      lastLoginTime: t.lastLoginTime || ''
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
        role: 'customer',
        isApproved: c.isApproved !== false,
        lastLoginTime: c.lastLoginTime || ''
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
            System Administration Panel
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
            {isRefreshing ? 'Refreshing...' : 'Refresh Register'}
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
                  New Customer Registrations Intercepted
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
              ✓ Mark All Seen
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
                          <span className="bg-amber-950/70 text-amber-300 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-900/35 uppercase tracking-widest font-mono animate-pulse">New</span>
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
                        {isBlocked ? 'ACCESS: BLOCK' : 'ACCESS: ALLOWED'}
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
      <div className="flex border-b border-indigo-950/80 gap-1.5 font-mono scrollbar-none overflow-x-auto py-1 px-1 -mx-1 sm:mx-0 shrink-0 touch-pan-x select-none">
        <button
          type="button"
          onClick={() => {
            setActiveTab('unifiedUsers');
            loadCustomersData();
            loadTenants();
          }}
          className={`py-2.5 px-3.5 sm:px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[42px] rounded-t-lg ${
            activeTab === 'unifiedUsers'
              ? 'border-indigo-500 text-white font-extrabold bg-indigo-950/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Users & Registrations (صارفین کی فہرست)</span>
          {totalPending > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] animate-bounce">
              ⏳ {totalPending} PENDING
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('businesses')}
          className={`py-2.5 px-3.5 sm:px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[42px] rounded-t-lg ${
            activeTab === 'businesses'
              ? 'border-indigo-500 text-white font-extrabold bg-indigo-950/40 font-mono'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-400" />
          <span>Businesses Directory</span>
          {pendingTenants.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[9px]">
              {pendingTenants.length} Pending
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('customers');
            loadCustomersData();
          }}
          className={`py-2.5 px-3.5 sm:px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[42px] rounded-t-lg ${
            activeTab === 'customers'
              ? 'border-indigo-500 text-white font-extrabold bg-indigo-950/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4 text-sky-400" />
          <span>Customers Directory</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('accessLogs');
            loadAccessLogsData();
          }}
          className={`py-2.5 px-3.5 sm:px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[42px] rounded-t-lg ${
            activeTab === 'accessLogs'
              ? 'border-indigo-500 text-white font-extrabold bg-indigo-950/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Access Logs</span>
        </button>

        {/* Live Admin Support Desk */}
        <button
          type="button"
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
          className={`py-2.5 px-3.5 sm:px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[42px] rounded-t-lg relative ${
            activeTab === 'chats'
              ? 'border-indigo-500 text-white font-extrabold bg-indigo-950/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <MessageCircle className="w-4 h-4 text-pink-400" />
          <span>Support Desk</span>
          {getSupportChats().filter(chat => chat.receiverEmail === 'irfanksaeed@gmail.com' && !chat.isRead).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 rounded-full font-black text-[9px] text-white animate-bounce">
              {getSupportChats().filter(chat => chat.receiverEmail === 'irfanksaeed@gmail.com' && !chat.isRead).length}
            </span>
          )}
        </button>

        {/* Dynamic ERP Reports & Metrics */}
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`py-2.5 px-3.5 sm:px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[42px] rounded-t-lg ${
            activeTab === 'reports'
              ? 'border-indigo-500 text-white font-extrabold bg-indigo-950/40'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-500" />
          <span>Platform Reports</span>
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
                  <span className="bg-indigo-950/80 text-sky-400 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded border border-indigo-900/40 tracking-widest font-mono">Active Operator Session</span>
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
                disabled={isSyncingRegister}
                onClick={async () => {
                  setIsSyncingRegister(true);
                  setSuccessMsg("Synchronizing register with live database...");
                  try {
                    await pushServerSync();
                    await pullServerSync();
                    loadTenants();
                    loadCustomersData();
                    loadAccessLogsData();
                    onRefreshStats();
                    setSuccessMsg("All credentials with system logs and user data tables synchronized.");
                  } catch (err: any) {
                    console.error("Sync error:", err);
                    setSuccessMsg("Failed to fully sync register. Using memory tables backup.");
                  } finally {
                    setIsSyncingRegister(false);
                    setTimeout(() => setSuccessMsg(''), 3000);
                  }
                }}
                className={`px-3.5 py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-200 hover:text-white font-extrabold text-[11px] uppercase tracking-wider rounded-lg border border-slate-800 hover:border-slate-700 flex items-center gap-1.5 transition cursor-pointer select-none ${isSyncingRegister ? 'opacity-70 pointer-events-none' : ''}`}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-450 ${isSyncingRegister ? 'animate-spin' : ''}`} />
                {isSyncingRegister ? 'Synchronizing...' : 'Sync System Register'}
              </button>
            </div>
          </div>

          {/* SUPER ADMIN ACCESS GATE & APPROVAL POLICY MANAGEMENT CARD */}
          {(() => {
            const pendingTenants = tenants.filter(t => t.isApproved === false);
            const pendingCustomers = customers.filter(c => c.isApproved === false);
            const totalPending = pendingTenants.length + pendingCustomers.length;

            return (
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border border-indigo-500/40 p-5 rounded-2xl shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-3 border-b border-indigo-950/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-white font-black text-sm tracking-tight flex items-center gap-2">
                        Super Admin Access Gate & Permission Policies (سپر ایڈمن منظوری اور کنٹرول)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300">
                      نئے مستقل لنکس کے لیے منظوری کی پالیسی اور ہر اکاؤنٹ کو بلاک یا ان بلاک کرنے کے مکمل اختیارات۔
                    </p>
                  </div>

                  {/* Toggle switch for require approval */}
                  <div className="flex items-center gap-3 bg-black/50 px-4 py-2 rounded-xl border border-indigo-500/30">
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-white block">
                        Require Approval for Permanent Link
                      </span>
                      <span className="text-[9.5px] text-indigo-300 font-medium">
                        {requireApproval ? '🔒 Strict Mode (ایڈمن منظوری ضروری ہے)' : '⚡ Auto-Approve (فوری خودکار منظوری)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleRequireApproval(!requireApproval)}
                      className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        requireApproval ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          requireApproval ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Pending Approvals Notice Banner and Itemized List */}
                {totalPending > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 border border-amber-500/50 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-bold border border-amber-500/40 shrink-0">
                          ⏳
                        </div>
                        <div>
                          <div className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wide font-mono flex items-center gap-2 flex-wrap">
                            <span>{totalPending} New Registration Request(s) Awaiting Approval</span>
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black animate-pulse">
                              ACTION REQUIRED
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 mt-1">
                            Review new registrations below. You have full authority to <strong>Approve</strong> or <strong>Reject / Deny</strong> each account.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApproveAllPending}
                        className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg cursor-pointer shrink-0 flex items-center justify-center gap-2"
                      >
                        <span>⚡</span> Approve All ({totalPending}) Requests
                      </button>
                    </div>

                    {/* Pending Businesses List */}
                    {pendingTenants.length > 0 && (
                      <div className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-wider text-amber-400 font-mono px-1 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-400" />
                          <span>Pending Business Registrations ({pendingTenants.length})</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {pendingTenants.map(tenant => {
                            const waApprovalNotice = encodeURIComponent(
                              `Salam ${tenant.companyName}!\n\nYour ERP Workspace on Biz Suite has been APPROVED by Super Admin Irfan Saeed.\n\nYou can now log in to your account here:\n${window.location.origin}/?autologin=${encodeURIComponent(tenant.email)}\n\nWelcome aboard!`
                            );
                            const waRejectNotice = encodeURIComponent(
                              `Salam ${tenant.companyName}!\n\nThis is regarding your registration request on Biz Suite ERP. Please contact Super Admin Irfan Saeed for verification.`
                            );
                            const cleanPhone = (tenant.phone || '').replace(/[^\d+]/g, '');

                            return (
                              <div
                                key={tenant.id}
                                className="bg-slate-950/95 border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-3.5 relative overflow-hidden shadow-xl hover:border-amber-500/70 transition"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <div className="font-black text-white text-base flex items-center gap-2 flex-wrap">
                                      <span className="truncate">{tenant.companyName}</span>
                                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                                        Pending Approval
                                      </span>
                                    </div>

                                    {/* Registered Email with Copy button & mailto */}
                                    <div className="flex items-center gap-2 pt-0.5">
                                      <span className="text-xs text-indigo-300 font-mono font-bold select-all bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/40 truncate">
                                        ✉️ {tenant.email}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(tenant.email);
                                          setSuccessMsg(`Copied email: ${tenant.email}`);
                                          setTimeout(() => setSuccessMsg(''), 2000);
                                        }}
                                        className="p-1 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded text-[10px] transition cursor-pointer"
                                        title="Copy Email Address"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                      <a
                                        href={`mailto:${tenant.email}?subject=Biz Suite ERP Account Registration Approval&body=Salam ${tenant.companyName},`}
                                        className="p-1 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded text-[10px] transition"
                                        title="Send Email"
                                      >
                                        <Mail className="w-3 h-3" />
                                      </a>
                                    </div>

                                    {/* Phone / Mobile */}
                                    {tenant.phone && (
                                      <div className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 pt-0.5">
                                        <span>📱 Mobile:</span>
                                        <strong className="select-all font-bold">{tenant.phone}</strong>
                                      </div>
                                    )}
                                  </div>

                                  <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 shrink-0">
                                    ID: {tenant.id}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-white/5 font-mono">
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Registered Date</span>
                                    <span className="text-slate-200 font-medium">{tenant.createdAt || 'Recent'}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 block text-[9px] uppercase font-bold">Currency / Language</span>
                                    <span className="text-slate-200 font-medium">{tenant.currency || 'USD'} / {(tenant.language || 'en').toUpperCase()}</span>
                                  </div>
                                </div>

                                {/* Decision Options in English */}
                                <div className="space-y-2 pt-1">
                                  <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                                    Admin Decision: Approve or Reject
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Approve Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleApproveTenantQuick(tenant)}
                                      className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5 min-w-[120px]"
                                      title="Approve this registration and grant full ERP access"
                                    >
                                      <CheckCircle2 className="w-4 h-4 text-white" />
                                      <span>✓ Approve Access</span>
                                    </button>

                                    {/* Reject / Deny Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleRejectTenantQuick(tenant)}
                                      className="py-2.5 px-3.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white border border-rose-800/60 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                                      title="Reject & delete registration request"
                                    >
                                      <XCircle className="w-4 h-4 text-rose-300" />
                                      <span>✕ Reject / Deny</span>
                                    </button>

                                    {/* WhatsApp Direct Contact Button */}
                                    {cleanPhone ? (
                                      <a
                                        href={`https://wa.me/${cleanPhone}?text=${waApprovalNotice}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="py-2.5 px-3 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 hover:text-white border border-emerald-900/60 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        title="Chat on WhatsApp"
                                      >
                                        <MessageCircle className="w-4 h-4 text-emerald-300" />
                                        <span>WhatsApp</span>
                                      </a>
                                    ) : (
                                      <a
                                        href={`https://wa.me/?text=${encodeURIComponent(`Salam ${tenant.companyName}! This is Super Admin Irfan Saeed regarding your Biz Suite ERP registration (${tenant.email}).`)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                                        title="Share on WhatsApp"
                                      >
                                        <MessageCircle className="w-4 h-4 text-slate-300" />
                                        <span>WhatsApp</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Pending Customers List */}
                    {pendingCustomers.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="text-xs font-black uppercase tracking-wider text-sky-400 font-mono px-1 flex items-center gap-2">
                          <Users className="w-4 h-4 text-sky-400" />
                          <span>Pending Customer Portal Users ({pendingCustomers.length})</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {pendingCustomers.map(customer => {
                            const matchedTenant = tenants.find(t => t.id === customer.tenantId);
                            const storeBrand = matchedTenant ? matchedTenant.companyName : 'Merchant';

                            return (
                              <div
                                key={customer.id}
                                className="bg-slate-950/95 border border-sky-500/40 rounded-2xl p-4 sm:p-5 space-y-3.5 relative overflow-hidden shadow-xl"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 space-y-1">
                                    <div className="font-black text-white text-base flex items-center gap-2 flex-wrap">
                                      <span className="truncate">{customer.name}</span>
                                      <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold">
                                        Customer User
                                      </span>
                                    </div>
                                    <div className="text-xs text-indigo-300 font-mono font-bold select-all bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">
                                      ✉️ {customer.email}
                                    </div>
                                    {customer.phone && (
                                      <div className="text-xs text-emerald-400 font-mono">
                                        📱 {customer.phone}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 shrink-0">
                                    Store: {storeBrand}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCustomerApprovalGlobal(customer.id)}
                                    className="flex-1 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>✓ Approve Customer Access</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRejectCustomerQuick(customer.id)}
                                    className="py-2.5 px-3.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 hover:text-white border border-rose-800/60 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <XCircle className="w-4 h-4 text-rose-300" />
                                    <span>✕ Reject</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      All accounts are approved. No pending registration requests in queue.
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Strict Gate Policy is ACTIVE: All new business registrations will appear here for your approval.
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 24-HOUR VISITOR PERMANENT UPGRADE REQUESTS SECTION */}
          {(() => {
            const guestUpgradeRequests = tenants.filter(t => t.guestUpgradeRequested);
            
            return (
              <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/40 p-5 rounded-2xl shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-amber-950/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🌟</span>
                      <h3 className="text-white font-black text-sm tracking-tight flex items-center gap-2">
                        24-Hour Visitor Upgrade Requests (24 گھنٹے والے وزیٹرز کی مستقل رسائی کی درخواستیں)
                      </h3>
                      {guestUpgradeRequests.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full animate-bounce">
                          {guestUpgradeRequests.length} NEW
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">
                      24 گھنٹے کے ٹرائل وزیٹرز جنہوں نے تمام ڈیٹا سمیت مستقل اکاؤنٹ کی اجازت طلب کی ہے۔
                    </p>
                  </div>
                </div>

                {guestUpgradeRequests.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {guestUpgradeRequests.map((tenant) => (
                        <div 
                          key={tenant.id}
                          className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-extrabold text-white text-sm flex items-center gap-2">
                                {tenant.companyName}
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-2 py-0.5 rounded-full font-bold">
                                  24h Trial
                                </span>
                              </div>
                              <div className="text-xs text-slate-300 font-mono mt-0.5">{tenant.email}</div>
                              {tenant.phone && (
                                <div className="text-[11px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                                  <span>📱 WhatsApp/Phone:</span>
                                  <strong>{tenant.phone}</strong>
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded">
                              {tenant.guestUpgradeRequestedAt ? new Date(tenant.guestUpgradeRequestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                            </span>
                          </div>

                          {tenant.guestUpgradeNotes && (
                            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-white/5 text-xs text-slate-300 italic">
                              "{tenant.guestUpgradeNotes}"
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleGrantGuestPermanent(tenant)}
                              className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-lg transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <span>👑</span> Grant Permanent Access (مستقل کریں)
                            </button>
                            <button
                              type="button"
                              onClick={() => onImpersonate(tenant)}
                              className="px-3 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-900/50 rounded-lg text-xs font-bold transition cursor-pointer"
                              title="Check user invoices and data"
                            >
                              👀 View Data
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDismissGuestUpgrade(tenant)}
                              className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg text-xs transition cursor-pointer"
                              title="Dismiss request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span>⏱️</span>
                      فی الوقت کوئی نئی وزٹر درخواست موصول نہیں ہوئی۔ وزیٹر کے ٹاپ بینر پر ریکویسٹ کا آپشن موجود ہے۔
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      Guest Pass Expiration: 24 Hours
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* SHARE INVITE & GUEST VISIT LINKS SECTION */}
          <div className="space-y-6 animate-fadeIn">
            {/* 1. Super Admin Custom Direct Invite Generator (Full Control with Email & Duration) */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 p-6 rounded-3xl shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-indigo-500/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      <Zap className="w-5 h-5 text-indigo-400" />
                    </span>
                    <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                      Custom Direct Invite Generator & Duration Controller
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 font-urdu leading-relaxed">
                    نئے ٹیننٹ کی ای میل درج کریں اور رسائی کی مدت (24 گھنٹے، 7 دن، 30 دن، 1 سال یا مستقل) مقرر کر کے مخصوص ڈائریکٹ لنک بنائیں
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] font-bold text-amber-300 font-mono flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    Super Admin Control
                  </span>
                </div>
              </div>

              {/* Generator Form */}
              <form onSubmit={handleGenerateCustomInvite} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5 md:col-span-1 lg:col-span-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Target Tenant Email * (ٹیننٹ کی ای میل)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="tenant@business.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-black/50 border border-indigo-900/60 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    Company Name (کمپنی کا نام)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Al-Madina Trading"
                    value={inviteCompanyName}
                    onChange={(e) => setInviteCompanyName(e.target.value)}
                    className="w-full bg-black/50 border border-indigo-900/60 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    Mobile / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="+923001234567"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    className="w-full bg-black/50 border border-indigo-900/60 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    Access Duration * (رسائی کی مدت)
                  </label>
                  <select
                    value={inviteDurationType}
                    onChange={(e) => setInviteDurationType(e.target.value)}
                    className="w-full bg-black/70 border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2.5 text-xs text-amber-200 outline-none font-bold"
                  >
                    <option value="permanent" className="bg-slate-900 text-amber-300">👑 Lifetime / Permanent (ہمیشہ کے لیے)</option>
                    <option value="24h" className="bg-slate-900 text-white">⏱️ 24 Hours (24 گھنٹے)</option>
                    <option value="3d" className="bg-slate-900 text-white">📅 3 Days (3 دن)</option>
                    <option value="7d" className="bg-slate-900 text-white">📅 7 Days (1 ہفتہ)</option>
                    <option value="15d" className="bg-slate-900 text-white">📅 15 Days (15 دن)</option>
                    <option value="30d" className="bg-slate-900 text-white">📅 30 Days (1 مہینہ)</option>
                    <option value="90d" className="bg-slate-900 text-white">📅 90 Days (3 مہینے)</option>
                    <option value="180d" className="bg-slate-900 text-white">📅 180 Days (6 مہینے)</option>
                    <option value="365d" className="bg-slate-900 text-white">📅 365 Days (1 سال)</option>
                    <option value="custom" className="bg-slate-900 text-indigo-300">🗓️ Specific Expiry Date (تاریخ مقرر کریں)</option>
                  </select>
                </div>

                {inviteDurationType === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
                      Specific Expiry Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={inviteCustomDate}
                      onChange={(e) => setInviteCustomDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-black/50 border border-indigo-900/60 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Daily Operating Hours (Optional)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={inviteHoursStart}
                      onChange={(e) => setInviteHoursStart(e.target.value)}
                      placeholder="09:00"
                      className="w-1/2 bg-black/50 border border-slate-800 focus:border-indigo-400 rounded-xl px-2 py-2 text-[11px] text-white outline-none font-mono"
                    />
                    <span className="text-slate-500 text-xs">-</span>
                    <input
                      type="time"
                      value={inviteHoursEnd}
                      onChange={(e) => setInviteHoursEnd(e.target.value)}
                      placeholder="18:00"
                      className="w-1/2 bg-black/50 border border-slate-800 focus:border-indigo-400 rounded-xl px-2 py-2 text-[11px] text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={inviteCreating}
                    className="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:opacity-95 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-4 h-4" />
                    Generate Direct Invite Link
                  </button>
                </div>
              </form>

              {/* Just Created Direct Invite Featured Card */}
              {lastCreatedInvite && (
                <div className="bg-indigo-950/70 border border-indigo-500/50 p-4 sm:p-5 rounded-2xl space-y-3.5 animate-fadeIn shadow-xl">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                    <div className="flex items-start sm:items-center gap-2.5">
                      <span className="text-xl p-2 bg-emerald-500/20 rounded-xl border border-emerald-500/30 shrink-0">🎉</span>
                      <div>
                        <div className="text-xs font-black text-white flex items-center gap-2 flex-wrap">
                          <span>Direct Custom Link Generated:</span>
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md text-[10.5px] font-mono font-bold">
                            {lastCreatedInvite.durationLabel}
                          </span>
                        </div>
                        <div className="text-xs text-indigo-300 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>✉️ {lastCreatedInvite.email}</span>
                          {lastCreatedInvite.phone && <span className="text-emerald-400 font-bold">📱 {lastCreatedInvite.phone}</span>}
                          {lastCreatedInvite.companyName && <span className="text-slate-300">🏢 {lastCreatedInvite.companyName}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Direct Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
                      <button
                        type="button"
                        onClick={() => handleCopyCustomInviteLink(lastCreatedInvite.id)}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700 shadow-sm"
                      >
                        {copiedInviteId === lastCreatedInvite.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`https://wa.me/${lastCreatedInvite.phone ? lastCreatedInvite.phone.replace(/[^\d+]/g, '') : ''}?text=${encodeURIComponent(`Salam! Here is your official direct access invitation to the ERP Workspace.\n\n🔗 Access Link: ${getBaseAppUrl()}/?inviteToken=${lastCreatedInvite.id}\n⏱️ Validity: ${lastCreatedInvite.durationLabel}\n🏢 Company: ${lastCreatedInvite.companyName || 'Business Portal'}\n\nPlease click the link to activate your pre-approved account.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 sm:flex-initial px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </a>

                      <a
                        href={`mailto:${lastCreatedInvite.email}?subject=${encodeURIComponent(`Official Direct Access Invitation - ${lastCreatedInvite.companyName || 'ERP Business Workspace'}`)}&body=${encodeURIComponent(`Salam / Hello,\n\nYou have been granted official pre-approved direct access to the ERP Business Workspace.\n\nAccess Link: ${getBaseAppUrl()}/?inviteToken=${lastCreatedInvite.id}\nDuration / Validity: ${lastCreatedInvite.durationLabel}\nExpiry: ${lastCreatedInvite.expiresAt || 'Lifetime Permanent'}\n${lastCreatedInvite.allowedHoursStart ? `Daily Hours: ${lastCreatedInvite.allowedHoursStart} - ${lastCreatedInvite.allowedHoursEnd}\n` : ''}\nPlease click the link above to log in and set up your workspace.\n\nRegards,\nSuper Admin (Irfan Saeed)`)}`}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-950/40"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Email</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDeleteCustomInvite(lastCreatedInvite.id)}
                        className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                        title="Delete this newly generated link"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Delete Link</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/70 border border-indigo-900/60 p-3 rounded-xl flex items-center justify-between font-mono text-xs text-indigo-200 select-all overflow-x-auto gap-3">
                    <span className="select-all font-bold truncate">
                      {`${getBaseAppUrl()}/?inviteToken=${lastCreatedInvite.id}`}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-extrabold uppercase shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ✓ Instant Pre-Approved Link
                    </span>
                  </div>
                </div>
              )}

              {/* Active & Historical Custom Invites Table */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-indigo-400" />
                    All Generated Custom Direct Links ({customInvites.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    {customInvites.some(inv => inv.status === 'revoked' || (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now())) && (
                      <button
                        type="button"
                        onClick={handleClearInactiveInvites}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950 hover:text-rose-300 border border-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                        title="Clean up all expired or revoked invite links"
                      >
                        <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-400" />
                        <span>Clear Inactive Links</span>
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Direct 1-Click WhatsApp, Email, Copy & Delete
                    </span>
                  </div>
                </div>

                {customInvites.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-black/40">
                    <table className="w-full text-left text-xs min-w-[720px]">
                      <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800 font-mono">
                        <tr>
                          <th className="py-3 px-3">Target Tenant Email</th>
                          <th className="py-3 px-3">Company & Mobile</th>
                          <th className="py-3 px-3">Allowed Duration</th>
                          <th className="py-3 px-3">Expiry Date</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Actions & Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {customInvites.map(inv => {
                          const isExpired = inv.expiresAt ? new Date(inv.expiresAt).getTime() < Date.now() : false;
                          const displayStatus = inv.status === 'revoked' ? 'Revoked' : (inv.status === 'used' ? 'Claimed / Used' : (isExpired ? 'Expired' : 'Active'));
                          
                          const inviteUrl = `${getBaseAppUrl()}/?inviteToken=${inv.id}`;
                          const waText = encodeURIComponent(`Salam! Here is your official direct access link to ERP Workspace:\n\n🔗 ${inviteUrl}\n⏱️ Validity: ${inv.durationLabel}\n🏢 Company: ${inv.companyName || 'Business'}`);
                          const mailSubject = encodeURIComponent(`Official ERP Workspace Invitation - ${inv.companyName || 'Direct Access'}`);
                          const mailBody = encodeURIComponent(`Salam / Hello,\n\nYou have been invited to the ERP Workspace.\n\nDirect Access Link: ${inviteUrl}\nValidity: ${inv.durationLabel}\nExpiry: ${inv.expiresAt || 'Lifetime Permanent'}\n\nPlease click the link to activate your account.\n\nRegards,\nSuper Admin`);

                          return (
                            <tr key={inv.id} className="hover:bg-slate-900/50 transition">
                              <td className="py-3 px-3">
                                <div className="font-bold text-white text-xs">{inv.email}</div>
                                <div className="text-[10px] text-slate-500">Created: {inv.createdAt}</div>
                              </td>
                              <td className="py-3 px-3 font-sans">
                                <div className="text-slate-200 text-xs font-bold">{inv.companyName || '—'}</div>
                                {inv.phone ? (
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[11px] text-emerald-400 font-mono font-bold">{inv.phone}</span>
                                    <a
                                      href={`https://wa.me/${inv.phone.replace(/[^\d+]/g, '')}?text=${waText}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Chat on WhatsApp"
                                      className="p-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/40 text-emerald-300 rounded transition"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                    </a>
                                    <a
                                      href={`tel:${inv.phone}`}
                                      title="Call Phone"
                                      className="p-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/40 text-indigo-300 rounded transition"
                                    >
                                      <Phone className="w-3 h-3" />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">No mobile</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  inv.isPermanent 
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                }`}>
                                  {inv.durationLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-300 text-xs">
                                {inv.expiresAt ? inv.expiresAt : <span className="text-amber-400 font-bold">👑 Lifetime</span>}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  displayStatus === 'Active' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : displayStatus === 'Claimed / Used'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}>
                                  {displayStatus}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {/* Copy Link Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCustomInviteLink(inv.id)}
                                    title="Copy Direct Link"
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 border border-slate-700"
                                  >
                                    {copiedInviteId === inv.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                                    )}
                                    <span className="text-[10px] font-sans">Copy</span>
                                  </button>

                                  {/* WhatsApp Direct Send Button */}
                                  <a
                                    href={`https://wa.me/${inv.phone ? inv.phone.replace(/[^\d+]/g, '') : ''}?text=${waText}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Send Direct via WhatsApp"
                                    className="p-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 rounded-lg transition flex items-center gap-1"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] font-sans hidden sm:inline">WhatsApp</span>
                                  </a>

                                  {/* Email Direct Send Button */}
                                  <a
                                    href={`mailto:${inv.email}?subject=${mailSubject}&body=${mailBody}`}
                                    title="Send Direct via Email"
                                    className="p-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 rounded-lg transition flex items-center gap-1"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="text-[10px] font-sans hidden sm:inline">Email</span>
                                  </a>

                                  {inv.status === 'active' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeCustomInvite(inv.id)}
                                      title="Revoke Invite Link"
                                      className="p-1.5 bg-amber-950 hover:bg-amber-900 border border-amber-800/60 text-amber-300 rounded-lg text-xs transition cursor-pointer"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomInvite(inv.id)}
                                    title="Delete Invite Link Permanently (ڈیلیٹ کریں)"
                                    className="p-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    <span className="text-[10px] font-sans font-bold text-rose-300 hidden md:inline">Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-center text-xs text-slate-400">
                    No custom direct invite links generated yet. Use the form above to generate links with tailored durations.
                  </div>
                )}
              </div>
            </div>

            {/* 2. Generic Open Links (Permanent Registration & 24h Guest Evaluation) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Permanent Open Signup Link */}
              <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border border-indigo-500/30 p-5 rounded-2xl shadow-xl space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Share2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-extrabold text-[11px] tracking-wider uppercase bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20 font-mono">
                      🌟 Open Registration Link
                    </span>
                  </div>
                  <h4 className="text-white font-black text-sm pt-0.5">
                    Permanent Business Registration Link
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-urdu">
                    کھلا رجسٹریشن لنک، جس سے نیا بزنس اونر فارم بھر کر مستقل اکاؤنٹ رجسٹر کر سکتا ہے
                  </p>
                </div>
                
                {/* Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopySignupLink}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-lg ${
                      copiedSignup 
                        ? 'bg-emerald-600 text-white border border-emerald-500' 
                        : 'accent-gradient text-white hover:opacity-95'
                    }`}
                  >
                    {copiedSignup ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Salam! Register your business workspace here:\n${getBaseAppUrl()}/?mode=register`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg text-center"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`mailto:?subject=${encodeURIComponent('ERP Business Registration Link')}&body=${encodeURIComponent(`Salam / Hello,\n\nPlease register your business at:\n${getBaseAppUrl()}/?mode=register\n\nRegards,\nSuper Admin`)}`}
                    className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg text-center"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </a>
                </div>

                <div className="bg-black/60 border border-slate-800 p-2 rounded-xl flex items-center justify-between font-mono text-[11px] text-slate-400 select-all">
                  <span className="truncate mr-2 text-indigo-300 font-bold select-all">
                    {`${getBaseAppUrl()}/?mode=register`}
                  </span>
                  <span className="text-[9px] text-indigo-400 font-extrabold uppercase shrink-0">Open Link</span>
                </div>
              </div>

              {/* 24-Hour Guest Trial Link */}
              <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border border-amber-500/30 p-5 rounded-2xl shadow-xl space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-400">
                    <span className="text-base">⏱️</span>
                    <span className="font-extrabold text-[11px] tracking-wider uppercase bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono text-amber-300">
                      ⏱️ 24-Hour Guest Pass Link
                    </span>
                  </div>
                  <h4 className="text-white font-black text-sm pt-0.5">
                    24-Hour Visitor Evaluation Trial
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-urdu">
                    24 گھنٹے کا وزٹ ٹرائل، جس سے بغیر رجسٹریشن کے 24 گھنٹے تک سسٹم لائیو ٹیسٹ کیا جا سکتا ہے
                  </p>
                </div>
                
                {/* Action Buttons Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyVisitLink}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer shadow-lg ${
                      copiedVisit 
                        ? 'bg-emerald-600 text-white border border-emerald-500' 
                        : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white'
                    }`}
                  >
                    {copiedVisit ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy 24h Link</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Salam! Click here for a free 24-hour instant evaluation session of our ERP Business Workspace:\n${getBaseAppUrl()}/?mode=visit\n\nNo registration required - valid for 24 hours.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg text-center"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`mailto:?subject=${encodeURIComponent('24-Hour Guest Trial - ERP Business Workspace')}&body=${encodeURIComponent(`Salam / Hello,\n\nYou can evaluate the ERP Business Workspace with a 24-hour trial pass:\n${getBaseAppUrl()}/?mode=visit\n\nValid for 24 hours from first access.\n\nRegards,\nSuper Admin`)}`}
                    className="py-2.5 px-3 bg-amber-700 hover:bg-amber-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg text-center"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </a>
                </div>

                <div className="bg-black/60 border border-slate-800 p-2 rounded-xl flex items-center justify-between font-mono text-[11px] text-slate-400 select-all">
                  <span className="truncate mr-2 text-amber-300 font-bold select-all">
                    {`${getBaseAppUrl()}/?mode=visit`}
                  </span>
                  <span className="text-[9px] text-amber-400 font-extrabold uppercase shrink-0">Auto-Expire 24h</span>
                </div>
              </div>
            </div>
          </div>

          {/* REAL-TIME ONLINE ACTIVE USER SESSIONS PANEL */}
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center flex-wrap gap-2 pb-3 border-b border-indigo-950/35">
              <div>
                <h3 className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 border border-emerald-400" />
                  Live Logged-In Users & Terminals ({activeSessions.length} Online)
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  The following user tenants/admins are currently logged in right now and actively accessing their business workspace.
                </p>
              </div>
              <button
                type="button"
                disabled={isRefreshingSessions}
                onClick={async () => {
                  setIsRefreshingSessions(true);
                  // Sync with actual cloud database entries
                  await pushServerSync();
                  await pullServerSync();
                  setActiveSessions(getActiveSessions());
                  loadTenants(); // update online status blocks
                  setIsRefreshingSessions(false);
                  setSuccessMsg("Logged-in sessions successfully synchronized & refreshed!");
                  setTimeout(() => setSuccessMsg(''), 2500);
                }}
                className={`text-[9px] font-mono text-indigo-400 uppercase font-black bg-indigo-950/40 hover:bg-indigo-950/80 px-2.5 py-1 rounded border border-indigo-500/20 transition cursor-pointer flex items-center gap-1.5 select-none ${isRefreshingSessions ? 'opacity-70 pointer-events-none' : ''}`}
              >
                <RefreshCw className={`w-3 ${isRefreshingSessions ? 'animate-spin' : ''}`} />
                {isRefreshingSessions ? 'Synchronizing...' : 'Refresh Sessions List'}
              </button>
            </div>

            {activeSessions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs italic bg-slate-950/30 rounded-xl border border-dashed border-slate-850/60">
                👤 No users logged in currently. (Sessions prune after 5 minutes of inactivity)
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeSessions.map((session) => {
                  const lastActiveDate = new Date(session.lastActiveTime);
                  const secondsAgo = Math.max(0, Math.round((new Date().getTime() - lastActiveDate.getTime()) / 1000));
                  let timeDisplay = 'Just now';
                  if (secondsAgo >= 60) {
                    const mins = Math.floor(secondsAgo / 60);
                    timeDisplay = `${mins}m ago`;
                  } else if (secondsAgo > 0) {
                    timeDisplay = `${secondsAgo}s ago`;
                  }

                  const matchingTenant = tenants.find(t => t.id === session.userId);
                  const matchingCustomer = customers.find(c => c.id === session.userId);

                  const isCustomer = !!matchingCustomer || session.activeModule === 'Customer Portal';

                  const isBlocked = isCustomer
                    ? (matchingCustomer?.isBlocked === true)
                    : (matchingTenant?.isActive === false);

                  return (
                    <div
                      key={`${session.userId}-${session.email}`}
                      className={`p-4 rounded-xl border transition-all duration-300 bg-slate-950/50 hover:bg-slate-950 relative overflow-hidden ${
                        isBlocked
                          ? 'border-rose-900/50 shadow-lg shadow-rose-950/5'
                          : isCustomer
                          ? 'border-sky-900/40 hover:border-sky-700/50 shadow-md shadow-sky-950/5'
                          : 'border-slate-850 hover:border-slate-800 shadow-md shadow-black/10'
                      }`}
                    >
                      {/* Live green dot pin */}
                      <span className="absolute top-3 right-3 flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBlocked ? 'bg-rose-400' : isCustomer ? 'bg-sky-400' : 'bg-emerald-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isBlocked ? 'bg-rose-500' : isCustomer ? 'bg-sky-550' : 'bg-emerald-500'}`}></span>
                      </span>

                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-white text-xs truncate max-w-[155px]">
                              {session.companyName || 'Unknown User'}
                            </span>
                            {isCustomer ? (
                              <span className="bg-sky-950 text-sky-400 border border-sky-900/45 text-[8px] font-black px-1.5 py-0.2 rounded uppercase font-mono">👤 CUSTOMER</span>
                            ) : (
                              <span className="bg-indigo-950 text-indigo-400 border border-indigo-900/45 text-[8px] font-black px-1.5 py-0.2 rounded uppercase font-mono">💼 MERCHANT</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block font-mono select-all truncate mt-0.5">
                            {session.email}
                          </span>
                        </div>

                        <div className="space-y-1 text-[10px] font-mono text-slate-500">
                          <p className="flex justify-between">
                            <span>💻 System Access:</span>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] border uppercase ${
                              isCustomer
                                ? 'text-sky-400 bg-sky-950/40 border-sky-500/10'
                                : 'text-indigo-400 bg-indigo-950/40 border-indigo-500/10'
                            }`}>
                              {session.activeModule || 'Dashboard'}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span>🕒 Active Pulse:</span>
                            <span className="text-slate-300 font-bold">{timeDisplay}</span>
                          </p>
                          <p className="flex justify-between">
                            <span>🌐 Console Device:</span>
                            <span className="text-slate-400 text-right truncate max-w-[120px]" title={session.userAgent}>
                              {session.deviceInfo || 'Browser'}
                            </span>
                          </p>
                          <p className="flex justify-between">
                            <span>🔌 IP Session:</span>
                            <span className="text-slate-400 font-bold">{session.ipAddress || '192.168.1.84'}</span>
                          </p>
                          <p className="flex justify-between">
                            <span>🔐 Access Security:</span>
                            {isBlocked ? (
                              <span className="text-rose-400 font-extrabold">BLOCKED</span>
                            ) : (
                              <span className="text-emerald-400 font-bold">ALLOWED</span>
                            )}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-900/60 flex justify-between items-center gap-2">
                          {!isCustomer ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (matchingTenant) {
                                  onImpersonate(matchingTenant);
                                } else {
                                  alert('Tenant matching key fallback triggered.');
                                }
                              }}
                              className="flex-1 py-1 text-[9px] font-bold uppercase tracking-wider bg-indigo-950/50 hover:bg-indigo-600 border border-indigo-900/40 hover:border-indigo-500 text-indigo-300 hover:text-white rounded-lg transition-all text-center cursor-pointer"
                            >
                              Impersonate
                            </button>
                          ) : (
                            <span className="flex-1 text-[9px] font-mono text-slate-500 italic p-1 border border-slate-900 bg-slate-950/30 rounded text-center">
                              Guest Session Secure
                            </span>
                          )}

                          {!session.userId.includes('demo') && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isCustomer) {
                                  handleToggleCustomerBlockGlobal(session.userId);
                                } else {
                                  handleToggleTenantBlockGlobal(session.userId);
                                }
                              }}
                              className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-lg border transition duration-200 cursor-pointer text-center ${
                                isBlocked
                                  ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-900'
                                  : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-900'
                              }`}
                            >
                              {isBlocked ? 'Allow' : 'Block'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Logins & Live Activity Footprints Panel */}
          <div className="bg-slate-950/60 border border-slate-900 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center flex-wrap gap-2 pb-3 border-b border-indigo-950/35">
              <div>
                <h3 className="text-white text-xs font-black uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-450 animate-ping shrink-0" />
                  Live Footprints & Login History
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[640px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                {accessLogs.map((log) => {
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
                               <span className="text-rose-400 font-extrabold text-[9px]">🚫 ACCESS LOCKED</span>
                             ) : (
                               <span className="text-emerald-400 font-extrabold text-[9px] animate-pulse">● ACTIVE / ALLOWED</span>
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
                            ? '✓ Allow' 
                            : '🚫 Lock Access'
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
                  <th className="px-5 py-3.5">Registration & Login Trace</th>
                  <th className="px-5 py-3.5">Approval & Lock Status</th>
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

                    const isOnline = item.type === 'merchant' && activeSessions.some(sess => sess.userId === item.rawId);

                    return (
                      <tr key={`${item.type}-${item.rawId}`} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 select-none border ${
                              isOnline
                                ? 'bg-emerald-950/55 text-emerald-405 border-emerald-500/25 animate-pulse font-mono'
                                : item.type === 'merchant'
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
                                  <span className="bg-violet-950/70 border border-violet-900/50 text-violet-400 text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-widest animate-pulse font-mono">YOU</span>
                                )}
                                {isOnline && (
                                  <span className="bg-emerald-950 text-emerald-450 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-emerald-500/35 tracking-wider flex items-center gap-1 shrink-0 animate-pulse font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    ONLINE NOW
                                  </span>
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
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-300">
                          {item.phone ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-emerald-400 select-all">{item.phone}</span>
                              <a
                                href={`https://wa.me/${item.phone.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(`Salam ${item.name}! Super Admin message.`)}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Chat on WhatsApp"
                                className="p-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 rounded transition"
                              >
                                <MessageCircle className="w-3 h-3" />
                              </a>
                              <a
                                href={`tel:${item.phone}`}
                                title="Call Phone"
                                className="p-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 rounded transition"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-slate-600 italic text-[10.5px]">None</span>
                              {item.type === 'merchant' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const match = tenants.find(t => t.id === item.rawId);
                                    if (match) handleOpenEdit(match);
                                  }}
                                  className="text-[9.5px] text-amber-400 hover:text-amber-300 font-sans cursor-pointer ml-1"
                                >
                                  + Add Mobile
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-slate-200 font-medium">{item.storeContext}</span>
                        </td>
                        <td className="px-5 py-4 text-slate-500 font-mono text-[10px]">
                          <div className="space-y-1">
                            <div><span className="text-slate-600 font-bold block sm:inline">Reg:</span> <span className="text-slate-300 font-medium">{item.createdAt}</span></div>
                            {item.lastLoginTime ? (
                              <div>
                                <span className="text-slate-600 font-bold block sm:inline">Active:</span>{' '}
                                <span className="text-amber-400 font-bold">
                                  {new Date(item.lastLoginTime).toLocaleString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            ) : (
                              <div><span className="text-slate-600 font-bold block sm:inline">Active:</span> <span className="text-slate-500 italic">Never signed in</span></div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1 text-left">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold font-mono border ${
                              isBlockedStatus
                                ? 'bg-rose-950/80 text-rose-450 border-rose-900/40'
                                : 'bg-emerald-950/80 text-emerald-400 border-emerald-900/40'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isBlockedStatus ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                              {isBlockedStatus ? 'BLOCKED' : 'ACTIVE'}
                            </span>
                            
                            <div className="pt-0.5">
                              {item.isApproved ? (
                                <span className="text-[8px] text-emerald-400 font-black bg-emerald-950/45 border border-emerald-550/25 px-1.5 py-0.5 rounded font-mono block w-max uppercase">
                                  ✓ APPROVED
                                </span>
                              ) : (
                                <span className="text-[8.5px] text-amber-400 font-black bg-amber-950/45 border border-amber-550/25 px-1.5 py-0.5 rounded font-mono block w-max animate-pulse uppercase">
                                  ⏳ PENDING GATE
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-sans flex-wrap">
                            {item.type === 'merchant' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const tenant = tenants.find(t => t.id === item.rawId);
                                    if (tenant) handleOpenTimeModal(tenant);
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer shrink-0"
                                  title="Manage Access Expiry Time & Operating Hours for this tenant"
                                >
                                  <Timer className="w-3 h-3 text-amber-400" />
                                  ⏱️ Validity
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const tenant = tenants.find(t => t.id === item.rawId);
                                    if (tenant) handleQuickResetPassword(tenant);
                                  }}
                                  className="px-2.5 py-1.5 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer shrink-0"
                                  title="View / Reset Password for this user"
                                >
                                  <Key className="w-3 h-3 text-indigo-400" />
                                  🔑 Password
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const tenant = tenants.find(t => t.id === item.rawId);
                                    if (tenant) handleToggleRoleQuick(tenant);
                                  }}
                                  disabled={isSelf}
                                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition flex items-center gap-1 shrink-0 ${
                                    isSelf
                                      ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                                      : 'bg-slate-900 hover:bg-slate-850 text-slate-200 border-slate-800 hover:border-amber-500/50 cursor-pointer'
                                  }`}
                                  title="Toggle Role (Admin / Standard User)"
                                >
                                  <Crown className="w-3 h-3 text-amber-400" />
                                  {item.role === 'admin' ? 'Demote' : 'Promote'}
                                </button>
                              </>
                            )}

                            {!item.isApproved && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.type === 'merchant') {
                                    const tenant = tenants.find(t => t.id === item.rawId);
                                    if (tenant) handleApproveTenantQuick(tenant);
                                  } else {
                                    handleToggleCustomerApprovalGlobal(item.rawId);
                                  }
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1 shrink-0 animate-pulse"
                                title="Approve registration and grant platform access"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                ✓ Approve
                              </button>
                            )}

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
                              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg border transition shrink-0 ${
                                isSelf
                                  ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                  : isBlockedStatus
                                  ? 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-900 hover:text-white cursor-pointer shadow-lg shadow-emerald-950/10'
                                  : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-900 hover:text-white cursor-pointer shadow-lg shadow-rose-950/10'
                              }`}
                              title={isBlockedStatus ? "Unblock / Restore user access" : "Block / Deactivate user access immediately"}
                            >
                               {isSelf ? 'ROOT IMMUNE' : isBlockedStatus ? '✓ UNBLOCK' : '🚫 BLOCK'}
                            </button>

                            {item.type === 'merchant' && !isSelf && (
                              <button
                                type="button"
                                onClick={() => {
                                  const tenant = tenants.find(t => t.id === item.rawId);
                                  if (tenant) handleRejectTenantQuick(tenant);
                                }}
                                className="p-1.5 bg-rose-950/40 hover:bg-rose-900/80 border border-rose-900/40 text-rose-300 rounded-lg transition cursor-pointer shrink-0"
                                title="Permanently delete user account and associated tables"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
                  <th className="px-5 py-3.5">Registered / Last Login</th>
                  <th className="px-5 py-3.5">System Role</th>
                  <th className="px-5 py-3.5">Approval Gate</th>
                  <th className="px-5 py-3.5">Gate Access</th>
                  <th className="px-5 py-3.5">License Status</th>
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
                    
                    const isOnline = activeSessions.some(sess => sess.userId === tenant.id);

                    return (
                      <tr key={tenant.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isOnline
                                ? 'bg-emerald-955/55 text-emerald-400 border border-emerald-500/25 animate-pulse font-mono'
                                : isDeactivated
                                ? 'bg-slate-800 text-slate-500'
                                : 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/30 font-mono'
                            }`}>
                              {tenant.companyName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                                {tenant.companyName}
                                {tenant.id === currentUser.id && (
                                  <span className="bg-indigo-950 text-indigo-400 text-[8px] tracking-wide uppercase px-1.5 py-0.5 rounded border border-indigo-900/50 font-mono">My Account</span>
                                )}
                                {tenant.isGuestPass && (
                                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8.5px] px-1.5 py-0.2 rounded font-mono font-bold">
                                    ⏱️ 24h Pass
                                  </span>
                                )}
                                {tenant.guestUpgradeRequested && (
                                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8.5px] px-1.5 py-0.2 rounded font-mono font-bold animate-pulse">
                                    ⭐ Upgrade Requested
                                  </span>
                                )}
                                {isOnline && (
                                  <span className="bg-emerald-955 text-emerald-400 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border border-emerald-555/25 tracking-wider flex items-center gap-1 shrink-0 animate-pulse font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                    ONLINE NOW
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-400 text-[11px] font-mono mt-0.5 select-all">{tenant.email}</div>
                              
                              {/* Direct Mobile & WhatsApp Contact Bar */}
                              {tenant.phone ? (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[11px] font-mono text-emerald-400 font-bold">{tenant.phone}</span>
                                  <a
                                    href={`https://wa.me/${tenant.phone.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(`Salam ${tenant.companyName}! This is Super Admin regarding your ERP account.`)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Chat on WhatsApp"
                                    className="p-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 rounded transition"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                  </a>
                                  <a
                                    href={`tel:${tenant.phone}`}
                                    title="Call Mobile"
                                    className="p-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 rounded transition"
                                  >
                                    <Phone className="w-3 h-3" />
                                  </a>
                                  <a
                                    href={`mailto:${tenant.email}`}
                                    title="Send Email"
                                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                                  >
                                    <Mail className="w-3 h-3" />
                                  </a>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(tenant)}
                                  className="text-[10px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 mt-1 font-sans cursor-pointer"
                                  title="Add mobile phone number for this business"
                                >
                                  <Phone className="w-3 h-3 text-amber-400" />
                                  <span>+ Add Mobile / WhatsApp</span>
                                </button>
                              )}

                              <div className="text-slate-500 text-[9px] font-mono mt-0.5 flex items-center gap-1">
                                <span>Tenant ID:</span>
                                <span className="bg-slate-950 px-1 py-0.2 rounded text-[8.5px] border border-slate-850/60 select-all font-bold text-indigo-400">
                                  {tenant.id}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="text-[10px] text-slate-500 font-medium">Registered:</div>
                            <div className="text-slate-300 font-mono text-[11px]">{tenant.createdAt || 'Demo Seeding'}</div>
                            <div className="text-[10px] text-slate-500 font-medium pt-0.5">Last Login Time:</div>
                            <div className="text-amber-400/90 font-mono text-[10.5px]">
                              {tenant.lastLoginTime ? (
                                new Date(tenant.lastLoginTime).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              ) : (
                                <span className="text-slate-500 italic">No login record</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                            tenant.role === 'admin' 
                              ? 'bg-amber-955/50 text-amber-400 border border-amber-900/30' 
                              : 'bg-slate-950 text-slate-400 border border-slate-850'
                          }`}>
                            {tenant.role || 'user'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {tenant.isApproved === false ? (
                            <button
                              type="button"
                              onClick={() => handleApproveTenantQuick(tenant)}
                              className="px-2.5 py-1 bg-amber-950/80 hover:bg-emerald-950 hover:text-emerald-300 border border-amber-500/30 hover:border-emerald-500/35 text-amber-300 rounded-full font-bold uppercase text-[9.5px] cursor-pointer flex items-center gap-1 transition animate-pulse"
                              title="Pending Super Admin Approval. Click to permit database access."
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-ping" />
                              Pndg Approve
                            </button>
                          ) : (
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-555/15 px-2 py-0.5 rounded-full font-bold uppercase text-[9.5px]">
                              Approved
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <button 
                            type="button"
                            onClick={() => tenant.id !== currentUser.id && toggleActivationQuick(tenant)}
                            disabled={tenant.id === currentUser.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                              isDeactivated 
                                ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-900/40 cursor-pointer' 
                                : 'bg-emerald-955 text-emerald-300 border border-emerald-900/40 hover:bg-emerald-900 cursor-pointer'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isDeactivated ? (
                              <>
                                <UserX className="w-3 h-3 text-rose-450" />
                                Blocked
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3 text-emerald-450" />
                                Active
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                              isExpired 
                                ? 'bg-rose-955 text-rose-455' 
                                : tenant.subscriptionStatus === 'inactive'
                                ? 'bg-slate-950 text-slate-500'
                                : 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/25'
                            }`}>
                              {tenant.subscriptionStatus || 'active'}
                            </span>
                            <div className="font-mono text-[9px] text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{tenant.subscriptionExpiry || 'No License Bound'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenTimeModal(tenant)}
                              className="px-2.5 py-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 rounded-lg text-[10.5px] font-bold uppercase transition flex items-center gap-1 cursor-pointer"
                              title="Manage Access Expiry Time & Operating Hours for this tenant"
                            >
                              <Timer className="w-3.5 h-3.5 text-amber-400" />
                              ⏱️ Time / Validity
                            </button>
                            {tenant.isGuestPass && (
                              <button
                                type="button"
                                onClick={() => handleGrantGuestPermanent(tenant)}
                                className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold rounded-lg text-[10.5px] flex items-center gap-1 transition-all cursor-pointer shadow-md"
                                title="Grant full permanent access and convert guest sandbox into permanent tenant database."
                              >
                                <Crown className="w-3.5 h-3.5 text-amber-300" />
                                Make Permanent
                              </button>
                            )}
                            {tenant.id !== currentUser.id && (
                              <button
                                type="button"
                                onClick={() => onImpersonate(tenant)}
                                className="px-2 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-900/45 text-indigo-300 font-extrabold rounded-lg hover:text-white cursor-pointer text-[10.5px] flex items-center gap-1 transition-all"
                                title="Full interactive diagnostic. Log in directly as this tenant brand."
                              >
                                <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
                                Login As
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(tenant)}
                              className="p-1 px-2 bg-slate-850 hover:bg-slate-800 hover:text-white border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 cursor-pointer text-[11px] font-semibold flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3 h-3" />
                              Edit
                            </button>
                            {tenant.id !== currentUser.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTenantQuick(tenant)}
                                className="p-1 px-2 bg-rose-955 border border-rose-900/40 text-rose-300 hover:text-white hover:bg-rose-900 rounded-lg cursor-pointer text-[11px] font-semibold flex items-center gap-1 transition"
                                title="Permanently delete account"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-450 hover:text-rose-222" />
                                Delete
                              </button>
                            )}
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
              Refresh Customers
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-850 bg-slate-900/20">
            <table className="w-full border-collapse text-left text-xs text-slate-300 font-sans">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-900/60 uppercase text-[10px] tracking-wider text-slate-400 font-bold">
                  <th className="px-5 py-3.5">Customer Name & ID</th>
                  <th className="px-5 py-3.5">Contact Detail</th>
                  <th className="px-5 py-3.5">Associated Store / Business</th>
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
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] uppercase font-bold font-mono border ${
                              isBlocked
                                ? 'bg-rose-950/35 text-rose-350 border-rose-900/40'
                                : 'bg-emerald-950/35 text-emerald-350 border-emerald-900/40'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
                              {isBlocked ? 'BLOCKED (بلاک ہے)' : 'ACTIVE ALLOWED (فعال)'}
                            </span>
                            <div className="pt-0.5">
                              {c.isApproved !== false ? (
                                <span className="text-[8.5px] text-emerald-450 font-black bg-emerald-950/30 border border-emerald-900/25 px-1.5 py-0.5 rounded font-mono uppercase block w-max">
                                  ✓ APPROVED (منظور شدہ)
                                </span>
                              ) : (
                                <span className="text-[8.5px] text-amber-450 font-black bg-amber-950/30 border border-amber-900/25 px-1.5 py-0.5 rounded font-mono uppercase block w-max animate-pulse">
                                  ⏳ PENDING GATE (منظوری کا انتظار)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.isApproved === false && (
                              <button
                                type="button"
                                onClick={() => handleToggleCustomerApprovalGlobal(c.id)}
                                className="px-2.5 py-1.5 bg-amber-950 hover:bg-emerald-950 text-amber-300 hover:text-emerald-300 border border-amber-900/45 hover:border-emerald-500/40 rounded-lg text-[10px] font-black uppercase transition cursor-pointer animate-pulse shrink-0 font-sans"
                              >
                                Approve (منظور کریں)
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleToggleCustomerBlockGlobal(c.id)}
                              className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg border transition cursor-pointer font-sans shrink-0 ${
                                isBlocked
                                  ? 'bg-emerald-950 text-emerald-300 hover:text-white border-emerald-900 hover:bg-emerald-900'
                                  : 'bg-rose-950 text-rose-300 hover:text-white border-rose-900 hover:bg-rose-900'
                              }`}
                            >
                              {isBlocked ? '✓ ALLOW (بحال کریں)' : '🚫 BLOCK (بلاک کریں)'}
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
                disabled={isRefreshingLogs}
                onClick={loadAccessLogsData}
                className={`px-3.5 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-900/50 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer font-mono ${isRefreshingLogs ? 'opacity-70 pointer-events-none' : ''}`}
              >
                <Activity className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshingLogs ? 'animate-spin' : 'animate-pulse'}`} />
                {isRefreshingLogs ? 'Refreshing / ریفریش ہو رہا ہے...' : 'Refresh Logs / ریفریش کریں'}
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
                  <th className="px-5 py-3.5">Capture / Log-in Time</th>
                  <th className="px-5 py-3.5">User Identity & Tenant ID</th>
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
                    let displayTenantId = 'N/A';
                    
                    if (log.type === 'merchant') {
                      const matchedTenant = tenants.find(t => t.id === log.targetId || t.email.toLowerCase() === log.email.toLowerCase());
                      isBlocked = matchedTenant ? (matchedTenant.isActive === false) : false;
                      displayTenantId = matchedTenant ? matchedTenant.id : log.targetId;
                    } else if (log.type === 'customer') {
                      const allCusts = getCustomersGlobal();
                      const matchedCustomer = allCusts.find(c => c.id === log.targetId || c.email.toLowerCase() === log.email.toLowerCase());
                      isBlocked = matchedCustomer ? (matchedCustomer.isBlocked === true) : false;
                      displayTenantId = matchedCustomer ? matchedCustomer.tenantId : 'Unregistered';
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
                          <div className="flex flex-col gap-0.5 mt-1">
                            <span className="text-slate-500 text-[9px] uppercase tracking-wider font-semibold font-mono">User ID: #{log.targetId}</span>
                            <span className="text-indigo-450 text-[10px] uppercase tracking-wider font-extrabold font-mono text-indigo-300">Tenant ID: {displayTenantId}</span>
                          </div>
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
                        <td className="px-5 py-4 max-w-xs truncate text-[11.5px] text-slate-400 font-mono">
                          {log.action}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-black font-mono border ${
                            isBlocked
                              ? 'bg-rose-950/80 text-rose-450 border-rose-900/40'
                              : 'bg-emerald-950/80 text-emerald-400 border-emerald-900/40'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                            {isBlocked ? 'ACCESS BLOCKED' : 'ACCESS ACTIVE'}
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
                    <option value="en">🇬🇧 English (EN)</option>
                    <option value="ar">🇸🇦 العربية (AR)</option>
                    <option value="ur">🇵🇰 اردو (UR)</option>
                    <option value="bn">🇧🇩 বাংলা (BN)</option>
                    <option value="hi">🇮🇳 हिन्दी (HI)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">VAT Rate (%) (Optional)</label>
                  <input
                    type="number"
                    value={createTaxRate}
                    onChange={(e) => setCreateTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Tax Reference Registry & Contact Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">VAT registration ID (TRN) (Optional)</label>
                  <input
                    type="text"
                    placeholder="E.g., 300482910390"
                    value={createTaxNumber}
                    onChange={(e) => setCreateTaxNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-white font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    Mobile / WhatsApp Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="E.g., +92 300 1234567 or +966 50 123 4567"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="w-full bg-slate-950 border border-emerald-900/40 focus:border-emerald-500 rounded-lg py-2 px-3 text-xs text-white font-mono"
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

              {/* Password update direct hook & Mobile Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-400" /> Mobile / WhatsApp Contact Phone
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full bg-slate-950 border border-emerald-900/40 focus:border-emerald-500 rounded-lg py-1.5 px-2.5 text-xs text-white font-mono"
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
                    <option value="en">🇬🇧 English (EN)</option>
                    <option value="ar">🇸🇦 العربية (AR)</option>
                    <option value="ur">🇵🇰 اردو (UR)</option>
                    <option value="bn">🇧🇩 বাংলা (BN)</option>
                    <option value="hi">🇮🇳 हिन्दी (HI)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">TRN Tax ID Ref (Optional)</label>
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
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Standard system Tax Rate (%) (Optional)</label>
                  <input
                    type="number"
                    value={editTaxRate}
                    onChange={(e) => setEditTaxRate(e.target.value === '' ? '' : Number(e.target.value))}
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

      {/* TENANT ACCESS TIME & VALIDITY CONTROL MODAL (SUPER ADMIN DIRECT CONTROL) */}
      {showTimeModal && timeModalTenant && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5 relative">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-amber-500/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Timer className="w-5 h-5" />
                  </span>
                  <h3 className="text-base font-black text-white tracking-tight">
                    Tenant Access Time & Duration Manager
                  </h3>
                </div>
                <p className="text-xs text-slate-300 font-urdu leading-relaxed">
                  سپر ایڈمن کنٹرول: اس ٹیننٹ کی رسائی کی مدت تبدیل کریں، وقت بڑھائیں یا مستقل رسائی دیں
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTimeModal(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Tenant Overview Badge */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="font-extrabold text-white text-sm">{timeModalTenant.companyName}</div>
                <div className="text-xs text-indigo-400 font-mono">{timeModalTenant.email}</div>
                {timeModalTenant.phone && <div className="text-[11px] text-slate-400 font-mono">{timeModalTenant.phone}</div>}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-mono block">Current Expiry Status</span>
                <span className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold inline-block mt-0.5 ${
                  !timeModalTenant.subscriptionExpiry
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : new Date(timeModalTenant.subscriptionExpiry).getTime() < Date.now()
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {timeModalTenant.subscriptionExpiry ? `Expires: ${timeModalTenant.subscriptionExpiry}` : '👑 Lifetime Permanent'}
                </span>
              </div>
            </div>

            {/* 1-Click Quick Extension Buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Quick 1-Click Duration Extension (فوری وقت بڑھائیں):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickExtendTenant('24h')}
                  disabled={timeModalSubmitting}
                  className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer font-mono"
                >
                  ⏱️ +24 Hours
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendTenant('7d')}
                  disabled={timeModalSubmitting}
                  className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer font-mono"
                >
                  📅 +7 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendTenant('30d')}
                  disabled={timeModalSubmitting}
                  className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer font-mono"
                >
                  📅 +30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendTenant('90d')}
                  disabled={timeModalSubmitting}
                  className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer font-mono"
                >
                  📅 +90 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendTenant('180d')}
                  disabled={timeModalSubmitting}
                  className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer font-mono"
                >
                  📅 +180 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendTenant('365d')}
                  disabled={timeModalSubmitting}
                  className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer font-mono"
                >
                  📅 +1 Year
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtendTenant('permanent')}
                  disabled={timeModalSubmitting}
                  className="col-span-2 p-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-950/40 font-mono uppercase tracking-wider"
                >
                  <Crown className="w-4 h-4 text-amber-200" />
                  👑 Set Lifetime Permanent
                </button>
              </div>
            </div>

            {/* Custom Expiry & Settings Form */}
            <form onSubmit={handleSaveTimeModal} className="space-y-4 pt-2 border-t border-slate-800">
              <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={timeModalIsPermanent}
                      onChange={(e) => setTimeModalIsPermanent(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-slate-900 border-slate-700"
                    />
                    <span>Lifetime Permanent Access (بغیر تاریخ کے مستقل رسائی)</span>
                  </label>
                  {timeModalIsPermanent && (
                    <span className="text-[10px] text-amber-300 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      No Expiry Date
                    </span>
                  )}
                </div>

                {!timeModalIsPermanent && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
                      Specific Access Expiry Date (رسائی کی آخری تاریخ)
                    </label>
                    <input
                      type="date"
                      value={timeModalExpiry}
                      onChange={(e) => setTimeModalExpiry(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Operating Hours and Lockout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Daily Operating Window (روزانہ کھلنے کا وقت)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={timeModalHoursStart}
                      onChange={(e) => setTimeModalHoursStart(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-2 text-xs text-white outline-none font-mono"
                    />
                    <span className="text-slate-500 text-xs">-</span>
                    <input
                      type="time"
                      value={timeModalHoursEnd}
                      onChange={(e) => setTimeModalHoursEnd(e.target.value)}
                      className="w-1/2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-2 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    Subscription Status (اسٹیٹس)
                  </label>
                  <select
                    value={timeModalStatus}
                    onChange={(e) => setTimeModalStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-bold"
                  >
                    <option value="active">Active (فعال - رسائی کی اجازت ہے)</option>
                    <option value="expired">Expired (مدت ختم - رسائی بلاک)</option>
                    <option value="inactive">Inactive (غیر فعال)</option>
                  </select>
                </div>
              </div>

              {/* Temporary Suspension */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Temporary Suspension Until (عارضی طور پر معطل رکھیں)
                </label>
                <input
                  type="date"
                  value={timeModalSuspendedUntil}
                  onChange={(e) => setTimeModalSuspendedUntil(e.target.value)}
                  className="w-full bg-slate-950 border border-rose-900/40 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  اگر آپ کسی مخصوص تاریخ تک رسائی روکنا چاہتے ہیں تو یہاں تاریخ منتخب کریں، ورنہ خالی چھوڑ دیں۔
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={timeModalSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes / محفوظ کریں
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
