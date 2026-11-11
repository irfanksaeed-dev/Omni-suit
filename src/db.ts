import { UserTenant, Customer, Product, Invoice, Sale, Expense, DashboardStats, AccessLog, ChatMessage, ActiveSession, PurchaseRecord, CustomerPayment, CustomerReturn, CustomInvite } from './types';

// Multi-tenant Local Database Engine
const KEYS = {
  TENANTS: 'biz_suite_tenants',
  ACTIVE_USER: 'biz_suite_active_user',
  CUSTOMERS: 'biz_suite_customers',
  PRODUCTS: 'biz_suite_products',
  INVOICES: 'biz_suite_invoices',
  SALES: 'biz_suite_sales',
  EXPENSES: 'biz_suite_expenses',
  ACCESS_LOGS: 'biz_suite_access_logs',
  SUPPORT_CHATS: 'biz_suite_support_chats',
  ACTIVE_SESSIONS: 'biz_suite_active_sessions',
  PURCHASES: 'biz_suite_purchases',
  CUSTOMER_PAYMENTS: 'biz_suite_customer_payments',
  CUSTOMER_RETURNS: 'biz_suite_customer_returns',
  CUSTOM_INVITES: 'biz_suite_custom_invites',
};

// Seed initial Demo Tenant if nothing exists
export function initializeDatabase() {
  let tenants = getTenants();
  
  // Ensure tenant-demo ALWAYS exists as the principal sandbox tenant
  const hasDemo = tenants.some(t => t.id === 'tenant-demo' || t.email.toLowerCase() === 'demo@business.com');
  if (!hasDemo) {
    const demoTenant: UserTenant = {
      id: 'tenant-demo',
      email: 'demo@business.com',
      passwordSha: 'demo123',
      companyName: 'Apex Enterprise Solutions',
      currency: 'USD',
      language: 'en',
      taxRate: 15,
      taxNumber: 'TRN-98471920',
      phone: '+1 (555) 304-2094',
      address: '742 Evergreen Terrace, Sector 4, Silicon Valley, CA',
      invoicePrefix: 'INV-',
      invoiceNotes: 'Thank you for your business. Payment is due within 15 days via wire transfer to Bank Account IBAN US993881023.',
      role: 'admin',
      isActive: true,
      isApproved: true,
      subscriptionStatus: 'active',
      subscriptionExpiry: '2027-12-31',
      createdAt: '2026-01-01'
    };
    tenants.unshift(demoTenant);
    localStorage.setItem(KEYS.TENANTS, JSON.stringify(tenants));
  }

  // Ensure Apex Enterprise Solutions has active sample demo records seeded
  const currentDemoCustomers = getCustomers('tenant-demo');
  if (currentDemoCustomers.length === 0) {
    seedDemoDataForTenant('tenant-demo');
  }

  // Ensure high-critical super admin irfanksaeed@gmail.com has a master admin account
  const irfanEmail = 'irfanksaeed@gmail.com';
  const hasIrfan = tenants.some(t => t.email.toLowerCase() === irfanEmail);
  if (!hasIrfan) {
    const irfanTenant: UserTenant = {
      id: 'tenant-irfan',
      email: irfanEmail,
      passwordSha: 'irfan123', // memorable default password
      companyName: 'Unified Global Administration',
      currency: 'AED',
      language: 'en',
      taxRate: 5,
      taxNumber: 'TRN-ADM-97100',
      phone: '+971 50 123 4567',
      address: 'Global Admin Center Office, Burj Khalifa Sector, Dubai, UAE',
      invoicePrefix: 'SYS-',
      invoiceNotes: 'Master Super Administrator Account.',
      role: 'admin',
      isActive: true,
      isApproved: true,
      subscriptionStatus: 'active',
      subscriptionExpiry: '2035-12-31',
      createdAt: '2026-05-26'
    };
    tenants.push(irfanTenant);
    localStorage.setItem(KEYS.TENANTS, JSON.stringify(tenants));
  }

  // Preserve approval flags so Super Admin maintains full review authority over all registrations
}

function getStorageArray<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

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

export async function pushServerSync(): Promise<void> {
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
        try {
          dbData[key] = JSON.parse(val);
        } catch (e) {
          console.error('JSON parse fail for key', key, e);
        }
      }
    });

    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    try {
      const activeUser = getActiveUser();
      if (activeUser && activeUser.role === 'admin') {
        reqHeaders['x-caller-role'] = 'admin';
      }
    } catch (e) {
      // ignore
    }

    const res = await fetch(getApiUrl('/api/db'), {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(dbData)
    });
    if (!res.ok) {
      console.warn('POST sync returned non-ok status:', res.status);
    }
  } catch (err: any) {
    console.warn('Background cloud database synchronization is currently offline: local storage is functioning correctly.', err.message || err);
  }
}

export function triggerServerSync(): void {
  pushServerSync().catch(err => {
    console.warn('Global trigger sync failed to execute context:', err);
  });
}

export async function pullServerSync(): Promise<void> {
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
        'biz_suite_access_logs',
        'biz_suite_support_chats',
        'biz_suite_active_sessions',
        'biz_suite_purchases',
        'biz_suite_custom_invites'
      ];
      let hasNewLocalRecords = false;
      SYNC_KEYS.forEach(key => {
        if (cloudDb && Array.isArray(cloudDb[key])) {
          const cloudArr = cloudDb[key];
          const localStr = localStorage.getItem(key);
          if (localStr) {
            try {
              const localArr = JSON.parse(localStr);
              if (Array.isArray(localArr) && localArr.length > 0) {
                const map = new Map<string, any>();
                // Cloud items first
                cloudArr.forEach((item: any) => {
                  if (item) {
                    const id = item.id || (item.userId ? `${item.userId}-${item.email}` : null);
                    if (id) map.set(id, item);
                  }
                });
                // Local items merged if missing in cloud
                localArr.forEach((item: any) => {
                  if (item) {
                    const id = item.id || (item.userId ? `${item.userId}-${item.email}` : null);
                    if (id && !map.has(id)) {
                      map.set(id, item);
                      hasNewLocalRecords = true;
                    }
                  }
                });
                localStorage.setItem(key, JSON.stringify(Array.from(map.values())));
                return;
              }
            } catch (e) {}
          }
          localStorage.setItem(key, JSON.stringify(cloudArr));
        }
      });
      if (hasNewLocalRecords) {
        pushServerSync().catch(() => {});
      }
      notifyDbUpdate();
    } else {
      console.warn('Cloud database pull responded with non-ok status code:', res.status);
    }
  } catch (err: any) {
    console.warn('Network offline or server database pull is currently unavailable. Operating on browser local storage fallback:', err.message || err);
  }
}

let notifyDbUpdateTimer: any = null;
export function notifyDbUpdate(): void {
  if (typeof window !== 'undefined') {
    if (notifyDbUpdateTimer) {
      clearTimeout(notifyDbUpdateTimer);
    }
    notifyDbUpdateTimer = setTimeout(() => {
      notifyDbUpdateTimer = null;
      window.dispatchEvent(new CustomEvent('db-update'));
    }, 0);
  }
}

function setStorageArray<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
  triggerServerSync();
  notifyDbUpdate();
}

// Access Logs
export function getAccessLogs(): AccessLog[] {
  return getStorageArray<AccessLog>(KEYS.ACCESS_LOGS);
}

export function logAccess(
  type: 'merchant' | 'customer',
  targetId: string,
  name: string,
  email: string,
  action: string
): void {
  try {
    const logs = getAccessLogs();
    const newLog: AccessLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      targetId,
      name,
      email,
      action,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined
    };
    
    // Maintain a maximum of 300 logs for display to avoid storage bloat
    const updated = [newLog, ...logs].slice(0, 300);
    setStorageArray(KEYS.ACCESS_LOGS, updated);
    triggerServerSync();
  } catch (err) {
    console.error('Failed to append access log', err);
  }
}

export function clearAccessLogs(): void {
  setStorageArray(KEYS.ACCESS_LOGS, []);
  triggerServerSync();
}

export function logTenantAction(tenantId: string, action: string): void {
  try {
    const tenants = getTenants();
    const tenant = tenants.find(t => t.id === tenantId);
    if (tenant) {
      logAccess('merchant', tenantId, tenant.companyName, tenant.email, action);
    } else {
      const customers = getCustomersGlobal();
      const customer = customers.find(c => c.id === tenantId);
      if (customer) {
        logAccess('customer', tenantId, customer.name, customer.email, action);
      } else {
        logAccess('merchant', tenantId, 'System Operator', 'operator@business.com', action);
      }
    }
  } catch (err) {
    console.error('Failed to log tenant action', err);
  }
}

