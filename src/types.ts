export type Language = 'en' | 'ar' | 'ur' | 'bn' | 'hi';
export type Currency = 'AED' | 'USD' | 'PKR' | 'INR' | 'SAR' | 'EUR';

export interface UserTenant {
  id: string;
  email: string;
  passwordSha: string; // Plaintext for local client-side multitenancy database
  companyName: string;
  currency: Currency;
  language: Language;
  taxRate: number; // percentage, e.g., 5 for 5%
  taxNumber?: string;
  phone?: string;
  address?: string;
  invoicePrefix?: string;
  invoiceNotes?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
  subscriptionStatus?: 'active' | 'inactive' | 'expired';
  subscriptionExpiry?: string;
  createdAt?: string;
  logoUrl?: string; // Base64 or URL company logo
  subscriptionPlan?: 'Free' | 'Basic' | 'Pro'; // Subscription plans
  paymentStatus?: 'Paid' | 'Unpaid' | 'Pending'; // Payment status
  bannedModules?: string[]; // Module access restrictions
  allowedHoursStart?: string; // "HH:MM" start limit
  allowedHoursEnd?: string; // "HH:MM" end limit
  tempSuspendedUntil?: string; // ISO date format suspension expiry
  isApproved?: boolean; // Super admin approval status
  lastLoginTime?: string; // Last login timestamp
  isGuestPass?: boolean; // 24-hour guest visitor pass flag
  guestExpiresAt?: string; // ISO timestamp when 24-hour visitor access expires
  guestUpgradeRequested?: boolean; // When 24h visitor requests Super Admin permission for permanent upgrade
  guestUpgradeRequestedAt?: string; // Timestamp when permanent access was requested
  guestUpgradeNotes?: string; // Notes/contact details supplied by visitor during request
}

export interface CustomInvite {
  id: string; // Token ID, e.g. inv-xxxxxxxx
  email: string;
  companyName?: string;
  phone?: string;
  durationLabel: string; // e.g. "24 Hours", "7 Days", "30 Days", "1 Year", "Permanent"
  expiresAt?: string; // ISO date/time string or undefined for permanent
  allowedHoursStart?: string;
  allowedHoursEnd?: string;
  isPermanent: boolean;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'used' | 'revoked' | 'expired';
  usedAt?: string;
  usedByTenantId?: string;
}

export interface ChatMessage {
  id: string;
  senderEmail: string;
  senderName: string;
  receiverEmail: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface ActiveSession {
  userId: string;
  email: string;
  companyName: string;
  activeModule: string;
  lastActiveTime: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  isBlocked?: boolean; // Block/Unblock customer access
  isApproved?: boolean; // Self-registered customers are pending until approved by merchant
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  minStockAlert: number;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  notes: string;
  status: 'paid' | 'unpaid' | 'overdue';
  paymentMethod?: 'cash' | 'card' | 'bank' | 'credit' | 'other';
  createdAt: string;
}

export interface Sale {
  id: string;
  tenantId: string;
  invoiceId?: string; // Optional reference to invoice
  customerId?: string; // Optional linked customer ID
  customerName: string;
  date: string;
  amount: number; // Grand total amount
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: number;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  isTaxEnabled?: boolean;
  category: string;
  description: string;
  paymentMethod: 'cash' | 'card' | 'bank' | 'credit' | 'other';
  createdAt: string;
  items?: InvoiceItem[]; // Line items for cart-based POS
  receiptNumber?: string; // Sequential receipt/invoice tracking number
  isCredit?: boolean; // Whether recorded as Udhaar / Credit
}

export interface Expense {
  id: string;
  tenantId: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  recipient: string;
  createdAt: string;
}

export interface PurchaseRecord {
  id: string;
  tenantId: string;
  supplierName: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  date: string;
  paymentStatus: 'paid' | 'unpaid' | 'pending';
  paymentMethod: 'cash' | 'card' | 'bank' | 'other';
  createdAt: string;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  type: 'merchant' | 'customer';
  targetId: string; // Tenant ID or Customer ID
  name: string;
  email: string;
  action: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface DashboardStats {
  totalSales: number;
  totalExpenses: number;
  profit: number;
  customerCount: number;
  lowStockCount: number;
}

export interface CustomerPayment {
  id: string;
  tenantId: string;
  customerId: string;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'card' | 'bank' | 'other';
  referenceNote?: string;
  createdAt: string;
}

export interface CustomerReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface CustomerReturn {
  id: string;
  tenantId: string;
  customerId: string;
  date: string;
  items: CustomerReturnItem[];
  totalAmount: number;
  notes?: string;
  createdAt: string;
}

