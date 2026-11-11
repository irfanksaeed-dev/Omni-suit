import React, { useState, useEffect, useRef } from 'react';
import { UserTenant, Sale, InvoiceItem, Product, Customer, Invoice } from '../types';
import { translations, currencySymbols } from '../translations';
import { 
  getSales, addSale, editSale, deleteSale, 
  getCustomers, getInvoices, addInvoice, addCustomer, 
  getProducts, editProduct, getNextInvoiceId 
} from '../db';
import { 
  Plus, Search, Trash2, Calendar, FileSpreadsheet, DollarSign, 
  Filter, ReceiptText, ShoppingCart, ShoppingBag, CreditCard, 
  ChevronRight, Check, AlertTriangle, Minus, Tag, Edit2, 
  Info, X, User, Mail, Send, ExternalLink, Percent, 
  Printer, CheckCircle2, ArrowRight, RefreshCw, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import { jsPDF } from 'jspdf';
import { cleanPhoneForWhatsApp, getDefaultPhoneCode } from '../utils/phone';
import { getBaseAppUrl, copyTextToClipboard, openExternalLink } from '../utils/links';

interface SalesModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function SalesModule({ user, onRefreshStats }: SalesModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency] || '$';

  const [sales, setSales] = useState<Sale[]>(() => getSales(user.id));
  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers(user.id));
  const [allInvoices, setAllInvoices] = useState<Invoice[]>(() => getInvoices(user.id));
  const [products, setProducts] = useState<Product[]>(() => getProducts(user.id));
  
  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [receiptSuccessSale, setReceiptSuccessSale] = useState<Sale | null>(null);
  const [oversellConfirmModal, setOversellConfirmModal] = useState<{ isOpen: boolean; onConfirm: () => void; items: { name: string; requested: number; available: number }[] }>({
    isOpen: false,
    onConfirm: () => {},
    items: []
  });

  // POS Add Sale Form State
  const [saleType, setSaleType] = useState<'itemized' | 'simple'>('itemized');
  const [basket, setBasket] = useState<InvoiceItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [customerMode, setCustomerMode] = useState<'walkin' | 'saved' | 'new'>('walkin');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('Walk-In Customer');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Product Sales');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank' | 'credit' | 'other'>('cash');
  const [invoiceId, setInvoiceId] = useState('');

  // Discount & Tax calculations
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [isVatEnabled, setIsVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState(user.taxRate ? user.taxRate.toString() : '5');
  const [directAmount, setDirectAmount] = useState('');

  // Edit Sale Form State
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerId, setEditCustomerId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Product Sales');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card' | 'bank' | 'credit' | 'other'>('cash');
  const [editSaleType, setEditSaleType] = useState<'itemized' | 'simple'>('itemized');
  const [editBasket, setEditBasket] = useState<InvoiceItem[]>([]);
  const [editDiscountType, setEditDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [editDiscountValue, setEditDiscountValue] = useState('0');
  const [editIsVatEnabled, setEditIsVatEnabled] = useState(true);
  const [editVatRate, setEditVatRate] = useState('5');
  const [searchEditProductQuery, setSearchEditProductQuery] = useState('');

  // Sharing states for detail/receipt modal
  const [sharingPhone, setSharingPhone] = useState('');
  const [sharingEmail, setSharingEmail] = useState('');

  const lastOpenedSaleIdRef = useRef<string | null>(null);

  // Sync sharing info when detail sale changes
  useEffect(() => {
    const targetSale = receiptSuccessSale || detailSale;
    if (targetSale) {
      if (targetSale.id !== lastOpenedSaleIdRef.current) {
        lastOpenedSaleIdRef.current = targetSale.id;
        const match = customers.find(c => 
          (targetSale.customerId && c.id === targetSale.customerId) ||
          c.name.toLowerCase() === targetSale.customerName.toLowerCase()
        );
        if (match) {
          setSharingPhone(match.phone || '');
          setSharingEmail(match.email || '');
        } else {
          setSharingPhone('');
          setSharingEmail('');
        }
      }
    } else {
      lastOpenedSaleIdRef.current = null;
    }
  }, [detailSale, receiptSuccessSale, customers]);

  // Handle DB refresh
  const handleRefresh = () => {
    const list = getSales(user.id);
    setSales(list);
    setCustomers(getCustomers(user.id));
    setAllInvoices(getInvoices(user.id));
    setProducts(getProducts(user.id));
    onRefreshStats();
    setDetailSale(prev => {
      if (!prev) return null;
      return list.find(s => s.id === prev.id) || null;
    });
  };

  useEffect(() => {
    window.addEventListener('db-update', handleRefresh);
    return () => {
      window.removeEventListener('db-update', handleRefresh);
    };
  }, []);

  // When payment method changes to credit, enforce non-walkin customer
  useEffect(() => {
    if (paymentMethod === 'credit' && customerMode === 'walkin') {
      setCustomerMode('saved');
      setCustomerName('');
    }
  }, [paymentMethod, customerMode]);

  // Calculate live POS subtotal, discount, VAT, and grand total
  const basketSubtotal = basket.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  const calculatedDiscount = (() => {
    const rawVal = parseFloat(discountValue) || 0;
    if (rawVal <= 0) return 0;
    if (discountType === 'percentage') {
      return (basketSubtotal * Math.min(100, rawVal)) / 100;
    }
    return Math.min(basketSubtotal, rawVal);
  })();

  const subtotalAfterDiscount = Math.max(0, basketSubtotal - calculatedDiscount);
  const activeTaxRate = isVatEnabled ? (parseFloat(vatRate) || 0) : 0;
  const calculatedVatAmount = isVatEnabled ? ((subtotalAfterDiscount * activeTaxRate) / 100) : 0;
  const calculatedGrandTotal = Math.max(0, subtotalAfterDiscount + calculatedVatAmount);

  // Edit basket calculations
  const editBasketSubtotal = editBasket.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const editCalculatedDiscount = (() => {
    const rawVal = parseFloat(editDiscountValue) || 0;
    if (rawVal <= 0) return 0;
    if (editDiscountType === 'percentage') {
      return (editBasketSubtotal * Math.min(100, rawVal)) / 100;
    }
    return Math.min(editBasketSubtotal, rawVal);
  })();
  const editSubtotalAfterDiscount = Math.max(0, editBasketSubtotal - editCalculatedDiscount);
  const editActiveTaxRate = editIsVatEnabled ? (parseFloat(editVatRate) || 0) : 0;
  const editCalculatedVatAmount = editIsVatEnabled ? ((editSubtotalAfterDiscount * editActiveTaxRate) / 100) : 0;
  const editCalculatedGrandTotal = Math.max(0, editSubtotalAfterDiscount + editCalculatedVatAmount);

  // Basket Handlers
  const handleAddToBasket = (prod: Product) => {
    const existing = basket.find(item => item.productId === prod.id);
    if (existing) {
      setBasket(basket.map(item => {
        if (item.productId === prod.id) {
          const nextQty = item.quantity + 1;
          return {
            ...item,
            quantity: nextQty,
            total: nextQty * item.price
          };
        }
        return item;
      }));
    } else {
      const newItem: InvoiceItem = {
        productId: prod.id,
        productName: prod.name,
        quantity: 1,
        price: prod.price,
        total: prod.price
      };
      setBasket([...basket, newItem]);
    }
  };

  const handleUpdateBasketQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromBasket(productId);
      return;
    }
    setBasket(basket.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          quantity: newQty,
          total: newQty * item.price
        };
      }
      return item;
    }));
  };

  const handleUpdateBasketPrice = (productId: string, newPrice: number) => {
    const safePrice = Math.max(0, newPrice);
    setBasket(basket.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          price: safePrice,
          total: item.quantity * safePrice
        };
      }
      return item;
    }));
  };

  const handleRemoveFromBasket = (productId: string) => {
    setBasket(basket.filter(item => item.productId !== productId));
  };

  // Edit Basket Handlers
  const handleAddToEditBasket = (prod: Product) => {
    const existing = editBasket.find(item => item.productId === prod.id);
    if (existing) {
      setEditBasket(editBasket.map(item => {
        if (item.productId === prod.id) {
          const nextQty = item.quantity + 1;
          return {
            ...item,
            quantity: nextQty,
            total: nextQty * item.price
          };
        }
        return item;
      }));
    } else {
      const newItem: InvoiceItem = {
        productId: prod.id,
        productName: prod.name,
        quantity: 1,
        price: prod.price,
        total: prod.price
      };
      setEditBasket([...editBasket, newItem]);
    }
  };

  const handleUpdateEditBasketQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setEditBasket(editBasket.filter(item => item.productId !== productId));
      return;
    }
    setEditBasket(editBasket.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          quantity: newQty,
          total: newQty * item.price
        };
      }
      return item;
    }));
  };

  const handleUpdateEditBasketPrice = (productId: string, newPrice: number) => {
    const safePrice = Math.max(0, newPrice);
    setEditBasket(editBasket.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          price: safePrice,
          total: item.quantity * safePrice
        };
      }
      return item;
    }));
  };

  // Helper for QR code generation
  const getQRCodeBase64 = (inv: any, companyName: string, taxNumber: string, currSymbol: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const qrDataPayload = [
        `Seller: ${companyName}`,
        `VAT Ref: ${taxNumber || 'N/A'}`,
        `No: ${inv.invoiceNumber}`,
        `Date: ${inv.date}`,
        `Total: ${currSymbol}${inv.total.toFixed(2)}`,
        `VAT Amount: ${currSymbol}${inv.taxAmount.toFixed(2)}`,
        `Verification Ref: TX-${inv.id.substring(0, 8).toUpperCase()}`
      ].join('\n');
      
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(qrDataPayload)}`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            resolve(canvas.toDataURL('image/png'));
            return;
          } catch (e) {
            console.error("Failed to convert preloaded QR code to data URL:", e);
          }
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  // PDF Generation function for Receipts / Invoices
  const downloadInvoicePDF = (inv: Invoice, qrCodeBase64: string | null) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const primaryColor = [79, 70, 229]; // Indigo
      const darkNeutral = [30, 41, 59];  // Slate 800
      const lightNeutral = [241, 245, 249]; // Slate 100
      const grayText = [100, 116, 139];   // Slate 500

      const drawDivider = (y: number) => {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, y, 195, y);
      };

      // Top band branding strip
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 10, 'F');

      // Company header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text((user.companyName || 'Business Name').toUpperCase(), 15, 22);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      const addressLine = `${user.address || 'Company Administrative Address'}`;
      const contactLine = `Phone: ${user.phone || 'Phone Contact'} | Email: ${user.email || ''}`;
      doc.text(addressLine, 15, 28);
      doc.text(contactLine, 15, 33);
      if (user.taxNumber) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(`TRN / Tax Ref: ${user.taxNumber}`, 15, 38);
      }

      // QR Code
      if (qrCodeBase64) {
        try {
          doc.addImage(qrCodeBase64, 'PNG', 115, 12, 28, 28, undefined, 'FAST');
        } catch (e) {
          console.error("Failed to add QR to PDF:", e);
        }
      }

      // Title & Reference
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('TAX INVOICE / RECEIPT', 195, 20, { align: 'right' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text(`Receipt/Inv No: ${inv.invoiceNumber}`, 195, 26, { align: 'right' });
      doc.text(`Date: ${inv.date}`, 195, 31, { align: 'right' });
      if (inv.dueDate) {
        doc.text(`Due Date: ${inv.dueDate}`, 195, 36, { align: 'right' });
      }

      drawDivider(48);

      // Customer section
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('CUSTOMER / BILLED TO', 15, 56);

      const custMeta = customers.find(c => c.id === inv.customerId);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text(inv.customerName, 15, 62);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      if (custMeta) {
        let yOffset = 67;
        if (custMeta.phone) { doc.text(`Phone: ${custMeta.phone}`, 15, yOffset); yOffset += 5; }
        if (custMeta.email) { doc.text(`Email: ${custMeta.email}`, 15, yOffset); yOffset += 5; }
        if (custMeta.address) { doc.text(`Address: ${custMeta.address}`, 15, yOffset); yOffset += 5; }
      } else if (inv.customerId === 'walk-in') {
        doc.text('Counter Walk-In Customer', 15, 67);
      } else {
        doc.text('Client Profile', 15, 67);
      }

      // Status indicator
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('PAYMENT STATUS', 150, 56);
      
      doc.setFontSize(11);
      const amtPaid = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
      const balDue = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);

      if (inv.status === 'paid') {
        doc.setTextColor(16, 185, 129); // Green
        doc.text('PAID IN FULL', 150, 62);
        if (inv.paymentMethod) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(grayText[0], grayText[1], grayText[2]);
          doc.text(`Via: ${inv.paymentMethod.toUpperCase()}`, 150, 67);
        }
      } else if (inv.paymentMethod === 'credit') {
        doc.setTextColor(220, 38, 38); // Red
        doc.text('CREDIT / UDHAAR', 150, 62);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
        doc.text(`Balance Due: ${symbol}${balDue.toFixed(2)}`, 150, 67);
      } else {
        doc.setTextColor(239, 68, 68);
        doc.text('UNPAID', 150, 62);
      }

      // Table Header
      let currentY = 88;
      doc.setFillColor(lightNeutral[0], lightNeutral[1], lightNeutral[2]);
      doc.rect(15, currentY, 180, 8, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('Item / Particulars', 18, currentY + 5.5);
      doc.text('Qty', 115, currentY + 5.5, { align: 'right' });
      doc.text('Unit Price', 150, currentY + 5.5, { align: 'right' });
      doc.text('Total Amount', 192, currentY + 5.5, { align: 'right' });

      currentY += 8;

      // Table Items
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      
      const itemsList = inv.items || [];
      itemsList.forEach((item: any, index: number) => {
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, currentY, 180, 8, 'F');
        }
        
        doc.setFont('Helvetica', 'bold');
        doc.text(item.productName, 18, currentY + 5.5);
        doc.setFont('Helvetica', 'normal');
        doc.text(item.quantity.toString(), 115, currentY + 5.5, { align: 'right' });
        doc.text(`${symbol} ${item.price.toFixed(2)}`, 150, currentY + 5.5, { align: 'right' });
        doc.setFont('Helvetica', 'bold');
        doc.text(`${symbol} ${item.total.toFixed(2)}`, 192, currentY + 5.5, { align: 'right' });

        currentY += 8;
      });

      drawDivider(currentY + 2);
      currentY += 8;

      // Totals
      const summaryLabelX = 140;
      const summaryValueX = 192;

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);

      doc.text('Subtotal:', summaryLabelX, currentY);
      doc.text(`${symbol} ${inv.subtotal.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
      currentY += 5;

      if (inv.discount > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text('Discount:', summaryLabelX, currentY);
        doc.text(`- ${symbol} ${inv.discount.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
        currentY += 5;
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      }

      doc.text(`Tax (${inv.taxRate}%):`, summaryLabelX, currentY);
      doc.text(`+ ${symbol} ${inv.taxAmount.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
      currentY += 5;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('Grand Total:', summaryLabelX, currentY + 2);
      doc.text(`${symbol} ${inv.total.toFixed(2)}`, summaryValueX, currentY + 2, { align: 'right' });

      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Amount Paid:', summaryLabelX, currentY + 2);
      doc.text(`${symbol} ${amtPaid.toFixed(2)}`, summaryValueX, currentY + 2, { align: 'right' });

      currentY += 5;
      doc.setFont('Helvetica', 'bold');
      if (inv.status === 'paid') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(220, 38, 38);
      }
      doc.text('Balance Due:', summaryLabelX, currentY + 2);
      doc.text(`${symbol} ${balDue.toFixed(2)}`, summaryValueX, currentY + 2, { align: 'right' });
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);

      // Notes
      let notesY = currentY - (inv.discount > 0 ? 20 : 15);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Notes / Terms:', 15, notesY);
      doc.setFont('Helvetica', 'normal');
      
      const remarks = inv.notes || 'Thank you for your business! Official POS Transaction Receipt.';
      const lines = doc.splitTextToSize(remarks, 110);
      doc.text(lines, 15, notesY + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page 1 of 1 | Verified Point of Sale Receipt`, 15, 285);
      doc.text(`Thank you for shopping with us!`, 195, 285, { align: 'right' });

      doc.save(`Receipt_${inv.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF receipt:', err);
    }
  };

  const handleDownloadInvoice = async (invId: string) => {
    const invoices = getInvoices(user.id);
    const inv = invoices.find(i => i.id === invId);
    if (!inv) {
      alert("Invoice/Receipt not found in records / ریکارڈ نہیں ملا۔");
      return;
    }
    const qrCode = await getQRCodeBase64(inv, user.companyName || 'Business Name', user.taxNumber || '', symbol);
    downloadInvoicePDF(inv, qrCode);
  };

  // WhatsApp & Email sharing
  const handleShareOnWhatsApp = (targetSale: Sale, phoneOverride?: string) => {
    const isCredit = targetSale.paymentMethod === 'credit' || targetSale.isCredit;
    const statusStr = isCredit ? 'CREDIT / UDHAAR (UNPAID)' : 'PAID IN FULL';
    const company = user.companyName || 'Our Business';
    const defaultCode = getDefaultPhoneCode(user.currency);
    const phoneToUse = phoneOverride || sharingPhone;
    const cleanedNum = cleanPhoneForWhatsApp(phoneToUse, defaultCode);
    const receiptNum = targetSale.receiptNumber || targetSale.invoiceId || `#${targetSale.id.substring(0, 8).toUpperCase()}`;

    let itemsBreakdown = '';
    if (targetSale.items && targetSale.items.length > 0) {
      itemsBreakdown = '\n*Items Purchased*:\n' + targetSale.items.map(i => `• ${i.quantity}x ${i.productName} = ${symbol}${(i.quantity * i.price).toFixed(2)}`).join('\n') + '\n';
    }

    const text = `*RECEIPT / SALE CONFIRMATION*\n` +
                 `*${company}*\n\n` +
                 `*Receipt No*: ${receiptNum}\n` +
                 `*Date*: ${targetSale.date}\n` +
                 `*Customer*: ${targetSale.customerName}\n` +
                 `${itemsBreakdown}` +
                 `*Grand Total*: *${symbol}${targetSale.amount.toFixed(2)}*\n` +
                 `*Payment Method*: ${targetSale.paymentMethod.toUpperCase()}\n` +
                 `*Status*: *${statusStr}*\n\n` +
                 `Thank you for your business!`;

    const waUrl = cleanedNum 
      ? `https://api.whatsapp.com/send?phone=${cleanedNum}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    
    openExternalLink(waUrl, '_blank');
  };

  const handleShareOnEmail = (targetSale: Sale, emailOverride?: string) => {
    const isCredit = targetSale.paymentMethod === 'credit' || targetSale.isCredit;
    const statusStr = isCredit ? 'CREDIT / UDHAAR (UNPAID)' : 'PAID IN FULL';
    const company = user.companyName || 'Our Business';
    const targetEmail = emailOverride || sharingEmail;
    const receiptNum = targetSale.receiptNumber || targetSale.invoiceId || `#${targetSale.id.substring(0, 8).toUpperCase()}`;

    let itemsBreakdown = '';
    if (targetSale.items && targetSale.items.length > 0) {
      itemsBreakdown = '\nItems Purchased:\n' + targetSale.items.map(i => `- ${i.quantity}x ${i.productName} @ ${symbol}${i.price.toFixed(2)} = ${symbol}${(i.quantity * i.price).toFixed(2)}`).join('\n') + '\n';
    }

    const subject = `Receipt ${receiptNum} from ${company}`;
    const body = `Hello ${targetSale.customerName},\n\n` +
                 `Here is your sales receipt from ${company}:\n\n` +
                 `Receipt Number: ${receiptNum}\n` +
                 `Date: ${targetSale.date}\n` +
                 `${itemsBreakdown}\n` +
                 `Grand Total: ${symbol}${targetSale.amount.toFixed(2)}\n` +
                 `Payment Method: ${targetSale.paymentMethod.toUpperCase()}\n` +
                 `Status: ${statusStr}\n\n` +
                 `Thank you for shopping with us!\n${company}`;

    const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    openExternalLink(mailtoUrl, '_self');
  };

  // Main Submit: Create POS Sale
  const executeCreateSale = (finalCustomerName: string, resolvedCustomerId: string, totalAmount: number) => {
    const isCredit = paymentMethod === 'credit';
    const invoiceNum = getNextInvoiceId(user.id);

    // 1. Prepare Line items
    const lineItems: InvoiceItem[] = saleType === 'itemized' 
      ? basket 
      : [{
          productId: 'DIRECT-ITEM',
          productName: description.trim() || `${category} Direct Sale`,
          quantity: 1,
          price: totalAmount,
          total: totalAmount
        }];

    const finalSubtotal = saleType === 'itemized' ? basketSubtotal : totalAmount;
    const finalDiscount = saleType === 'itemized' ? calculatedDiscount : 0;
    const finalTaxAmount = saleType === 'itemized' ? calculatedVatAmount : 0;
    const finalTaxRate = saleType === 'itemized' ? activeTaxRate : 0;

    // 2. Deduct inventory stock for all products in basket
    if (saleType === 'itemized') {
      basket.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          const newStock = Math.max(0, prod.stock - item.quantity);
          editProduct(user.id, {
            ...prod,
            stock: newStock
          });
        }
      });
    }

    // 3. Auto-generate sequential invoice
    const newInvoice = addInvoice(user.id, {
      invoiceNumber: invoiceNum,
      customerId: resolvedCustomerId || 'walk-in',
      customerName: finalCustomerName,
      date,
      dueDate: isCredit ? new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0] : date,
      items: lineItems,
      subtotal: finalSubtotal,
      taxRate: finalTaxRate,
      taxAmount: finalTaxAmount,
      discount: finalDiscount,
      total: totalAmount,
      amountPaid: isCredit ? 0 : totalAmount,
      balanceDue: isCredit ? totalAmount : 0,
      notes: description.trim() || (isCredit ? 'Credit / Udhaar sale transaction.' : 'Point of Sale instant transaction.'),
      status: isCredit ? 'unpaid' : 'paid',
      paymentMethod
    });

    // 4. Determine clean description
    let saleDesc = description.trim();
    if (!saleDesc) {
      if (saleType === 'itemized') {
        saleDesc = basket.map(i => `${i.quantity}x ${i.productName}`).join(', ');
      } else {
        saleDesc = isCredit ? 'Credit / Udhaar sale' : 'Point of Sale cash checkout';
      }
    }

    // 5. Add Sale record
    const recordedSale = addSale(user.id, {
      customerId: resolvedCustomerId || undefined,
      customerName: finalCustomerName,
      amount: totalAmount,
      subtotal: finalSubtotal,
      taxRate: finalTaxRate,
      taxAmount: finalTaxAmount,
      discount: finalDiscount,
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      isTaxEnabled: isVatEnabled,
      category: saleType === 'itemized' ? 'Product Sales' : category,
      description: saleDesc,
      date,
      paymentMethod,
      invoiceId: newInvoice.id,
      receiptNumber: newInvoice.invoiceNumber,
      items: lineItems,
      isCredit
    });

    // Reset Form
    setBasket([]);
    setSearchProductQuery('');
    setDiscountValue('0');
    setDirectAmount('');
    setDescription('');
    setPaymentMethod('cash');
    setCustomerMode('walkin');
    setCustomerName('Walk-In Customer');
    setSelectedCustomerId('');
    setNewCustPhone('');
    setNewCustEmail('');
    setShowAddModal(false);
    
    // Refresh DB and display receipt modal immediately
    handleRefresh();
    setReceiptSuccessSale(recordedSale);
  };

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();

    // Check customer selection
    let finalCustomerName = '';
    let resolvedCustomerId = '';

    if (customerMode === 'walkin') {
      if (paymentMethod === 'credit') {
        alert(user.language === 'ur' 
          ? 'ادھار / کریڈٹ سیل کے لیے رجسٹرڈ کسٹمر کا انتخاب لازمی ہے۔' 
          : 'Credit / Udhaar sale requires selecting or creating a registered customer profile.');
        return;
      }
      finalCustomerName = 'Walk-In Customer';
      resolvedCustomerId = 'walk-in';
    } else if (customerMode === 'saved') {
      if (!selectedCustomerId) {
        alert(user.language === 'ur' ? 'براہ مہربانی فہرست سے کسٹمر منتخب کریں۔' : 'Please select a saved customer.');
        return;
      }
      const matched = customers.find(c => c.id === selectedCustomerId);
      if (!matched) {
        alert("Selected customer not found.");
        return;
      }
      finalCustomerName = matched.name;
      resolvedCustomerId = matched.id;
    } else if (customerMode === 'new') {
      const trimmed = customerName.trim();
      if (!trimmed || trimmed.toLowerCase() === 'walk-in customer') {
        alert(user.language === 'ur' ? 'براہ مہربانی کسٹمر کا نام درج کریں۔' : 'Please enter a valid customer name.');
        return;
      }
      const createdCust = addCustomer(user.id, {
        name: trimmed,
        email: newCustEmail.trim(),
        phone: newCustPhone.trim(),
        address: '',
        isApproved: true
      });
      finalCustomerName = createdCust.name;
      resolvedCustomerId = createdCust.id;
    }

    // Determine Total Amount
    let totalAmount = 0;
    if (saleType === 'itemized') {
      if (basket.length === 0) {
        alert(user.language === 'ur' ? 'براہ مہربانی باسکٹ میں کم از کم ایک پروڈکٹ شامل کریں۔' : 'Please add at least one product into your POS cart before saving.');
        return;
      }
      totalAmount = calculatedGrandTotal;
    } else {
      totalAmount = parseFloat(directAmount) || 0;
    }

    if (isNaN(totalAmount) || totalAmount <= 0) {
      alert(user.language === 'ur' ? 'کل رقم 0 سے زیادہ ہونی چاہیے۔' : 'Grand Total must be greater than zero.');
      return;
    }

    // Check Stock Availability and Warnings
    if (saleType === 'itemized') {
      const lowStockItems: { name: string; requested: number; available: number }[] = [];
      basket.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        const available = prod ? prod.stock : 0;
        if (item.quantity > available) {
          lowStockItems.push({
            name: item.productName,
            requested: item.quantity,
            available
          });
        }
      });

      if (lowStockItems.length > 0) {
        setOversellConfirmModal({
          isOpen: true,
          items: lowStockItems,
          onConfirm: () => {
            setOversellConfirmModal(prev => ({ ...prev, isOpen: false }));
            executeCreateSale(finalCustomerName, resolvedCustomerId, totalAmount);
          }
        });
        return;
      }
    }

    // Proceed to create sale
    executeCreateSale(finalCustomerName, resolvedCustomerId, totalAmount);
  };

  // Start Edit Sale
  const handleStartEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditCustomerName(sale.customerName);
    setEditCustomerId(sale.customerId || '');
    setEditAmount(sale.amount.toString());
    setEditCategory(sale.category || 'Product Sales');
    setEditDescription(sale.description);
    setEditDate(sale.date);
    setEditPaymentMethod(sale.paymentMethod);
    setEditSaleType(sale.items && sale.items.length > 0 ? 'itemized' : 'simple');
    setEditBasket(sale.items || []);
    setEditDiscountType(sale.discountType || 'fixed');
    setEditDiscountValue(sale.discountValue ? sale.discountValue.toString() : (sale.discount ? sale.discount.toString() : '0'));
    setEditIsVatEnabled(sale.isTaxEnabled !== undefined ? sale.isTaxEnabled : (sale.taxRate ? sale.taxRate > 0 : true));
    setEditVatRate(sale.taxRate ? sale.taxRate.toString() : (user.taxRate ? user.taxRate.toString() : '5'));
    setSearchEditProductQuery('');
  };

  // Save Edit Sale
  const handleUpdateSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    let saleAmount = 0;
    if (editSaleType === 'itemized') {
      if (editBasket.length === 0) {
        alert(user.language === 'ur' ? 'براہ مہربانی باسکٹ میں کم از کم ایک پروڈکٹ شامل کریں۔' : 'Please add at least one product into your basket.');
        return;
      }
      saleAmount = editCalculatedGrandTotal;
    } else {
      saleAmount = parseFloat(editAmount) || 0;
    }

    if (isNaN(saleAmount) || saleAmount <= 0) {
      alert("Grand Total must be greater than zero.");
      return;
    }

    // Revert stock of previous sale items
    if (editingSale.items && editingSale.items.length > 0) {
      editingSale.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          editProduct(user.id, {
            ...prod,
            stock: prod.stock + item.quantity
          });
        }
      });
    }

    // Deduct stock for new edited items
    if (editSaleType === 'itemized') {
      const freshProducts = getProducts(user.id);
      editBasket.forEach(item => {
        const prod = freshProducts.find(p => p.id === item.productId);
        if (prod) {
          const updatedStock = Math.max(0, prod.stock - item.quantity);
          editProduct(user.id, {
            ...prod,
            stock: updatedStock
          });
        }
      });
    }

    const updatedSale: Sale = {
      ...editingSale,
      customerName: editCustomerName.trim() || 'Walk-In Customer',
      customerId: editCustomerId || editingSale.customerId,
      amount: saleAmount,
      subtotal: editSaleType === 'itemized' ? editBasketSubtotal : saleAmount,
      taxRate: editSaleType === 'itemized' ? editActiveTaxRate : 0,
      taxAmount: editSaleType === 'itemized' ? editCalculatedVatAmount : 0,
      discount: editSaleType === 'itemized' ? editCalculatedDiscount : 0,
      discountType: editDiscountType,
      discountValue: parseFloat(editDiscountValue) || 0,
      isTaxEnabled: editIsVatEnabled,
      category: editSaleType === 'itemized' ? 'Product Sales' : editCategory,
      description: editDescription.trim() || 'Edited Sale Transaction',
      date: editDate,
      paymentMethod: editPaymentMethod,
      items: editSaleType === 'itemized' ? editBasket : undefined,
      isCredit: editPaymentMethod === 'credit'
    };

    editSale(user.id, updatedSale);
    setEditingSale(null);
    handleRefresh();
  };

  // Filter Catalog Products
  const filteredProductsPOS = products.filter(p =>
    p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchProductQuery.toLowerCase())
  );

  const filteredProductsEditPOS = products.filter(p =>
    p.name.toLowerCase().includes(searchEditProductQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchEditProductQuery.toLowerCase())
  );

  const categories = ['Product Sales', 'Consulting', 'Services', 'Subscriptions', 'Other'];

  // Filter Sales list
  const filteredSales = sales.filter(s => {
    const cust = customers.find(c => c.id === s.customerId || c.name.toLowerCase() === s.customerName.toLowerCase());
    const matchesPhone = cust && cust.phone ? cust.phone.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const matchesSearch = s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.receiptNumber && s.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          matchesPhone;
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchesCustomer = customerFilter === 'all' || s.customerName.toLowerCase() === customerFilter.toLowerCase();
    return matchesSearch && matchesCategory && matchesCustomer;
  });

  const formatMoney = (val: number) => {
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isRtl = user.language === 'ar' || user.language === 'ur';

  return (
    <div className="space-y-6">
      {/* Header & Main POS CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-indigo-400" />
            {t.sales} / POS System
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cart-based Point of Sale, live inventory stock sync, UAE VAT calculations & instant receipts.
          </p>
        </div>
        <button
          onClick={() => {
            setSaleType('itemized');
            setBasket([]);
            setSearchProductQuery('');
            setDiscountValue('0');
            setIsVatEnabled(true);
            setVatRate(user.taxRate ? user.taxRate.toString() : '5');
            setPaymentMethod('cash');
            setCustomerMode('walkin');
            setCustomerName('Walk-In Customer');
            setSelectedCustomerId('');
            setNewCustPhone('');
            setNewCustEmail('');
            setDirectAmount('');
            setDescription('');
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-900/30 hover:shadow-indigo-800/50 transition-all cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{t.addSale} (POS)</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${isRtl ? 'left-3' : 'right-3'}`} />
          <input
            type="text"
            placeholder="Search sale, customer, invoice #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Customer Filter */}
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-400 shrink-0" />
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
          >
            <option value="all">All Customers / تمام گاہک</option>
            {Array.from(new Set(sales.map(s => s.customerName.trim()))).map((cName: string) => (
              <option key={cName} value={cName.toLowerCase()}>
                👤 {cName}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
          >
            <option value="all">All Categories / تمام کیٹیگریز</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Filtered Sales Total */}
        <div className="bg-slate-950/60 rounded-xl px-4 py-2 border border-slate-900 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Filtered Revenue:</span>
          <span className="font-extrabold text-emerald-400 font-mono text-sm">
            {formatMoney(filteredSales.reduce((sum, s) => sum + s.amount, 0))}
          </span>
        </div>
      </div>

      {/* Sales Transactions Register Table */}
      <div className="bg-slate-900/20 rounded-2xl border border-slate-850 overflow-hidden shadow-xl">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">{t.date}</th>
                <th className="px-5 py-4">Receipt / Invoice #</th>
                <th className="px-5 py-4">Customer Name</th>
                <th className="px-5 py-4">{t.paymentMethod}</th>
                <th className="px-5 py-4">Items Breakdown</th>
                <th className="px-5 py-4 text-right">{t.amount}</th>
                <th className="px-5 py-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 italic text-slate-500">
                    No matching sales transactions found in POS records.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const isCredit = sale.paymentMethod === 'credit' || sale.isCredit;
                  const receiptNo = sale.receiptNumber || sale.invoiceId || `#${sale.id.substring(0, 8).toUpperCase()}`;

                  return (
                    <tr 
                      key={sale.id} 
                      className="hover:bg-slate-800/40 transition cursor-pointer"
                      onClick={() => setDetailSale(sale)}
                    >
                      <td className="px-5 py-4 whitespace-nowrap text-slate-400 font-mono">
                        {sale.date}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-mono font-bold text-indigo-300">
                        {receiptNo}
                      </td>
                      <td className="px-5 py-4 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{sale.customerName}</span>
                          {isCredit && (
                            <span className="text-[9px] bg-rose-950/80 text-rose-400 border border-rose-800/50 px-1.5 py-0.5 rounded font-extrabold">
                              Udhaar / Credit
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${
                          isCredit 
                            ? 'bg-rose-950/40 text-rose-400 border-rose-800/40' 
                            : sale.paymentMethod === 'cash'
                              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                              : 'bg-indigo-950/40 text-indigo-400 border-indigo-800/40'
                        }`}>
                          {sale.paymentMethod === 'credit' ? '📋 Credit / Udhaar' : sale.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-4 max-w-xs truncate text-slate-400 text-[11px]" title={sale.description}>
                        {sale.items && sale.items.length > 0 
                          ? `${sale.items.length} item(s) (${sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')})`
                          : sale.description || '-'}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-emerald-400 whitespace-nowrap text-sm font-mono">
                        {formatMoney(sale.amount)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              if (sale.invoiceId) {
                                handleDownloadInvoice(sale.invoiceId);
                              } else {
                                setDetailSale(sale);
                              }
                            }}
                            className="text-[10px] bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-800/30 text-emerald-400 font-bold px-2 py-1 rounded-lg transition cursor-pointer"
                            title="Receipt PDF"
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={() => handleShareOnWhatsApp(sale)}
                            className="text-[10px] bg-indigo-950/40 hover:bg-indigo-900 border border-indigo-800/30 text-indigo-400 font-bold px-2 py-1 rounded-lg transition cursor-pointer"
                            title="WhatsApp Share"
                          >
                            💬 WhatsApp
                          </button>
                          <button
                            onClick={() => handleStartEditSale(sale)}
                            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                            title="Edit Sale"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(sale.id)}
                            className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-850 p-2 space-y-2">
          {filteredSales.length === 0 ? (
            <div className="text-center py-8 italic text-slate-500 text-xs">
              No sales records found.
            </div>
          ) : (
            filteredSales.map((sale) => {
              const isCredit = sale.paymentMethod === 'credit' || sale.isCredit;
              const receiptNo = sale.receiptNumber || sale.invoiceId || `#${sale.id.substring(0, 8).toUpperCase()}`;

              return (
                <div 
                  key={sale.id}
                  onClick={() => setDetailSale(sale)}
                  className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-850/80 space-y-3 cursor-pointer hover:border-slate-700 transition"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-indigo-400 font-bold block truncate">{receiptNo}</span>
                      <h4 className="font-bold text-white text-sm truncate">{sale.customerName}</h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{sale.description || '-'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-emerald-400 font-mono block">
                        {formatMoney(sale.amount)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase inline-block mt-0.5 ${
                        isCredit ? 'bg-rose-950/80 text-rose-400 border border-rose-800/40' : 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/40'
                      }`}>
                        {sale.paymentMethod === 'credit' ? 'Udhaar' : sale.paymentMethod}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400" onClick={(e) => e.stopPropagation()}>
                    <span className="font-mono">{sale.date}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          if (sale.invoiceId) {
                            handleDownloadInvoice(sale.invoiceId);
                          } else {
                            setDetailSale(sale);
                          }
                        }}
                        className="text-[10px] bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/40 text-emerald-400 font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="Download Receipt PDF"
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span>PDF</span>
                      </button>
                      <button
                        onClick={() => handleShareOnWhatsApp(sale)}
                        className="text-[10px] bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/40 text-indigo-400 font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                        title="WhatsApp Share"
                      >
                        <Send className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        onClick={() => handleStartEditSale(sale)}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                        title="Edit Sale"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteId(sale.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD SALE / FULL POS CHECKOUT MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setShowAddModal(false)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-300 relative z-50"
          >
            {/* Modal Header */}
            <div className="bg-slate-950/70 px-6 py-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl">
                  <ShoppingCart className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    Point of Sale (POS) Checkout
                  </h3>
                  <p className="text-[10px] text-slate-400">Add products to cart, apply tax/discounts, and complete sale.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSale} className="flex-1 flex flex-col overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
                
                {/* Mode Selector (Itemized POS vs Quick Direct) */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                  <button
                    type="button"
                    onClick={() => setSaleType('itemized')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-extrabold transition-all text-xs cursor-pointer ${
                      saleType === 'itemized'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>🛍️ Cart-Based POS (Line Items)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleType('simple')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-extrabold transition-all text-xs cursor-pointer ${
                      saleType === 'simple'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>⚡ Direct Amount Entry</span>
                  </button>
                </div>

                {/* ========================================== */}
                {/* 1. CUSTOMER LINKING & DETAILS */}
                {/* ========================================== */}
                <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="font-extrabold text-white text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Customer Linking & Account</span>
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={paymentMethod === 'credit'}
                        onClick={() => {
                          setCustomerMode('walkin');
                          setCustomerName('Walk-In Customer');
                          setSelectedCustomerId('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                          paymentMethod === 'credit'
                            ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                            : customerMode === 'walkin'
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                        }`}
                      >
                        🚶 Walk-In Customer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerMode('saved');
                          setCustomerName('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                          customerMode === 'saved'
                            ? 'bg-indigo-950/80 text-indigo-400 border-indigo-500/30'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                        }`}
                      >
                        🔍 Find Saved Customer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerMode('new');
                          setCustomerName('');
                          setSelectedCustomerId('');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer ${
                          customerMode === 'new'
                            ? 'bg-purple-950/80 text-purple-400 border-purple-500/30'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-850'
                        }`}
                      >
                        ➕ Quick-Add New
                      </button>
                    </div>
                  </div>

                  {/* Customer Selection Input Views */}
                  {customerMode === 'walkin' && (
                    <div className="p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        🚶 Walk-In Customer (Direct Counter Sale)
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Anonymous / No Ledger</span>
                    </div>
                  )}

                  {customerMode === 'saved' && (
                    <div className="space-y-2">
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white outline-none text-xs cursor-pointer font-medium"
                      >
                        <option value="">-- Choose Registered Customer from Database --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ''} {c.email ? `• ${c.email}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedCustomerId && (() => {
                        const sel = customers.find(c => c.id === selectedCustomerId);
                        if (!sel) return null;
                        return (
                          <div className="p-2 bg-indigo-950/30 rounded-xl border border-indigo-900/30 flex items-center justify-between text-[11px] text-indigo-300">
                            <span>Selected: <strong className="text-white">{sel.name}</strong></span>
                            <span>{sel.phone || sel.email || 'Registered account'}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {customerMode === 'new' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">Customer Full Name *</label>
                        <input
                          type="text"
                          required={customerMode === 'new'}
                          placeholder="e.g. John Doe / Al-Ahmad Co"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">WhatsApp / Phone</label>
                        <input
                          type="text"
                          placeholder="971501234567"
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold">Email (Optional)</label>
                        <input
                          type="email"
                          placeholder="client@mail.com"
                          value={newCustEmail}
                          onChange={(e) => setNewCustEmail(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-white outline-none text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ========================================== */}
                {/* 2. PRODUCT SELECTION & CART LINE ITEMS */}
                {/* ========================================== */}
                {saleType === 'itemized' && (
                  <div className="space-y-4">
                    {/* Catalog Picker */}
                    <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5">
                          <ShoppingBag className="w-4 h-4 text-emerald-400" />
                          <span>Product Catalog & Add Items</span>
                        </h4>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-lg border border-slate-800 font-mono">
                          {products.length} Products in Inventory
                        </span>
                      </div>

                      {/* Product Search Filter */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search items by name, SKU/barcode..."
                          value={searchProductQuery}
                          onChange={(e) => setSearchProductQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 px-3.5 py-2 rounded-xl text-white outline-none text-xs transition"
                        />
                        <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-500" />
                      </div>

                      {/* Product Catalog List */}
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-900/80 pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                        {filteredProductsPOS.length === 0 ? (
                          <div className="p-4 text-center italic text-slate-500 text-[11px]">
                            No inventory items matching "{searchProductQuery}".
                          </div>
                        ) : (
                          filteredProductsPOS.map(p => {
                            const inCart = basket.find(item => item.productId === p.id);
                            const cartQty = inCart ? inCart.quantity : 0;
                            const isOutOfStock = p.stock <= 0;
                            const isLowStock = p.stock <= p.minStockAlert && !isOutOfStock;

                            return (
                              <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/30 hover:bg-slate-900 transition gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                                      {p.sku}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-0.5">
                                    <span className="text-emerald-400 font-extrabold">{formatMoney(p.price)}</span>
                                    <span className={`font-mono font-bold ${
                                      isOutOfStock ? 'text-rose-500' : isLowStock ? 'text-amber-500' : 'text-slate-400'
                                    }`}>
                                      {p.stock} units available
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {cartQty > 0 && (
                                    <span className="text-[10px] bg-indigo-950/80 text-indigo-300 font-extrabold px-2 py-0.5 rounded-lg border border-indigo-800/40">
                                      {cartQty} in cart
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleAddToBasket(p)}
                                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Cart Items Table */}
                    <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-900">
                        <h4 className="font-extrabold text-indigo-300 text-xs flex items-center gap-1.5">
                          <ShoppingCart className="w-4 h-4 text-indigo-400" />
                          <span>Sale Line Items ({basket.length})</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {basket.reduce((sum, item) => sum + item.quantity, 0)} total units
                        </span>
                      </div>

                      {basket.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                          <ShoppingCart className="w-8 h-8 text-slate-700 stroke-[1.5]" />
                          <p className="text-xs">Your POS cart is currently empty. Click "Add" on any product above.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                          {basket.map(item => {
                            const origProd = products.find(p => p.id === item.productId);
                            const availStock = origProd ? origProd.stock : 0;
                            const isExceeding = item.quantity > availStock;

                            return (
                              <div key={item.productId} className="bg-slate-900/50 p-3 rounded-xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-bold text-white text-xs truncate">{item.productName}</h5>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                    <span>Price: {formatMoney(item.price)}</span>
                                    <span>•</span>
                                    <span className={isExceeding ? 'text-rose-400 font-extrabold flex items-center gap-1' : 'text-slate-400'}>
                                      {isExceeding && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                                      Stock: {availStock} units
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                  {/* Editable Unit Price */}
                                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                                    <span className="text-[10px] text-slate-500">{symbol}</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.price}
                                      onChange={(e) => handleUpdateBasketPrice(item.productId, parseFloat(e.target.value) || 0)}
                                      className="w-14 bg-transparent text-white font-mono text-xs outline-none text-right font-bold"
                                      title="Edit Unit Price"
                                    />
                                  </div>

                                  {/* Qty Controls */}
                                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBasketQty(item.productId, item.quantity - 1)}
                                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleUpdateBasketQty(item.productId, parseInt(e.target.value, 10) || 1)}
                                      className="w-8 text-center bg-transparent text-white font-mono font-bold text-xs outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateBasketQty(item.productId, item.quantity + 1)}
                                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  {/* Line Total */}
                                  <span className="font-extrabold text-white font-mono text-xs min-w-[70px] text-right">
                                    {formatMoney(item.quantity * item.price)}
                                  </span>

                                  {/* Remove Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFromBasket(item.productId)}
                                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ========================================== */}
                {/* DIRECT AMOUNT ENTRY (IF SIMPLE MODE) */}
                {/* ========================================== */}
                {saleType === 'simple' && (
                  <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-300 text-xs">Direct Sale Amount ({symbol}) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required={saleType === 'simple'}
                        placeholder="0.00"
                        value={directAmount}
                        onChange={(e) => setDirectAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-lg font-mono font-bold outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* ========================================== */}
                {/* 3. AUTO CALCULATIONS & BILLING BREAKDOWN */}
                {/* ========================================== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Metadata & Payment Method */}
                  <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-2xl space-y-3.5">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-300 text-xs">Transaction Date *</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-300 text-xs flex items-center justify-between">
                        <span>Payment Method *</span>
                        {paymentMethod === 'credit' && (
                          <span className="text-[10px] text-rose-400 font-extrabold">Requires Registered Customer</span>
                        )}
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs font-bold cursor-pointer"
                      >
                        <option value="cash">💵 Cash (نقد)</option>
                        <option value="card">💳 Card / Credit Card</option>
                        <option value="bank">🏦 Bank Transfer</option>
                        <option value="credit">📋 Credit / Udhaar (قرض / ادھار)</option>
                        <option value="other">🔄 Other</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-300 text-xs">Notes / Remarks (Optional)</label>
                      <input
                        type="text"
                        placeholder="Additional terms or receipt comments..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Right Column: Calculations Breakdown Card */}
                  <div className="bg-slate-950 p-4 border border-indigo-500/20 rounded-2xl flex flex-col justify-between space-y-3">
                    <div className="space-y-2 text-xs">
                      {/* Subtotal */}
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Subtotal:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {formatMoney(saleType === 'itemized' ? basketSubtotal : (parseFloat(directAmount) || 0))}
                        </span>
                      </div>

                      {/* Discount Control */}
                      {saleType === 'itemized' && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span>Discount:</span>
                            <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800">
                              <button
                                type="button"
                                onClick={() => setDiscountType('fixed')}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${discountType === 'fixed' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                              >
                                {symbol}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiscountType('percentage')}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${discountType === 'percentage' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                              >
                                %
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={discountValue}
                              onChange={(e) => setDiscountValue(e.target.value)}
                              className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-white font-mono font-bold text-xs outline-none"
                            />
                            {calculatedDiscount > 0 && (
                              <span className="text-rose-400 font-mono font-bold">
                                -{formatMoney(calculatedDiscount)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* VAT / Tax Toggle */}
                      {saleType === 'itemized' && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-900">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="vat-toggle-pos"
                              checked={isVatEnabled}
                              onChange={(e) => setIsVatEnabled(e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                            />
                            <label htmlFor="vat-toggle-pos" className="text-slate-300 font-bold select-none cursor-pointer">
                              UAE VAT ({vatRate}%)
                            </label>
                          </div>
                          {isVatEnabled && (
                            <span className="text-indigo-300 font-mono font-bold">
                              +{formatMoney(calculatedVatAmount)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Grand Total Display */}
                    <div className="bg-gradient-to-br from-indigo-950/60 to-slate-950/80 p-3.5 rounded-xl border border-indigo-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                          Grand Total (Auto-Calculated)
                        </span>
                        <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">
                          {formatMoney(saleType === 'itemized' ? calculatedGrandTotal : (parseFloat(directAmount) || 0))}
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold text-indigo-300 bg-indigo-950 border border-indigo-800/40 px-2.5 py-1 rounded-lg uppercase">
                        {paymentMethod === 'credit' ? 'Credit Sale' : 'Paid'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer CTA */}
              <div className="bg-slate-950 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-800 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="text-[11px] text-slate-400 font-mono text-center sm:text-left">
                  Receipt # auto-assigned upon checkout
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition font-semibold cursor-pointer text-center"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-indigo-900/30"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="whitespace-nowrap">Complete & Record Sale</span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POST-SALE RECEIPT SUCCESS & INSTANT SHARING MODAL */}
      {/* ========================================================================= */}
      {receiptSuccessSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setReceiptSuccessSale(null)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs text-slate-300 relative z-50 animate-fade-in mx-auto"
          >
            {/* Success Header */}
            <div className="bg-gradient-to-r from-emerald-950/70 to-slate-950 px-4 py-3 sm:px-6 sm:py-4 border-b border-emerald-500/20 shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">
                    Sale Recorded & Receipt Generated!
                  </h3>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold block truncate">
                    {receiptSuccessSale.receiptNumber || receiptSuccessSale.invoiceId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptSuccessSale(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              {/* Grand Total Banner */}
              <div className="bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                    {formatMoney(receiptSuccessSale.amount)}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">Payment Method</span>
                  <span className="text-xs font-extrabold uppercase text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/40 inline-block mt-0.5">
                    {receiptSuccessSale.paymentMethod === 'credit' ? '📋 Credit / Udhaar' : `💳 ${receiptSuccessSale.paymentMethod}`}
                  </span>
                </div>
              </div>

              {/* Receipt Summary Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-slate-950/40 p-3 sm:p-3.5 rounded-xl border border-slate-850/60 text-[11px]">
                <div className="min-w-0">
                  <span className="text-slate-400 font-bold block mb-0.5">Customer:</span>
                  <span className="text-white font-bold truncate block">{receiptSuccessSale.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">Date:</span>
                  <span className="text-white font-mono">{receiptSuccessSale.date}</span>
                </div>
              </div>

              {/* Itemized Table Breakdown */}
              {receiptSuccessSale.items && receiptSuccessSale.items.length > 0 && (
                <div className="space-y-2">
                  <div className="overflow-x-auto border border-slate-850 rounded-xl scrollbar-thin">
                    <table className="w-full text-left text-[11px] text-slate-300 bg-slate-950/40">
                      <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[9px] border-b border-slate-850">
                        <tr>
                          <th className="px-3 py-2 w-[45%]">Item</th>
                          <th className="px-3 py-2 text-center w-[15%]">Qty</th>
                          <th className="px-3 py-2 text-right w-[20%]">Unit Price</th>
                          <th className="px-3 py-2 text-right w-[20%]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {receiptSuccessSale.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-white font-bold break-words min-w-0">{it.productName}</td>
                            <td className="px-3 py-2 text-center font-mono">{it.quantity}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatMoney(it.price)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-200">
                              {formatMoney(it.quantity * it.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial calculation breakdown */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-850 space-y-1 text-[11px]">
                    {receiptSuccessSale.subtotal !== undefined && (
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Subtotal:</span>
                        <span className="font-mono text-slate-200 font-semibold">{formatMoney(receiptSuccessSale.subtotal)}</span>
                      </div>
                    )}
                    {receiptSuccessSale.taxAmount !== undefined && receiptSuccessSale.taxAmount > 0 && (
                      <div className="flex justify-between items-center text-slate-400">
                        <span>VAT / Tax ({receiptSuccessSale.taxRate || user.taxRate || 5}%):</span>
                        <span className="font-mono text-slate-200 font-semibold">+{formatMoney(receiptSuccessSale.taxAmount)}</span>
                      </div>
                    )}
                    {receiptSuccessSale.discount !== undefined && receiptSuccessSale.discount > 0 && (
                      <div className="flex justify-between items-center text-rose-400">
                        <span>Discount:</span>
                        <span className="font-mono font-semibold">-{formatMoney(receiptSuccessSale.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-white font-black border-t border-slate-800 pt-1.5 text-xs">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-400 text-sm">{formatMoney(receiptSuccessSale.amount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Instant WhatsApp Share */}
              <div className="bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-emerald-500/20 space-y-2">
                <h4 className="font-extrabold text-white text-xs flex items-center gap-1.5">
                  <span>💬 Instant WhatsApp Receipt Share</span>
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="971501234567"
                    value={sharingPhone}
                    onChange={(e) => setSharingPhone(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleShareOnWhatsApp(receiptSuccessSale)}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Receipt Modal Footer CTA */}
            <div className="bg-slate-950 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-800 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (receiptSuccessSale.invoiceId) {
                    handleDownloadInvoice(receiptSuccessSale.invoiceId);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Download Receipt PDF</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setReceiptSuccessSale(null);
                  setShowAddModal(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Start New Sale</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SALE DETAIL MODAL */}
      {/* ========================================================================= */}
      {detailSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setDetailSale(null)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-300 relative z-50 mx-auto"
          >
            <div className="bg-slate-950/70 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800 shrink-0 flex items-center justify-between gap-2">
              <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2 truncate">
                <ReceiptText className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
                <span>Sales Transaction Details</span>
              </h3>
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-slate-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Amount</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                    {formatMoney(detailSale.amount)}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">Payment Method</span>
                  <span className="text-xs font-extrabold uppercase text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/40 inline-block mt-0.5">
                    {detailSale.paymentMethod === 'credit' ? '📋 Credit / Udhaar' : `💳 ${detailSale.paymentMethod}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-slate-950/40 p-3 sm:p-3.5 rounded-xl border border-slate-850/60 text-[11px]">
                <div className="min-w-0">
                  <span className="text-slate-400 font-bold block mb-0.5">Customer:</span>
                  <span className="text-white font-bold truncate block">{detailSale.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">Date:</span>
                  <span className="text-white font-mono">{detailSale.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">Receipt Ref:</span>
                  <span className="text-indigo-400 font-mono font-bold">
                    {detailSale.receiptNumber || detailSale.invoiceId || `#${detailSale.id.substring(0, 8).toUpperCase()}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-0.5">Category:</span>
                  <span className="text-white">{detailSale.category}</span>
                </div>
              </div>

              {detailSale.items && detailSale.items.length > 0 && (
                <div className="space-y-2">
                  <label className="text-slate-400 font-bold text-xs">Itemized Products ({detailSale.items.length})</label>
                  <div className="overflow-x-auto border border-slate-850 rounded-xl scrollbar-thin">
                    <table className="w-full text-left text-[11px] text-slate-300 bg-slate-950/40">
                      <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[9px] border-b border-slate-850">
                        <tr>
                          <th className="px-3 py-2 w-[45%]">Item</th>
                          <th className="px-3 py-2 text-center w-[15%]">Qty</th>
                          <th className="px-3 py-2 text-right w-[20%]">Unit Price</th>
                          <th className="px-3 py-2 text-right w-[20%]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {detailSale.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-white font-bold break-words min-w-0">{it.productName}</td>
                            <td className="px-3 py-2 text-center font-mono">{it.quantity}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatMoney(it.price)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-200">
                              {formatMoney(it.quantity * it.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial breakdown */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-850 space-y-1 text-[11px]">
                    {detailSale.subtotal !== undefined && (
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Subtotal:</span>
                        <span className="font-mono text-slate-200 font-semibold">{formatMoney(detailSale.subtotal)}</span>
                      </div>
                    )}
                    {detailSale.taxAmount !== undefined && detailSale.taxAmount > 0 && (
                      <div className="flex justify-between items-center text-slate-400">
                        <span>VAT / Tax ({detailSale.taxRate || user.taxRate || 5}%):</span>
                        <span className="font-mono text-slate-200 font-semibold">+{formatMoney(detailSale.taxAmount)}</span>
                      </div>
                    )}
                    {detailSale.discount !== undefined && detailSale.discount > 0 && (
                      <div className="flex justify-between items-center text-rose-400">
                        <span>Discount:</span>
                        <span className="font-mono font-semibold">-{formatMoney(detailSale.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-white font-black border-t border-slate-800 pt-1.5 text-xs">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-400 text-sm">{formatMoney(detailSale.amount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp Share Box */}
              <div className="bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-extrabold text-white text-xs">Dispatch / Share via WhatsApp</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="971501234567"
                    value={sharingPhone}
                    onChange={(e) => setSharingPhone(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleShareOnWhatsApp(detailSale)}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-800 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (detailSale.invoiceId) {
                    handleDownloadInvoice(detailSale.invoiceId);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer text-xs"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition font-semibold cursor-pointer text-xs text-center"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT SALE MODAL */}
      {/* ========================================================================= */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setEditingSale(null)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-300 relative z-50"
          >
            <div className="bg-slate-950/70 px-6 py-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                Edit Sale Record
              </h3>
              <button
                type="button"
                onClick={() => setEditingSale(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateSale} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 text-xs">Customer Name</label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 text-xs">Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 text-xs">Payment Method</label>
                    <select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs font-bold"
                    >
                      <option value="cash">💵 Cash</option>
                      <option value="card">💳 Card</option>
                      <option value="bank">🏦 Bank Transfer</option>
                      <option value="credit">📋 Credit / Udhaar</option>
                      <option value="other">🔄 Other</option>
                    </select>
                  </div>
                </div>

                {editSaleType === 'itemized' ? (
                  <div className="space-y-3 pt-2 border-t border-slate-850">
                    <label className="font-bold text-indigo-300 text-xs">Cart Items</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {editBasket.map(item => (
                        <div key={item.productId} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                          <span className="font-bold text-white text-xs">{item.productName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono">{item.quantity} x {formatMoney(item.price)}</span>
                            <span className="font-bold text-emerald-400 font-mono">{formatMoney(item.quantity * item.price)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-indigo-500/20">
                      <span className="font-bold text-white text-xs">Total:</span>
                      <span className="font-black text-emerald-400 font-mono text-base">{formatMoney(editCalculatedGrandTotal)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 text-xs">Amount ({symbol})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white font-mono font-bold outline-none text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-bold text-slate-300 text-xs">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs"
                  />
                </div>
              </div>

              <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 shrink-0 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition cursor-pointer text-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Oversell Warning Confirmation Modal */}
      {oversellConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md" onClick={() => setOversellConfirmModal(prev => ({ ...prev, isOpen: false }))} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 relative z-50 text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">Insufficient Stock Warning</h4>
                <p className="text-[10px] text-slate-400">Some items in your cart exceed available warehouse inventory:</p>
              </div>
            </div>

            <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-40 overflow-y-auto">
              {oversellConfirmModal.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px]">
                  <span className="font-bold text-white">{item.name}</span>
                  <span className="text-amber-400 font-mono">
                    Req: {item.requested} (Avail: {item.available})
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-300">
              Do you want to proceed and allow overselling for this sale? Stock quantity will be reduced to 0.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setOversellConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold transition cursor-pointer"
              >
                Cancel / Adjust Cart
              </button>
              <button
                type="button"
                onClick={oversellConfirmModal.onConfirm}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition cursor-pointer"
              >
                Confirm & Proceed
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteId !== null}
        title={t.delete}
        message="Are you sure you want to delete this sale record? If linked to an invoice, it will be updated accordingly."
        language={user.language}
        onConfirm={() => {
          if (deleteId) {
            deleteSale(user.id, deleteId);
            setDeleteId(null);
            handleRefresh();
          }
        }}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
