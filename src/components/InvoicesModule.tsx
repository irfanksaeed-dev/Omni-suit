import React, { useState } from 'react';
import { UserTenant, Invoice, Customer, Product, InvoiceItem } from '../types';
import { translations, currencySymbols } from '../translations';
import { getInvoices, getCustomers, getProducts, addInvoice, editInvoice, deleteInvoice, getNextInvoiceId } from '../db';
import { Plus, Trash2, Calendar, FileText, Printer, CheckCircle, Clock, Filter, AlertCircle, ShoppingCart, Download, Mail, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import { jsPDF } from 'jspdf';

const bilingualTerms = {
  invoiceTitle: { en: 'TAX INVOICE', ar: 'فاتورة ضريبية مبسطة' },
  invoiceNumber: { en: 'Invoice Number', ar: 'رقم الفاتورة' },
  date: { en: 'Date of Issue', ar: 'تاريخ الإصدار' },
  dueDate: { en: 'Due Date', ar: 'تاريخ الاستحقاق' },
  billedTo: { en: 'Billed To (Buyer)', ar: 'الفاتورة إلى (العميل)' },
  status: { en: 'Payment Status', ar: 'حالة السداد' },
  description: { en: 'Description / Particulars', ar: 'البيان / تفاصيل السلع' },
  qty: { en: 'Qty', ar: 'الكمية' },
  price: { en: 'Unit Price', ar: 'سعر الوحدة' },
  total: { en: 'Total Amount', ar: 'المجموع الإجمالي' },
  subtotal: { en: 'Subtotal (Excl. VAT)', ar: 'المجموع الفرعي (خاضع للضريبة)' },
  tax: { en: 'VAT (Tax Amount)', ar: 'ضريبة القيمة المضافة' },
  discount: { en: 'Discount', ar: 'الخصم الممنوح' },
  totalPayable: { en: 'Total Payable (Incl. VAT)', ar: 'إجمالي المبلغ المستحق' },
  amountPaid: { en: 'Amount Paid', ar: 'المبلغ المدفوع' },
  balanceDue: { en: 'Balance Due', ar: 'المتبقي المستحق' },
  notes: { en: 'Notes & Payment Terms', ar: 'الشروط وملاحظات الدفع' },
  trn: { en: 'VAT TRN (Seller Tax ID)', ar: 'الرقم الضريبي للمنشأة' },
  buyerTrn: { en: 'Buyer Tax ID (TRN)', ar: 'الرقم الضريبي للمشتري' },
  authorizedSign: { en: 'Prepared / Authorized Signature', ar: 'توقيع الجهة المعتمد' },
  thankYou: { en: 'Thank you for your business!', ar: 'نشكركم على تعاملكم معنا ونقدر ثقتكم!' },
  paidStatus: { en: 'PAID', ar: 'مدفوعة' },
  unpaidStatus: { en: 'UNPAID', ar: 'غير مدفوعة' },
  via: { en: 'Via', ar: 'وسيلة الدفع' }
};

const getBilingualValue = (key: keyof typeof bilingualTerms, lang: 'en' | 'ar' | 'bilingual') => {
  const item = bilingualTerms[key];
  if (lang === 'en') return <span className="font-sans leading-relaxed">{item.en}</span>;
  if (lang === 'ar') return <span className="font-sans font-semibold leading-relaxed text-right block" dir="rtl">{item.ar}</span>;
  return (
    <div className="flex flex-col text-[100%] leading-tight font-sans">
      <span className="font-semibold text-slate-850 tracking-tight">{item.en}</span>
      <span className="text-slate-500 font-bold mt-0.5 text-[80%]" dir="rtl">{item.ar}</span>
    </div>
  );
};

const getBilingualString = (key: keyof typeof bilingualTerms, lang: 'en' | 'ar' | 'bilingual', separator: string = ' / ') => {
  const item = bilingualTerms[key];
  if (lang === 'en') return item.en;
  if (lang === 'ar') return item.ar;
  return `${item.en}${separator}${item.ar}`;
};

interface InvoicesModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function InvoicesModule({ user, onRefreshStats }: InvoicesModuleProps) {
  const t = translations[user.language];
  const symbol = currencySymbols[user.currency];

  const [invoices, setInvoices] = useState<Invoice[]>(() => getInvoices(user.id));
  const [customers] = useState<Customer[]>(() => getCustomers(user.id));
  const [products] = useState<Product[]>(() => getProducts(user.id));

  // Filters
  const [searchInvoiceNum, setSearchInvoiceNum] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue'>('all');

  // Active Printable Invoice Detail modal
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // New Invoice Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [custSearchTerm, setCustSearchTerm] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(() => getNextInvoiceId(user.id));
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState(user.invoiceNotes || '');
  const [discountInput, setDiscountInput] = useState('0');
  const [isPaidOnCreation, setIsPaidOnCreation] = useState(false);
  const [paymentStatusOption, setPaymentStatusOption] = useState<'paid' | 'unpaid' | 'partial'>('unpaid');
  const [customAmountPaidInput, setCustomAmountPaidInput] = useState('0');
  const [includeTax, setIncludeTax] = useState(true);
  const [saveToRecord, setSaveToRecord] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash'>('bank');

  // Sizing & Language settings for active printing/display
  const [printSize, setPrintSize] = useState<'a4' | '80mm' | '58mm'>('a4');
  const [printLanguage, setPrintLanguage] = useState<'en' | 'ar' | 'bilingual'>('bilingual');

  // Add Item fields
  const [isManualItemMode, setIsManualItemMode] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState('1');
  const [attachedItems, setAttachedItems] = useState<InvoiceItem[]>([]);
  const [validationError, setValidationError] = useState('');

  // PDF Generator Engine
  const generateInvoicePDF = (inv: Invoice) => {
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

      // Company Name header & Meta details
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text((user.companyName || 'Business Name').toUpperCase(), 15, 25);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      const addressLine = `${user.address || 'Company Administrative Address'}`;
      const contactLine = `Phone: ${user.phone || 'Phone Contact'} | Email: ${user.email || ''}`;
      doc.text(addressLine, 15, 31);
      doc.text(contactLine, 15, 36);
      if (user.taxNumber) {
        doc.setFont('Helvetica', 'bold');
        doc.text(`TRN / Tax Ref: ${user.taxNumber}`, 15, 41);
      }

      // Invoice Header Info Right Column
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('INVOICE', 195, 25, { align: 'right' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text(`Invoice No: ${inv.invoiceNumber}`, 195, 31, { align: 'right' });
      doc.text(`Date: ${inv.date}`, 195, 36, { align: 'right' });
      if (inv.dueDate) {
        doc.text(`Due Date: ${inv.dueDate}`, 195, 41, { align: 'right' });
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
      
      doc.setFontSize(12);
      if (inv.status === 'paid') {
        doc.setTextColor(16, 185, 129); // Green 500
        doc.text('PAID', 150, 62);
        if (inv.paymentMethod) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(grayText[0], grayText[1], grayText[2]);
          doc.text(`Via: ${inv.paymentMethod.toUpperCase()}`, 150, 67);
        }
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
      
      inv.items.forEach((item, index) => {
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
      console.error('Failed to export high performance invoice PDF format:', err);
    }
  };

  const handleRefresh = () => {
    setInvoices(getInvoices(user.id));
    onRefreshStats();
  };

  const handleAddProductItem = () => {
    setValidationError('');
    
    if (isManualItemMode) {
      if (!manualItemName.trim()) {
        setValidationError('Please enter a custom product/item name.');
        return;
      }
      const price = parseFloat(manualItemPrice);
      if (isNaN(price) || price < 0) {
        setValidationError('Please enter a valid unit price (0 or greater).');
        return;
      }
      const qty = parseInt(selectedQty);
      if (isNaN(qty) || qty <= 0) {
        setValidationError('Please enter a valid quantity of 1 or more.');
        return;
      }

      const newItem: InvoiceItem = {
        productId: 'custom-' + Math.random().toString(36).substring(2, 11),
        productName: manualItemName.trim(),
        quantity: qty,
        price: price,
        total: qty * price
      };

      setAttachedItems([...attachedItems, newItem]);
      setManualItemName('');
      setManualItemPrice('');
      setSelectedQty('1');
    } else {
      if (!selectedProductId || parseInt(selectedQty) <= 0) {
        setValidationError(t.addInvoiceItemError);
        return;
      }

      const prod = products.find(p => p.id === selectedProductId);
      if (!prod) return;

      // Check if product already added
      const existingIdx = attachedItems.findIndex(i => i.productId === prod.id);
      if (existingIdx !== -1) {
        const copy = [...attachedItems];
        copy[existingIdx].quantity += parseInt(selectedQty);
        if (copy[existingIdx].quantity > prod.stock) {
          setValidationError(`Only ${prod.stock} units available in stock warehouse catalog.`);
          return;
        }
        copy[existingIdx].total = copy[existingIdx].quantity * copy[existingIdx].price;
        setAttachedItems(copy);
      } else {
        if (parseInt(selectedQty) > prod.stock) {
          setValidationError(`Only ${prod.stock} units in stock currently.`);
          return;
        }
        const newItem: InvoiceItem = {
          productId: prod.id,
          productName: prod.name,
          quantity: parseInt(selectedQty),
          price: prod.price,
          total: parseInt(selectedQty) * prod.price
        };
        setAttachedItems([...attachedItems, newItem]);
      }

      setSelectedProductId('');
      setSelectedQty('1');
    }
  };

  const handleRemoveItem = (idx: number) => {
    setAttachedItems(attachedItems.filter((_, i) => i !== idx));
  };

  const handleCreateInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!customerId) {
      setValidationError('Please choose a customer profile.');
      return;
    }
    if (attachedItems.length === 0) {
      setValidationError(t.invoiceNoItems);
      return;
    }

    let customerName = '';
    if (customerId === 'walk-in') {
      customerName = 'Walk-In Customer';
    } else {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) return;
      customerName = customer.name;
    }

    const subtotal = attachedItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = includeTax ? (user.taxRate || 5) : 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const discount = parseFloat(discountInput) || 0;
    const total = subtotal + taxAmount - discount;

    let calculatedAmountPaid = 0;
    let calculatedBalanceDue = total;
    let computedStatus: 'paid' | 'unpaid' = 'unpaid';

    if (paymentStatusOption === 'paid') {
      calculatedAmountPaid = total;
      calculatedBalanceDue = 0;
      computedStatus = 'paid';
    } else if (paymentStatusOption === 'partial') {
      calculatedAmountPaid = parseFloat(customAmountPaidInput) || 0;
      if (calculatedAmountPaid > total) {
        calculatedAmountPaid = total;
      }
      calculatedBalanceDue = Math.max(0, total - calculatedAmountPaid);
      computedStatus = calculatedBalanceDue === 0 ? 'paid' : 'unpaid';
    } else {
      calculatedAmountPaid = 0;
      calculatedBalanceDue = total;
      computedStatus = 'unpaid';
    }

    const newInv: Invoice = saveToRecord 
      ? addInvoice(user.id, {
          invoiceNumber,
          customerId,
          customerName,
          date: issueDate,
          dueDate,
          items: attachedItems,
          subtotal,
          taxRate,
          taxAmount,
          discount,
          total,
          amountPaid: calculatedAmountPaid,
          balanceDue: calculatedBalanceDue,
          notes,
          status: computedStatus,
          paymentMethod: computedStatus === 'paid' ? paymentMethod : undefined
        })
      : {
          id: 'temp-' + Math.random().toString(36).substr(2, 9),
          tenantId: user.id,
          invoiceNumber,
          customerId,
          customerName,
          date: issueDate,
          dueDate,
          items: attachedItems,
          subtotal,
          taxRate,
          taxAmount,
          discount,
          total,
          amountPaid: calculatedAmountPaid,
          balanceDue: calculatedBalanceDue,
          notes,
          status: computedStatus,
          paymentMethod: computedStatus === 'paid' ? paymentMethod : undefined,
          createdAt: new Date().toISOString()
        };

    // Show saved invoice without downloading automatically.
    // If saving, open the detail layout sheet preview, otherwise trigger offline PDF download.
    if (saveToRecord) {
      setActiveInvoice(newInv);
    } else {
      generateInvoicePDF(newInv);
    }

    // Reset fields
    setCustomerId('');
    setAttachedItems([]);
    setDiscountInput('0');
    setNotes(user.invoiceNotes || '');
    setInvoiceNumber(getNextInvoiceId(user.id));
    setIncludeTax(true);
    setSaveToRecord(true);
    setDueDate('');
    setIsManualItemMode(false);
    setManualItemName('');
    setManualItemPrice('');
    setPaymentMethod('bank');
    setPaymentStatusOption('unpaid');
    setCustomAmountPaidInput('0');
    setIsPaidOnCreation(false);
    setShowCreateModal(false);
    handleRefresh();
  };

  const handleUpdateStatus = (id: string, newStatus: 'paid' | 'unpaid') => {
    handleUpdateStatusWithMethod(id, newStatus, 'bank');
  };

  const handleUpdateStatusWithMethod = (id: string, newStatus: 'paid' | 'unpaid', method?: 'bank' | 'cash') => {
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      const updated: Invoice = { 
        ...inv, 
        status: newStatus, 
        paymentMethod: newStatus === 'paid' ? method : undefined,
        amountPaid: newStatus === 'paid' ? inv.total : 0,
        balanceDue: newStatus === 'paid' ? 0 : inv.total
      };
      editInvoice(user.id, updated);
      handleRefresh();
      if (activeInvoice && activeInvoice.id === id) {
        setActiveInvoice(updated);
      }
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const triggerBrowserPrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn("Failed to invoke browser print inside iframe sandbox:", e);
      alert("Notice: Browser printing is restricted by iframe sandbox policies in this preview window. Please open the application in a new browser tab or use the 'Download PDF' feature on the invoice sheet details.");
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const cust = customers.find(c => c.id === inv.customerId);
    const matchesPhone = cust && cust.phone ? cust.phone.toLowerCase().includes(searchInvoiceNum.toLowerCase()) : false;
    const matchesNum = inv.invoiceNumber.toLowerCase().includes(searchInvoiceNum.toLowerCase()) || 
                       inv.customerName.toLowerCase().includes(searchInvoiceNum.toLowerCase()) ||
                       matchesPhone;
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesNum && matchesStatus;
  });

  const formatMoney = (val: number) => {
    return `${symbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isRtl = user.language === 'ar' || user.language === 'ur';

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            {t.invoices}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Author multi-line invoice billing sheets, compute VAT ratios, and print professional copies.</p>
        </div>
        <button
          onClick={() => {
            setValidationError('');
            setAttachedItems([]);
            setCustomerId('');
            setInvoiceNumber(getNextInvoiceId(user.id));
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t.createInvoice}
        </button>
      </div>

      {/* Local filters bar */}
      <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search invoice number or customer name..."
            value={searchInvoiceNum}
            onChange={(e) => setSearchInvoiceNum(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="paid">{t.paid}</option>
            <option value="unpaid">{t.unpaid}</option>
            <option value="overdue">{t.overdue}</option>
          </select>
        </div>

        {/* Summary tag */}
        <div className="bg-slate-950/40 border border-slate-900 px-4 py-2 rounded-xl flex items-center justify-between text-xs">
          <span className="text-slate-400">Due Outstanding:</span>
          <span className="font-extrabold text-amber-500">
            {formatMoney(filteredInvoices.reduce((sum, i) => sum + (i.balanceDue !== undefined ? i.balanceDue : (i.status === 'paid' ? 0 : i.total)), 0))}
          </span>
        </div>
      </div>

      {/* Invoice Register Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInvoices.length === 0 ? (
          <div className="col-span-full bg-slate-900/10 border border-slate-850 py-12 rounded-2xl text-center text-xs italic text-slate-500">
            No matching invoices logged. Tap 'Generate New Invoice' to start billing clients.
          </div>
        ) : (
          filteredInvoices.map((inv) => (
            <div 
              key={inv.id}
              className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between shadow-lg relative cursor-pointer hover:border-slate-800 transition"
              onClick={() => setActiveInvoice(inv)}
            >
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-slate-850/60">
                  <span className="font-mono text-white text-[11px] px-2 py-0.5 bg-slate-950 rounded border border-slate-900/80">
                    {inv.invoiceNumber}
                  </span>
                  <span className={`px-2 py-0.5 font-bold rounded text-[9px] uppercase ${
                    inv.status === 'paid' 
                      ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-400' 
                      : inv.status === 'unpaid' 
                      ? 'bg-yellow-950/60 border border-yellow-500/30 text-yellow-500' 
                      : 'bg-red-950/60 border border-red-500/30 text-red-500'
                  }`}>
                    {t[inv.status]} {inv.status === 'paid' && inv.paymentMethod ? `(${inv.paymentMethod === 'cash' ? '💵 Cash' : '🏛️ Bank'})` : ''}
                  </span>
                </div>

                <div className="space-y-1.5 mt-4 text-xs">
                  <h4 className="font-extrabold text-white line-clamp-1">{inv.customerName}</h4>
                  <p className="text-slate-400 text-[10px]">{t.issueDate}: {inv.date}{inv.dueDate ? ` • ${t.dueDate}: ${inv.dueDate}` : ''}</p>
                </div>

                {/* Items summary */}
                <div className="mt-3.5 bg-slate-950/40 p-2 rounded-lg text-[10px] text-slate-400">
                  {inv.items.length} product lines attached ({inv.items.map(i => i.productName).join(', ')})
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-slate-850/60 flex justify-between items-end" onClick={(e) => e.stopPropagation()}>
                <div>
                  <p className="text-[10px] text-slate-500 font-mono">Total Net bill</p>
                  <p className="font-black text-white text-base leading-none">{formatMoney(inv.total)}</p>
                  <div className="flex gap-2 text-[10px] mt-1.5 font-semibold">
                    <span className="text-emerald-400">Paid: {formatMoney(inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0))}</span>
                    <span className="text-amber-500">Due: {formatMoney(inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total))}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateInvoicePDF(inv);
                  }}
                  title="Download PDF"
                  className="bg-slate-800 hover:bg-indigo-600 hover:text-white hover:border-indigo-500/30 text-slate-300 p-2 ml-2 rounded-xl cursor-pointer border border-slate-750 transition flex items-center gap-1.5 text-[10px] font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 1. Large Printable Invoice Details Modal */}
      {activeInvoice && (() => {
        // Calculate QR Code url using public api
        const qrDataPayload = [
          `Seller: ${user.companyName}`,
          `VAT Ref: ${user.taxNumber || 'N/A'}`,
          `No: ${activeInvoice.invoiceNumber}`,
          `Date: ${activeInvoice.date}`,
          `Total: ${symbol}${activeInvoice.total.toFixed(2)}`,
          `VAT Amount: ${symbol}${activeInvoice.taxAmount.toFixed(2)}`,
          `Verification Ref: TX-${activeInvoice.id.substring(0,8).toUpperCase()}`
        ].join('\n');
        
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(qrDataPayload)}`;
        const isLayoutRtl = printLanguage === 'ar';
        const alignLeftClass = isLayoutRtl ? 'text-right' : 'text-left';
        const alignRightClass = isLayoutRtl ? 'text-left' : 'text-right';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" onClick={() => setActiveInvoice(null)} />

            {/* Injected Style Block to handle printer device-specific margins & pagination */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                html, body {
                  background: white !important;
                  color: black !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                /* Paper size constraints overrides */
                @page {
                  size: ${printSize === 'a4' ? 'A4 portrait' : printSize === '80mm' ? '80mm' : '58mm'};
                  margin: ${printSize === 'a4' ? '12mm 10mm' : '3mm 2mm'};
                }
                /* Hide everything except printable element */
                body * {
                  visibility: hidden !important;
                }
                #printable-area, #printable-area * {
                  visibility: visible !important;
                }
                #printable-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: ${printSize === 'a4' ? '100%' : printSize === '80mm' ? '80mm' : '58mm'} !important;
                  font-size: ${printSize === 'a4' ? '11px' : printSize === '80mm' ? '9.5px' : '8px'} !important;
                  color: black !important;
                  background: white !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                }
                .print\\:hidden, button, select, header, aside, .fixed, [role="dialog"]:not(#printable-area) {
                  display: none !important;
                }
                /* Preserves backgrounds */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            ` }} />

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] relative text-xs text-slate-300 overflow-hidden"
            >
              {/* Action Bar Header */}
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-white">Invoice Sheet Layout</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {activeInvoice.status !== 'paid' && (
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                      <span className="text-[9px] font-bold text-slate-500 pl-1 uppercase shrink-0">Pay:</span>
                      <button
                        onClick={() => handleUpdateStatusWithMethod(activeInvoice.id, 'paid', 'bank')}
                        className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-1 px-2 rounded cursor-pointer text-[10px]"
                        title="Mark Paid via Bank"
                      >
                        🏛️ Bank
                      </button>
                      <button
                        onClick={() => handleUpdateStatusWithMethod(activeInvoice.id, 'paid', 'cash')}
                        className="bg-emerald-650 hover:bg-emerald-600 text-white font-bold py-1 px-2 rounded cursor-pointer text-[10px]"
                        title="Mark Paid via Cash"
                      >
                        💵 Cash
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => generateInvoicePDF(activeInvoice)}
                    className="bg-emerald-650 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                  <button
                    onClick={triggerBrowserPrint}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t.print}
                  </button>
                  <button
                    onClick={() => setActiveInvoice(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    {t.close}
                  </button>
                </div>
              </div>

              {/* Sizing & Language preferences bar */}
              <div className="bg-slate-950/70 px-4 py-2 border-b border-slate-800 flex flex-wrap gap-4 items-center justify-between shrink-0 text-[11px] print:hidden">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">Page Sizing:</span>
                  <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded">
                    {(['a4', '80mm', '58mm'] as const).map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setPrintSize(sz)}
                        className={`px-2.5 py-1 text-[9px] font-extrabold uppercase rounded transition-all cursor-pointer ${
                          printSize === sz ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {sz === 'a4' ? 'A4 Paper' : sz === '80mm' ? '80mm Thermal' : '58mm Mini'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400">Language:</span>
                  <div className="flex bg-slate-900 border border-slate-800 p-0.5 rounded">
                    {(['en', 'ar', 'bilingual'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setPrintLanguage(lang)}
                        className={`px-2.5 py-1 text-[9px] font-extrabold uppercase rounded transition-all cursor-pointer ${
                          printLanguage === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {lang === 'en' ? 'EN' : lang === 'ar' ? 'العربية' : 'Bilingual'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Share with Customer Section */}
              {(() => {
                const matchingCust = customers.find(c => c.id === activeInvoice.customerId);
                if (!matchingCust) return null;
                
                // Construct magic link
                const magicMailLink = window.location.origin + "/?customerEmail=" + encodeURIComponent(matchingCust.email) + "&invoiceId=" + activeInvoice.id;
                const magicPhoneLink = window.location.origin + "/?customerPhone=" + encodeURIComponent(matchingCust.phone) + "&invoiceId=" + activeInvoice.id;
                
                const selectedLink = matchingCust.phone ? magicPhoneLink : magicMailLink;
                
                // Custom templates
                const totalVal = formatMoney(activeInvoice.total);
                const dueVal = formatMoney(activeInvoice.balanceDue !== undefined ? activeInvoice.balanceDue : (activeInvoice.status === 'paid' ? 0 : activeInvoice.total));
                
                const subjectStr = `Invoice ${activeInvoice.invoiceNumber} from ${user.companyName}`;
                const bodyStr = `Dear ${matchingCust.name},\n\nYour invoice ${activeInvoice.invoiceNumber} is ready. \nTotal Amount: ${totalVal}\nBalance Due: ${dueVal}\n\nYou can click the link below to open your invoice instantly, view details, and manage payments.\n\nLink: ${selectedLink}\n\nThank you,\n${user.companyName}`;
                
                const mailToUrl = `mailto:${encodeURIComponent(matchingCust.email || '')}?subject=${encodeURIComponent(subjectStr)}&body=${encodeURIComponent(bodyStr)}`;
                
                // WhatsApp format
                const cleanPhone = matchingCust.phone ? matchingCust.phone.replace(/\D/g, '') : '';
                const waMsg = `السلام علیکم *${matchingCust.name}*!\n\nآپ کا بل نمبر *${activeInvoice.invoiceNumber}* تیار ہے۔\n*کل رقم:* ${totalVal}\n*بقایا رقم:* ${dueVal}\n\nاس لنک پر کلک کر کے اپنا بل دیکھیں، بقایا جات چیک کریں اور ادا کریں:\n${selectedLink}\n\nشکریہ!\n*${user.companyName}*`;
                const waUrl = `https://wa.me/${cleanPhone ? cleanPhone : ''}?text=${encodeURIComponent(waMsg)}`;

                return (
                  <div className="mx-4 mt-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-slate-350 select-none shrink-0 print:hidden font-sans">
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">📲 Share with Registered Customer / شیئر کریں</span>
                      <div className="text-white text-xs font-black flex items-center gap-1.5 flex-wrap">
                        <span>{matchingCust.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({matchingCust.phone || matchingCust.email || 'No Contact Info'})</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Customer can click to open this specific invoice instantly & see dues.</p>
                    </div>
                    
                    <div className="flex gap-2 shrink-0">
                      {matchingCust.phone && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] px-3 py-1.5 rounded-lg transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      
                      {matchingCust.email && (
                        <a
                          href={mailToUrl}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span>Email</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Print Info Notice Banner (Hidden during Media Print) */}
              <div className="mx-4 mt-3 p-3 bg-indigo-950/45 border border-indigo-900/35 rounded-xl flex items-start gap-2.5 text-[10px] text-indigo-300 print:hidden leading-relaxed shrink-0">
                <span className="text-xs shrink-0 select-none">💡</span>
                <p>
                  <strong>Professional Layout & QR Sizing Active:</strong> Formatted for {printSize === 'a4' ? 'standard A4 binder bills' : 'POS thermal receipt width'}. Scanning QR code displays verified seller VAT TRN credentials and items receipt total.
                </p>
              </div>

              {/* Core Invoice Card (Print Optimized Segment ID "printable-area") */}
              <div className={`flex-1 overflow-y-auto ${printSize !== 'a4' ? 'bg-slate-950/60 p-6 flex justify-center items-start' : 'bg-white'}`}>
                <div 
                  id="printable-area" 
                  className={`overflow-y-auto bg-white text-slate-800 font-sans select-text shadow-xl transition-all duration-300 ${
                    printSize === 'a4' 
                      ? 'p-8 space-y-6 w-full max-w-full' 
                      : printSize === '80mm'
                      ? 'p-5 space-y-4 w-[80mm] border border-dashed border-slate-300 text-[10px] rounded-sm'
                      : 'p-3.5 space-y-3.5 w-[58mm] border border-dashed border-slate-300 text-[8px] rounded-sm'
                  }`}
                  style={{
                    direction: isLayoutRtl ? 'rtl' : 'ltr'
                  }}
                >
                  {/* Header block logo / info */}
                  <div className={`flex border-b border-dashed border-slate-200 pb-5 ${
                    printSize === 'a4' ? 'flex-row justify-between items-start gap-4' : 'flex-col items-center text-center gap-3'
                  }`}>
                    <div className={printSize === 'a4' ? (isLayoutRtl ? 'text-right' : 'text-left') : 'text-center'}>
                      {user.logoUrl ? (
                        <img src={user.logoUrl} alt="Logo" className="max-h-12 max-w-[180px] object-contain mb-2" referrerPolicy="no-referrer" />
                      ) : (
                        <h1 className="text-lg font-black text-indigo-900 leading-tight uppercase tracking-tight">{user.companyName}</h1>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1 max-w-sm whitespace-pre-line leading-relaxed">
                        {user.address || 'Company Administrative Address'}<br />
                        Phone / الهاتـف: {user.phone || 'Phone Contact'} | Email: {user.email}
                      </p>
                      {user.taxNumber && (
                        <p className="text-[9px] font-bold text-indigo-950 mt-1 uppercase">
                          {getBilingualString('trn', printLanguage)}: <span className="font-mono text-xs">{user.taxNumber}</span>
                        </p>
                      )}
                    </div>

                    {/* Top QR code for standard A4 layout */}
                    {printSize === 'a4' && (
                      <div className="flex flex-col items-center justify-center border border-slate-200 p-1 bg-white rounded-lg select-none shrink-0 w-[100px] h-[100px]">
                        <img 
                          src={qrCodeUrl} 
                          alt="ZATCA Verification QR" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <div className={printSize === 'a4' ? (isLayoutRtl ? 'text-left' : 'text-right') : 'text-center w-full pt-3 border-t border-dashed border-slate-200'}>
                      <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                        {getBilingualString('invoiceTitle', printLanguage)}
                      </h2>
                      
                      {/* Beautifully aligned metadata box for proper visual sequence */}
                      <div className={`mt-3 inline-flex flex-col text-left border border-slate-100 rounded-lg p-2.5 bg-slate-50/50 min-w-[200px] space-y-1.5 ${
                        isLayoutRtl ? 'text-right' : 'text-left'
                      }`} style={{ direction: isLayoutRtl ? 'rtl' : 'ltr' }}>
                        <div className="flex justify-between items-center gap-4 border-b border-slate-100 pb-1">
                          <span className="text-slate-500 font-bold font-sans text-[9px] uppercase tracking-wider">
                            {getBilingualString('invoiceNumber', printLanguage)}:
                          </span>
                          <span className="font-extrabold text-indigo-950 font-mono text-[11px]">{activeInvoice.invoiceNumber}</span>
                        </div>
                        <div className={`flex justify-between items-center gap-4 pb-1 ${activeInvoice.dueDate ? 'border-b border-slate-100' : ''}`}>
                          <span className="text-slate-500 font-bold font-sans text-[9px] uppercase tracking-wider">
                            {getBilingualString('date', printLanguage)}:
                          </span>
                          <span className="font-bold text-slate-800 font-mono text-[10px]">{activeInvoice.date}</span>
                        </div>
                        {activeInvoice.dueDate && (
                          <div className="flex justify-between items-center gap-4 text-rose-600 font-bold pt-0.5">
                            <span className="font-bold font-sans text-[9px] uppercase tracking-wider">
                              {getBilingualString('dueDate', printLanguage)}:
                            </span>
                            <span className="font-extrabold font-mono text-[10px]">{activeInvoice.dueDate}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Billed details */}
                  <div className={`p-3.5 rounded-lg border ${
                    printSize === 'a4' 
                      ? 'bg-slate-50 border-slate-100 flex justify-between items-start text-[10px] gap-4' 
                      : 'bg-white border-dashed border-slate-250 flex flex-col space-y-2.5 text-[9px] w-full text-center items-center'
                  }`}>
                    <div className={printSize === 'a4' ? (isLayoutRtl ? 'text-right' : 'text-left') : 'text-center'}>
                      <h3 className="uppercase font-bold text-slate-500 tracking-wider mb-1">
                        {getBilingualValue('billedTo', printLanguage)}
                      </h3>
                      <p className="font-extrabold text-slate-900 text-sm">{activeInvoice.customerName}</p>
                      {(() => {
                        const custMeta = customers.find(c => c.id === activeInvoice.customerId);
                        if (custMeta) {
                          return (
                            <p className="text-[9px] text-slate-500 mt-1 max-w-md whitespace-pre-wrap leading-relaxed">
                              Phone: {custMeta.phone} | Email: {custMeta.email}<br />
                              Address: {custMeta.address}
                              {custMeta.vatNumber && (
                                <span className="block font-bold text-slate-700 mt-1">
                                  {getBilingualString('buyerTrn', printLanguage)}: {custMeta.vatNumber}
                                </span>
                              )}
                            </p>
                          );
                        }
                        if (activeInvoice.customerId === 'walk-in') {
                          return (
                            <p className="text-[9px] text-slate-500 mt-1 max-w-md leading-relaxed italic">
                              Counter Walk-In Customer Account / عميل نقدي مباشر
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className={printSize === 'a4' ? (isLayoutRtl ? 'text-left' : 'text-right') : 'text-center pt-2.5 border-t border-dashed border-slate-150 w-full'}>
                      <h3 className="uppercase font-bold text-slate-400 tracking-wider mb-1">
                        {getBilingualValue('status', printLanguage)}
                      </h3>
                      <span className={`px-2.5 py-0.5 font-extrabold rounded text-[9px] border inline-block ${
                        activeInvoice.status === 'paid' 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                          : 'bg-rose-50 border-rose-200 text-rose-500'
                      }`}>
                        {activeInvoice.status === 'paid' ? getBilingualString('paidStatus', printLanguage) : getBilingualString('unpaidStatus', printLanguage)}
                      </span>
                      {activeInvoice.status === 'paid' && activeInvoice.paymentMethod && (
                        <p className="text-[9px] text-slate-650 font-bold mt-1.5 uppercase font-mono">
                          {getBilingualString('via', printLanguage)}: {activeInvoice.paymentMethod === 'cash' ? '💵 Cash / نقدي' : '🏛️ Bank / تحويل'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items listing table list */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead>
                        <tr className="border-b-2 border-slate-300 text-slate-500 font-extrabold uppercase py-2">
                          <th className={`py-2 pb-1.5 ${alignLeftClass} font-black`}>
                            {getBilingualValue('description', printLanguage)}
                          </th>
                          <th className={`py-2 pb-1.5 ${alignRightClass} font-black`}>
                            {getBilingualValue('qty', printLanguage)}
                          </th>
                          <th className={`py-2 pb-1.5 ${alignRightClass} font-black`}>
                            {getBilingualValue('price', printLanguage)}
                          </th>
                          <th className={`py-2 pb-1.5 ${alignRightClass} font-black`}>
                            {getBilingualValue('total', printLanguage)}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeInvoice.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 font-medium">
                            <td className={`py-2 border-b border-slate-100 font-extrabold text-slate-800 ${alignLeftClass}`}>{item.productName}</td>
                            <td className={`py-2 border-b border-slate-100 font-mono text-slate-600 ${alignRightClass}`}>{item.quantity}</td>
                            <td className={`py-2 border-b border-slate-100 font-mono text-slate-600 ${alignRightClass}`}>{formatMoney(item.price)}</td>
                            <td className={`py-2 border-b border-slate-100 font-bold font-mono text-slate-800 ${alignRightClass}`}>{formatMoney(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Calculations footer */}
                  <div className={`flex pt-4 flex-wrap border-t border-slate-200 gap-5 ${
                    printSize === 'a4' ? 'justify-between items-start' : 'flex-col items-center text-center'
                  }`}>
                    {/* Notes Box Column */}
                    <div className={`text-[9px] text-slate-500 italic leading-relaxed ${
                      printSize === 'a4' ? 'max-w-xs text-left' : 'w-full text-center border-b border-dashed border-slate-150 pb-3'
                    }`} style={{ direction: isLayoutRtl ? 'rtl' : 'ltr' }}>
                      <span className="font-bold text-slate-800 block uppercase tracking-wider mb-1">
                        {getBilingualString('notes', printLanguage)}
                      </span>
                      <p className="whitespace-pre-line text-[9px] font-sans">
                        {activeInvoice.notes || 'No custom payment instructions attached.'}
                      </p>
                    </div>

                    {/* Math totals table alignment */}
                    <div className={`w-full sm:w-64 space-y-2 text-[10px] text-slate-700 ${
                      printSize === 'a4' ? (isLayoutRtl ? 'mr-auto' : 'ml-auto') : 'mx-auto'
                    }`}>
                      <div className="flex justify-between border-b border-dashed border-slate-100 pb-1 items-center gap-4">
                        {getBilingualValue('subtotal', printLanguage)}
                        <span className="font-bold font-mono text-slate-900">{formatMoney(activeInvoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-slate-100 pb-1 items-center gap-4">
                        <div className="flex flex-col items-start">
                          {getBilingualValue('tax', printLanguage)}
                          <span className="text-[9px] text-indigo-500 font-mono font-bold">({activeInvoice.taxRate}%)</span>
                        </div>
                        <span className="font-bold font-mono text-slate-900">+{formatMoney(activeInvoice.taxAmount)}</span>
                      </div>
                      {activeInvoice.discount > 0 && (
                        <div className="flex justify-between border-b border-rose-100 pb-1 text-rose-600 items-center gap-4">
                          {getBilingualValue('discount', printLanguage)}
                          <span className="font-bold font-mono">-{formatMoney(activeInvoice.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-indigo-950 border-t-2 border-slate-300 pt-2 font-black text-xs items-center gap-4">
                        {getBilingualValue('totalPayable', printLanguage)}
                        <span className="font-mono text-sm">{formatMoney(activeInvoice.total)}</span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-slate-100 pb-1 text-slate-500 mt-1 items-center gap-4">
                        {getBilingualValue('amountPaid', printLanguage)}
                        <span className="font-semibold font-mono text-slate-800">{formatMoney(activeInvoice.amountPaid !== undefined ? activeInvoice.amountPaid : (activeInvoice.status === 'paid' ? activeInvoice.total : 0))}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 border-b border-rose-100 pb-1 font-bold items-center gap-4">
                        {getBilingualValue('balanceDue', printLanguage)}
                        <span className="font-bold font-mono text-rose-700">{formatMoney(activeInvoice.balanceDue !== undefined ? activeInvoice.balanceDue : (activeInvoice.status === 'paid' ? 0 : activeInvoice.total))}</span>
                      </div>
                    </div>
                  </div>

                  {/* BOTTOM QR Code for narrow POS receipt rolls */}
                  {printSize !== 'a4' && (
                    <div className="flex flex-col items-center justify-center pt-4 border-t border-dashed border-slate-200 mt-2 space-y-1.5 pb-2">
                      <div className="flex flex-col items-center justify-center border border-slate-200 p-1 bg-white rounded-lg w-[110px] h-[110px]">
                        <img 
                          src={qrCodeUrl} 
                          alt="Verification QR" 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className="text-[8px] text-slate-500 uppercase tracking-widest font-black">
                        {printLanguage === 'ar' 
                          ? 'فاتورة ضريبة مبسطة معتمدة' 
                          : printLanguage === 'en' 
                          ? 'VERIFIED E-INVOICE' 
                          : 'VERIFIED E-INVOICE / فاتورة معتمدة'}
                      </span>
                    </div>
                  )}

                  {/* Appreciation Note replacing old Signatures block */}
                  {printSize === 'a4' && (
                    <div className="pt-10 pb-4 text-center select-none" style={{ direction: isLayoutRtl ? 'rtl' : 'ltr' }}>
                      <div className="inline-block bg-slate-50/50 border border-slate-100 rounded-xl px-6 py-4 max-w-xl mx-auto">
                        <p className="text-indigo-950 font-extrabold text-xs tracking-tight font-sans">
                          Thank You for Your Business!
                        </p>
                        <p className="text-slate-500 font-medium text-[10px] mt-1 font-sans">
                          We genuinely appreciate your partnership. Your trust is our greatest motivation, and we look forward to serving you again.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bottom footer print area */}
                  <div className="text-center border-t border-slate-200 pt-6 text-[8px] text-slate-400 uppercase tracking-widest leading-loose shrink-0">
                    {user.companyName} • {user.email} • {user.phone} <br />
                    {getBilingualString('thankYou', printLanguage)}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* 2. Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 relative text-xs text-slate-300 max-h-[92vh] flex flex-col overflow-hidden"
          >
            <h3 className="text-base font-extrabold text-white mb-3 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-5 h-5 text-indigo-400" />
              {t.createInvoice}
            </h3>

            {validationError && (
              <div className="mb-3 p-2 bg-red-950/40 border border-red-500/30 text-red-200 text-[11px] rounded flex items-center gap-1.5 shrink-0">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleCreateInvoiceSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Core numbers */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-0.5 opacity-90">
                  <label className="font-bold text-slate-400">Invoice ID / انوائس آئی ڈی *</label>
                  <input
                    type="text"
                    required
                    disabled
                    readOnly
                    value={invoiceNumber}
                    className="w-full bg-slate-950/80 border border-slate-850 rounded-xl px-3 py-2 text-indigo-400 font-mono font-bold cursor-not-allowed select-none"
                  />
                  <span className="text-[9px] text-slate-500 block leading-tight">(Auto-generated & read-only)</span>
                </div>

                <div className="space-y-0.5">
                  <div className="flex justify-between items-center mb-0.5 gap-1">
                    <label className="font-bold text-slate-400">{t.selectCustomer} *</label>
                    <input
                      type="text"
                      placeholder="Search name/phone..."
                      value={custSearchTerm}
                      onChange={(e) => setCustSearchTerm(e.target.value)}
                      className="bg-slate-950/95 border border-slate-800 rounded-lg px-2 py-0.5 text-[10px] text-white outline-none focus:border-indigo-500 max-w-[125px] transition"
                    />
                  </div>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                  >
                    <option value="">-- Choose Customer --</option>
                    <option value="walk-in">🚶 Walk-In Customer</option>
                    {customers
                      .filter(c => 
                        c.name.toLowerCase().includes(custSearchTerm.toLowerCase()) || 
                        c.phone.toLowerCase().includes(custSearchTerm.toLowerCase())
                      )
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="font-bold text-slate-400">Issue Date *</label>
                    <input
                      type="date"
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[10px] text-white"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="font-bold text-slate-400">Due Date (Optional)</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-[10px] text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Attach Product Block Section */}
              <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-850 space-y-3">
                <div className="flex justify-between items-center bg-slate-900/60 p-1 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1.5 flex items-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
                    Items & Products
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualItemMode(false);
                        setValidationError('');
                      }}
                      className={`text-[9px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                        !isManualItemMode 
                          ? 'bg-indigo-600 text-white' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      🗃️ From Catalog
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualItemMode(true);
                        setValidationError('');
                      }}
                      className={`text-[9px] font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                        isManualItemMode 
                          ? 'bg-indigo-600 text-white' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      ✍️ Custom / Manual
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  {!isManualItemMode ? (
                    <div className="sm:col-span-8">
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                      >
                        <option value="">-- Choose Product SKU --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({symbol} {p.price} - Stock: {p.stock})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="col-span-1 sm:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Item Custom Name / Desc *"
                        value={manualItemName}
                        onChange={(e) => setManualItemName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder={`Unit Price (${symbol}) *`}
                        value={manualItemPrice}
                        onChange={(e) => setManualItemPrice(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={selectedQty}
                      onChange={(e) => setSelectedQty(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddProductItem}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-xl font-bold cursor-pointer text-center"
                    >
                      Add Line
                    </button>
                  </div>
                </div>
              </div>

              {/* Attached items list review */}
              {attachedItems.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-400">Attached Product Register lines:</span>
                  <div className="bg-slate-950/60 rounded-xl border border-slate-900 overflow-hidden divide-y divide-slate-900">
                    {attachedItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center text-xs">
                        <div className="space-y-0.5">
                          <p className="font-bold text-white">{item.productName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {item.quantity} units x {formatMoney(item.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-200">{formatMoney(item.total)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-rose-400 font-bold hover:underline cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Flat discount & notes footer details */}
              <div className="space-y-1">
                <label className="font-bold text-slate-400">Flat Discount Amount ({symbol})</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="20.00"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                />
              </div>

              {/* Feature toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                <div className="space-y-3">
                  <span className="font-bold text-[10px] uppercase text-indigo-400 tracking-wider block font-sans">Calculation & Payment Settings</span>
                  
                  <label className="font-semibold text-slate-300 flex items-center gap-2 select-none cursor-pointer text-[11px] hover:text-white transition pb-1.5 border-b border-slate-800/50">
                    <input
                      type="checkbox"
                      checked={includeTax}
                      onChange={(e) => setIncludeTax(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 focus:ring-0 text-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Include Tax / VAT ({user.taxRate || 5}%)</span>
                  </label>

                  {/* Payment Status selector */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-bold block">Invoice Status / ادائیگی کا اسٹیٹس منتخب کریں :</span>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentStatusOption('unpaid');
                          setIsPaidOnCreation(false);
                        }}
                        className={`py-1 px-1 text-[9px] font-bold rounded cursor-pointer text-center transition ${
                          paymentStatusOption === 'unpaid'
                            ? 'bg-rose-900/80 border border-rose-600 text-rose-100'
                            : 'text-slate-400 hover:text-slate-250 hover:bg-slate-900'
                        }`}
                      >
                        Unpaid
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentStatusOption('paid');
                          setIsPaidOnCreation(true);
                        }}
                        className={`py-1 px-1 text-[9px] font-bold rounded cursor-pointer text-center transition ${
                          paymentStatusOption === 'paid'
                            ? 'bg-emerald-950 border border-emerald-600 text-emerald-100'
                            : 'text-slate-400 hover:text-slate-250 hover:bg-slate-900'
                        }`}
                      >
                        Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentStatusOption('partial');
                          setIsPaidOnCreation(false);
                        }}
                        className={`py-1 px-1 text-[9px] font-bold rounded cursor-pointer text-center transition ${
                          paymentStatusOption === 'partial'
                            ? 'bg-amber-950 border border-amber-600 text-amber-100'
                            : 'text-slate-400 hover:text-slate-250 hover:bg-slate-900'
                        }`}
                      >
                        Partial
                      </button>
                    </div>
                  </div>

                  {/* Prompt custom amount paid if Partial */}
                  {paymentStatusOption === 'partial' && (
                    <div className="space-y-1 bg-slate-950 p-2 rounded-lg border border-slate-850">
                      <span className="text-[10px] text-indigo-400 font-semibold block">Enter Amount Received ({symbol}) / وصول شدہ رقم:</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={customAmountPaidInput}
                        onChange={(e) => setCustomAmountPaidInput(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-850 rounded px-2.5 py-1 text-white font-mono text-[11px] outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {/* Payment method toggle for Paid / Partial */}
                  {paymentStatusOption !== 'unpaid' && (
                    <div className="pt-1.5 space-y-1 bg-slate-950/60 p-2 rounded-lg border border-slate-900/50">
                      <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider">Payment Method / رسید کا طریقہ</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition text-[11px]">
                          <input
                            type="radio"
                            name="payment_method_creation"
                            value="bank"
                            checked={paymentMethod === 'bank'}
                            onChange={() => setPaymentMethod('bank')}
                            className="text-indigo-500 bg-slate-950 border-slate-800 focus:ring-0 w-3.5 h-3.5"
                          />
                          <span>🏛️ Bank / بینک</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition text-[11px]">
                          <input
                            type="radio"
                            name="payment_method_creation"
                            value="cash"
                            checked={paymentMethod === 'cash'}
                            onChange={() => setPaymentMethod('cash')}
                            className="text-indigo-500 bg-slate-950 border-slate-800 focus:ring-0 w-3.5 h-3.5"
                          />
                          <span>💵 Cash / کیش</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-4">
                  <span className="font-bold text-[10px] uppercase text-emerald-400 tracking-wider block">Database Storage Options</span>
                  
                  <label className="font-semibold text-slate-300 flex items-start gap-2 select-none cursor-pointer text-[11px] hover:text-white transition">
                    <input
                      type="checkbox"
                      checked={saveToRecord}
                      onChange={(e) => setSaveToRecord(e.target.checked)}
                      className="rounded border-slate-800 bg-slate-950 focus:ring-0 text-indigo-500 w-4 h-4 cursor-pointer mt-0.5 shrink-0"
                    />
                    <div>
                      <p>Save Invoice to System History</p>
                      <p className="text-[9px] text-slate-500 font-normal mt-0.5 leading-tight">If unchecked, generates and downloads PDF offline immediately without any persistent system database record.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">Invoice Memo / Notes</label>
                <textarea
                  placeholder="Record telegraphic swift routing coordinates, default instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full h-16 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 outline-none resize-none"
                />
              </div>

              {/* Grand totals review */}
              {attachedItems.length > 0 && (
                <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-2.5 text-xs text-slate-300 shrink-0">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                    <div>
                      <span className="text-slate-500">VAT Standard ({includeTax ? (user.taxRate || 5) : 0}%):</span>
                      <span className="text-slate-300 ml-1">
                        {formatMoney((attachedItems.reduce((sum, item) => sum + item.total, 0) * (includeTax ? (user.taxRate || 5) : 0)) / 100)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-300 font-bold uppercase">Estimated Bill Total:</span>
                      <span className="text-sm font-black text-indigo-400 ml-1">
                        {(() => {
                          const sub = attachedItems.reduce((sum, item) => sum + item.total, 0);
                          const tax = includeTax ? ((sub * (user.taxRate || 5)) / 100) : 0;
                          const disc = parseFloat(discountInput) || 0;
                          return formatMoney(sub + tax - disc);
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] sm:text-xs">
                    <div>
                      <span className="text-emerald-500 font-bold">💵 Cash/Bank Paid:</span>
                      <span className="text-emerald-400 font-bold ml-1 font-mono">
                        {(() => {
                          const sub = attachedItems.reduce((sum, item) => sum + item.total, 0);
                          const tax = includeTax ? ((sub * (user.taxRate || 5)) / 100) : 0;
                          const disc = parseFloat(discountInput) || 0;
                          const gTotal = sub + tax - disc;
                          
                          if (paymentStatusOption === 'paid') return formatMoney(gTotal);
                          if (paymentStatusOption === 'partial') return formatMoney(parseFloat(customAmountPaidInput) || 0);
                          return formatMoney(0);
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-rose-500 font-bold">🚩 Remaining Due:</span>
                      <span className="text-rose-400 font-bold ml-1 font-mono">
                        {(() => {
                          const sub = attachedItems.reduce((sum, item) => sum + item.total, 0);
                          const tax = includeTax ? ((sub * (user.taxRate || 5)) / 100) : 0;
                          const disc = parseFloat(discountInput) || 0;
                          const gTotal = sub + tax - disc;
                          
                          let p = 0;
                          if (paymentStatusOption === 'paid') p = gTotal;
                          else if (paymentStatusOption === 'partial') p = parseFloat(customAmountPaidInput) || 0;
                          return formatMoney(Math.max(0, gTotal - p));
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Handlers */}
              <div className="flex gap-2.5 justify-end pt-3 bg-slate-900 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 font-semibold cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
                >
                  Generate Invoices
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
            deleteInvoice(user.id, deleteId);
            handleRefresh();
            if (activeInvoice && activeInvoice.id === deleteId) {
              setActiveInvoice(null);
            }
          }
        }}
        message="Are you sure you want to delete this invoice? The record of sales connected with this invoice will be deleted completely. This action stands irreversible."
        language={user.language}
      />
    </div>
  );
}