export function adminToggleCustomerBlockGlobal(customerId: string): boolean {
  const allCustomers = getCustomersGlobal();
  const index = allCustomers.findIndex(c => c.id === customerId);
  if (index !== -1) {
    const cust = allCustomers[index];
    cust.isBlocked = !cust.isBlocked;
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(allCustomers));
    triggerServerSync();
    return cust.isBlocked || false;
  }
  return false;
}

export function adminToggleCustomerApprovalGlobal(customerId: string): boolean {
  const allCustomers = getCustomersGlobal();
  const index = allCustomers.findIndex(c => c.id === customerId);
  if (index !== -1) {
    const cust = allCustomers[index];
    cust.isApproved = cust.isApproved !== false ? false : true;
    localStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(allCustomers));
    triggerServerSync();
    return cust.isApproved || false;
  }
  return false;
}

// User Registrations & Approval Policies
export function getRequireAdminApprovalSetting(): boolean {
  const saved = localStorage.getItem('biz_suite_require_admin_approval');
  if (saved === null) return true; // Default: Require Super Admin Approval for all permanent accounts
  return saved === 'true';
}

export function setRequireAdminApprovalSetting(required: boolean): void {
  localStorage.setItem('biz_suite_require_admin_approval', String(required));
  triggerServerSync();
}

export function getTenants(): UserTenant[] {
  return getStorageArray<UserTenant>(KEYS.TENANTS);
}

export function registerTenant(tenant: UserTenant, bypassApproval: boolean = false): { success: boolean; requiresApproval: boolean; error?: string; createdTenant?: UserTenant } {
  const tenants = getTenants();
  if (tenants.some(t => t.email.toLowerCase() === tenant.email.toLowerCase())) {
    return { success: false, requiresApproval: false, error: 'Email already registered' };
  }
  
  const isSpecialAdmin = tenant.email.toLowerCase() === 'admin@business.com' || 
                         tenant.email.toLowerCase() === 'irfanksaeed@gmail.com' ||
                         tenant.email.toLowerCase() === 'demo@business.com';
                         
  // Strict Security Policy: All new registrations MUST be approved by Super Admin unless registered via a pre-approved custom invite token
  const requiresApproval = !bypassApproval && !isSpecialAdmin;

  const preparedTenant: UserTenant = {
    ...tenant,
    role: isSpecialAdmin ? 'admin' : (tenant.role || 'user'),
    isActive: tenant.isActive !== false,
    isApproved: bypassApproval ? true : (isSpecialAdmin ? true : false),
    subscriptionStatus: tenant.subscriptionStatus || 'active',
    subscriptionExpiry: tenant.subscriptionExpiry !== undefined ? tenant.subscriptionExpiry : '2027-12-31', // Default 1 year subscription if not specified
    createdAt: tenant.createdAt || new Date().toISOString().split('T')[0]
  };

  tenants.push(preparedTenant);
  setStorageArray(KEYS.TENANTS, tenants);
  triggerServerSync();
  
  return { success: true, requiresApproval: !preparedTenant.isApproved, createdTenant: preparedTenant };
}

export function adminUpdateTenant(updated: UserTenant): void {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === updated.id);
  if (idx !== -1) {
    tenants[idx] = updated;
    setStorageArray(KEYS.TENANTS, tenants);
    
    // If updating currently logged in user, refresh their session
    const active = getActiveUser();
    if (active && active.id === updated.id) {
      setActiveUser(updated);
    }
    triggerServerSync();
  }
}

// Full admin delete power: purge tenant database and all segregated tables (invoices, sales, expenses, etc.)
export function adminDeleteTenant(tenantId: string): void {
  const tenants = getTenants();
  const filteredTenants = tenants.filter(t => t.id !== tenantId);
  setStorageArray(KEYS.TENANTS, filteredTenants);

  //Segregated tables cleanup to guarantee clean storage hygiene
  const purgeSegregated = (storageKey: string) => {
    const items = getStorageArray<{ id: string; tenantId: string }>(storageKey);
    const retained = items.filter(item => item.tenantId !== tenantId);
    setStorageArray(storageKey, retained);
  };

  purgeSegregated(KEYS.CUSTOMERS);
  purgeSegregated(KEYS.PRODUCTS);
  purgeSegregated(KEYS.INVOICES);
  purgeSegregated(KEYS.SALES);
  purgeSegregated(KEYS.EXPENSES);
  triggerServerSync();
}

// Admin custom manual registration helper
export function adminCreateTenant(tenant: UserTenant): boolean {
  const tenants = getTenants();
  if (tenants.some(t => t.email.toLowerCase() === tenant.email.toLowerCase())) {
    return false;
  }
  tenants.push(tenant);
  setStorageArray(KEYS.TENANTS, tenants);
  triggerServerSync();
  
  return true;
}

export function getPendingUsersCount(): number {
  const tenants = getTenants();
  return tenants.filter(t => t.isApproved === false).length;
}

export function adminToggleTenantApproval(tenantId: string): boolean {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx !== -1) {
    const current = tenants[idx];
    const newStatus = !current.isApproved;
    tenants[idx] = {
      ...current,
      isApproved: newStatus,
      isActive: newStatus ? true : current.isActive
    };
    setStorageArray(KEYS.TENANTS, tenants);
    triggerServerSync();
    return true;
  }
  return false;
}

export function adminToggleTenantBlock(tenantId: string): boolean {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx !== -1) {
    const current = tenants[idx];
    tenants[idx] = {
      ...current,
      isActive: current.isActive === false ? true : false
    };
    setStorageArray(KEYS.TENANTS, tenants);
    triggerServerSync();
    return true;
  }
  return false;
}

export function adminToggleTenantRole(tenantId: string): boolean {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx !== -1) {
    const current = tenants[idx];
    tenants[idx] = {
      ...current,
      role: current.role === 'admin' ? 'user' : 'admin'
    };
    setStorageArray(KEYS.TENANTS, tenants);
    triggerServerSync();
    return true;
  }
  return false;
}

export function adminResetTenantPassword(tenantId: string, newPasswordSha: string): boolean {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx !== -1) {
    tenants[idx] = {
      ...tenants[idx],
      passwordSha: newPasswordSha
    };
    setStorageArray(KEYS.TENANTS, tenants);
    triggerServerSync();
    return true;
  }
  return false;
}

export function getActiveUser(): UserTenant | null {
  const data = localStorage.getItem(KEYS.ACTIVE_USER);
  if (!data) return null;
  try {
    const rawUser = JSON.parse(data) as UserTenant;
    // Cross-verify with registered tenants status
    const verifiedTenant = getTenants().find(t => t.id === rawUser.id);
    if (!verifiedTenant) {
      localStorage.removeItem(KEYS.ACTIVE_USER);
      return null;
    }
    // Blocked or de-activated tenants should be logged out immediately
    if (verifiedTenant.isActive === false || verifiedTenant.isApproved === false) {
      localStorage.removeItem(KEYS.ACTIVE_USER);
      return null;
    }
    return verifiedTenant;
  } catch (e) {
    localStorage.removeItem(KEYS.ACTIVE_USER);
    return null;
  }
}

export function setActiveUser(user: UserTenant | null): void {
  if (user) {
    localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(user));
  } else {
    localStorage.removeItem(KEYS.ACTIVE_USER);
  }
}

export function updateTenantSettings(updated: Partial<UserTenant>): UserTenant | null {
  const active = getActiveUser();
  if (!active) return null;
  
  const merged: UserTenant = { ...active, ...updated };
  setActiveUser(merged);
  
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === merged.id);
  if (idx !== -1) {
    tenants[idx] = merged;
    setStorageArray(KEYS.TENANTS, tenants);
  }
  logTenantAction(merged.id, 'Updated tenant account profile details and workspace settings');
  return merged;
}

