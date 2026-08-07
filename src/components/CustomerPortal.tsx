import React, { useState } from 'react';
import { Customer, UserTenant, Invoice } from '../types';
import { getInvoices } from '../db';
import { translations } from '../translations';
import { FileText, LogOut, CheckCircle, Clock, DollarSign, Printer, Download, Globe, Coins, ShieldAlert, Award, MessageSquare, X, Share2, Link, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { cleanPhoneForWhatsApp, getDefaultPhoneCode } from '../utils/phone';

const bilingualTerms = {
  invoiceTitle: { en: 'TAX INVOICE', ar: 'فاتورة ضريبية مبسطة', ur: 'ٹیکس انوائس', hi: 'टैक्स इनवॉइस' },
  invoiceNumber: { en: 'Invoice Number', ar: 'رقم الفاتورة', ur: 'انوائس نمبر', hi: 'इनवॉइस नंबर' },
  date: { en: 'Date of Issue', ar: 'تاريخ الإصدار', ur: 'تاریخ اجراء', hi: 'जारी करने की तिथि' },
  dueDate: { en: 'Due Date', ar: 'تاريخ الاستحقاق', ur: 'آخری تاریخ', hi: 'देय तिथि' },
  billedTo: { en: 'Billed To (Buyer)', ar: 'الفاتورة إلى (العميل)', ur: 'بل بنام (خریدار)', hi: 'बिल प्राप्तकर्ता (क्रेता)' },
  status: { en: 'Payment Status', ar: 'حالة السداد', ur: 'ادائیگی کی صورتحال', hi: 'भुगतान की स्थिति' },
  description: { en: 'Description / Particulars', ar: 'البيان / تفاصيل السلع', ur: 'تفصیل / سامان کا نام', hi: 'विवरण / विशेष' },
  qty: { en: 'Qty', ar: 'الكمية', ur: 'مقدار', hi: 'मात्रा' },
  price: { en: 'Unit Price', ar: 'سعر الوحدة', ur: 'یونٹ کی قیمت', hi: 'इकाई मूल्य' },
  total: { en: 'Total Amount', ar: 'المجموع الإجمالي', ur: 'کل رقم', hi: 'कुल राशि' },
  subtotal: { en: 'Subtotal (Excl. VAT)', ar: 'المجموع الفرعي (خاضع للضريبة)', ur: 'ذیلی کل (ٹیکس کے بغیر)', hi: 'उप-योग (बिना टैक्स)' },
  tax: { en: 'VAT (Tax Amount)', ar: 'ضريبة القيمة المضافة', ur: 'ٹیکس رقم (واٹ)', hi: 'वैट (टैक्स राशि)' },
  discount: { en: 'Discount', ar: 'الخصم الممنوح', ur: 'رعایت / ڈسکاؤنٹ', hi: 'छूट (डिस्काउंट)' },
  totalPayable: { en: 'Total Payable (Incl. VAT)', ar: 'إجمالي المبلغ المستحق', ur: 'قابل ادائیگی رقم (ٹیکس سمیت)', hi: 'कुल देय राशि (टैक्स सहित)' },
  amountPaid: { en: 'Amount Paid', ar: 'المبلغ المدفوع', ur: 'ادا شدہ رقم', hi: 'भुगतान की गई राशि' },
  balanceDue: { en: 'Balance Due', ar: 'المتبقي المستحق', ur: 'باقی رقم', hi: 'शेष राशि' },
  notes: { en: 'Notes & Payment Terms', ar: 'الشروط وملاحظات الدفع', ur: 'نوٹ اور شرائط', hi: 'नोट और भुगतान की शर्तें' },
  trn: { en: 'VAT TRN (Seller Tax ID)', ar: 'الرقم الضريبي للمنشأة', ur: 'سپلائر ٹیکس رجسٹریشن نمبر', hi: 'विक्रेता टैक्स आईडी (TRN)' },
  buyerTrn: { en: 'Buyer Tax ID (TRN)', ar: 'الرقم الضريبي للمشتري', ur: 'خریدار ٹیکس رجسٹریشن نمبر', hi: 'क्रेता टैक्स आईडी (TRN)' },
  authorizedSign: { en: 'Prepared / Authorized Signature', ar: 'توقيع الجهة المعتمد', ur: 'مجاز دستخط', hi: 'अधिकृत हस्ताक्षर' },
  thankYou: { en: 'Thank you for your business!', ar: 'نشكركم على تعاملكم معنا ونقدر ثقتكم!', ur: 'آپ کے تعاون کا شکریہ!', hi: 'आपके व्यवसाय के लिए धन्यवाद!' },
  paidStatus: { en: 'PAID', ar: 'مدفوعة', ur: 'ادا شدہ', hi: 'भुगतान किया गया' },
  unpaidStatus: { en: 'UNPAID', ar: 'غير مدفوعة', ur: 'غیر ادا شدہ', hi: 'अवैतनिक' },
  via: { en: 'Via', ar: 'وسيلة الدفع', ur: 'بذریعہ', hi: 'के माध्यम से' }
};

const getBilingualValueAndForward = (
  key: keyof typeof bilingualTerms,
  lang: 'en' | 'ar' | 'ur' | 'hi' | 'both',
  secondaryLang: 'ar' | 'ur' | 'hi' = 'ar'
) => {
  const item = bilingualTerms[key];
  if (lang === 'en') return <span className="font-sans leading-relaxed">{item.en}</span>;
  if (lang === 'ar') return <span className="font-sans font-semibold leading-relaxed text-right block" dir="rtl">{item.ar}</span>;
  if (lang === 'ur') return <span className="font-sans font-semibold leading-relaxed text-right block" dir="rtl">{item.ur}</span>;
  if (lang === 'hi') return <span className="font-sans leading-relaxed">{item.hi}</span>;

  // Bilingual / Both Mode
  const secondaryText = item[secondaryLang] || item.ar;
  const isRtlSec = secondaryLang === 'ar' || secondaryLang === 'ur';

  return (
    <div className="flex flex-col text-[100%] leading-tight font-sans">
      <span className="font-semibold text-slate-850 tracking-tight">{item.en}</span>
      <span className="text-slate-500 font-bold mt-0.5 text-[80%]" dir={isRtlSec ? "rtl" : "ltr"}>
        {secondaryText}
      </span>
    </div>
  );
};

const getBilingualStringAndForward = (
  key: keyof typeof bilingualTerms,
  lang: 'en' | 'ar' | 'ur' | 'hi' | 'both',
  secondaryLang: 'ar' | 'ur' | 'hi' = 'ar',
  separator: string = ' / '
) => {
  const item = bilingualTerms[key];
  if (lang === 'en') return item.en;
  if (lang === 'ar') return item.ar;
  if (lang === 'ur') return item.ur;
  if (lang === 'hi') return item.hi;

  const secondaryText = item[secondaryLang] || item.ar;
  return `${item.en}${separator}${secondaryText}`;
};

interface CustomerPortalProps {
  customer: Customer;
  merchant: UserTenant;
  onSignOut: () => void;
  initialInvoiceId?: string | null;
}

export default function CustomerPortal({ customer, merchant, onSignOut, initialInvoiceId }: CustomerPortalProps) {
  // Pull all invoices matching this customer profile
  const invoices = customer.id.startsWith('guest-')
    ? getInvoices(merchant.id).filter(inv => inv.id === customer.id.replace('guest-', ''))
    : getInvoices(merchant.id).filter(inv => inv.customerId === customer.id);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(() => {
    if (initialInvoiceId) {
      const match = invoices.find(inv => inv.id === initialInvoiceId);
      if (match) return match;
    }
    return null;
  });
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [receiptLang, setReceiptLang] = useState<'en' | 'ar' | 'ur' | 'hi' | 'both'>('both');
  const [sharingPhone, setSharingPhone] = useState(() => customer.phone && !customer.phone.includes('unregistered') ? customer.phone : '');
  const [countryCode, setCountryCode] = useState(() => {
    if (merchant.currency === 'AED') return '971';
    if (merchant.currency === 'PKR') return '92';
    if (merchant.currency === 'SAR') return '966';
    if (merchant.phone) {
      const clean = merchant.phone.replace(/\D/g, '');
      if (clean.startsWith('971')) return '971';
      if (clean.startsWith('92')) return '92';
      if (clean.startsWith('966')) return '966';
    }
    return '971';
  });

  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  const handleCopyLink = (inv: Invoice) => {
    const portalUrl = `${window.location.origin}?invoiceId=${inv.id}`;
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopiedInvoiceId(inv.id);
      setTimeout(() => setCopiedInvoiceId(null), 3000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleNativeShare = (inv: Invoice) => {
    const portalUrl = `${window.location.origin}?invoiceId=${inv.id}`;
    const shareData = {
      title: `Invoice ${inv.invoiceNumber} - ${merchant.companyName}`,
      text: `Hello! View and download my tax invoice of amount ${currencySymbol}${inv.total.toFixed(2)} from ${merchant.companyName} dynamically.`,
      url: portalUrl,
    };
    if (navigator.share) {
      navigator.share(shareData).then(() => {
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      }).catch(err => {
        console.warn('Native share error or dismissed:', err);
      });
    } else {
      handleCopyLink(inv);
    }
  };

  const shareViaEmail = (inv: Invoice) => {
    const portalUrl = `${window.location.origin}?invoiceId=${inv.id}`;
    const subject = encodeURIComponent(`Invoice ${inv.invoiceNumber} from ${merchant.companyName}`);
    const body = encodeURIComponent(
      `Dear customer,\n\nPlease click on the link below to view, download, or share your tax invoice (${inv.invoiceNumber}) of amount ${currencySymbol}${inv.total.toFixed(2)} from ${merchant.companyName} without needing to log in:\n\n${portalUrl}\n\nThank you for choosing ${merchant.companyName}!\nBest regards,\n${merchant.companyName}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  // Ledger stats calculation
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
  const balanceDue = totalInvoiced - totalPaid;

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'paid') return inv.status === 'paid';
    if (filter === 'unpaid') return inv.status === 'unpaid';
    return true;
  });

  const currencySymbol = merchant.currency === 'USD' ? '$' : merchant.currency === 'AED' ? 'AED ' : merchant.currency === 'PKR' ? 'Rs ' : merchant.currency === 'SAR' ? 'SAR ' : merchant.currency === 'EUR' ? '€' : '';

  const secondaryLang: 'ar' | 'ur' | 'hi' = merchant.language === 'ur' ? 'ur' : merchant.language === 'hi' ? 'hi' : 'ar';

  const getBilingualValue = (key: keyof typeof bilingualTerms, lang: 'en' | 'ar' | 'ur' | 'hi' | 'both') => 
    getBilingualValueAndForward(key, lang, secondaryLang);

  const getBilingualString = (key: keyof typeof bilingualTerms, lang: 'en' | 'ar' | 'ur' | 'hi' | 'both') => 
    getBilingualStringAndForward(key, lang, secondaryLang);

  const handlePrint = () => {
    window.print();
  };

  const generateInvoicePDF = (inv: Invoice) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const symbol = currencySymbol || '';
      const primaryColor = [79, 70, 229]; // Indigo: #4f46e5
      const darkNeutral = [30, 41, 59];  // Slate 800: #1e293b
      const lightNeutral = [241, 245, 249]; // Slate 100: #f1f5f9
      const grayText = [100, 116, 139];   // Slate 500: #64748b

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
      doc.text((merchant.companyName || 'Business Name').toUpperCase(), 15, 25);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      const addressLine = `${merchant.address || 'Company Administrative Address'}`;
      const contactLine = `Phone: ${merchant.phone || 'Phone Contact'} | Email: ${merchant.email || ''}`;
      doc.text(addressLine, 15, 31);
      doc.text(contactLine, 15, 36);
      if (merchant.taxNumber) {
        doc.setFont('Helvetica', 'bold');
        doc.text(`TRN / Tax Ref: ${merchant.taxNumber}`, 15, 41);
      }

      // Invoice Header Info Right Column
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('TAX INVOICE', 195, 25, { align: 'right' });

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

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text(customer.name, 15, 62);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      let yOffset = 67;
      if (customer.phone) { doc.text(`Phone: ${customer.phone}`, 15, yOffset); yOffset += 5; }
      if (customer.email) { doc.text(`Email: ${customer.email}`, 15, yOffset); yOffset += 5; }
      if (customer.address) { doc.text(`Address: ${customer.address}`, 15, yOffset); yOffset += 5; }

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
      } else if (inv.status === 'overdue') {
        doc.setTextColor(239, 68, 68); // Red 500
        doc.text('OVERDUE', 150, 62);
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
      doc.text(`Tax (${inv.taxRate || merchant.taxRate || 5}%):`, summaryLabelX, currentY);
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

      // Notes block
      let notesY = currentY - (inv.discount > 0 ? 25 : 20);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Notes / Terms:', 15, notesY);
      doc.setFont('Helvetica', 'normal');
      
      const remarks = inv.notes || merchant.invoiceNotes || 'Thank you for your business!';
      const lines = doc.splitTextToSize(remarks, 110);
      doc.text(lines, 15, notesY + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Page 1 of 1 | Invoice generated via secure customer portal.`, 15, 285);
      doc.text(`Thank you for your trust we value your business.`, 195, 285, { align: 'right' });

      doc.save(`Invoice_${inv.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Failed to export invoice PDF format:', err);
    }
  };

  const shareOnWhatsApp = (inv: Invoice, overridePhone?: string) => {
    const statusStr = inv.status === 'paid' ? 'PAID' : 'UNPAID';
    const amtPaid = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
    const balDue = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);
    const company = merchant.companyName || 'Our Business';
    
    const activePhone = overridePhone !== undefined ? overridePhone : (customer.phone && !customer.phone.includes('unregistered') ? customer.phone : '');
    
    // Process phone number dynamically with or without country code
    const defaultCode = getDefaultPhoneCode(merchant.currency);
    const cleanedNum = cleanPhoneForWhatsApp(activePhone, defaultCode);
    
    const portalUrl = `${window.location.origin}?invoiceId=${inv.id}`;

    const text = `Hello! Here is your invoice from *${company}*:\n\n` +
                 `*Invoice Number*: ${inv.invoiceNumber}\n` +
                 `*Date*: ${inv.date}\n` +
                 `*Due Date*: ${inv.dueDate || 'N/A'}\n` +
                 `*Total Amount*: ${currencySymbol}${inv.total.toFixed(2)}\n` +
                 `*Amount Paid*: ${currencySymbol}${amtPaid.toFixed(2)}\n` +
                 `*Remaining Balance*: ${currencySymbol}${balDue.toFixed(2)}\n` +
                 `*Status*: *${statusStr}*\n\n` +
                 `You can view the full secure invoice online here:\n${portalUrl}`;

    const waUrl = cleanedNum 
      ? `https://api.whatsapp.com/send?phone=${cleanedNum}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    
    window.open(waUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Printable Area Target block for Standard CSS Prints */}
      <div id="printable-area" className="hidden print:block text-black p-8 bg-white min-h-screen">
        {selectedInvoice && (
          <div className="space-y-6 text-xs font-sans leading-relaxed text-slate-800" dir={receiptLang === 'ar' || receiptLang === 'ur' ? 'rtl' : 'ltr'}>
            <div className="flex justify-between items-start border-b pb-6 border-slate-200">
              <div>
                {merchant.logoUrl ? (
                  <img src={merchant.logoUrl} alt="Logo" className="max-h-12 max-w-xs object-contain mb-3" referrerPolicy="no-referrer" />
                ) : (
                  <div className="font-extrabold text-lg text-indigo-900 tracking-tight">{merchant.companyName}</div>
                )}
                <p className="font-bold text-slate-800">{merchant.companyName}</p>
                <p className="text-slate-500">{merchant.address || 'Heaquaters Office'}</p>
                <p className="text-slate-500">Phone: {merchant.phone || '-'}</p>
                {merchant.taxNumber && <p className="text-slate-900 font-bold font-mono">TRN VAT ID: {merchant.taxNumber}</p>}
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-black text-indigo-900 uppercase">
                  {getBilingualString('invoiceTitle', receiptLang)}
                </h1>
                <p className="font-mono font-black text-base text-slate-900 mt-2">{selectedInvoice.invoiceNumber}</p>
                <div className="mt-4 space-y-1 text-slate-500">
                  <p>{getBilingualString('date', receiptLang)}: <strong className="text-slate-800 font-mono">{selectedInvoice.date}</strong></p>
                  <p>{getBilingualString('dueDate', receiptLang)}: <strong className="text-slate-800 font-mono">{selectedInvoice.dueDate}</strong></p>
                  <p>{getBilingualString('status', receiptLang)}: <strong className="uppercase font-bold text-emerald-600">{selectedInvoice.status === 'paid' ? getBilingualString('paidStatus', receiptLang) : getBilingualString('unpaidStatus', receiptLang)}</strong></p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="font-extrabold text-[10px] uppercase text-slate-400 block tracking-wider">
                  {getBilingualString('billedTo', receiptLang)}:
                </span>
                <p className="font-black text-slate-900 text-sm mt-1">{customer.name}</p>
                <p className="text-slate-500 mt-1">{customer.email}</p>
                <p className="text-slate-500">{customer.phone}</p>
                <p className="text-slate-500 text-[10px]">{customer.address}</p>
              </div>
              <div className="text-right flex flex-col justify-between">
                <div>
                  <span className="font-extrabold text-[10px] uppercase text-slate-400 block tracking-wider">Default Currency / العملة:</span>
                  <span className="font-mono font-black text-sm text-indigo-950">{merchant.currency}</span>
                </div>
                {selectedInvoice.notes && (
                  <div className="text-slate-500 text-[10px] italic">
                    Note: {selectedInvoice.notes}
                  </div>
                )}
              </div>
            </div>

            <table className="w-full text-left border-collapse mt-4 text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-slate-400 font-black tracking-wider uppercase text-[9px] bg-slate-50">
                  <th className="py-2 px-3">{getBilingualString('description', receiptLang)}</th>
                  <th className="py-2 px-3 text-right">{getBilingualString('price', receiptLang)}</th>
                  <th className="py-2 px-3 text-center">{getBilingualString('qty', receiptLang)}</th>
                  <th className="py-2 px-2 text-right">Tax (%)</th>
                  <th className="py-2 px-3 text-right">{getBilingualString('total', receiptLang)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {selectedInvoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900">{item.productName}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{currencySymbol}{item.price.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center font-mono">{item.quantity}</td>
                    <td className="py-2.5 px-2 text-right font-mono">{selectedInvoice.taxRate || merchant.taxRate || 5}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {currencySymbol}{item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-5 text-xs text-slate-900">
              <div className="w-64 space-y-2 border-t pt-4 border-slate-200">
                <div className="flex justify-between">
                  <span>{getBilingualString('subtotal', receiptLang)}:</span>
                  <span className="font-mono font-bold">{currencySymbol}{selectedInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{getBilingualString('tax', receiptLang)} ({merchant.taxRate || 5}%):</span>
                  <span className="font-mono text-slate-700">{currencySymbol}{selectedInvoice.taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed pt-2 text-sm font-black text-indigo-950">
                  <span>{getBilingualString('totalPayable', receiptLang)}:</span>
                  <span className="font-mono">{currencySymbol}{selectedInvoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {merchant.invoiceNotes && (
              <div className="border-t border-slate-200 pt-6 mt-12 text-[10px] text-slate-500 leading-relaxed font-sans bg-slate-50 p-4 rounded-xl">
                <strong className="block text-slate-700 mb-1 uppercase tracking-wider">Ref wire or swift coordinates:</strong>
                {merchant.invoiceNotes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Screen View Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden print:hidden">
        {/* Top Header navbar */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            {merchant.logoUrl ? (
              <img src={merchant.logoUrl} alt="Logo" className="max-h-10 max-w-[140px] object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-black text-sm shadow-md">
                OM
              </div>
            )}
            <div>
              <h1 className="text-sm font-black tracking-tight text-white uppercase">{merchant.companyName}</h1>
              <p className="text-[10px] text-slate-400 font-medium font-mono">BILLING & INVOICES PORTAL</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick badges */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-violet-950/40 border border-violet-800/40 text-[10px] text-violet-300 rounded-full font-bold">
              <Award className="w-3.5 h-3.5 text-violet-400" />
              Verified Client Profile
            </span>
            <button 
              onClick={onSignOut}
              className="flex items-center gap-1 text-[10px] font-bold bg-slate-800 hover:bg-rose-950/30 hover:text-rose-400 text-slate-300 py-2 px-3.5 rounded-xl border border-slate-750 transition duration-300 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>LOGOUT / مخرج</span>
            </button>
          </div>
        </header>

        {/* Workspace core grid split */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
          {/* Welcome greeting card with stats */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/45 p-6 rounded-2xl border border-slate-850 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest bg-indigo-950/60 py-1 px-3 rounded-full border border-indigo-900/40">CUSTOMER DASHBOARD</span>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-3 flex items-center gap-2">
                <span>Welcome,</span>
                <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-white bg-clip-text text-transparent">{customer.name}!</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Logged in using: <strong className="font-mono text-white">{customer.email || customer.phone}</strong></p>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full md:w-auto shrink-0 font-mono">
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-850 flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider flex items-center gap-1">
                  <Coins className="w-3 h-3 text-slate-400" /> Total Invoiced
                </span>
                <span className="text-xs sm:text-sm font-black text-white mt-1.5">{currencySymbol}{totalInvoiced.toFixed(2)}</span>
              </div>
              <div className="bg-emerald-950/15 p-3.5 rounded-xl border border-emerald-900/20 flex flex-col">
                <span className="text-[9px] text-emerald-500 uppercase font-black tracking-wider flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Total Paid
                </span>
                <span className="text-xs sm:text-sm font-black text-emerald-400 mt-1.5">{currencySymbol}{totalPaid.toFixed(2)}</span>
              </div>
              <div className="bg-amber-950/15 p-3.5 rounded-xl border border-amber-905/20 flex flex-col">
                <span className="text-[9px] text-amber-550 uppercase font-black tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-500" /> Balance Due
                </span>
                <span className="text-xs sm:text-sm font-black text-amber-400 mt-1.5">{currencySymbol}{balanceDue.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Table index container */}
          <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-850">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  YOUR VALUED STATEMENTS & TAX INVOICES
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Below is a log of all transactions and legal invoices matching your customer domain profile database.</p>
              </div>

              {/* Status query quick filters */}
              <div className="bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex gap-1">
                {(['all', 'paid', 'unpaid'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition cursor-pointer ${
                      filter === f 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* List Table Grid layout */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="text-slate-500 font-extrabold text-[10px] uppercase border-b border-slate-800">
                    <th className="py-3 px-4">Invoice ID</th>
                    <th className="py-3 px-4">Invoice Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 italic">
                        No invoices matches this query criteria currently.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-850/40 transition">
                        <td className="py-3 px-4 font-mono font-black text-white text-xs">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 font-mono">{inv.date}</td>
                        <td className="py-3 px-4 font-mono">{inv.dueDate}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {currencySymbol}{inv.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                            inv.status === 'paid' 
                              ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-400' 
                              : 'bg-amber-950/50 border border-amber-500/30 text-amber-400'
                          }`}>
                            {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="bg-indigo-600/15 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white font-bold px-2.5 py-1.5 rounded-lg transition duration-300 cursor-pointer text-[10px]"
                            >
                              View
                            </button>
                            <button
                              onClick={() => generateInvoicePDF(inv)}
                              className="p-1.5 px-2.5 bg-indigo-650/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/35 rounded-lg cursor-pointer transition flex items-center gap-1 text-[10px] font-bold"
                              title="Download PDF Invoice"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </button>
                            <button
                              onClick={() => shareOnWhatsApp(inv)}
                              className="p-1.5 px-2.5 bg-emerald-650/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/35 rounded-lg cursor-pointer transition flex items-center gap-1 text-[10px] font-bold"
                              title="Send on WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Detail PDF / Print Preview Modal backdrop popup */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative overflow-hidden"
            >
              {/* Modal controls bar */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center text-xs">
                <span className="font-extrabold text-white">TAX RECEIPT PREVIEW</span>
                
                {/* Print and Translation options */}
                <div className="flex gap-2">
                  <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 flex">
                     {(['en', 'ar', 'ur', 'hi', 'both'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setReceiptLang(lang)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                          receiptLang === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {lang === 'en' ? 'EN' : lang === 'ar' ? 'عربى' : lang === 'ur' ? 'اردو' : lang === 'hi' ? 'हिंदी' : 'Dual'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => generateInvoicePDF(selectedInvoice)}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    DOWNLOAD PDF
                  </button>

                  <button
                    onClick={() => shareOnWhatsApp(selectedInvoice)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WHATSAPP
                  </button>

                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-black py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    PRINT
                  </button>

                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="bg-slate-850 hover:bg-slate-850 text-slate-300 font-bold py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    CLOSE
                  </button>
                </div>
              </div>

              {/* Universal Sharing & Quick Copy Hub */}
              <div className="bg-slate-950/95 border-b border-slate-800 p-4 sm:p-5 flex flex-col gap-4 font-sans">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <div>
                      <h4 className="text-[11px] font-black text-white uppercase tracking-wider">
                        {merchant.language === 'ur' ? 'آسان شیئرنگ اور ورچوئل لنک' : 'Universal Document Sharing & Actions'}
                      </h4>
                      <p className="text-[9px] text-slate-400">
                        {merchant.language === 'ur' ? 'کسٹمر بغیر لاگ آن کیے بِل براہ راست دیکھ اور ڈاؤن لوڈ کر سکتا ہے' : 'Access link has zero friction — no sign-in or login barrier for clients.'}
                      </p>
                    </div>
                  </div>

                  {/* Multi-Channel sharing action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Copy Link Button */}
                    <button
                      onClick={() => handleCopyLink(selectedInvoice)}
                      className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[10px] font-bold transition duration-200 border cursor-pointer ${
                        copiedInvoiceId === selectedInvoice.id
                          ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300'
                          : 'bg-indigo-600/10 hover:bg-indigo-600/25 border-indigo-500/25 text-indigo-300'
                      }`}
                    >
                      <Link className="w-3.5 h-3.5" />
                      <span>{copiedInvoiceId === selectedInvoice.id ? (merchant.language === 'ur' ? 'لنک کاپی ہو گیا! ✓' : 'Link Copied! ✓') : (merchant.language === 'ur' ? 'لنک کاپی کریں' : 'Copy Direct Link')}</span>
                    </button>

                    {/* Email Link Button */}
                    <button
                      onClick={() => shareViaEmail(selectedInvoice)}
                      className="flex items-center gap-1.5 py-1.5 px-3 bg-slate-800 hover:bg-slate-755 border border-slate-700 hover:border-slate-600 text-slate-200 rounded-lg text-[10px] font-bold transition duration-200 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{merchant.language === 'ur' ? 'ای میل شیئر' : 'Email Invoice Link'}</span>
                    </button>

                    {/* Native Device Share Sheet Button */}
                    <button
                      onClick={() => handleNativeShare(selectedInvoice)}
                      className="flex items-center gap-1.5 py-1.5 px-3 bg-violet-600 hover:bg-violet-700 text-white border border-violet-500 rounded-lg text-[10px] font-bold transition duration-200 cursor-pointer shadow-md shadow-violet-950/35"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{merchant.language === 'ur' ? 'موبائل شیئر' : 'Phone Share Sheet'}</span>
                    </button>
                  </div>
                </div>

                {/* Direct WhatsApp Message Forward Panel */}
                <div className="pt-3 border-t border-slate-900 flex flex-col md:flex-row items-start md:items-center gap-3 justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-200 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      {merchant.language === 'ur' ? 'واٹس ایپ پر بل بھیجیں:' : 'Send Invoice via WhatsApp Direct:'}
                    </span>
                    <span className="text-[8.5px] text-slate-500">
                      {merchant.language === 'ur' ? 'کنٹری کوڈ منتخب کر کے نمبر ٹائپ کریں' : 'Direct WhatsApp API integration — opens immediately on any device.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 w-full md:w-auto mt-1 md:mt-0 font-sans">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-emerald-400 outline-none transition font-sans cursor-pointer focus:border-emerald-500/50"
                    >
                      <option value="971">🇦🇪 +971 (UAE)</option>
                      <option value="92">🇵🇰 +92 (PK)</option>
                      <option value="966">🇸🇦 +966 (KSA)</option>
                      <option value="91">🇮🇳 +91 (IND)</option>
                      <option value="974">🇶🇦 +974 (QA)</option>
                      <option value="968">🇴🇲 +968 (OM)</option>
                      <option value="973">🇧🇭 +973 (BH)</option>
                      <option value="965">🇰🇼 +965 (KW)</option>
                      <option value="1">🇺🇸 +1 (US)</option>
                      <option value="44">🇬🇧 +44 (UK)</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="E.g., 0501234567 or 300123456" 
                      value={sharingPhone}
                      onChange={(e) => setSharingPhone(e.target.value)}
                      className="bg-slate-900 border border-slate-800 focus:border-emerald-555/60 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-slate-600 outline-none transition w-full md:w-44 font-mono"
                    />
                    <button
                      onClick={() => shareOnWhatsApp(selectedInvoice, sharingPhone)}
                      className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg font-bold text-[10px] uppercase transition cursor-pointer flex items-center justify-center gap-1 shrink-0 shadow-md shadow-emerald-950/25"
                      title="Send PDF access via WhatsApp link"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{merchant.language === 'ur' ? 'میسج بھیجیں' : 'Send WhatsApp'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Invoice layout paper view */}
              <div className="flex-1 p-8 overflow-y-auto bg-white text-slate-800 font-sans" dir={receiptLang === 'ar' || receiptLang === 'ur' ? 'rtl' : 'ltr'}>
                <div className="flex justify-between items-start border-b pb-6 border-slate-200">
                  <div>
                    {merchant.logoUrl ? (
                      <img src={merchant.logoUrl} alt="Logo" className="max-h-12 max-w-xs object-contain mb-3" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="font-extrabold text-lg text-indigo-900 tracking-tight">{merchant.companyName}</div>
                    )}
                    <h2 className="font-bold text-slate-900 leading-tight">{merchant.companyName}</h2>
                    <p className="text-slate-500 text-[11px] leading-relaxed mt-1 max-w-xs">{merchant.address || 'Operations HQ'}</p>
                    <p className="text-slate-500 text-[11px]">Contact: {merchant.phone || '-'}</p>
                    {merchant.taxNumber && <p className="text-indigo-950 font-black text-xs font-mono mt-1">VAT/TRN: {merchant.taxNumber}</p>}
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black text-indigo-950">
                      {getBilingualString('invoiceTitle', receiptLang)}
                    </h2>
                    <span className="inline-block bg-slate-100 text-slate-900 font-mono font-bold text-xs px-2.5 py-1 rounded mt-2">{selectedInvoice.invoiceNumber}</span>
                    <div className="mt-4 space-y-1 text-slate-500 text-[11px]">
                      <p>{getBilingualString('date', receiptLang)}: <strong className="text-slate-800 font-mono">{selectedInvoice.date}</strong></p>
                      <p>{getBilingualString('dueDate', receiptLang)}: <strong className="text-slate-800 font-mono">{selectedInvoice.dueDate}</strong></p>
                      <p>{getBilingualString('status', receiptLang)}: <strong className="uppercase font-bold text-emerald-650">{selectedInvoice.status === 'paid' ? getBilingualString('paidStatus', receiptLang) : getBilingualString('unpaidStatus', receiptLang)}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-400 text-[9px] uppercase block">
                      {getBilingualString('billedTo', receiptLang)}:
                    </span>
                    <p className="font-black text-slate-900 text-sm mt-1">{customer.name}</p>
                    <p className="text-slate-500">{customer.email}</p>
                    <p className="text-slate-500">{customer.phone}</p>
                    <p className="text-slate-500 leading-relaxed text-[10px] mt-1 max-w-xs">{customer.address}</p>
                  </div>
                  <div className="text-right flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-slate-400 text-[9px] uppercase block">Primary Account Currency / العملة:</span>
                      <strong className="font-mono text-indigo-950 font-black text-sm">{merchant.currency}</strong>
                    </div>
                    {selectedInvoice.notes && (
                      <p className="text-slate-500 text-[10px] italic">Comments: {selectedInvoice.notes}</p>
                    )}
                  </div>
                </div>

                 {/* Items loop */}
                <table className="w-full text-left border-collapse mt-6 text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-400 font-black uppercase text-[9px] bg-slate-50">
                      <th className="py-2.5 px-3">{getBilingualString('description', receiptLang)}</th>
                      <th className="py-2.5 px-2 text-right">{getBilingualString('price', receiptLang)}</th>
                      <th className="py-2.5 px-2 text-center">{getBilingualString('qty', receiptLang)}</th>
                      <th className="py-2.5 px-2 text-right">Tax (%)</th>
                      <th className="py-2.5 px-3 text-right">{getBilingualString('total', receiptLang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{item.productName}</p>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-900">{currencySymbol}{item.price.toFixed(2)}</td>
                        <td className="py-3 px-2 text-center font-mono text-slate-900">{item.quantity}</td>
                        <td className="py-3 px-2 text-right font-mono text-slate-500">{selectedInvoice.taxRate || merchant.taxRate || 5}%</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {currencySymbol}{item.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Total Summaries */}
                <div className="flex justify-end pt-5 text-xs text-slate-900 font-sans">
                  <div className="w-64 space-y-2 border-t pt-4 border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{getBilingualString('subtotal', receiptLang)}:</span>
                      <span className="font-mono font-bold">{currencySymbol}{selectedInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{getBilingualString('tax', receiptLang)} ({selectedInvoice.taxRate || merchant.taxRate || 5}%):</span>
                      <span className="font-mono text-slate-700">{currencySymbol}{selectedInvoice.taxAmount.toFixed(2)}</span>
                    </div>
                    {selectedInvoice.discount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>{getBilingualString('discount', receiptLang)}:</span>
                        <span className="font-mono font-bold">-{currencySymbol}{selectedInvoice.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-dashed pt-2 text-xs font-black text-indigo-950">
                      <span>{getBilingualString('totalPayable', receiptLang)}:</span>
                      <strong className="font-mono text-base">{currencySymbol}{selectedInvoice.total.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>{getBilingualString('amountPaid', receiptLang)}:</span>
                      <span className="font-mono">{currencySymbol}{(selectedInvoice.amountPaid !== undefined ? selectedInvoice.amountPaid : (selectedInvoice.status === 'paid' ? selectedInvoice.total : 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600 font-extrabold border-t border-slate-100 pt-1">
                      <span>{getBilingualString('balanceDue', receiptLang)}:</span>
                      <span className="font-mono text-sm">{currencySymbol}{(selectedInvoice.balanceDue !== undefined ? selectedInvoice.balanceDue : (selectedInvoice.status === 'paid' ? 0 : selectedInvoice.total)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Remittance coordinates */}
                {merchant.invoiceNotes && (
                  <div className="border-t border-slate-200 pt-6 mt-10 text-[9px] text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl">
                    <strong className="block text-slate-705 font-bold mb-1 uppercase tracking-wider">Payment / Routing wire instructions:</strong>
                    {merchant.invoiceNotes}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
