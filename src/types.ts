export type Language = 'en' | 'ar' | 'ur' | 'hi';
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
  paymentMethod?: 'cash' | 'card' | 'bank' | 'other';
  createdAt: string;
}

export interface Sale {
  id: string;
  tenantId: string;
  invoiceId?: string; // Optional reference to invoice
  customerName: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  paymentMethod: 'cash' | 'card' | 'bank' | 'other';
  createdAt: string;
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