// ==========================================
// 24-HOUR GUEST VISITOR PASS OPERATIONS
// ==========================================
export function provisionGuestPassTenant(passCode?: string): UserTenant {
  const tenants = getTenants();
  
  // If active user is already an unexpired guest tenant, reuse and ensure demo data
  const active = getActiveUser();
  if (!passCode && active && active.isGuestPass) {
    if (!isGuestPassExpired(active)) {
      const custs = getCustomers(active.id);
      if (custs.length === 0) {
        seedDemoDataForTenant(active.id);
      }
      return active;
    }
  }

  const cleanPass = passCode ? passCode.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const guestPassId = cleanPass ? `tenant-guest-${cleanPass}` : `tenant-guest-${Date.now().toString(36)}`;
  
  // Check if this guest tenant already exists in database
  const existing = tenants.find(t => t.id === guestPassId || (cleanPass && t.id === `tenant-guest-${cleanPass}`));
  if (existing) {
    const isExp = existing.guestExpiresAt && new Date(existing.guestExpiresAt).getTime() < Date.now();
    if (isExp) {
      existing.guestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      existing.isActive = true;
      existing.isApproved = true;
      existing.subscriptionStatus = 'active';
      existing.subscriptionExpiry = existing.guestExpiresAt;
      adminUpdateTenant(existing);
    }
    const custs = getCustomers(existing.id);
    if (custs.length === 0) {
      seedDemoDataForTenant(existing.id);
    }
    return existing;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24-hour expiration
  const newGuest: UserTenant = {
    id: guestPassId,
    email: `guest-${Math.random().toString(36).substring(2, 7)}@omnisuite.app`,
    passwordSha: 'guest123',
    companyName: 'Guest Explorer (24h Pass)',
    currency: 'USD',
    language: 'en',
    taxRate: 5,
    invoicePrefix: 'GST-',
    invoiceNotes: '24-Hour Interactive Evaluation Sandbox Pass.',
    role: 'user',
    isActive: true,
    isApproved: true,
    isGuestPass: true,
    guestExpiresAt: expiresAt,
    subscriptionStatus: 'active',
    subscriptionExpiry: expiresAt,
    createdAt: new Date().toISOString()
  };

  tenants.push(newGuest);
  setStorageArray(KEYS.TENANTS, tenants);
  
  // Seed sample products, sales, customers, and invoices for the guest visitor
  seedDemoDataForTenant(guestPassId);
  triggerServerSync();
  return newGuest;
}

export function isGuestPassExpired(user: UserTenant): boolean {
  if (!user.isGuestPass || !user.guestExpiresAt) return false;
  return new Date(user.guestExpiresAt).getTime() <= Date.now();
}

export function getGuestPassRemainingHours(user: UserTenant): { hours: number; minutes: number; isExpired: boolean } {
  if (!user.isGuestPass || !user.guestExpiresAt) return { hours: 24, minutes: 0, isExpired: false };
  const diffMs = new Date(user.guestExpiresAt).getTime() - Date.now();
  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, isExpired: true };
  }
  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes, isExpired: false };
}

export function requestGuestUpgradeToPermanent(
  tenantId: string, 
  details: { companyName: string; email: string; phone?: string; notes?: string; password?: string }
): { success: boolean; message: string; updatedUser?: UserTenant } {
  const tenants = getTenants();
  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) {
    return { success: false, message: 'Guest account not found.' };
  }

  // Check if email is already taken by another permanent tenant
  if (details.email && details.email.toLowerCase() !== tenant.email.toLowerCase()) {
    const emailExists = tenants.some(t => t.id !== tenantId && t.email.toLowerCase() === details.email.toLowerCase());
    if (emailExists) {
      return { success: false, message: 'This email address is already in use by another account.' };
    }
  }

  tenant.companyName = details.companyName.trim() || tenant.companyName;
  if (details.email && details.email.trim()) tenant.email = details.email.trim().toLowerCase();
  if (details.phone) tenant.phone = details.phone.trim();
  if (details.password) tenant.passwordSha = details.password;
  tenant.guestUpgradeRequested = true;
  tenant.guestUpgradeRequestedAt = new Date().toISOString();
  tenant.guestUpgradeNotes = details.notes || 'User requested permanent account conversion from 24-hour trial.';

  setStorageArray(KEYS.TENANTS, tenants);
  logAccess('merchant', tenant.id, tenant.companyName, tenant.email, `Submitted request for Permanent Account Conversion to Super Admin (Phone: ${details.phone || 'N/A'})`);
  triggerServerSync();

  return { success: true, message: 'Request submitted successfully to Super Admin Irfan Saeed.', updatedUser: tenant };
}

export function grantGuestPermanentAccess(tenantId: string, customData?: Partial<UserTenant>): UserTenant | null {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) return null;

  const current = tenants[idx];
  const updated: UserTenant = {
    ...current,
    ...(customData || {}),
    isGuestPass: false,
    guestExpiresAt: undefined,
    guestUpgradeRequested: false,
    isApproved: true,
    isActive: true,
    subscriptionStatus: 'active',
    subscriptionExpiry: '2027-12-31',
    role: current.role || 'user'
  };

  tenants[idx] = updated;
  setStorageArray(KEYS.TENANTS, tenants);
  logAccess('merchant', updated.id, updated.companyName, updated.email, 'Super Admin GRANTED Permanent Account Access to guest visitor');
  triggerServerSync();

  return updated;
}

export function dismissGuestUpgradeRequest(tenantId: string): void {
  const tenants = getTenants();
  const tenant = tenants.find(t => t.id === tenantId);
  if (tenant) {
    tenant.guestUpgradeRequested = false;
    setStorageArray(KEYS.TENANTS, tenants);
    triggerServerSync();
  }
}

