import React, { useState, useEffect } from 'react';
import { UserTenant, Sale, InvoiceItem, Product } from '../types';
import { translations, currencySymbols } from '../translations';
import { getSales, addSale, editSale, deleteSale, getCustomers, getInvoices, addInvoice, addCustomer, getProducts, editProduct } from '../db';
import { Plus, Search, Trash2, Calendar, FileSpreadsheet, DollarSign, Filter, ReceiptText, ShoppingCart, ShoppingBag, CreditCard, ChevronRight, Check, AlertTriangle, Minus, Tag, Edit2, Info, X, User, Mail, Send, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import { jsPDF } from 'jspdf';
import { cleanPhoneForWhatsApp, getDefaultPhoneCode } from '../utils/phone';

interface SalesModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function SalesModule({ user, onRefreshStats }: SalesModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const [sales, setSales] = useState<Sale[]>(() => getSales(user.id));
  const [customers, setCustomers] = useState(() => getCustomers(user.id));
  const [allInvoices, setAllInvoices] = useState(() => getInvoices(user.id));
  const [products, setProducts] = useState<Product[]>(() => getProducts(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Detail & Edit State Variables
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // Separate states for Edit Form
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Product Sales');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'card' | 'bank' | 'other'>('cash');
  const [editSaleType, setEditSaleType] = useState<'simple' | 'itemized'>('simple');
  const [editBasket, setEditBasket] = useState<InvoiceItem[]>([]);
  const [editDisValue, setEditDisValue] = useState('0');
  const [editTxRateValue, setEditTxRateValue] = useState('0');
  const [editRegisterNewCustomer, setEditRegisterNewCustomer] = useState(false);
  const [isEditCustDropdownOpen, setIsEditCustDropdownOpen] = useState(false);
  const [searchEditProductQuery, setSearchEditProductQuery] = useState('');

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Product Sales');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank' | 'other'>('cash');
  const [invoiceId, setInvoiceId] = useState('');

  // POS / Itemized Basket states
  const [saleType, setSaleType] = useState<'simple' | 'itemized'>('simple');
  const [basket, setBasket] = useState<InvoiceItem[]>([]);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [disValue, setDisValue] = useState('0');
  const [txRateValue, setTxRateValue] = useState(user.taxRate ? user.taxRate.toString() : '0');

  // Search, Auto-Save & Auto-Invoice Controls
  const [registerNewCustomer, setRegisterNewCustomer] = useState(false);
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [autoGenInvoice, setAutoGenInvoice] = useState(false);
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);

  // Invoice sharing/dispatch states
  const [sharingPhone, setSharingPhone] = useState('');
  const [sharingEmail, setSharingEmail] = useState('');

  const lastOpenedSaleIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (detailSale) {
      if (detailSale.id !== lastOpenedSaleIdRef.current) {
        lastOpenedSaleIdRef.current = detailSale.id;
        const match = customers.find(c => c.name.toLowerCase() === detailSale.customerName.toLowerCase());
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
  }, [detailSale, customers]);

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

  const getQRCodeBase64 = (inv: any, companyName: string, taxNumber: string, symbol: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const qrDataPayload = [
        `Seller: ${companyName}`,
        `VAT Ref: ${taxNumber || 'N/A'}`,
        `No: ${inv.invoiceNumber}`,
        `Date: ${inv.date}`,
        `Total: ${symbol}${inv.total.toFixed(2)}`,
        `VAT Amount: ${symbol}${inv.taxAmount.toFixed(2)}`,
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

  const downloadInvoicePDF = (inv: any, qrCodeBase64: string | null) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Simple theme styles
      const primaryColor = [79, 70, 229]; // Indigo: #4f46e5
      const darkNeutral = [30, 41, 59];  // Slate 800: #1e293b
      const lightNeutral = [241, 245, 249]; // Slate 100: #f1f5f9
      const grayText = [100, 116, 139];   // Slate 500: #64748b

      // Horizontal divider line
      const drawDivider = (y: number) => {
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.3);
        doc.line(15, y, 195, y);
      };

      // Top band branding strip
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 10, 'F');

      // Company header based on Logo preference
      const hasLogo = !!user.logoUrl;
      if (hasLogo && user.logoUrl) {
        try {
          doc.addImage(user.logoUrl, 'PNG', 15, 12, 35, 15, undefined, 'FAST');
        } catch (e) {
          console.error("Failed to add company logo to PDF:", e);
        }
        
        // Print company text to the right of the logo, or below it
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text((user.companyName || 'Business Name').toUpperCase(), 55, 17);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
        const addressLine = `${user.address || 'Company Administrative Address'}`;
        const contactLine = `Phone: ${user.phone || 'Phone Contact'} | Email: ${user.email || ''}`;
        doc.text(addressLine, 55, 23);
        doc.text(contactLine, 55, 28);
        if (user.taxNumber) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(`TRN / Tax Ref: ${user.taxNumber}`, 55, 33);
        }
      } else {
        // Company Name header & Meta details (without logo)
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
      }

      // Draw QR Code if we have it preloaded
      if (qrCodeBase64) {
        try {
          doc.addImage(qrCodeBase64, 'PNG', 115, 12, 28, 28, undefined, 'FAST');
        } catch (e) {
          console.error("Failed to add ZATCA QR to PDF:", e);
        }
      }

      // Invoice Header Info Right Column
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('INVOICE', 195, 20, { align: 'right' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text(`Invoice No: ${inv.invoiceNumber}`, 195, 26, { align: 'right' });
      doc.text(`Date: ${inv.date}`, 195, 31, { align: 'right' });
      if (inv.dueDate) {
        doc.text(`Due Date: ${inv.dueDate}`, 195, 36, { align: 'right' });
      }

      drawDivider(48);

      // Billed To & Status
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('BILLED TO', 15, 56);

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
        doc.text('Anonymous Client / Deleted Profile', 15, 67);
      }

      // Status indicator on the right side
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('STATUS', 150, 56);
      
      doc.setFontSize(11);
      const amtPaid = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
      const balDue = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);

      if (inv.status === 'paid') {
        doc.setTextColor(16, 185, 129); // Green 500
        doc.text('PAID IN FULL', 150, 62);
        if (inv.paymentMethod) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(grayText[0], grayText[1], grayText[2]);
          doc.text(`Via: ${inv.paymentMethod.toUpperCase()}`, 150, 67);
        }
      } else if (amtPaid > 0) {
        doc.setTextColor(245, 158, 11); // Amber / Orange 500
        doc.text('PARTIALLY PAID', 150, 62);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(grayText[0], grayText[1], grayText[2]);
        doc.text(`Unpaid: ${symbol}${balDue.toFixed(2)}`, 150, 67);
      } else {
        doc.setTextColor(239, 68, 68); // Red 500
        doc.text('UNPAID', 150, 62);
      }

      // Table draw setup
      let currentY = 88;
      doc.setFillColor(lightNeutral[0], lightNeutral[1], lightNeutral[2]);
      doc.rect(15, currentY, 180, 8, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('Description / Particulars', 18, currentY + 5.5);
      doc.text('Qty', 115, currentY + 5.5, { align: 'right' });
      doc.text('Unit Price', 150, currentY + 5.5, { align: 'right' });
      doc.text('Total Amount', 192, currentY + 5.5, { align: 'right' });

      currentY += 8;

      // Draw rows
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      
      const itemsList = inv.items || [];
      itemsList.forEach((item: any, index: number) => {
        // Simple alternate rows decoration
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
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

      // Summary section alignment
      const summaryLabelX = 140;
      const summaryValueX = 192;

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);

      // Subtotal
      doc.text('Subtotal:', summaryLabelX, currentY);
      doc.text(`${symbol} ${inv.subtotal.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
      currentY += 5;

      // Tax
      doc.text(`Tax (${inv.taxRate}%):`, summaryLabelX, currentY);
      doc.text(`+ ${symbol} ${inv.taxAmount.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
      currentY += 5;

      // Discount if any
      if (inv.discount > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text('Discount:', summaryLabelX, currentY);
        doc.text(`- ${symbol} ${inv.discount.toFixed(2)}`, summaryValueX, currentY, { align: 'right' });
        currentY += 5;
        doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      }

      // Grand Total line
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('Total Payable:', summaryLabelX, currentY + 2);
      doc.text(`${symbol} ${inv.total.toFixed(2)}`, summaryValueX, currentY + 2, { align: 'right' });

      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Amount Paid:', summaryLabelX, currentY + 2);
      doc.text(`${symbol} ${(inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0)).toFixed(2)}`, summaryValueX, currentY + 2, { align: 'right' });

      currentY += 5;
      doc.setFont('Helvetica', 'bold');
      if (inv.status === 'paid') {
        doc.setTextColor(16, 185, 129); // Green
      } else {
        doc.setTextColor(220, 38, 38); // Red
      }
      doc.text('Balance Due:', summaryLabelX, currentY + 2);
      doc.text(`${symbol} ${(inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total)).toFixed(2)}`, summaryValueX, currentY + 2, { align: 'right' });
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);

      // Clean Notes box block
      let notesY = currentY - (inv.discount > 0 ? 25 : 20);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Notes / Terms:', 15, notesY);
      doc.setFont('Helvetica', 'normal');
      
      const remarks = inv.notes || 'Default remarks: Please complete payments within due date. Thank you.';
      const lines = doc.splitTextToSize(remarks, 110);
      doc.text(lines, 15, notesY + 5);

      // Appreciation message replacing signature
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Page 1 of 1 | Invoice generated via modern system console.`, 15, 285);
      doc.text(`Thank you for your business! We appreciate your trust.`, 195, 285, { align: 'right' });

      doc.save(`Invoice_${inv.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF invoice:', err);
    }
  };

  const handleDownloadInvoice = async (invId: string) => {
    const invoices = getInvoices(user.id);
    const inv = invoices.find(i => i.id === invId);
    if (!inv) {
      alert("Invoice not found in records / انوائس نہیں ملی۔");
      return;
    }
    
    // Generate QR Code if possible
    const qrCode = await getQRCodeBase64(inv, user.companyName || 'Business Name', user.taxNumber || '', symbol);
    
    // Generate PDF
    downloadInvoicePDF(inv, qrCode);
  };

  const handleShareOnWhatsApp = (inv: any, phoneOverride?: string) => {
    const statusStr = inv.status === 'paid' ? 'PAID' : 'UNPAID';
    const amtPaid = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
    const balDue = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);
    const company = user.companyName || 'Our Business';
    
    // Auto deduce default prefix code
    const defaultCode = getDefaultPhoneCode(user.currency);
    const phoneToUse = phoneOverride || sharingPhone;
    const cleanedNum = cleanPhoneForWhatsApp(phoneToUse, defaultCode);
    
    const portalUrl = `${window.location.origin}?customerEmail=${encodeURIComponent(sharingEmail)}&customerPhone=${encodeURIComponent(phoneToUse)}&invoiceId=${inv.id}`;

    const text = `Hello! Here is your invoice from *${company}*:\n\n` +
                 `*Invoice Number*: ${inv.invoiceNumber}\n` +
                 `*Date*: ${inv.date}\n` +
                 `*Due Date*: ${inv.dueDate || 'N/A'}\n` +
                 `*Total Amount*: ${symbol}${inv.total.toFixed(2)}\n` +
                 `*Amount Paid*: ${symbol}${amtPaid.toFixed(2)}\n` +
                 `*Remaining Balance*: ${symbol}${balDue.toFixed(2)}\n` +
                 `*Status*: *${statusStr}*\n\n` +
                 `You can view the full secure invoice online here:\n${portalUrl}`;

    const waUrl = cleanedNum 
      ? `https://api.whatsapp.com/send?phone=${cleanedNum}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    
    window.open(waUrl, '_blank');
  };

  const handleShareOnEmail = (inv: any, emailOverride?: string) => {
    const statusStr = inv.status === 'paid' ? 'PAID' : 'UNPAID';
    const amtPaid = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
    const balDue = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);
    const company = user.companyName || 'Our Business';
    const targetEmail = emailOverride || sharingEmail;

    const portalUrl = `${window.location.origin}?customerEmail=${encodeURIComponent(targetEmail)}&customerPhone=${encodeURIComponent(sharingPhone)}&invoiceId=${inv.id}`;

    const subject = `Invoice ${inv.invoiceNumber} from ${company}`;
    const body = `Hello,\n\nPlease find the invoice summary below:\n\n` +
                 `Invoice Number: ${inv.invoiceNumber}\n` +
                 `Date: ${inv.date}\n` +
                 `Due Date: ${inv.dueDate || 'N/A'}\n` +
                 `Total Amount: ${symbol}${inv.total.toFixed(2)}\n` +
                 `Amount Paid: ${symbol}${amtPaid.toFixed(2)}\n` +
                 `Remaining Balance: ${symbol}${balDue.toFixed(2)}\n` +
                 `Status: ${statusStr}\n\n` +
                 `You can view and download the full invoice online using the secure link below:\n${portalUrl}\n\n` +
                 `Thank you,\n${company}`;

    const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleAutoGenerateInvoice = async (sale: Sale) => {
    // 1. Try to find the matching customer
    const trimmedName = sale.customerName.trim();
    const isWalking = trimmedName.toLowerCase() === 'walk-in customer' ||
                      trimmedName.toLowerCase() === 'walking' ||
                      trimmedName.toLowerCase() === 'walkin' ||
                      trimmedName.toLowerCase() === 'walk-in';

    let customerId = '';
    if (isWalking) {
      customerId = 'walk-in';
    } else {
      const customer = customers.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
      if (customer) {
        customerId = customer.id;
      } else {
        // Direct manual customer mode supported natively is 'manual'
        customerId = 'manual';
      }
    }

    // 2. Map sale detail or basket list
    let invoiceItems: InvoiceItem[] = [];
    let subtotal = sale.amount;
    let taxAmount = 0;
    let discount = 0;

    if (sale.items && sale.items.length > 0) {
      invoiceItems = sale.items;
      // Re-map totals
      subtotal = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      // Deduce proportional tax if any
      const taxRate = user.taxRate || 0;
      if (taxRate > 0) {
        // Simple backward tax allocation if the sale total matches
        taxAmount = (subtotal * taxRate) / 100;
      }
      discount = Math.max(0, (subtotal + taxAmount) - sale.amount);
    } else {
      invoiceItems = [{
        productId: 'DIRECT-SALE',
        productName: sale.description || `${sale.category} Product Sale Item`,
        quantity: 1,
        price: sale.amount,
        total: sale.amount
      }];
    }

    // 3. Insert Invoice and link back to this sale's ID
    const newInv = addInvoice(user.id, {
      customerId: customerId,
      customerName: sale.customerName,
      date: sale.date,
      dueDate: sale.date,
      items: invoiceItems,
      subtotal: subtotal,
      taxRate: user.taxRate || 0,
      taxAmount: taxAmount,
      discount: discount,
      total: sale.amount,
      amountPaid: sale.amount,
      balanceDue: 0,
      notes: sale.description || `Auto-generated from Sales POS transaction #${sale.id.toUpperCase()}`,
      status: 'paid',
      paymentMethod: sale.paymentMethod,
    }, sale.id);

    // Refresh statistics and listing
    handleRefresh();

    // Automatically trigger PDF download
    const qrCode = await getQRCodeBase64(newInv, user.companyName || 'Business Name', user.taxNumber || '', symbol);
    downloadInvoicePDF(newInv, qrCode);
    return newInv;
  };

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    
    let saleAmount = parseFloat(amount);
    if (saleType === 'itemized') {
      if (basket.length === 0) {
        alert(user.language === 'ur' ? 'براہ مہربانی باسکٹ میں کم از کم ایک پروڈکٹ شامل کریں۔' : 'Please add at least one product into your basket before saving.');
        return;
      }
      // Sum the basket totals
      const sub = basket.reduce((sum, item) => sum + item.total, 0);
      const discount = parseFloat(disValue) || 0;
      const txVal = parseFloat(txRateValue) || 0;
      const tax = (sub * txVal) / 100;
      saleAmount = Math.max(0, sub + tax - discount);
    }

    if (isNaN(saleAmount) || saleAmount <= 0) {
      alert(user.language === 'ur' ? 'کل رقم 0 سے زیادہ ہونی چاہیے۔' : 'Total amount must be greater than zero.');
      return;
    }

    let finalCustomerName = customerName.trim();
    if (!finalCustomerName) {
      finalCustomerName = 'Walk-In Customer';
    }

    const isWalking = finalCustomerName.toLowerCase() === 'walk-in customer' ||
                      finalCustomerName.toLowerCase() === 'walking' ||
                      finalCustomerName.toLowerCase() === 'walkin' ||
                      finalCustomerName.toLowerCase() === 'walk-in';

    const alreadyExists = customers.some(c => c.name.toLowerCase() === finalCustomerName.toLowerCase());

    // Auto record new customer profile if requested and not walk-in
    if (registerNewCustomer && !isWalking && !alreadyExists) {
      addCustomer(user.id, {
        name: finalCustomerName,
        email: newCustEmail,
        phone: newCustPhone,
        address: '',
        isApproved: true
      });
    }

    // Deduct stock if itemized sale type is checked
    if (saleType === 'itemized') {
      basket.forEach(item => {
        const originalProd = products.find(p => p.id === item.productId);
        if (originalProd) {
          const updatedStock = Math.max(0, originalProd.stock - item.quantity);
          editProduct(user.id, {
            ...originalProd,
            stock: updatedStock
          });
        }
      });
    }

    // Determine default description for itemized items if none entered
    let finalDesc = description.trim();
    if (saleType === 'itemized' && !finalDesc) {
      finalDesc = basket.map(item => `${item.quantity}x ${item.productName}`).join(', ');
    }

    const recordedSale = addSale(user.id, {
      customerName: finalCustomerName,
      amount: saleAmount,
      category: saleType === 'itemized' ? 'Product Sales' : category,
      description: finalDesc || 'Direct cash sale',
      date,
      paymentMethod,
      invoiceId: invoiceId || undefined,
      items: saleType === 'itemized' ? basket : undefined,
    });

    if (autoGenInvoice) {
      handleAutoGenerateInvoice(recordedSale).then(() => {
        const list = getSales(user.id);
        const updated = list.find(s => s.id === recordedSale.id);
        if (updated) {
          setDetailSale(updated);
        }
      });
    } else {
      setDetailSale(recordedSale);
    }

    // Reset fields
    setCustomerName('');
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('cash');
    setInvoiceId('');
    setRegisterNewCustomer(false);
    setNewCustPhone('');
    setNewCustEmail('');
    setAutoGenInvoice(false);
    setBasket([]);
    setSearchProductQuery('');
    setDisValue('0');
    setTxRateValue(user.taxRate ? user.taxRate.toString() : '0');
    setSaleType('simple');
    setShowAddModal(false);
    handleRefresh();
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  // Basket operation handlers
  const handleAddToBasket = (prod: Product) => {
    const existing = basket.find(item => item.productId === prod.id);
    const addedQty = existing ? existing.quantity : 0;
    
    if (addedQty >= prod.stock) {
      alert(user.language === 'ur' ? `صرف ${prod.stock} آئٹمز اسٹاک میں دستیاب ہیں۔` : `Only ${prod.stock} items are available in stock.`);
      return;
    }

    if (existing) {
      const updated = basket.map(item => {
        if (item.productId === prod.id) {
          const nextQty = item.quantity + 1;
          return {
            ...item,
            quantity: nextQty,
            total: nextQty * item.price
          };
        }
        return item;
      });
      setBasket(updated);
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

  const handleUpdateBasketQty = (productId: string, delta: number) => {
    const originalProd = products.find(p => p.id === productId);
    const updated = basket.map(item => {
      if (item.productId === productId) {
        const nextQty = item.quantity + delta;
        if (originalProd && nextQty > originalProd.stock) {
          alert(user.language === 'ur' ? `صرف ${originalProd.stock} آئٹمز اسٹاک میں دستیاب ہیں۔` : `Only ${originalProd.stock} items are available in stock.`);
          return item;
        }
        if (nextQty <= 0) return null;
        return {
          ...item,
          quantity: nextQty,
          total: nextQty * item.price
        };
      }
      return item;
    }).filter(Boolean) as InvoiceItem[];
    setBasket(updated);
  };

  const handleRemoveFromBasket = (productId: string) => {
    setBasket(basket.filter(item => item.productId !== productId));
  };

  const handleStartEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setEditCustomerName(sale.customerName);
    setEditAmount(sale.amount.toString());
    setEditCategory(sale.category || 'Product Sales');
    setEditDescription(sale.description);
    setEditDate(sale.date);
    setEditPaymentMethod(sale.paymentMethod);
    setEditSaleType(sale.items && sale.items.length > 0 ? 'itemized' : 'simple');
    setEditBasket(sale.items || []);
    
    if (sale.items && sale.items.length > 0) {
      const sub = sale.items.reduce((sum, item) => sum + item.total, 0);
      const taxRate = user.taxRate || 0;
      setEditTxRateValue(taxRate.toString());
      const taxAmount = (sub * taxRate) / 100;
      const expectedTotalBeforeDiscount = sub + taxAmount;
      const discount = Math.max(0, expectedTotalBeforeDiscount - sale.amount);
      setEditDisValue(discount.toFixed(0));
    } else {
      setEditDisValue('0');
      setEditTxRateValue(user.taxRate ? user.taxRate.toString() : '0');
    }
    setEditRegisterNewCustomer(false);
    setIsEditCustDropdownOpen(false);
    setSearchEditProductQuery('');
  };

  const handleUpdateSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale) return;

    let saleAmount = parseFloat(editAmount);
    if (editSaleType === 'itemized') {
      if (editBasket.length === 0) {
        alert(user.language === 'ur' ? 'براہ مہربانی باسکٹ میں کم از کم ایک پروڈکٹ شامل کریں۔' : 'Please add at least one product into your basket before saving.');
        return;
      }
      const sub = editBasket.reduce((sum, item) => sum + item.total, 0);
      const discount = parseFloat(editDisValue) || 0;
      const txVal = parseFloat(editTxRateValue) || 0;
      const tax = (sub * txVal) / 100;
      saleAmount = Math.max(0, sub + tax - discount);
    }

    if (isNaN(saleAmount) || saleAmount <= 0) {
      alert(user.language === 'ur' ? 'کل رقم 0 سے زیادہ ہونی چاہیے۔' : 'Total amount must be greater than zero.');
      return;
    }

    let finalCustomerName = editCustomerName.trim() || 'Walk-In Customer';
    const isWalking = finalCustomerName.toLowerCase() === 'walk-in customer' ||
                      finalCustomerName.toLowerCase() === 'walking' ||
                      finalCustomerName.toLowerCase() === 'walkin' ||
                      finalCustomerName.toLowerCase() === 'walk-in';

    const alreadyExists = customers.some(c => c.name.toLowerCase() === finalCustomerName.toLowerCase());

    if (editRegisterNewCustomer && !isWalking && !alreadyExists) {
      addCustomer(user.id, {
        name: finalCustomerName,
        email: '',
        phone: '',
        address: '',
        isApproved: true
      });
    }

    // Revert stock of previous itemized sale
    if (editingSale.items && editingSale.items.length > 0) {
      editingSale.items.forEach(item => {
        const originalProd = products.find(p => p.id === item.productId);
        if (originalProd) {
          editProduct(user.id, {
            ...originalProd,
            stock: originalProd.stock + item.quantity
          });
        }
      });
    }

    // Deduct stock for the edited itemized sale
    if (editSaleType === 'itemized') {
      const freshProducts = getProducts(user.id);
      editBasket.forEach(item => {
        const originalProd = freshProducts.find(p => p.id === item.productId);
        if (originalProd) {
          const updatedStock = Math.max(0, originalProd.stock - item.quantity);
          editProduct(user.id, {
            ...originalProd,
            stock: updatedStock
          });
        }
      });
    }

    let finalDesc = editDescription.trim();
    if (editSaleType === 'itemized' && !finalDesc) {
      finalDesc = editBasket.map(item => `${item.quantity}x ${item.productName}`).join(', ');
    }

    const updatedSale: Sale = {
      ...editingSale,
      customerName: finalCustomerName,
      amount: saleAmount,
      category: editSaleType === 'itemized' ? 'Product Sales' : editCategory,
      description: finalDesc || 'Edited sale',
      date: editDate,
      paymentMethod: editPaymentMethod,
      items: editSaleType === 'itemized' ? editBasket : undefined,
    };

    editSale(user.id, updatedSale);
    setEditingSale(null);
    handleRefresh();
  };

  const handleAddToEditBasket = (prod: Product) => {
    const existing = editBasket.find(item => item.productId === prod.id);
    const addedQty = existing ? existing.quantity : 0;
    const previouslyDeducted = (editingSale?.items?.find(i => i.productId === prod.id)?.quantity || 0);
    const maxAllowedStock = prod.stock + previouslyDeducted;

    if (addedQty >= maxAllowedStock) {
      alert(user.language === 'ur' ? `صرف ${maxAllowedStock} آئٹمز اسٹاک میں دستیاب ہیں۔` : `Only ${maxAllowedStock} items are available in stock.`);
      return;
    }

    if (existing) {
      const updated = editBasket.map(item => {
        if (item.productId === prod.id) {
          const nextQty = item.quantity + 1;
          return {
            ...item,
            quantity: nextQty,
            total: nextQty * item.price
          };
        }
        return item;
      });
      setEditBasket(updated);
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

  const handleUpdateEditBasketQty = (productId: string, delta: number) => {
    const originalProd = products.find(p => p.id === productId);
    const updated = editBasket.map(item => {
      if (item.productId === productId) {
        const nextQty = item.quantity + delta;
        const previouslyDeducted = (editingSale?.items?.find(i => i.productId === productId)?.quantity || 0);
        const maxAllowed = (originalProd?.stock || 0) + previouslyDeducted;

        if (nextQty > maxAllowed) {
          alert(user.language === 'ur' ? `صرف ${maxAllowed} آئٹمز اسٹاک میں دستیاب ہیں۔` : `Only ${maxAllowed} items are available in stock.`);
          return item;
        }
        if (nextQty <= 0) return null;
        return {
          ...item,
          quantity: nextQty,
          total: nextQty * item.price
        };
      }
      return item;
    }).filter(Boolean) as InvoiceItem[];
    setEditBasket(updated);
  };

  const handleRemoveFromEditBasket = (productId: string) => {
    setEditBasket(editBasket.filter(item => item.productId !== productId));
  };

  const filteredProductsPOS = products.filter(p =>
    p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchProductQuery.toLowerCase())
  );

  const filteredProductsEditPOS = products.filter(p =>
    p.name.toLowerCase().includes(searchEditProductQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchEditProductQuery.toLowerCase())
  );

  const basketSubtotal = basket.reduce((sum, item) => sum + item.total, 0);
  const basketDiscount = parseFloat(disValue) || 0;
  const basketTaxRate = parseFloat(txRateValue) || 0;
  const basketTaxAmount = (basketSubtotal * basketTaxRate) / 100;
  const basketGrandTotal = Math.max(0, basketSubtotal + basketTaxAmount - basketDiscount);

  const editBasketSubtotal = editBasket.reduce((sum, item) => sum + item.total, 0);
  const editBasketDiscount = parseFloat(editDisValue) || 0;
  const editBasketTaxRate = parseFloat(editTxRateValue) || 0;
  const editBasketTaxAmount = (editBasketSubtotal * editBasketTaxRate) / 100;
  const editBasketGrandTotal = Math.max(0, editBasketSubtotal + editBasketTaxAmount - editBasketDiscount);

  // Categories list
  const categories = ['Product Sales', 'Consulting', 'Services', 'Subscriptions', 'Other'];

  const matchedCustomer = customers.find(c => c.name.toLowerCase() === customerName.trim().toLowerCase());
  const pendingInvoices = matchedCustomer 
    ? allInvoices.filter(inv => inv.customerId === matchedCustomer.id && (inv.status === 'unpaid' || inv.status === 'overdue'))
    : [];

  const filteredCustomersList = customers.filter(c => 
    c.name.toLowerCase().includes(customerName.toLowerCase()) ||
    (c.phone && c.phone.toLowerCase().includes(customerName.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(customerName.toLowerCase()))
  );

  // Filters
  const filteredSales = sales.filter(s => {
    const cust = customers.find(c => c.name.toLowerCase() === s.customerName.toLowerCase());
    const matchesPhone = cust && cust.phone ? cust.phone.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const matchesSearch = s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
      {/* Module Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-indigo-400" />
            {t.sales}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Record and monitor all revenue flow channels and direct cash receipts.</p>
        </div>
        <button
          onClick={() => {
            setCustomerName('');
            setRegisterNewCustomer(false);
            setAutoGenInvoice(false);
            setIsCustDropdownOpen(false);
            setAmount('');
            setDescription('');
            setInvoiceId('');
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t.addSale}
        </button>
      </div>

      {/* Filters Bench */}
      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${isRtl ? 'left-3' : 'right-3'}`} />
          <input
            type="text"
            placeholder={t.search}
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
            <option value="all">
              {user.language === 'ur' ? 'تمام گاہک (All Customers)' : 'All Customers'}
            </option>
            {/* Find unique customer names present in sales to make filtering list clean */}
            {(Array.from(new Set(sales.map(s => s.customerName.trim()))) as string[]).map(cName => (
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
            <option value="all">{user.language === 'ur' ? 'تمام کیٹیگریز' : 'All Categories'}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Total stats under current filters */}
        <div className="bg-slate-950/60 rounded-xl px-4 py-2 border border-slate-900 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {user.language === 'ur' ? 'فلٹر شدہ آمدنی:' : 'Filtered Amount:'}
          </span>
          <span className="font-extrabold text-emerald-400 font-mono">
            {formatMoney(filteredSales.reduce((sum, s) => sum + s.amount, 0))}
          </span>
        </div>
      </div>

      {/* Listing layout */}
      <div className="bg-slate-900/20 rounded-2xl border border-slate-850 overflow-hidden shadow-xl">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-4">{t.date}</th>
                <th className="px-5 py-4">Customer Name</th>
                <th className="px-5 py-4">{t.category}</th>
                <th className="px-5 py-4">{t.description}</th>
                <th className="px-5 py-4">{t.paymentMethod}</th>
                <th className="px-5 py-4 text-right">{t.amount}</th>
                <th className="px-5 py-4 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 italic text-slate-500">
                    No matching sales transactions found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    className="hover:bg-slate-800/40 transition cursor-pointer"
                    onClick={() => setDetailSale(sale)}
                  >
                    <td className="px-5 py-4 whitespace-nowrap text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{sale.date}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailSale(sale);
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white text-indigo-300 font-extrabold transition cursor-pointer flex items-center gap-1 border border-slate-700/60"
                          title="View Details / تفصیل دیکھیں"
                        >
                          👁️ {user.language === 'ur' ? 'تفصیل' : 'Details'}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-white whitespace-nowrap">
                      <div>{sale.customerName}</div>
                      {sale.invoiceId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadInvoice(sale.invoiceId!);
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-extrabold font-mono mt-0.5 flex items-center gap-1 cursor-pointer hover:underline"
                          title="Download PDF Invoice / انوائس ڈاؤن لوڈ کریں"
                        >
                          🧾 Linked Invoice: {sale.invoiceId}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="bg-slate-800 text-indigo-200 px-2 py-0.5 rounded text-[10px] font-medium border border-slate-700">{sale.category}</span>
                    </td>
                    <td className="px-5 py-4 max-w-xs truncate" title={sale.description}>{sale.description || '-'}</td>
                    <td className="px-5 py-4 whitespace-nowrap capitalize">
                      <span className="bg-indigo-950/50 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-black text-emerald-400 whitespace-nowrap">
                      {formatMoney(sale.amount)}
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      {!sale.invoiceId ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAutoGenerateInvoice(sale);
                          }}
                          className="mr-2 text-[10px] bg-indigo-950/40 text-indigo-400 border border-indigo-500/25 font-extrabold hover:bg-indigo-950/80 px-2.5 py-1 rounded-lg hover:text-indigo-300 transition cursor-pointer"
                          title="Generate Invoice from Sales"
                        >
                          🧾 Auto-Invoice
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadInvoice(sale.invoiceId!);
                          }}
                          className="mr-2 text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/25 font-extrabold hover:bg-emerald-950/85 px-2.5 py-1 rounded-lg hover:text-emerald-300 transition cursor-pointer inline-flex items-center gap-1"
                          title="Download PDF Invoice / پی ڈی ایف انوائس ڈاؤن لوڈ کریں"
                        >
                          📄 PDF
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditSale(sale);
                        }}
                        className="p-1 px-2 hover:bg-indigo-500/10 hover:text-indigo-400 text-slate-400 rounded transition cursor-pointer"
                        title="Edit sale record"
                      >
                        <Edit2 className="w-4 h-4 inline-block" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(sale.id);
                        }}
                        className="p-1 px-2 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded transition cursor-pointer"
                        title="Delete sale record"
                      >
                        <Trash2 className="w-4 h-4 inline-block" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Layout stack */}
        <div className="block md:hidden divide-y divide-slate-800/80">
          {filteredSales.length === 0 ? (
            <div className="p-8 text-center italic text-slate-500 text-xs">No transactions match the selected criteria.</div>
          ) : (
            filteredSales.map((sale) => (
              <div 
                key={sale.id} 
                className="p-4 bg-slate-950/20 flex flex-col gap-2.5 cursor-pointer hover:bg-slate-800/20 transition duration-150"
                onClick={() => setDetailSale(sale)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">{sale.date}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailSale(sale);
                        }}
                        className="text-[9px] bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-300 hover:text-white font-bold px-1.5 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                        title="View Details / تفصیل دیکھیں"
                      >
                        👁️ {user.language === 'ur' ? 'تفصیل' : 'Details'}
                      </button>
                    </div>
                    <h4 className="font-extrabold text-white text-sm mt-1 hover:underline">{sale.customerName}</h4>
                    {sale.invoiceId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(sale.invoiceId!);
                        }}
                        className="text-[10px] text-indigo-300 hover:text-indigo-200 font-bold font-mono mt-0.5 block text-left cursor-pointer hover:underline"
                        title="Download PDF Invoice / انوائس ڈاؤن لوڈ کریں"
                      >
                        🧾 Linked Invoice: {sale.invoiceId}
                      </button>
                    )}
                  </div>
                  <span className="font-black text-sm text-emerald-400">{formatMoney(sale.amount)}</span>
                </div>
                
                <div className="text-xs text-slate-400">{sale.description || 'No description'}</div>

                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-900">
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{sale.category}</span>
                    <span className="bg-indigo-950/40 text-indigo-300 px-1.5 py-0.5 rounded uppercase">{sale.paymentMethod}</span>
                    {!sale.invoiceId ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAutoGenerateInvoice(sale);
                        }}
                        className="text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-800 text-indigo-400 font-bold px-1.5 py-0.5 rounded transition cursor-pointer"
                      >
                        🧾 Auto-Invoice
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadInvoice(sale.invoiceId!);
                        }}
                        className="text-[9px] bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-800/30 text-emerald-400 font-bold px-1.5 py-0.5 rounded transition cursor-pointer"
                        title="Download PDF Invoice / پی ڈی ایف انوائس ڈاؤن لوڈ کریں"
                      >
                        📄 Download PDF
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditSale(sale);
                      }}
                      className="text-indigo-400 font-bold hover:underline cursor-pointer text-[10px]"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(sale.id);
                      }}
                      className="text-rose-400 font-bold hover:underline cursor-pointer text-[10px]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Sale Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-300 relative z-50"
          >
            {/* Modal Header */}
            <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-indigo-400" />
                {t.addSale}
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
                {saleType === 'simple' ? '⚡ Direct' : '🛍️ POS Basket'}
              </span>
            </div>

            <form onSubmit={handleCreateSale} className="flex-1 flex flex-col overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                {/* Sale Mode Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400">
                    {user.language === 'ur' ? 'سیلز انٹری کا طریقہ منتخب کریں:' : 'Select Entry Method:'}
                  </label>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                    <button
                      type="button"
                      onClick={() => setSaleType('simple')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                        saleType === 'simple'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{user.language === 'ur' ? 'سادہ انٹری ' : 'Simple Entry'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSaleType('itemized')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                        saleType === 'itemized'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{user.language === 'ur' ? 'آئٹمائزڈ پوس (POS)' : 'Itemized POS'}</span>
                    </button>
                  </div>
                </div>

                {/* Customer Section */}
                <div className="space-y-1 relative border-t border-slate-900/50 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-400 text-xs">
                      {user.language === 'ur' ? 'گاہک کا نام (اختیاری):' : 'Customer Name (Optional):'}
                    </label>
                  </div>

                  {/* Customer Type Quick Selector */}
                  <div className="flex gap-1.5 mb-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('Walk-In Customer');
                        setRegisterNewCustomer(false);
                        setIsCustDropdownOpen(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                        customerName === 'Walk-In Customer' || !customerName.trim()
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-950/40 text-slate-500 border-slate-900 hover:bg-slate-900 hover:text-slate-300'
                      }`}
                    >
                      🚶 {user.language === 'ur' ? 'عام واک ان' : 'Walk-In Customer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('');
                        setRegisterNewCustomer(false);
                        setIsCustDropdownOpen(true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                        customerName && customerName !== 'Walk-In Customer' && customers.some(c => c.name.toLowerCase() === customerName.toLowerCase())
                          ? 'bg-indigo-950/80 text-indigo-400 border-indigo-500/30'
                          : 'bg-slate-950/40 text-slate-500 border-slate-900 hover:bg-slate-900 hover:text-slate-300'
                      }`}
                    >
                      🔍 {user.language === 'ur' ? 'محفوظ کھاتہ' : 'Find Saved'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerName('Manual Customer');
                        setRegisterNewCustomer(false);
                        setIsCustDropdownOpen(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all border cursor-pointer ${
                        customerName && customerName !== 'Walk-In Customer' && !customers.some(c => c.name.toLowerCase() === customerName.toLowerCase())
                          ? 'bg-amber-950/80 text-amber-500 border-amber-500/30'
                          : 'bg-slate-950/40 text-slate-500 border-slate-900 hover:bg-slate-900 hover:text-slate-300'
                      }`}
                    >
                      ✍️ {user.language === 'ur' ? 'دستی کسٹمر ' : 'Manual / Temporary'}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder={user.language === 'ur' ? 'خالی چھوڑنے سے عام کسٹمر واک ان ہوگا...' : 'Optional - empty defaults to Walk-In Customer...'}
                      value={customerName}
                      onFocus={() => setIsCustDropdownOpen(true)}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setIsCustDropdownOpen(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none transition"
                    />
                    <div className="absolute right-3 top-3 flex items-center gap-1 text-slate-500">
                      <Search className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Dynamic Indicator Status Pill */}
                  {(() => {
                    const trimmed = customerName.trim();
                    const isWalking = trimmed === 'Walk-In Customer' || !trimmed;
                    if (isWalking) {
                      return (
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold px-1 py-0.5 animate-fade-in mt-0.5">
                          <span>🚶 {user.language === 'ur' ? 'واک ان کسٹمر (عام سیل)' : 'Walk-In Customer (Cash Sale / No database record)'}</span>
                        </div>
                      );
                    }
                    const isSaved = customers.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
                    if (isSaved) {
                      return (
                        <div className="text-[10px] text-indigo-400 flex items-center gap-1 font-semibold px-1 py-0.5 animate-fade-in mt-0.5">
                          <span>✅ {user.language === 'ur' ? 'محفوظ شدہ کھاتہ منسلک ' : 'Saved Customer Profile Linked'}</span>
                        </div>
                      );
                    }
                    if (registerNewCustomer) {
                      return (
                        <div className="text-[10px] text-indigo-300 flex items-center gap-1 font-semibold px-1 py-0.5 animate-fade-in mt-0.5">
                          <span>➕ {user.language === 'ur' ? 'نیا کھاتہ سبمٹ پر بن جائے گا' : 'New Customer Profile will be saved on submit'}</span>
                        </div>
                      );
                    }
                    return (
                      <div className="text-[10px] text-amber-500 flex items-center gap-1 font-semibold px-1 py-0.5 animate-fade-in mt-0.5">
                        <span>✍️ {user.language === 'ur' ? 'عارضی کسٹمر (محفوظ نہیں ہوگا)' : 'Temporary Manual Customer (One-time Sale / Unsaved)'}</span>
                      </div>
                    );
                  })()}

                  {isCustDropdownOpen && (
                    <div className="absolute left-0 right-0 z-[60] mt-1 max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                      <div
                        onClick={() => {
                          setCustomerName('Walk-In Customer');
                          setRegisterNewCustomer(false);
                          setIsCustDropdownOpen(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition text-left"
                      >
                        <div>
                          <div className="font-bold text-emerald-400 flex items-center gap-1">
                            <span>🚶 Walk-In Customer</span>
                            <span className="text-[9px] bg-emerald-950/40 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-900/40 font-normal">Walking / default</span>
                          </div>
                          <div className="text-[10px] text-slate-500">Quick direct cash sales without registration</div>
                        </div>
                      </div>

                      <div className="border-t border-slate-900 my-1 font-bold" />

                      {filteredCustomersList.length === 0 ? (
                        <div className="p-2 text-slate-500 italic text-center text-[10px]">
                          No saved database matches for "{customerName}"
                        </div>
                      ) : (
                        filteredCustomersList.map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setCustomerName(cust.name);
                              setRegisterNewCustomer(false);
                              setIsCustDropdownOpen(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition text-left"
                          >
                            <div>
                              <div className="font-bold text-white text-xs">{cust.name}</div>
                              <div className="text-[9px] text-slate-400 flex items-center gap-2 mt-0.5">
                                {cust.phone && <span>📞 {cust.phone}</span>}
                                {cust.email && <span>✉️ {cust.email}</span>}
                              </div>
                            </div>
                            <span className="text-[8px] bg-indigo-950/60 text-sky-400 border border-indigo-900/50 px-2 py-0.5 rounded font-extrabold font-mono uppercase tracking-widest shrink-0">
                              Saved
                            </span>
                          </div>
                        ))
                      )}

                      {customerName.trim() && 
                       customerName.toLowerCase() !== 'walk-in customer' && 
                       !customers.some(c => c.name.toLowerCase() === customerName.trim().toLowerCase()) && (
                        <>
                          <div className="border-t border-slate-900 my-1" />
                          <div
                            onClick={() => {
                              setRegisterNewCustomer(true);
                              setIsCustDropdownOpen(false);
                            }}
                            className="p-2 rounded-lg bg-indigo-950/20 hover:bg-indigo-950/45 border border-indigo-500/10 cursor-pointer transition text-left flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-indigo-300 text-xs flex items-center gap-1">
                                <span>➕ Auto-Save: "{customerName}"</span>
                              </div>
                              <div className="text-[10px] text-slate-400">Save as a permanent customer record</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Inline Quick Save option */}
                  {customerName.trim() && 
                   customerName.toLowerCase() !== 'walk-in customer' && 
                   !customers.some(c => c.name.toLowerCase() === customerName.trim().toLowerCase()) && (
                    <div className="flex flex-col gap-2 bg-slate-950/30 p-3 border border-slate-850 rounded-xl mt-1.5 transition">
                      <div className="flex items-center gap-2 select-none">
                        <input
                          type="checkbox"
                          id="save-new-customer-mem"
                          checked={registerNewCustomer}
                          onChange={(e) => setRegisterNewCustomer(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer shrink-0"
                        />
                        <label htmlFor="save-new-customer-mem" className="text-[11px] text-slate-400 font-bold cursor-pointer">
                          ➕ Save <strong className="text-white">"{customerName}"</strong> into customers memory register
                        </label>
                      </div>

                      {registerNewCustomer && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 px-1 py-1 border-t border-slate-900/60 pt-2 animate-fade-in">
                          <div className="space-y-0.5 animate-fade-in">
                            <label className="text-[9px] text-slate-400 font-extrabold uppercase">{user.language === 'ur' ? 'واٹس ایپ / موبائل نمبر:' : 'WhatsApp / Phone (e.g. 923001234567)'}</label>
                            <input
                              type="text"
                              placeholder="923001234567"
                              value={newCustPhone}
                              onChange={(e) => setNewCustPhone(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1 text-[11px] text-white font-mono placeholder-slate-700 outline-none font-bold"
                            />
                          </div>
                          <div className="space-y-0.5 animate-fade-in">
                            <label className="text-[9px] text-slate-400 font-extrabold uppercase">{user.language === 'ur' ? 'ای میل ایڈریس:' : 'Email Address:'}</label>
                            <input
                              type="email"
                              placeholder="customer@email.com"
                              value={newCustEmail}
                              onChange={(e) => setNewCustEmail(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-700 outline-none font-bold"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Settle outstanding invoice prompt */}
                {pendingInvoices.length > 0 && (
                  <div className="bg-indigo-950/45 border border-indigo-500/20 rounded-xl p-3.5 space-y-2 text-[11px]">
                    <div className="flex justify-between items-center">
                      <label className="font-extrabold text-indigo-300 block text-[10px] uppercase tracking-wider">
                        🔗 Outstanding Invoice Found ({pendingInvoices.length})
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Settle an outstanding invoice for this customer with this sale transaction?
                    </p>
                    <select
                      value={invoiceId}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        setInvoiceId(selectedId);
                        if (selectedId) {
                          const matchedInv = pendingInvoices.find(inv => inv.id === selectedId);
                          if (matchedInv) {
                            setAmount(matchedInv.total.toString());
                            setDescription(`Settlement for Invoice #${matchedInv.invoiceNumber}`);
                            setCategory('Product Sales');
                            setSaleType('simple'); // Defaults to simple for direct settlement
                            if (matchedInv.paymentMethod) {
                              setPaymentMethod(matchedInv.paymentMethod as any);
                            }
                          }
                        } else {
                          setAmount('');
                          setDescription('');
                          setCategory('Product Sales');
                          setPaymentMethod('cash');
                        }
                      }}
                      className="w-full bg-slate-950 border border-indigo-500/30 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="">-- Direct Sale (Not Linked to any Invoice) --</option>
                      {pendingInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} (Total: {symbol} {inv.total.toLocaleString(undefined, {minimumFractionDigits: 2})})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* SIMPLE ENTRY FIELDS VIEW */}
                {saleType === 'simple' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">
                          {user.language === 'ur' ? 'کل رقم:' : 'Total Amount:'} ({symbol}) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required={saleType === 'simple'}
                          placeholder="99.99"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none transition text-sm font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">{t.date} *</label>
                        <input
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">{t.category}</label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">{t.paymentMethod}</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none"
                        >
                          <option value="cash">{t.cash}</option>
                          <option value="card">{t.card}</option>
                          <option value="bank">{t.bank}</option>
                          <option value="other">{t.other}</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-400">{t.description}</label>
                      <textarea
                        placeholder="Record custom comments or payment terms..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full h-16 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2 text-white placeholder-slate-600 outline-none resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* ITEMIZED POS VIEW */}
                {saleType === 'itemized' && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Catalog Loader & Search */}
                    <div className="bg-slate-950/60 p-4 border border-slate-850/80 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-900">
                        <div>
                          <h4 className="font-extrabold text-white text-xs flex items-center gap-1">
                            <ShoppingBag className="w-4 h-4 text-emerald-400" />
                            {user.language === 'ur' ? 'پروڈکٹ کیٹلاگ' : 'Product Inventory Catalog'}
                          </h4>
                          <p className="text-[10px] text-slate-400">Search products to add to checkout basket.</p>
                        </div>
                        <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-lg font-mono">
                          {products.length} Products
                        </span>
                      </div>

                      {/* Product search box */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={user.language === 'ur' ? 'نام یا مینوفیکچرر کوڈ / SKU سے تلاش کریں...' : 'Search items by name, SKU/code...'}
                          value={searchProductQuery}
                          onChange={(e) => setSearchProductQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 px-3.5 py-2 rounded-xl text-white outline-none text-xs transition"
                        />
                        <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-500" />
                      </div>

                      {/* Live filtered products lists */}
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-900 scrollbar-thin scrollbar-thumb-slate-800 space-y-1.5 pr-1 pt-1">
                        {filteredProductsPOS.length === 0 ? (
                          <div className="p-4 text-center italic text-slate-500 text-[11px]">
                            No matching stock items found in inventory list.
                          </div>
                        ) : (
                          filteredProductsPOS.map(p => {
                            const inBasketItem = basket.find(item => item.productId === p.id);
                            const basketQty = inBasketItem ? inBasketItem.quantity : 0;
                            const isLowStock = p.stock <= p.minStockAlert;
                            const isOutOfStock = p.stock <= 0;

                            return (
                              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-xl bg-slate-900/40 hover:bg-slate-900 transition gap-2 text-left">
                                <div>
                                  <div className="font-bold text-white text-xs flex items-center gap-1.5 flex-wrap">
                                    <span>{p.name}</span>
                                    <span className="text-[9px] font-mono font-normal text-slate-500 bg-slate-950 p-0.5 px-1.5 rounded">{p.sku}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-0.5 flex-wrap">
                                    <span className="text-emerald-400 font-extrabold">{formatMoney(p.price)}</span>
                                    <span className="flex items-center gap-1.5">
                                      <span>Stock:</span>
                                      <span className={`font-mono font-bold ${
                                        isOutOfStock 
                                          ? 'text-rose-500' 
                                          : isLowStock 
                                            ? 'text-amber-500 font-extrabold animate-pulse' 
                                            : 'text-slate-300'
                                      }`}>
                                        {p.stock} units
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-bold">
                                  {basketQty > 0 && (
                                    <span className="text-[10px] bg-indigo-950/60 border border-indigo-900/60 text-indigo-400 font-black px-2 py-0.5 rounded-lg">
                                      {basketQty} in basket
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => handleAddToBasket(p)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                      isOutOfStock
                                        ? 'bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800'
                                        : 'bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white'
                                    }`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{user.language === 'ur' ? 'شامل کریں' : 'Add'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Active Basket list View */}
                    <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-3">
                      <h4 className="font-extrabold text-indigo-300 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-900">
                        <ShoppingCart className="w-4 h-4 text-indigo-400" />
                        {user.language === 'ur' ? 'موجودہ سیلز باسکٹ (POS Basket)' : 'Current Sale Items Basket'}
                        <span className="ml-auto text-[9px] bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded-full">
                          {basket.reduce((sum, item) => sum + item.quantity, 0)} items
                        </span>
                      </h4>

                      {basket.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 italic flex flex-col items-center justify-center gap-1">
                          <ShoppingCart className="w-8 h-8 text-slate-700 stroke-[1.5]" />
                          <span className="text-[11px] mt-1">Basket is currently empty. Scroll the catalog above to add products.</span>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-900/60 scrollbar-thin">
                          {basket.map(item => (
                            <div key={item.productId} className="flex justify-between items-center gap-3 pt-2 text-xs">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-white text-xs truncate" title={item.productName}>{item.productName}</h5>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {formatMoney(item.price)} each
                                </p>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                {/* Qty controller buttons */}
                                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 items-center">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateBasketQty(item.productId, -1)}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="font-bold min-w-6 text-center text-white text-[11px] font-mono">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateBasketQty(item.productId, 1)}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>

                                {/* Item Total */}
                                <span className="font-bold text-slate-200 min-w-[65px] text-right font-mono">
                                  {formatMoney(item.total)}
                                </span>

                                {/* Remove trash button */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromBasket(item.productId)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pricing, date & payment details for POS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/20 p-4 border border-slate-850/60 rounded-xl">
                      {/* Left: Metadata details */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-400">{t.date} *</label>
                          <input
                            type="date"
                            required
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-400">{t.paymentMethod}</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none text-xs"
                          >
                            <option value="cash">{t.cash}</option>
                            <option value="card">{t.card}</option>
                            <option value="bank">{t.bank}</option>
                            <option value="other">{t.other}</option>
                          </select>
                        </div>
                      </div>

                      {/* Right: Calculations */}
                      <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-slate-900 flex flex-col justify-between">
                        <div className="space-y-1.5 text-[10px]">
                          <div className="flex justify-between text-slate-400">
                            <span>Basket Subtotal:</span>
                            <span className="font-mono">{formatMoney(basketSubtotal)}</span>
                          </div>

                          <div className="flex items-center justify-between text-slate-400 gap-2">
                            <span>Discount ({symbol}):</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={disValue}
                              onChange={(e) => setDisValue(e.target.value || '0')}
                              className="w-16 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-white text-center font-mono text-[10px] outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between text-slate-400 gap-2">
                            <span>Tax Sales (%):</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={txRateValue}
                              onChange={(e) => setTxRateValue(e.target.value || '0')}
                              className="w-16 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-white text-center font-mono text-[10px] outline-none"
                            />
                          </div>
                        </div>

                        <div className="border-t border-slate-900 pt-2 flex items-center justify-between">
                          <span className="text-white font-extrabold text-xs">POS Grand Total:</span>
                          <span className="text-sm font-black text-emerald-400 font-mono">
                            {formatMoney(basketGrandTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Remarks Description for POS */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400">POS Custom Notes/Remarks (Optional)</label>
                      <input
                        type="text"
                        placeholder="Leave empty to automatically itemize catalog items as description..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Instant Invoice Generation Toggle */}
                <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="auto-create-invoice-toggle"
                      checked={autoGenInvoice}
                      onChange={(e) => setAutoGenInvoice(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="auto-create-invoice-toggle" className="text-xs text-slate-200 font-bold select-none cursor-pointer">
                      🧾 {user.language === 'ur' ? 'ساتھ ہی انوائس بھی بنائیں' : 'Auto-Generate Invoice for this Sale'}
                    </label>
                  </div>
                  <span className="text-[9px] text-indigo-400 font-extrabold uppercase bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/30">
                    {user.language === 'ur' ? 'انسٹنٹ انوائس' : 'Saves Time'}
                  </span>
                </div>
              </div>

              {/* Modal Footer (Actions Row) */}
              <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 shrink-0 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition font-semibold cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
                >
                  {t.addSale}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Sale Details Modal */}
      {detailSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setDetailSale(null)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden text-xs text-slate-300 relative z-50 animate-fade-in"
          >
            {/* Modal Header */}
            <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ReceiptText className="w-5 h-5 text-indigo-400" />
                {user.language === 'ur' ? 'تفصیلات سیلز ریکارڈ' : 'Sales Transaction Information'}
              </h3>
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-800">
              {/* Primary Total Banner */}
              <div className="bg-gradient-to-br from-indigo-950/40 to-slate-950/40 p-5 rounded-2xl border border-indigo-900/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Transaction Amount</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight mt-1 inline-block">
                    {formatMoney(detailSale.amount)}
                  </span>
                </div>
                <div className="bg-indigo-950/50 text-indigo-300 rounded-xl p-2.5 px-3 border border-indigo-900/30 text-right">
                  <span className="text-[10px] text-slate-400 block font-medium">Payment Method</span>
                  <span className="font-extrabold text-xs uppercase tracking-wider mt-0.5 inline-block">
                    💳 {detailSale.paymentMethod}
                  </span>
                </div>
              </div>

              {/* Grid with Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-850">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Customer Name:</span>
                  <span className="text-white font-bold block">{detailSale.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Transaction Date:</span>
                  <span className="text-white font-mono block">{detailSale.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Category / Channel:</span>
                  <span className="text-white block">
                    <span className="bg-slate-805 text-indigo-200 px-2.5 py-0.5 rounded text-[10px] font-bold border border-slate-800">
                      {detailSale.category}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-1">Receipt ID / Ref:</span>
                  <span className="text-indigo-400 font-mono font-bold uppercase tracking-wider block">
                    #{detailSale.id.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block">Description / Particulars:</span>
                <p className="bg-slate-950 p-3 rounded-xl text-slate-200 font-medium leading-relaxed border border-slate-900">
                  {detailSale.description || 'No detailed description.'}
                </p>
              </div>

              {/* Itemized POS Basket representation */}
              {detailSale.items && detailSale.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-400 font-bold block flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Itemized Products Basket ({detailSale.items.length})</span>
                  </span>
                  
                  <div className="border border-slate-850 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px] text-slate-300 bg-slate-950/40">
                      <thead className="bg-slate-950 text-slate-400 font-semibold uppercase text-[9px] border-b border-slate-850">
                        <tr>
                          <th className="px-4 py-2.5">Product</th>
                          <th className="px-4 py-2.5 text-center">Qty</th>
                          <th className="px-4 py-2.5 text-right">Unit Price</th>
                          <th className="px-4 py-2.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {detailSale.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/35 transition">
                            <td className="px-4 py-2 text-white font-bold">{item.productName}</td>
                            <td className="px-4 py-2 text-center font-mono font-bold text-slate-400">{item.quantity}</td>
                            <td className="px-4 py-2 text-right font-mono">{formatMoney(item.price)}</td>
                            <td className="px-4 py-2 text-right font-mono font-extrabold text-slate-200">{formatMoney(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Linked Invoice metadata card */}
              {detailSale.invoiceId ? (() => {
                const linkedInvoice = allInvoices.find(i => i.id === detailSale.invoiceId);
                return (
                  <div className="space-y-4">
                    <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider block">🧾 Reference Invoice Linked</span>
                        <span className="text-slate-300 font-medium block">Invoice Ref: <strong className="text-white font-mono">#{detailSale.invoiceId}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(detailSale.invoiceId!)}
                        className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-[10px] px-3.5 py-2 rounded-xl transition cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download Invoice (PDF)</span>
                      </button>
                    </div>

                    {/* Dispatch/Share Form */}
                    {linkedInvoice && (
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
                        <h4 className="font-extrabold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-900 pb-2">
                          <span>🚀 {user.language === 'ur' ? 'پی ڈی ایف انوائس شیئر / ارسال کریں:' : 'Dispatch / Share PDF Invoice:'}</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-1">
                          {/* WhatsApp Section */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] text-slate-400 font-bold block">
                                {user.language === 'ur' ? 'واٹس ایپ نمبر (موبائل):' : 'WhatsApp Number:'}
                              </label>
                              {customers.length > 0 && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      const matchedCust = customers.find(c => c.id === e.target.value);
                                      if (matchedCust) {
                                        setSharingPhone(matchedCust.phone || '');
                                        if (matchedCust.email) {
                                          setSharingEmail(matchedCust.email);
                                        }
                                      }
                                    }
                                  }}
                                  className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-indigo-400 font-bold max-w-[150px] outline-none cursor-pointer"
                                >
                                  <option value="">👤 {user.language === 'ur' ? 'محفوظ کردہ نمبر' : 'Saved phone...'}</option>
                                  {customers.filter(c => c.phone).map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                placeholder="923001234567"
                                value={sharingPhone}
                                onChange={(e) => setSharingPhone(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 font-bold outline-none font-mono text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleShareOnWhatsApp(linkedInvoice)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg transition shrink-0 flex items-center gap-1 cursor-pointer"
                                title="Share on WhatsApp"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{user.language === 'ur' ? 'بھجیں' : 'Send'}</span>
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-500 block">
                              {customers.some(c => c.phone === sharingPhone)
                                ? '✨ Saved customer contact'
                                : '✍️ Manual entry'}
                            </span>
                          </div>

                          {/* Email Section */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] text-slate-400 font-bold block">
                                {user.language === 'ur' ? 'ای میل ایڈریس:' : 'Email Address:'}
                              </label>
                              {customers.length > 0 && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      const matchedCust = customers.find(c => c.id === e.target.value);
                                      if (matchedCust) {
                                        setSharingEmail(matchedCust.email || '');
                                        if (matchedCust.phone) {
                                          setSharingPhone(matchedCust.phone);
                                        }
                                      }
                                    }
                                  }}
                                  className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[9px] text-indigo-400 font-bold max-w-[150px] outline-none cursor-pointer"
                                >
                                  <option value="">📧 {user.language === 'ur' ? 'محفوظ کردہ ای میل' : 'Saved email...'}</option>
                                  {customers.filter(c => c.email).map(c => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <input
                                type="email"
                                placeholder="customer@email.com"
                                value={sharingEmail}
                                onChange={(e) => setSharingEmail(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-600 font-semibold outline-none text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleShareOnEmail(linkedInvoice)}
                                className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg transition shrink-0 flex items-center gap-1 cursor-pointer"
                                title="Share by Email"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>{user.language === 'ur' ? 'ای میل' : 'Email'}</span>
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-500 block">
                              {customers.some(c => c.email === sharingEmail)
                                ? '✨ Saved customer email'
                                : '✍️ Manual entry'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="bg-slate-950 p-4 rounded-xl border border-dashed border-slate-800 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div>
                    <span className="text-amber-500 font-bold text-[10px] uppercase tracking-wider block flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{user.language === 'ur' ? 'پی ڈی ایف انوائس تیار نہیں' : 'No Linked PDF Invoice'}</span>
                    </span>
                    <span className="text-slate-400 mt-0.5 text-[11px] block leading-relaxed font-sans">
                      {user.language === 'ur' 
                        ? 'اس سیلز ریکارڈ کے لئے پی ڈی ایف انوائس ڈاؤن لوڈ یا پرنٹ کرنے کے لئے انوائس تیار کریں۔' 
                        : 'Generate an invoice for clients to download or print formatted PDFs.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleAutoGenerateInvoice(detailSale);
                      // Update this local state to show the newly linked invoice
                      const updatedSales = getSales(user.id);
                      const currentSale = updatedSales.find(s => s.id === detailSale.id);
                      if (currentSale) {
                        setDetailSale(currentSale);
                      }
                    }}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] px-3.5 py-2.5 rounded-xl transition cursor-pointer shrink-0"
                  >
                    <ReceiptText className="w-3.5 h-3.5" />
                    <span>{user.language === 'ur' ? 'انوائس تیار کریں' : 'Generate Invoice Now'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 shrink-0 flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setDetailSale(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setEditingSale(null)} />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs text-slate-300 relative z-50"
          >
            {/* Modal Header */}
            <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800 shrink-0 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                {user.language === 'ur' ? 'سیلز ریکارڈ کی تصحیح' : 'Edit Sales Record'}
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
                {editSaleType === 'simple' ? '⚡ Direct' : '🛍️ POS Basket'}
              </span>
            </div>

            <form onSubmit={handleUpdateSale} className="flex-1 flex flex-col overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
                {/* Sale Mode Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400">
                    {user.language === 'ur' ? 'سیلز انٹری کا طریقہ منتخب کریں:' : 'Select Entry Method:'}
                  </label>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850">
                    <button
                      type="button"
                      onClick={() => setEditSaleType('simple')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                        editSaleType === 'simple'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{user.language === 'ur' ? 'سادہ انٹری ' : 'Simple Entry'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditSaleType('itemized')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                        editSaleType === 'itemized'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>{user.language === 'ur' ? 'آئٹمائزڈ پوس (POS)' : 'Itemized POS'}</span>
                    </button>
                  </div>
                </div>

                {/* Customer Section */}
                <div className="space-y-1 relative">
                  <div className="flex justify-between items-center">
                    <label className="font-bold text-slate-400">
                      {user.language === 'ur' ? 'گاہک کا نام:' : 'Customer Name:'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditCustomerName('Walk-In Customer');
                        setEditRegisterNewCustomer(false);
                        setIsEditCustDropdownOpen(false);
                      }}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 font-extrabold flex items-center gap-1 transition uppercase tracking-wider bg-slate-950/40 hover:bg-slate-950/80 px-2.5 py-1 rounded border border-emerald-950 cursor-pointer"
                    >
                      🚶 {user.language === 'ur' ? 'واک ان (عام کسٹمر)' : 'Walk-In Customer'}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder={user.language === 'ur' ? 'گاہک کا نام درج کریں...' : 'Enter customer name...'}
                      value={editCustomerName}
                      onFocus={() => setIsEditCustDropdownOpen(true)}
                      onChange={(e) => {
                        setEditCustomerName(e.target.value);
                        setIsEditCustDropdownOpen(true);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none transition"
                    />
                    <div className="absolute right-3 top-3 flex items-center gap-1 text-slate-500">
                      <Search className="w-4 h-4" />
                    </div>
                  </div>

                  {isEditCustDropdownOpen && (
                    <div className="absolute left-0 right-0 z-[60] mt-1 max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                      <div
                        onClick={() => {
                          setEditCustomerName('Walk-In Customer');
                          setEditRegisterNewCustomer(false);
                          setIsEditCustDropdownOpen(false);
                        }}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition text-left"
                      >
                        <div>
                          <div className="font-bold text-emerald-400 flex items-center gap-1">
                            <span>🚶 Walk-In Customer</span>
                            <span className="text-[9px] bg-emerald-950/40 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-900/40 font-normal">Walking / default</span>
                          </div>
                          <div className="text-[10px] text-slate-500">Quick direct cash sales without registration</div>
                        </div>
                      </div>

                      <div className="border-t border-slate-900 my-1 font-bold" />

                      {filteredCustomersList.length === 0 ? (
                        <div className="p-2 text-slate-500 italic text-center text-[10px]">
                          No saved database matches for "{editCustomerName}"
                        </div>
                      ) : (
                        filteredCustomersList.filter(c => 
                          c.name.toLowerCase().includes(editCustomerName.toLowerCase()) ||
                          (c.phone && c.phone.toLowerCase().includes(editCustomerName.toLowerCase())) ||
                          (c.email && c.email.toLowerCase().includes(editCustomerName.toLowerCase()))
                        ).map((cust) => (
                          <div
                            key={cust.id}
                            onClick={() => {
                              setEditCustomerName(cust.name);
                              setEditRegisterNewCustomer(false);
                              setIsEditCustDropdownOpen(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-900 cursor-pointer transition text-left"
                          >
                            <div>
                              <div className="font-bold text-white text-xs">{cust.name}</div>
                              <div className="text-[9px] text-slate-400 flex items-center gap-2 mt-0.5 font-sans">
                                {cust.phone && <span>📞 {cust.phone}</span>}
                                {cust.email && <span>✉️ {cust.email}</span>}
                              </div>
                            </div>
                            <span className="text-[8px] bg-indigo-950/60 text-sky-400 border border-indigo-900/50 px-2 py-0.5 rounded font-extrabold font-mono uppercase tracking-widest shrink-0">
                              Saved
                            </span>
                          </div>
                        ))
                      )}

                      {editCustomerName.trim() && 
                       editCustomerName.toLowerCase() !== 'walk-in customer' && 
                       !customers.some(c => c.name.toLowerCase() === editCustomerName.trim().toLowerCase()) && (
                        <>
                          <div className="border-t border-slate-900 my-1" />
                          <div
                            onClick={() => {
                              setEditRegisterNewCustomer(true);
                              setIsEditCustDropdownOpen(false);
                            }}
                            className="p-2 rounded-lg bg-indigo-950/20 hover:bg-indigo-950/45 border border-indigo-500/10 cursor-pointer transition text-left flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-indigo-300 text-xs flex items-center gap-1">
                                <span>➕ Auto-Save: "{editCustomerName}"</span>
                              </div>
                              <div className="text-[10px] text-slate-400">Save as a permanent customer record</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Inline Quick Save option */}
                  {editCustomerName.trim() && 
                   editCustomerName.toLowerCase() !== 'walk-in customer' && 
                   !customers.some(c => c.name.toLowerCase() === editCustomerName.trim().toLowerCase()) && (
                    <div className="flex items-center gap-2 bg-slate-950/30 p-2 px-3 border border-slate-850 rounded-xl mt-1.5 transition select-none">
                      <input
                        type="checkbox"
                        id="edit-save-new-customer-mem"
                        checked={editRegisterNewCustomer}
                        onChange={(e) => setEditRegisterNewCustomer(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer shrink-0"
                      />
                      <label htmlFor="edit-save-new-customer-mem" className="text-[11px] text-slate-400 font-medium cursor-pointer">
                        ➕ Save <strong className="text-white">"{editCustomerName}"</strong> into customers memory register
                      </label>
                    </div>
                  )}
                </div>

                {/* SIMPLE EDIT ENTRY FIELDS VIEW */}
                {editSaleType === 'simple' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">
                          {user.language === 'ur' ? 'کل رقم:' : 'Total Amount:'} ({symbol}) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required={editSaleType === 'simple'}
                          placeholder="99.99"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none transition text-sm font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">{t.date} *</label>
                        <input
                          type="date"
                          required
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">{t.category}</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none font-sans"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-400">{t.paymentMethod}</label>
                        <select
                          value={editPaymentMethod}
                          onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none text-sans"
                        >
                          <option value="cash">{t.cash}</option>
                          <option value="card">{t.card}</option>
                          <option value="bank">{t.bank}</option>
                          <option value="other">{t.other}</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-400">{t.description}</label>
                      <textarea
                        placeholder="Record custom comments or payment terms..."
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full h-16 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2 text-white placeholder-slate-600 outline-none resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* ITEMIZED EDIT POS VIEW */}
                {editSaleType === 'itemized' && (
                  <div className="space-y-4 animate-fade-in">
                    {/* Catalog Loader & Search */}
                    <div className="bg-slate-950/60 p-4 border border-slate-850/80 rounded-2xl space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-900">
                        <div>
                          <h4 className="font-extrabold text-white text-xs flex items-center gap-1">
                            <ShoppingBag className="w-4 h-4 text-emerald-400" />
                            {user.language === 'ur' ? 'پروڈکٹ کیٹلاگ' : 'Product Inventory Catalog'}
                          </h4>
                          <p className="text-[10px] text-slate-400">Search products to add to checkout basket.</p>
                        </div>
                        <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-lg font-mono">
                          {products.length} Products
                        </span>
                      </div>

                      {/* Product search box */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={user.language === 'ur' ? 'نام یا مینوفیکچرر کوڈ / SKU سے تلاش کریں...' : 'Search items by name, SKU/code...'}
                          value={searchEditProductQuery}
                          onChange={(e) => setSearchEditProductQuery(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 px-3.5 py-2 rounded-xl text-white outline-none text-xs transition"
                        />
                        <Search className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-500" />
                      </div>

                      {/* Live filtered products lists */}
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-900 scrollbar-thin scrollbar-thumb-slate-800 space-y-1.5 pr-1 pt-1">
                        {filteredProductsEditPOS.length === 0 ? (
                          <div className="p-4 text-center italic text-slate-500 text-[11px]">
                            No matching stock items found in inventory list.
                          </div>
                        ) : (
                          filteredProductsEditPOS.map(p => {
                            const inBasketItem = editBasket.find(item => item.productId === p.id);
                            const basketQty = inBasketItem ? inBasketItem.quantity : 0;
                            const previouslyDeducted = (editingSale?.items?.find(i => i.productId === p.id)?.quantity || 0);
                            const currentStockValue = p.stock + previouslyDeducted;
                            const isLowStock = currentStockValue <= p.minStockAlert;
                            const isOutOfStock = currentStockValue <= 0;

                            return (
                              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-xl bg-slate-900/40 hover:bg-slate-900 transition gap-2 text-left relative z-[70]">
                                <div>
                                  <div className="font-bold text-white text-xs flex items-center gap-1.5 flex-wrap">
                                    <span>{p.name}</span>
                                    <span className="text-[9px] font-mono font-normal text-slate-500 bg-slate-950 p-0.5 px-1.5 rounded">{p.sku}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-0.5 flex-wrap">
                                    <span className="text-emerald-400 font-extrabold">{formatMoney(p.price)}</span>
                                    <span className="flex items-center gap-1.5 font-sans">
                                      <span>Stock:</span>
                                      <span className={`font-mono font-bold ${
                                        isOutOfStock 
                                          ? 'text-rose-500' 
                                          : isLowStock 
                                            ? 'text-amber-500 font-extrabold animate-pulse' 
                                            : 'text-slate-300'
                                      }`}>
                                        {currentStockValue} units
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-bold">
                                  {basketQty > 0 && (
                                    <span className="text-[10px] bg-indigo-950/60 border border-indigo-900/60 text-indigo-400 font-black px-2 py-0.5 rounded-lg font-sans">
                                      {basketQty} in basket
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isOutOfStock}
                                    onClick={() => handleAddToEditBasket(p)}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                      isOutOfStock
                                        ? 'bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800'
                                        : 'bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-400 hover:text-white'
                                    }`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{user.language === 'ur' ? 'شامل کریں' : 'Add'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Active Basket list View */}
                    <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-3">
                      <h4 className="font-extrabold text-indigo-300 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-900 font-sans">
                        <ShoppingCart className="w-4 h-4 text-indigo-400" />
                        {user.language === 'ur' ? 'موجودہ سیلز باسکٹ (POS Basket)' : 'Current Sale Items Basket'}
                        <span className="ml-auto text-[9px] bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded-full">
                          {editBasket.reduce((sum, item) => sum + item.quantity, 0)} items
                        </span>
                      </h4>

                      {editBasket.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 italic flex flex-col items-center justify-center gap-1 font-sans">
                          <ShoppingCart className="w-8 h-8 text-slate-700 stroke-[1.5]" />
                          <span className="text-[11px] mt-1">Basket is currently empty. Scroll the catalog above to add products.</span>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-900/60 scrollbar-thin">
                          {editBasket.map(item => (
                            <div key={item.productId} className="flex justify-between items-center gap-3 pt-2 text-xs">
                              <div className="flex-1 min-w-0">
                                <h5 className="font-bold text-white text-xs truncate" title={item.productName}>{item.productName}</h5>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-sans">
                                  {formatMoney(item.price)} each
                                </p>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                {/* Qty controller buttons */}
                                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 items-center">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateEditBasketQty(item.productId, -1)}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="font-bold min-w-6 text-center text-white text-[11px] font-mono">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateEditBasketQty(item.productId, 1)}
                                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>

                                {/* Item Total */}
                                <span className="font-bold text-slate-200 min-w-[65px] text-right font-mono">
                                  {formatMoney(item.total)}
                                </span>

                                {/* Remove trash button */}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromEditBasket(item.productId)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pricing, date & payment details for POS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/20 p-4 border border-slate-850/60 rounded-xl">
                      {/* Left: Metadata details */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-400">{t.date} *</label>
                          <input
                            type="date"
                            required
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-white outline-none text-xs"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-slate-400">{t.paymentMethod}</label>
                          <select
                            value={editPaymentMethod}
                            onChange={(e) => setEditPaymentMethod(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none text-xs font-sans"
                          >
                            <option value="cash">{t.cash}</option>
                            <option value="card">{t.card}</option>
                            <option value="bank">{t.bank}</option>
                            <option value="other">{t.other}</option>
                          </select>
                        </div>
                      </div>

                      {/* Right: Calculations */}
                      <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-slate-900 flex flex-col justify-between">
                        <div className="space-y-1.5 text-[10px] font-sans">
                          <div className="flex justify-between text-slate-400">
                            <span>Basket Subtotal:</span>
                            <span className="font-mono">{formatMoney(editBasketSubtotal)}</span>
                          </div>

                          <div className="flex items-center justify-between text-slate-400 gap-2">
                            <span>Discount ({symbol}):</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editDisValue}
                              onChange={(e) => setEditDisValue(e.target.value || '0')}
                              className="w-16 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-white text-center font-mono text-[10px] outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between text-slate-400 gap-2">
                            <span>Tax Sales (%):</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={editTxRateValue}
                              onChange={(e) => setEditTxRateValue(e.target.value || '0')}
                              className="w-16 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded text-white text-center font-mono text-[10px] outline-none"
                            />
                          </div>
                        </div>

                        <div className="border-t border-slate-900 pt-2 flex items-center justify-between">
                          <span className="text-white font-extrabold text-xs">POS Grand Total:</span>
                          <span className="text-sm font-black text-emerald-400 font-mono">
                            {formatMoney(editBasketGrandTotal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Remarks Description for POS */}
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400">POS Custom Notes/Remarks (Optional)</label>
                      <input
                        type="text"
                        placeholder="Leave empty to automatically itemize catalog items as description..."
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer (Actions Row) */}
              <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 shrink-0 flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition font-semibold cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            // Reverse inventory stock level deduction if this direct cash sale had products attached
            const saleToUndo = sales.find(s => s.id === deleteId);
            if (saleToUndo && saleToUndo.items && saleToUndo.items.length > 0) {
              const currentProducts = getProducts(user.id);
              saleToUndo.items.forEach(item => {
                const originalProd = currentProducts.find(p => p.id === item.productId);
                if (originalProd) {
                  editProduct(user.id, {
                    ...originalProd,
                    stock: originalProd.stock + item.quantity
                  });
                }
              });
            }
            deleteSale(user.id, deleteId);
            handleRefresh();
          }
        }}
        message="Are you sure you want to delete this sale transaction? If product items were attached, their quantity will be returned to stock. This action is permanent."
        language={user.language}
      />
    </div>
  );
}