// ==========================================
// CUSTOM DIRECT INVITES & PROVISIONING TOKENS
// ==========================================
export function getCustomInvites(): CustomInvite[] {
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  // Auto-mark expired tokens
  const now = Date.now();
  let changed = false;
  const updated = list.map(inv => {
    if (inv.status === 'active' && !inv.isPermanent && inv.expiresAt && new Date(inv.expiresAt).getTime() < now) {
      changed = true;
      return { ...inv, status: 'expired' as const };
    }
    return inv;
  });
  if (changed) {
    setStorageArray(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites', updated);
  }
  return updated;
}

export function createCustomInvite(data: {
  email: string;
  companyName?: string;
  phone?: string;
  durationType: string; // '24h' | '3d' | '7d' | '15d' | '30d' | '90d' | '180d' | '365d' | 'custom' | 'permanent'
  customDate?: string;
  allowedHoursStart?: string;
  allowedHoursEnd?: string;
}): CustomInvite {
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  const tokenId = 'inv-' + Math.random().toString(36).substring(2, 9);
  const now = Date.now();
  
  let expiresAt: string | undefined = undefined;
  let durationLabel = 'Permanent / Lifetime';
  let isPermanent = false;

  switch (data.durationType) {
    case '24h':
      expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '24 Hours Pass (1 Day)';
      break;
    case '3d':
      expiresAt = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '3 Days Pass';
      break;
    case '7d':
      expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '7 Days License (1 Week)';
      break;
    case '15d':
      expiresAt = new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '15 Days License';
      break;
    case '30d':
      expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '30 Days (1 Month)';
      break;
    case '90d':
      expiresAt = new Date(now + 90 * 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '90 Days (3 Months)';
      break;
    case '180d':
      expiresAt = new Date(now + 180 * 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '180 Days (6 Months)';
      break;
    case '365d':
      expiresAt = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
      durationLabel = '1 Year License';
      break;
    case 'custom':
      if (data.customDate) {
        expiresAt = new Date(data.customDate + 'T23:59:59').toISOString();
        durationLabel = `Until ${data.customDate}`;
      } else {
        expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
        durationLabel = '30 Days (1 Month)';
      }
      break;
    case 'permanent':
    default:
      isPermanent = true;
      expiresAt = undefined;
      durationLabel = 'Permanent / Lifetime Access';
      break;
  }

  const newInvite: CustomInvite = {
    id: tokenId,
    email: data.email.trim().toLowerCase(),
    companyName: data.companyName?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    durationLabel,
    expiresAt,
    allowedHoursStart: data.allowedHoursStart?.trim() || undefined,
    allowedHoursEnd: data.allowedHoursEnd?.trim() || undefined,
    isPermanent,
    createdAt: new Date().toISOString(),
    createdBy: 'Super Admin',
    status: 'active'
  };

  list.unshift(newInvite);
  setStorageArray(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites', list);
  logAccess('merchant', tokenId, data.companyName || 'New Business', data.email, `Super Admin generated custom invite link with ${durationLabel}`);
  triggerServerSync();

  return newInvite;
}

export function getCustomInviteByToken(tokenId: string): CustomInvite | null {
  const clean = tokenId.trim().toLowerCase().replace(/^[\s#?\/]+/, '');
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  return list.find(inv => inv.id.toLowerCase() === clean) || null;
}

export function claimCustomInvite(tokenId: string, tenantId: string): boolean {
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  const idx = list.findIndex(inv => inv.id.toLowerCase() === tokenId.toLowerCase());
  if (idx !== -1) {
    list[idx].status = 'used';
    list[idx].usedAt = new Date().toISOString();
    list[idx].usedByTenantId = tenantId;
    setStorageArray(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites', list);
    triggerServerSync();
    return true;
  }
  return false;
}

export function revokeCustomInvite(tokenId: string): boolean {
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  const idx = list.findIndex(inv => inv.id.toLowerCase() === tokenId.toLowerCase());
  if (idx !== -1) {
    list[idx].status = 'revoked';
    setStorageArray(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites', list);
    triggerServerSync();
    return true;
  }
  return false;
}

export function deleteCustomInvite(tokenId: string): void {
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  const filtered = list.filter(inv => inv.id.toLowerCase() !== tokenId.toLowerCase());
  setStorageArray(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites', filtered);
  triggerServerSync();
}

export function clearInactiveCustomInvites(): number {
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  const activeOnly = list.filter(inv => inv.status === 'active');
  const deletedCount = list.length - activeOnly.length;
  setStorageArray(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites', activeOnly);
  triggerServerSync();
  return deletedCount;
}

export function updateCustomInvite(tokenId: string, updates: Partial<CustomInvite>): CustomInvite | null {
  const list = getStorageArray<CustomInvite>(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites');
  const idx = list.findIndex(inv => inv.id.toLowerCase() === tokenId.toLowerCase());
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    setStorageArray(KEYS.CUSTOM_INVITES || 'biz_suite_custom_invites', list);
    triggerServerSync();
    return list[idx];
  }
  return null;
}

// ==========================================
// TENANT TIME & DURATION CONTROL BY SUPER ADMIN
// ==========================================
export function adminUpdateTenantAccessTime(
  tenantId: string, 
  options: {
    subscriptionExpiry?: string;
    isPermanent?: boolean;
    allowedHoursStart?: string;
    allowedHoursEnd?: string;
    tempSuspendedUntil?: string;
    isActive?: boolean;
    subscriptionStatus?: 'active' | 'inactive' | 'expired';
  }
): UserTenant | null {
  const tenants = getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) return null;

  const current = tenants[idx];
  const updated: UserTenant = {
    ...current,
    ...options,
    subscriptionExpiry: options.isPermanent ? undefined : (options.subscriptionExpiry !== undefined ? options.subscriptionExpiry : current.subscriptionExpiry),
    subscriptionStatus: options.subscriptionStatus || (options.isPermanent || !options.subscriptionExpiry || new Date(options.subscriptionExpiry).getTime() >= Date.now() ? 'active' : 'expired'),
    allowedHoursStart: options.allowedHoursStart !== undefined ? options.allowedHoursStart : current.allowedHoursStart,
    allowedHoursEnd: options.allowedHoursEnd !== undefined ? options.allowedHoursEnd : current.allowedHoursEnd,
    tempSuspendedUntil: options.tempSuspendedUntil !== undefined ? options.tempSuspendedUntil : current.tempSuspendedUntil,
    isActive: options.isActive !== undefined ? options.isActive : current.isActive
  };

  // If this was a guest pass and was extended/made permanent, unflag guestPass if permanent
  if (options.isPermanent) {
    updated.isGuestPass = false;
    updated.guestExpiresAt = undefined;
    updated.guestUpgradeRequested = false;
  }

  tenants[idx] = updated;
  setStorageArray(KEYS.TENANTS, tenants);
  
  // If active user is this tenant, sync active user session
  const activeUser = getActiveUser();
  if (activeUser && activeUser.id === tenantId) {
    setActiveUser(updated);
  }

  logAccess('merchant', updated.id, updated.companyName, updated.email, `Super Admin updated access time limits: Expiry=${updated.subscriptionExpiry || 'Permanent'}, Hours=${updated.allowedHoursStart || '00:00'}-${updated.allowedHoursEnd || '23:59'}`);
  triggerServerSync();

  return updated;
}

export function adminExtendTenantSubscription(
  tenantId: string,
  extension: '24h' | '7d' | '30d' | '90d' | '180d' | '365d' | 'permanent' | string
): UserTenant | null {
  const tenants = getTenants();
  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) return null;

  const now = Date.now();
  // Calculate base from current expiry if still in future, or from now
  const baseTime = (tenant.subscriptionExpiry && new Date(tenant.subscriptionExpiry).getTime() > now)
    ? new Date(tenant.subscriptionExpiry).getTime()
    : now;

  let newExpiry: string | undefined = undefined;
  let isPermanent = false;

  switch (extension) {
    case '24h':
      newExpiry = new Date(baseTime + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '7d':
      newExpiry = new Date(baseTime + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '30d':
      newExpiry = new Date(baseTime + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '90d':
      newExpiry = new Date(baseTime + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '180d':
      newExpiry = new Date(baseTime + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case '365d':
      newExpiry = new Date(baseTime + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'permanent':
      isPermanent = true;
      newExpiry = undefined;
      break;
    default:
      // If it's a date string like '2026-12-31'
      newExpiry = extension;
      break;
  }

  return adminUpdateTenantAccessTime(tenantId, {
    subscriptionExpiry: newExpiry,
    isPermanent,
    subscriptionStatus: 'active',
    isActive: true
  });
}

export function isTenantAccessExpired(tenant: UserTenant): boolean {
  if (tenant.role === 'admin') return false; // Super Admins never expire
  
  // 1. Guest pass expiration
  if (tenant.isGuestPass && tenant.guestExpiresAt) {
    if (new Date(tenant.guestExpiresAt).getTime() <= Date.now()) {
      return true;
    }
  }

  // 2. Explicit expired status
  if (tenant.subscriptionStatus === 'expired') {
    return true;
  }

  // 3. Subscription Expiry date check
  if (tenant.subscriptionExpiry) {
    // If format is YYYY-MM-DD, check end of that day (23:59:59)
    const expDate = tenant.subscriptionExpiry.includes('T') 
      ? new Date(tenant.subscriptionExpiry).getTime()
      : new Date(tenant.subscriptionExpiry + 'T23:59:59').getTime();
    
    if (expDate <= Date.now()) {
      return true;
    }
  }

  // 4. Temporary suspension check
  if (tenant.tempSuspendedUntil) {
    const suspendEnd = tenant.tempSuspendedUntil.includes('T')
      ? new Date(tenant.tempSuspendedUntil).getTime()
      : new Date(tenant.tempSuspendedUntil + 'T23:59:59').getTime();
    if (suspendEnd > Date.now()) {
      return true; // temporarily suspended
    }
  }

  return false;
}

function getTenantData<T extends { tenantId: string }>(key: string, tenantId: string): T[] {
  const all = getStorageArray<T>(key);
  return all.filter(item => item.tenantId === tenantId);
}

function saveTenantData<T extends { id: string; tenantId: string }>(
  key: string, 
  tenantId: string, 
  item: T, 
  isNew: boolean
): void {
  const all = getStorageArray<T>(key);
  if (isNew) {
    all.push(item);
  } else {
    const idx = all.findIndex(i => i.id === item.id && i.tenantId === tenantId);
    if (idx !== -1) {
      all[idx] = item;
    }
  }
  setStorageArray(key, all);
}

function deleteTenantData<T extends { id: string; tenantId: string }>(
  key: string, 
  tenantId: string, 
  itemId: string
): void {
  const all = getStorageArray<T>(key);
  const filtered = all.filter(i => !(i.id === itemId && i.tenantId === tenantId));
  setStorageArray(key, filtered);
}

// Helper Functions for Dynamic Automatic ID Generation
export function getNextCustomerId(tenantId: string): string {
  const customers = getCustomers(tenantId);
  let maxNum = 0;
  customers.forEach(f => {
    const match = f.id.match(/^CUS-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `CUS-${String(maxNum + 1).padStart(4, '0')}`;
}

export function getNextProductId(tenantId: string): string {
  const products = getProducts(tenantId);
  let maxNum = 0;
  products.forEach(p => {
    const match = p.id.match(/^PRD-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  return `PRD-${String(maxNum + 1).padStart(4, '0')}`;
}

export function getNextInvoiceId(tenantId: string): string {
  const invoices = getInvoices(tenantId);
  const currentYear = new Date().getFullYear();
  let maxNum = 0;
  invoices.forEach(inv => {
    const matchId = inv.id.match(/^INV-(\d+)-(\d+)$/i);
    const matchNum = inv.invoiceNumber ? inv.invoiceNumber.match(/^INV-(\d+)-(\d+)$/i) : null;
    const match = matchId || matchNum;
    if (match) {
      const year = parseInt(match[1], 10);
      if (year === currentYear) {
        const num = parseInt(match[2], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  });
  return `INV-${currentYear}-${String(maxNum + 1).padStart(4, '0')}`;
}

// Customers Crud
export function getCustomers(tenantId: string): Customer[] {
  return getTenantData<Customer>(KEYS.CUSTOMERS, tenantId);
}

export function addCustomer(tenantId: string, data: Omit<Customer, 'id' | 'tenantId' | 'createdAt'>): Customer {
  const nextId = getNextCustomerId(tenantId);
  const newItem: Customer = {
    ...data,
    id: nextId,
    tenantId,
    createdAt: new Date().toISOString(),
    isApproved: data.isApproved !== undefined ? data.isApproved : true // Merchant registered are active, online-registered pending until approved
  };
  saveTenantData(KEYS.CUSTOMERS, tenantId, newItem, true);
  logTenantAction(tenantId, `Created customer record for "${newItem.name}" (${newItem.email || 'No Email'})`);
  return newItem;
}

export function editCustomer(tenantId: string, item: Customer): void {
  saveTenantData(KEYS.CUSTOMERS, tenantId, item, false);
  logTenantAction(tenantId, `Updated customer card for "${item.name}"`);
}

export function deleteCustomer(tenantId: string, id: string): void {
  deleteTenantData(KEYS.CUSTOMERS, tenantId, id);
  logTenantAction(tenantId, `Removed customer account ID [${id}]`);
}

export function toggleCustomerBlock(tenantId: string, customerId: string): boolean {
  const customers = getCustomers(tenantId);
  const found = customers.find(c => c.id === customerId);
  if (found) {
    found.isBlocked = found.isBlocked === true ? false : true;
    editCustomer(tenantId, found);
    return found.isBlocked;
  }
  return false;
}

export function toggleCustomerApproval(tenantId: string, customerId: string): boolean {
  const customers = getCustomers(tenantId);
  const found = customers.find(c => c.id === customerId);
  if (found) {
    found.isApproved = found.isApproved === true ? false : true;
    editCustomer(tenantId, found);
    return found.isApproved;
  }
  return false;
}

export function getCustomersGlobal(): Customer[] {
  const data = localStorage.getItem(KEYS.CUSTOMERS);
  return data ? JSON.parse(data) : [];
}

export function customerLoginLookup(identifier: string): { customer: Customer; tenant: UserTenant }[] {
  const allCustomers = getCustomersGlobal();
  const cleanId = identifier.trim().toLowerCase();
  
  // Find matching profiles by email or phone
  const matches = allCustomers.filter(c => 
    (c.email && c.email.toLowerCase() === cleanId) || 
    (c.phone && c.phone.trim().replace(/[^\d+]/g, '') === cleanId.replace(/[^\d+]/g, ''))
  );
  
  const tenants = getTenants();
  return matches.map(m => {
    const tenant = tenants.find(t => t.id === m.tenantId);
    return { customer: m, tenant: tenant! };
  }).filter(item => item.tenant !== undefined && item.tenant !== null);
}

// Products Crud
export function getProducts(tenantId: string): Product[] {
  return getTenantData<Product>(KEYS.PRODUCTS, tenantId);
}

export function addProduct(tenantId: string, data: Omit<Product, 'id' | 'tenantId' | 'createdAt'>): Product {
  const nextId = getNextProductId(tenantId);
  const newItem: Product = {
    ...data,
    id: nextId,
    tenantId,
    createdAt: new Date().toISOString()
  };
  saveTenantData(KEYS.PRODUCTS, tenantId, newItem, true);
  logTenantAction(tenantId, `Added product "${newItem.name}" to inventory list (Price: ${newItem.price})`);
  return newItem;
}

export function editProduct(tenantId: string, item: Product): void {
  saveTenantData(KEYS.PRODUCTS, tenantId, item, false);
  logTenantAction(tenantId, `Modified inventory details for product "${item.name}" (Stock: ${item.stock})`);
}

export function deleteProduct(tenantId: string, id: string): void {
  deleteTenantData(KEYS.PRODUCTS, tenantId, id);
  logTenantAction(tenantId, `Deleted product entry ID [${id}] from master inventory`);
}

// Sales transactions
export function getSales(tenantId: string): Sale[] {
  return getTenantData<Sale>(KEYS.SALES, tenantId);
}

export function addSale(tenantId: string, data: Omit<Sale, 'id' | 'tenantId' | 'createdAt'>): Sale {
  const newItem: Sale = {
    ...data,
    id: 'sale-' + Math.random().toString(36).substring(2, 9),
    tenantId,
    createdAt: new Date().toISOString()
  };
  saveTenantData(KEYS.SALES, tenantId, newItem, true);
  logTenantAction(tenantId, `Registered sale transaction: ${newItem.description} (Amount: ${newItem.amount})`);

  // If this sale carries an invoiceId, automatically resolve and mark the corresponding Invoice as paid unless it is credit/udhaar!
  if (newItem.invoiceId && newItem.paymentMethod !== 'credit' && !newItem.isCredit) {
    const invoices = getInvoices(tenantId);
    const linkedInvoice = invoices.find(inv => inv.id === newItem.invoiceId);
    if (linkedInvoice && linkedInvoice.status !== 'paid') {
      linkedInvoice.status = 'paid';
      linkedInvoice.paymentMethod = newItem.paymentMethod;
      linkedInvoice.amountPaid = linkedInvoice.total;
      linkedInvoice.balanceDue = 0;
      saveTenantData(KEYS.INVOICES, tenantId, linkedInvoice, false);
    }
  }

  return newItem;
}

export function editSale(tenantId: string, item: Sale): void {
  saveTenantData(KEYS.SALES, tenantId, item, false);
  logTenantAction(tenantId, `Edited sale transaction details for ID [${item.id}]`);
}

export function deleteSale(tenantId: string, id: string): void {
  const sales = getSales(tenantId);
  const foundSale = sales.find(s => s.id === id);
  if (foundSale && foundSale.invoiceId) {
    const invoices = getInvoices(tenantId);
    const linkedInvoice = invoices.find(inv => inv.id === foundSale.invoiceId);
    if (linkedInvoice && linkedInvoice.status === 'paid') {
      linkedInvoice.status = 'unpaid';
      linkedInvoice.amountPaid = 0;
      linkedInvoice.balanceDue = linkedInvoice.total;
      saveTenantData(KEYS.INVOICES, tenantId, linkedInvoice, false);
    }
  }
  deleteTenantData(KEYS.SALES, tenantId, id);
  logTenantAction(tenantId, `Deleted sale transaction record ID [${id}]`);
}

// Expenses
export function getExpenses(tenantId: string): Expense[] {
  return getTenantData<Expense>(KEYS.EXPENSES, tenantId);
}

export function addExpense(tenantId: string, data: Omit<Expense, 'id' | 'tenantId' | 'createdAt'>): Expense {
  const newItem: Expense = {
    ...data,
    id: 'exp-' + Math.random().toString(36).substring(2, 9),
    tenantId,
    createdAt: new Date().toISOString()
  };
  saveTenantData(KEYS.EXPENSES, tenantId, newItem, true);
  logTenantAction(tenantId, `Recorded business expense: "${newItem.description}" (Amount: ${newItem.amount})`);
  return newItem;
}

export function editExpense(tenantId: string, item: Expense): void {
  saveTenantData(KEYS.EXPENSES, tenantId, item, false);
  logTenantAction(tenantId, `Edited expense entry ID [${item.id}]`);
}

export function deleteExpense(tenantId: string, id: string): void {
  deleteTenantData(KEYS.EXPENSES, tenantId, id);
  logTenantAction(tenantId, `Deleted business expense record ID [${id}]`);
}

// Invoices (Multi-Item complete sales)
export function getInvoices(tenantId: string): Invoice[] {
  return getTenantData<Invoice>(KEYS.INVOICES, tenantId);
}

export function addInvoice(
  tenantId: string, 
  data: Omit<Invoice, 'id' | 'tenantId' | 'createdAt' | 'invoiceNumber'> & { invoiceNumber?: string },
  existingSaleId?: string
): Invoice {
  const nextId = getNextInvoiceId(tenantId);
  const newItem: Invoice = {
    ...data,
    id: nextId,
    invoiceNumber: data.invoiceNumber || nextId, // Support custom invoice number if provided
    tenantId,
    createdAt: new Date().toISOString()
  };
  saveTenantData(KEYS.INVOICES, tenantId, newItem, true);
  logTenantAction(tenantId, `Created Invoice #${newItem.invoiceNumber} for total ${newItem.total} (${newItem.status.toUpperCase()})`);
  
  // If an existing sale ID is being converted to this invoice, link it
  if (existingSaleId) {
    const sales = getSales(tenantId);
    const found = sales.find(s => s.id === existingSaleId);
    if (found) {
      found.invoiceId = nextId;
      found.description = `Settlement for Invoice #${newItem.invoiceNumber}`;
      editSale(tenantId, found);
    }
  } else if (newItem.status === 'paid') {
    // Only record standard paid sale logs if no pre-existing sale is being converted
    recordSaleFromInvoice(tenantId, newItem);
  }
  
  // Dedust stock from products
  deductStockForInvoice(tenantId, newItem);

  return newItem;
}

export function editInvoice(tenantId: string, updatedInvoice: Invoice): void {
  const oldInvoice = getInvoices(tenantId).find(inv => inv.id === updatedInvoice.id);
  
  // Save new invoice details
  saveTenantData(KEYS.INVOICES, tenantId, updatedInvoice, false);
  logTenantAction(tenantId, `Updated Invoice #${updatedInvoice.invoiceNumber} details`);

  // If transition to paid happened, record a corresponding sale
  if (updatedInvoice.status === 'paid' && (!oldInvoice || oldInvoice.status !== 'paid')) {
    recordSaleFromInvoice(tenantId, updatedInvoice);
  }
  // If transitioned from paid back to unpaid, delete the matching sale
  else if (updatedInvoice.status !== 'paid' && oldInvoice && oldInvoice.status === 'paid') {
    const sales = getSales(tenantId);
    const matchingSale = sales.find(s => s.invoiceId === updatedInvoice.id);
    if (matchingSale) {
      deleteSale(tenantId, matchingSale.id);
    }
  }
  // If it was already paid and remains paid, but details (total, payment method, name) changed, update the sale details
  else if (updatedInvoice.status === 'paid' && oldInvoice && oldInvoice.status === 'paid') {
    const sales = getSales(tenantId);
    const matchingSale = sales.find(s => s.invoiceId === updatedInvoice.id);
    if (matchingSale) {
      matchingSale.amount = updatedInvoice.total;
      matchingSale.customerName = updatedInvoice.customerName;
      matchingSale.paymentMethod = updatedInvoice.paymentMethod || 'bank';
      matchingSale.description = `Settlement for Invoice #${updatedInvoice.invoiceNumber}`;
      editSale(tenantId, matchingSale);
    }
  }
  
  // Re-adjust stock if quantities/items changed is outside basic scope, we can update simple stocks safely
}

export function deleteInvoice(tenantId: string, id: string): void {
  // First, find and delete any linked sale so that revenue calculation stays accurate
  const sales = getSales(tenantId);
  const linkedSale = sales.find(s => s.invoiceId === id);
  if (linkedSale) {
    deleteSale(tenantId, linkedSale.id);
  }
  // Get invoice number for descriptive logging
  const invoices = getInvoices(tenantId);
  const found = invoices.find(inv => inv.id === id);
  const invoiceNum = found ? found.invoiceNumber : id;
  
  deleteTenantData(KEYS.INVOICES, tenantId, id);
  logTenantAction(tenantId, `Deleted Invoice record ID [#${invoiceNum}]`);
}

function recordSaleFromInvoice(tenantId: string, inv: Invoice) {
  // Check if a sale for this invoice already exists to avoid duplication
  const sales = getSales(tenantId);
  if (sales.some(s => s.invoiceId === inv.id)) return;
  
  addSale(tenantId, {
    invoiceId: inv.id,
    customerName: inv.customerName,
    date: inv.date,
    amount: inv.total,
    category: 'Invoice Payment',
    description: `Settlement for Invoice #${inv.invoiceNumber}`,
    paymentMethod: inv.paymentMethod || 'bank',
  });
}

function deductStockForInvoice(tenantId: string, inv: Invoice) {
  const products = getProducts(tenantId);
  inv.items.forEach(item => {
    const prod = products.find(p => p.id === item.productId);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - item.quantity);
      editProduct(tenantId, prod);
    }
  });
}

// Calculate Combined Dashboard Statistics
export function getDashboardStats(tenantId: string): DashboardStats {
  const sales = getSales(tenantId);
  const expenses = getExpenses(tenantId);
  const customers = getCustomers(tenantId);
  const products = getProducts(tenantId);

  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;
  const customerCount = customers.length;
  const lowStockCount = products.filter(p => p.stock <= p.minStockAlert).length;

  return {
    totalSales,
    totalExpenses,
    profit,
    customerCount,
    lowStockCount
  };
}

// Clear Session / Seeding Code
function seedDemoDataForTenant(tenantId: string) {
  // Pre-configured Customers
  const customerList = [
    { name: 'Al-Khaleej Trading Corp', email: 'billing@alkhaleej.ae', phone: '+971 4 394 1029', address: 'Sheikh Zayed Road, Floor 14, Al Safa Tower, Dubai' },
    { name: 'E-Commerce Tech Center', email: 'sales@ecommercetec.com', phone: '+1 (321) 405-2094', address: '492 Tech Plaza, Seattle, WA' },
    { name: 'Global Retail Syndicate', email: 'vendors@globalretail.in', phone: '+91 22 4920 3041', address: 'Juhu Tara Rd, Santacruz West, Mumbai, Maharashtra' }
  ];
  
  const savedCustomers: Customer[] = [];
  customerList.forEach((c, index) => {
    const nextId = `CUS-${String(index + 1).padStart(4, '0')}`;
    const newItem: Customer = {
      id: nextId,
      tenantId,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      createdAt: new Date().toISOString(),
      isApproved: true
    };
    savedCustomers.push(newItem);
    saveTenantData(KEYS.CUSTOMERS, tenantId, newItem, true);
  });

  // Pre-configured Products
  const productList = [
    { name: 'Enterprise Cloud Server Lic', sku: 'SVR-CLD-ENT', description: 'Enterprise Server Core license block, valid for 12 months subscription.', price: 1200, cost: 450, stock: 15, minStockAlert: 5 },
    { name: 'Super Ergonomic Office Chair', sku: 'CHR-ERG-900', description: 'Polished chrome frame, premium high-back mesh chair with lumbar alignment tools.', price: 350, cost: 180, stock: 40, minStockAlert: 10 },
    { name: 'Dual 4K IPS Monitor Display', sku: 'MON-4K-DL', description: 'Ultra widescreen dual multi-input IPS display monitors, extreme sRGB coverage.', price: 650, cost: 380, stock: 3, minStockAlert: 5 },
    { name: 'Premium Aluminum Desk Hub', sku: 'HUB-USB-12', description: 'Thunderbolt 4 expansion dock with dual HDMI charging, ethernet lines, multi-USB slots.', price: 120, cost: 50, stock: 12, minStockAlert: 15 }
  ];

  const savedProducts: Product[] = [];
  productList.forEach((p, index) => {
    const nextId = `PRD-${String(index + 1).padStart(4, '0')}`;
    const newItem: Product = {
      id: nextId,
      tenantId,
      name: p.name,
      sku: p.sku,
      description: p.description,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      minStockAlert: p.minStockAlert,
      createdAt: new Date().toISOString()
    };
    savedProducts.push(newItem);
    saveTenantData(KEYS.PRODUCTS, tenantId, newItem, true);
  });

  // Let's seed Expenses across the last 5 Months (to build nice graphs)
  const expenseLogs = [
    { amount: 1500, category: 'Salaries', date: '2026-01-15', description: 'Core team payroll distribution', recipient: 'Staff Payroll Services' },
    { amount: 600, category: 'Rent', date: '2026-02-01', description: 'Desk space facility rental dues', recipient: 'WeWork Office Co' },
    { amount: 120, category: 'Utilities', date: '2026-02-18', description: 'High-speed Fiber optic connection', recipient: 'AT&T Business' },
    { amount: 350, category: 'Marketing', date: '2026-03-05', description: 'Social Media target ads campaign', recipient: 'Meta Platform Ads' },
    { amount: 540, category: 'Inventory Purchase', date: '2026-04-12', description: 'Purchase 3 units of MON-4K-DL display chairs', recipient: 'Wholesale Warehousing' },
    { amount: 1500, category: 'Salaries', date: '2026-05-10', description: 'Staff payroll disbursement', recipient: 'Staff Payroll' },
    { amount: 180, category: 'Operations', date: '2026-05-19', description: 'Cloud backups and firewall keys', recipient: 'Google Cloud Platform' }
  ];

  expenseLogs.forEach(exp => {
    const newItem: Expense = {
      id: 'exp-' + Math.random().toString(36).substring(2, 9),
      tenantId,
      amount: exp.amount,
      category: exp.category,
      date: exp.date,
      description: exp.description,
      recipient: exp.recipient,
      createdAt: new Date().toISOString()
    };
    saveTenantData(KEYS.EXPENSES, tenantId, newItem, true);
  });

  // Let's seed Sales across the last 5 Months (for realistic charts)
  const salesHistory = [
    { customerName: 'Al-Khaleej Trading Corp', date: '2026-01-22', amount: 2400, category: 'Product Sales', description: '2 units of Enterprise Cloud Server Lic', paymentMethod: 'bank' as const },
    { customerName: 'John Doe Logistics Ltd', date: '2026-02-11', amount: 700, category: 'Product Sales', description: '2 units of Super Ergonomic Office Chair', paymentMethod: 'card' as const },
    { customerName: 'E-Commerce Tech Center', date: '2026-03-15', amount: 350, category: 'Consulting', description: 'On-site database integration consulting session', paymentMethod: 'cash' as const },
    { customerName: 'Global Retail Syndicate', date: '2026-04-02', amount: 1950, category: 'Product Sales', description: '3 units of Dual 4K IPS Monitor Display', paymentMethod: 'bank' as const },
    { customerName: 'Al-Khaleej Trading Corp', date: '2026-05-04', amount: 1200, category: 'Product Sales', description: '1 unit of Enterprise Cloud Server Lic', paymentMethod: 'bank' as const },
    { customerName: 'E-Commerce Tech Center', date: '2026-05-18', amount: 480, category: 'Product Sales', description: '4 units of Premium Aluminum Desk Hub', paymentMethod: 'card' as const }
  ];

  salesHistory.forEach(s => {
    const newItem: Sale = {
      id: 'sale-' + Math.random().toString(36).substring(2, 9),
      tenantId,
      customerName: s.customerName,
      date: s.date,
      amount: s.amount,
      category: s.category,
      description: s.description,
      paymentMethod: s.paymentMethod,
      createdAt: new Date().toISOString()
    };
    saveTenantData(KEYS.SALES, tenantId, newItem, true);
  });

  // Let's also create 2 Sample Invoices (1 Paid, 1 Unpaid)
  const invoicesList = [
    {
      id: 'INV-2026-0001',
      invoiceNumber: 'INV-2026-0001',
      customerId: savedCustomers[0].id,
      customerName: savedCustomers[0].name,
      date: '2026-05-04',
      dueDate: '2026-05-25',
      items: [
        { productId: savedProducts[0].id, productName: savedProducts[0].name, quantity: 1, price: savedProducts[0].price, total: savedProducts[0].price }
      ],
      subtotal: 1200,
      taxRate: 15,
      taxAmount: 180,
      discount: 0,
      total: 1380,
      notes: 'Please quote Invoice INV-2026-0001 in bank telegraphic transfers.',
      status: 'paid' as const
    },
    {
      id: 'INV-2026-0002',
      invoiceNumber: 'INV-2026-0002',
      customerId: savedCustomers[1].id,
      customerName: savedCustomers[1].name,
      date: '2026-05-18',
      dueDate: '2026-06-02',
      items: [
        { productId: savedProducts[3].id, productName: savedProducts[3].name, quantity: 2, price: savedProducts[3].price, total: savedProducts[3].price * 2 },
        { productId: savedProducts[1].id, productName: savedProducts[1].name, quantity: 1, price: savedProducts[1].price, total: savedProducts[1].price }
      ],
      subtotal: 240 + 350, // 590
      taxRate: 15,
      taxAmount: 88.5,
      discount: 20,
      total: 658.5,
      notes: 'Deliver chairs to secondary receiving loading dock.',
      status: 'unpaid' as const
    }
  ];

  invoicesList.forEach(inv => {
    const newItem: Invoice = {
      ...inv,
      tenantId,
      createdAt: new Date().toISOString()
    };
    saveTenantData(KEYS.INVOICES, tenantId, newItem, true);
  });
}

// Support Chats & Messaging Helpers
export function getSupportChats(): ChatMessage[] {
  return getStorageArray<ChatMessage>(KEYS.SUPPORT_CHATS);
}

export function addChatMessage(
  senderEmail: string,
  senderName: string,
  receiverEmail: string,
  text: string
): ChatMessage {
  const chats = getSupportChats();
  const newMsg: ChatMessage = {
    id: 'msg-' + Math.random().toString(36).substring(2, 9),
    senderEmail,
    senderName,
    receiverEmail,
    text,
    timestamp: new Date().toISOString(),
    isRead: false
  };
  chats.push(newMsg);
  setStorageArray(KEYS.SUPPORT_CHATS, chats);
  return newMsg;
}

export function markChatAsRead(senderEmail: string, receiverEmail: string): void {
  const chats = getSupportChats();
  let updated = false;
  chats.forEach(msg => {
    // Mark as read if we received this from the senderEmail
    if (msg.senderEmail === senderEmail && msg.receiverEmail === receiverEmail && !msg.isRead) {
      msg.isRead = true;
      updated = true;
    }
  });
  if (updated) {
    setStorageArray(KEYS.SUPPORT_CHATS, chats);
  }
}

// Active User Sessions Helpers
export function getActiveSessions(): ActiveSession[] {
  clearStaleSessions();
  return getStorageArray<ActiveSession>(KEYS.ACTIVE_SESSIONS);
}

export function updateActiveSession(
  userId: string,
  email: string,
  companyName: string,
  activeModule: string,
  ipAddress?: string,
  userAgent?: string,
  deviceInfo?: string
): void {
  let sessions = getActiveSessions();
  const now = new Date();
  
  // Prune sessions that haven't updated in 5 minutes (300000 ms) to clean database size
  sessions = sessions.filter(session => {
    try {
      const lastTime = new Date(session.lastActiveTime).getTime();
      return (now.getTime() - lastTime) < 300000;
    } catch {
      return false;
    }
  });

  const idx = sessions.findIndex(s => s.userId === userId && s.email === email);
  
  const activeIp = ipAddress || '192.168.1.84';
  const activeUa = userAgent || (typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown OS');
  
  let detectedDevice = deviceInfo || 'Desktop Browser';
  if (activeUa.includes('Mobi') || activeUa.includes('Android') || activeUa.includes('iPhone')) {
    detectedDevice = 'Mobile App / Phone';
  } else if (activeUa.includes('Mac')) {
    detectedDevice = 'macOS workstation';
  } else if (activeUa.includes('Win')) {
    detectedDevice = 'Windows 11 Workstation';
  } else if (activeUa.includes('Linux')) {
    detectedDevice = 'Linux System';
  }

  const updatedSession: ActiveSession = {
    userId,
    email,
    companyName,
    activeModule: activeModule || 'Dashboard',
    lastActiveTime: now.toISOString(),
    ipAddress: activeIp,
    userAgent: activeUa,
    deviceInfo: detectedDevice
  };

  if (idx !== -1) {
    sessions[idx] = updatedSession;
  } else {
    sessions.push(updatedSession);
  }

  setStorageArray(KEYS.ACTIVE_SESSIONS, sessions);
}

export function clearStaleSessions(): void {
  let sessions = getStorageArray<ActiveSession>(KEYS.ACTIVE_SESSIONS);
  const now = new Date();
  const filtered = sessions.filter(session => {
    try {
      const lastTime = new Date(session.lastActiveTime).getTime();
      return (now.getTime() - lastTime) < 300000;
    } catch {
      return false;
    }
  });
  if (filtered.length !== sessions.length) {
    setStorageArray(KEYS.ACTIVE_SESSIONS, filtered);
  }
}

// Purchase Records database operations
export function getPurchases(tenantId: string): PurchaseRecord[] {
  const list = getStorageArray<PurchaseRecord>(KEYS.PURCHASES);
  return list.filter(item => item.tenantId === tenantId);
}

export function addPurchase(tenantId: string, data: Omit<PurchaseRecord, 'id' | 'tenantId' | 'createdAt'>): PurchaseRecord {
  const list = getStorageArray<PurchaseRecord>(KEYS.PURCHASES);
  const newId = 'pur-' + Date.now() + Math.random().toString(36).substring(2, 7);
  const nowStr = new Date().toISOString();
  
  const newItem: PurchaseRecord = {
    ...data,
    id: newId,
    tenantId,
    createdAt: nowStr
  };
  
  list.push(newItem);
  setStorageArray(KEYS.PURCHASES, list);
  
  // High craftsmanship: automatically adjust product inventory stock when merchandise is purchased from supplier
  if (data.sku) {
    const products = getProducts(tenantId);
    const matchedIdx = products.findIndex(p => p.sku === data.sku);
    if (matchedIdx !== -1) {
      products[matchedIdx].stock += Math.max(0, data.quantity);
      editProduct(tenantId, products[matchedIdx]);
    }
  }

  triggerServerSync();
  return newItem;
}

export function deletePurchase(tenantId: string, id: string): void {
  const list = getStorageArray<PurchaseRecord>(KEYS.PURCHASES);
  const index = list.findIndex(item => item.tenantId === tenantId && item.id === id);
  if (index !== -1) {
    const purchase = list[index];
    list.splice(index, 1);
    setStorageArray(KEYS.PURCHASES, list);

    // Rollback stock if deleted? Yes! If we cancel/delete a supplier purchase, reduce the product SKU stock accordingly.
    if (purchase.sku) {
      const products = getProducts(tenantId);
      const matchedIdx = products.findIndex(p => p.sku === purchase.sku);
      if (matchedIdx !== -1) {
        products[matchedIdx].stock = Math.max(0, products[matchedIdx].stock - purchase.quantity);
        editProduct(tenantId, products[matchedIdx]);
      }
    }

    triggerServerSync();
  }
}

export function editPurchase(tenantId: string, item: PurchaseRecord): void {
  const list = getStorageArray<PurchaseRecord>(KEYS.PURCHASES);
  const idx = list.findIndex(r => r.tenantId === tenantId && r.id === item.id);
  if (idx !== -1) {
    const prev = list[idx];
    list[idx] = item;
    setStorageArray(KEYS.PURCHASES, list);

    // Recalculate stock adjustments
    if (item.sku) {
      const products = getProducts(tenantId);
      const matchedIdx = products.findIndex(p => p.sku === item.sku);
      if (matchedIdx !== -1) {
        // Remove previous difference, add new difference
        const difference = item.quantity - prev.quantity;
        products[matchedIdx].stock = Math.max(0, products[matchedIdx].stock + difference);
        editProduct(tenantId, products[matchedIdx]);
      }
    }

    triggerServerSync();
  }
}

export function resetTenantData(tenantId: string): void {
  // Wipe sales
  let sales = getStorageArray<Sale>(KEYS.SALES);
  sales = sales.filter(s => s.tenantId !== tenantId);
  setStorageArray(KEYS.SALES, sales);

  // Wipe expenses
  let expenses = getStorageArray<Expense>(KEYS.EXPENSES);
  expenses = expenses.filter(e => e.tenantId !== tenantId);
  setStorageArray(KEYS.EXPENSES, expenses);

  // Wipe purchases
  let purchases = getStorageArray<PurchaseRecord>(KEYS.PURCHASES);
  purchases = purchases.filter(p => p.tenantId !== tenantId);
  setStorageArray(KEYS.PURCHASES, purchases);

  // Wipe invoices
  let invoices = getStorageArray<Invoice>(KEYS.INVOICES);
  invoices = invoices.filter(i => i.tenantId !== tenantId);
  setStorageArray(KEYS.INVOICES, invoices);

  // Wipe customers
  let customers = getStorageArray<Customer>(KEYS.CUSTOMERS);
  customers = customers.filter(c => c.tenantId !== tenantId);
  setStorageArray(KEYS.CUSTOMERS, customers);

  // Wipe products
  let products = getStorageArray<Product>(KEYS.PRODUCTS);
  products = products.filter(p => p.tenantId !== tenantId);
  setStorageArray(KEYS.PRODUCTS, products);

  // Optional: Seed a clean, default product for illustration or leave empty. We leave empty so they get a pure reset!
  
  triggerServerSync();
}

/**
 * Ultra-robust lookup of a business tenant by short code, ID, email, or company name
 */
export function resolveTenantByCode(inputCode: string, tenants: UserTenant[]): UserTenant | null {
  if (!inputCode) return null;
  
  // Resiliently sanitise the code input:
  // - trim spaces, linebreaks, tabs
  // - remove any leading '#' or '?' or '/'
  // - strip standard prefix words like 'OMNI-' or 'TENANT-' case-insensitively
  // - strip standard prefix words like 'OMNI', 'TENANT' optionally followed by non-alphanumeric characters
  const cleanInput = inputCode
    .trim()
    .replace(/^[\s#?\/]+/, '') // strip prepended hashes, search metrics, or url paths
    .replace(/\s+/g, '')
    .replace(/^(OMNI-|TENANT-)/i, '')
    .replace(/^(OMNI|TENANT)/i, '')
    .toLowerCase();

  // 1. Direct short-code match (e.g. t7tyfjf matches "tenant-t7tyfjf")
  for (const t of tenants) {
    const cleanId = t.id.replace(/^tenant-/i, '').toLowerCase();
    if (cleanId === cleanInput) {
      return t;
    }
  }

  // 2. Exact match against database id (case-insensitive)
  for (const t of tenants) {
    if (t.id.toLowerCase() === inputCode.trim().toLowerCase()) {
      return t;
    }
    if (t.id.toLowerCase().replace(/\s+/g, '') === inputCode.trim().toLowerCase().replace(/\s+/g, '')) {
      return t;
    }
  }

  // 3. Match against email address (case-insensitive)
  for (const t of tenants) {
    if (t.email.toLowerCase() === inputCode.trim().toLowerCase()) {
      return t;
    }
  }

  // 4. Fuzzy match against company name (alphanumeric only)
  const cleanInputText = inputCode.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanInputText.length >= 3) {
    for (const t of tenants) {
      const cleanCompany = t.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanCompany === cleanInputText) {
        return t;
      }
    }
  }

  return null;
}

// ==========================================
// CUSTOMER PAYMENTS DATABASE OPERATIONS
// ==========================================
export function getCustomerPayments(tenantId: string, customerId?: string): CustomerPayment[] {
  const list = getStorageArray<CustomerPayment>(KEYS.CUSTOMER_PAYMENTS || 'biz_suite_customer_payments');
  const tenantList = list.filter(item => item.tenantId === tenantId);
  if (customerId) {
    return tenantList.filter(item => item.customerId === customerId);
  }
  return tenantList;
}

export function addCustomerPayment(tenantId: string, data: Omit<CustomerPayment, 'id' | 'tenantId' | 'createdAt'>): CustomerPayment {
  const list = getStorageArray<CustomerPayment>(KEYS.CUSTOMER_PAYMENTS || 'biz_suite_customer_payments');
  const newId = 'pay-' + Date.now() + Math.random().toString(36).substring(2, 7);
  const nowStr = new Date().toISOString();
  
  const newItem: CustomerPayment = {
    ...data,
    id: newId,
    tenantId,
    createdAt: nowStr
  };
  
  list.push(newItem);
  setStorageArray(KEYS.CUSTOMER_PAYMENTS || 'biz_suite_customer_payments', list);
  triggerServerSync();
  return newItem;
}

export function deleteCustomerPayment(tenantId: string, id: string): void {
  const list = getStorageArray<CustomerPayment>(KEYS.CUSTOMER_PAYMENTS || 'biz_suite_customer_payments');
  const idx = list.findIndex(item => item.tenantId === tenantId && item.id === id);
  if (idx !== -1) {
    list.splice(idx, 1);
    setStorageArray(KEYS.CUSTOMER_PAYMENTS || 'biz_suite_customer_payments', list);
    triggerServerSync();
  }
}

// ==========================================
// CUSTOMER RETURNS DATABASE OPERATIONS
// ==========================================
export function getCustomerReturns(tenantId: string, customerId?: string): CustomerReturn[] {
  const list = getStorageArray<CustomerReturn>(KEYS.CUSTOMER_RETURNS || 'biz_suite_customer_returns');
  const tenantList = list.filter(item => item.tenantId === tenantId);
  if (customerId) {
    return tenantList.filter(item => item.customerId === customerId);
  }
  return tenantList;
}

export function addCustomerReturn(tenantId: string, data: Omit<CustomerReturn, 'id' | 'tenantId' | 'createdAt'>): CustomerReturn {
  const list = getStorageArray<CustomerReturn>(KEYS.CUSTOMER_RETURNS || 'biz_suite_customer_returns');
  const newId = 'ret-' + Date.now() + Math.random().toString(36).substring(2, 7);
  const nowStr = new Date().toISOString();
  
  const newItem: CustomerReturn = {
    ...data,
    id: newId,
    tenantId,
    createdAt: nowStr
  };
  
  list.push(newItem);
  setStorageArray(KEYS.CUSTOMER_RETURNS || 'biz_suite_customer_returns', list);
  
  // Dynamic feature: automatically adjust stock upward when items are returned
  data.items.forEach(returnItem => {
    if (returnItem.productId) {
      const products = getProducts(tenantId);
      const matchedIdx = products.findIndex(p => p.id === returnItem.productId);
      if (matchedIdx !== -1) {
        products[matchedIdx].stock += Math.max(0, returnItem.quantity);
        editProduct(tenantId, products[matchedIdx]);
      }
    }
  });

  triggerServerSync();
  return newItem;
}

export function deleteCustomerReturn(tenantId: string, id: string): void {
  const list = getStorageArray<CustomerReturn>(KEYS.CUSTOMER_RETURNS || 'biz_suite_customer_returns');
  const idx = list.findIndex(item => item.tenantId === tenantId && item.id === id);
  if (idx !== -1) {
    const returnRecord = list[idx];
    list.splice(idx, 1);
    setStorageArray(KEYS.CUSTOMER_RETURNS || 'biz_suite_customer_returns', list);

    // Rollback stock adjustment: deduct returned items from stock inventory
    returnRecord.items.forEach(returnItem => {
      if (returnItem.productId) {
        const products = getProducts(tenantId);
        const matchedIdx = products.findIndex(p => p.id === returnItem.productId);
        if (matchedIdx !== -1) {
          products[matchedIdx].stock = Math.max(0, products[matchedIdx].stock - returnItem.quantity);
          editProduct(tenantId, products[matchedIdx]);
        }
      }
    });

    triggerServerSync();
  }
}


