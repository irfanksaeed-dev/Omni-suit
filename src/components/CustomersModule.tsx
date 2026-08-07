import React, { useState, useEffect } from 'react';
import { UserTenant, Customer, Invoice, CustomerPayment, CustomerReturn, Product } from '../types';
import { translations } from '../translations';
import { getCustomers, addCustomer, editCustomer, deleteCustomer, getNextCustomerId, toggleCustomerBlock, toggleCustomerApproval, getInvoices, getCustomerPayments, addCustomerPayment, deleteCustomerPayment, getCustomerReturns, addCustomerReturn, deleteCustomerReturn, getProducts } from '../db';
import { Plus, Search, Trash2, Edit2, Contact, Phone, Mail, MapPin, User, ArrowRight, ShieldAlert, Check, Copy, KeyRound, Accessibility, RefreshCw, ArrowLeft, Receipt, CheckCircle, Clock, CreditCard, Building, Wallet, Calendar, ExternalLink, QrCode, Printer, Download, MessageSquare, Users, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import { jsPDF } from 'jspdf';
import { cleanPhoneForWhatsApp, getDefaultPhoneCode } from '../utils/phone';

interface CustomersModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function CustomersModule({ user, onRefreshStats }: CustomersModuleProps) {
  const t = translations[user.language];
  const currencySymbol = user.currency === 'USD' ? '$' : user.currency === 'AED' ? 'AED ' : user.currency === 'PKR' ? 'Rs ' : user.currency === 'SAR' ? 'SAR ' : user.currency === 'EUR' ? '€' : '';

  const generateInvoicePDF = (inv: Invoice, cust: Customer) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const symbol = currencySymbol || '';
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

      // Company Name header & Meta details
      let compName = (user.companyName || 'Business Name').toUpperCase();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      const compLines = doc.splitTextToSize(compName, 115);
      doc.text(compLines[0] + (compLines.length > 1 ? '...' : ''), 15, 25);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      
      const addressLine = `${user.address || 'Company Administrative Address'}`;
      const addrLines = doc.splitTextToSize(addressLine, 115);
      doc.text(addrLines[0] + (addrLines.length > 1 ? '...' : ''), 15, 31);

      const contactLine = `Phone: ${user.phone || 'Phone Contact'} | Email: ${user.email || ''}`;
      const contactLines = doc.splitTextToSize(contactLine, 115);
      doc.text(contactLines[0] + (contactLines.length > 1 ? '...' : ''), 15, 36);

      if (user.taxNumber) {
        doc.setFont('Helvetica', 'bold');
        doc.text(`TRN / Tax Ref: ${user.taxNumber}`, 15, 41);
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
      doc.setFontSize(11);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      const billedName = cust ? cust.name : inv.customerName;
      const billedLines = doc.splitTextToSize(billedName, 120);
      doc.text(billedLines[0] + (billedLines.length > 1 ? '...' : ''), 15, 62);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      let yOffset = 67;
      if (cust) {
        if (cust.phone) {
          const pLine = doc.splitTextToSize(`Phone: ${cust.phone}`, 120);
          doc.text(pLine[0] + (pLine.length > 1 ? '...' : ''), 15, yOffset);
          yOffset += 5;
        }
        if (cust.email) {
          const eLine = doc.splitTextToSize(`Email: ${cust.email}`, 120);
          doc.text(eLine[0] + (eLine.length > 1 ? '...' : ''), 15, yOffset);
          yOffset += 5;
        }
        if (cust.address) {
          const aLines = doc.splitTextToSize(`Address: ${cust.address}`, 120);
          doc.text(aLines[0] + (aLines.length > 1 ? '...' : ''), 15, yOffset);
          yOffset += 5;
        }
      } else {
        doc.text('Walk-In / Direct Account Invoice', 15, yOffset);
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
        // Wrap name to 85mm
        const productNameLines = doc.splitTextToSize(item.productName, 85);
        const rowHeight = Math.max(8, productNameLines.length * 4.5 + 2.5);

        // Check page overflow
        if (currentY + rowHeight > 270) {
          doc.addPage();
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(0, 0, 210, 10, 'F');
          
          currentY = 20;
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
        }

        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, currentY, 180, rowHeight, 'F');
        }
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
        doc.text(productNameLines, 18, currentY + 4.5);
        
        doc.setFont('Helvetica', 'normal');
        doc.text(item.quantity.toString(), 115, currentY + 4.5, { align: 'right' });
        doc.text(`${symbol} ${item.price.toFixed(2)}`, 150, currentY + 4.5, { align: 'right' });
        doc.setFont('Helvetica', 'bold');
        doc.text(`${symbol} ${item.total.toFixed(2)}`, 192, currentY + 4.5, { align: 'right' });

        currentY += rowHeight;
      });

      // Force a page break if summary wouldn't fit beautifully
      if (currentY + 50 > 280) {
        doc.addPage();
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 10, 'F');
        currentY = 20;
      }

      drawDivider(currentY + 2);
      currentY += 8;

      // Summary section alignment alongside Notes/Terms
      const summaryLabelX = 145;
      const summaryValueX = 192;
      const startSummaryY = currentY;
      let tempY = startSummaryY;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);

      // Subtotal
      doc.text('Subtotal:', summaryLabelX, tempY);
      doc.text(`${symbol} ${inv.subtotal.toFixed(2)}`, summaryValueX, tempY, { align: 'right' });
      tempY += 5;

      // Tax
      doc.text(`Tax (${inv.taxRate || user.taxRate || 5}%):`, summaryLabelX, tempY);
      doc.text(`+ ${symbol} ${inv.taxAmount.toFixed(2)}`, summaryValueX, tempY, { align: 'right' });
      tempY += 5;

      // Discount if any
      if (inv.discount > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text('Discount:', summaryLabelX, tempY);
        doc.text(`- ${symbol} ${inv.discount.toFixed(2)}`, summaryValueX, tempY, { align: 'right' });
        tempY += 5;
        doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      }

      // Grand Total line
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('Total Payable:', summaryLabelX, tempY + 2);
      doc.text(`${symbol} ${inv.total.toFixed(2)}`, summaryValueX, tempY + 2, { align: 'right' });
      tempY += 7;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Amount Paid:', summaryLabelX, tempY);
      doc.text(`${symbol} ${amtPaid.toFixed(2)}`, summaryValueX, tempY, { align: 'right' });
      tempY += 5;

      doc.setFont('Helvetica', 'bold');
      if (inv.status === 'paid') {
        doc.setTextColor(16, 185, 129); // Green
      } else {
        doc.setTextColor(220, 38, 38); // Red
      }
      doc.text('Balance Due:', summaryLabelX, tempY);
      doc.text(`${symbol} ${balDue.toFixed(2)}`, summaryValueX, tempY, { align: 'right' });
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);

      // Notes / Terms on the Left (aligned to starting Y of the summary with 115mm width limit to ensure zero layout overlap)
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Notes / Terms:', 15, startSummaryY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      const remarks = inv.notes || user.invoiceNotes || 'Thank you for your business!';
      const remarksLines = doc.splitTextToSize(remarks, 115);
      doc.text(remarksLines, 15, startSummaryY + 5);

      // Footer
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Page 1 of 1 | Invoice generated via secure ledger hub.`, 15, 285);
      doc.text(`Processed with the merchant registry console.`, 195, 285, { align: 'right' });

      doc.save(`Invoice_${inv.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Failed to export invoice PDF format:', err);
    }
  };

  const generateStatementPDF = (cust: Customer, timeline: any[]) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const symbol = user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$';
      const primaryColor = [79, 70, 229]; // Indigo 600
      const darkNeutral = [15, 23, 42];   // Slate 900
      const lightNeutral = [248, 250, 252]; // Slate 50
      const grayText = [100, 116, 139];   // Slate 500

      const drawDivider = (y: number) => {
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(15, y, 195, y);
      };

      // Top band branding strip
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 10, 'F');

      // Company Name header & Meta details
      let compName = (user.companyName || 'Apex Business Solutions').toUpperCase();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      let compWidth = doc.getTextWidth(compName);
      if (compWidth > 105) {
        doc.setFontSize(14);
        compWidth = doc.getTextWidth(compName);
        if (compWidth > 105) {
          const splitComp = doc.splitTextToSize(compName, 105);
          compName = splitComp[0] + '...';
        }
      }
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(compName, 15, 25);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      
      const rawAddress = user.address || 'Administrative Headquarters Registered Address';
      const addressLines = doc.splitTextToSize(rawAddress, 110);
      doc.text(addressLines[0] + (addressLines.length > 1 ? '...' : ''), 15, 31);
      
      const rawContact = `Phone: ${user.phone || '-'} | Email: ${user.email || '-'}`;
      const contactLines = doc.splitTextToSize(rawContact, 110);
      doc.text(contactLines[0] + (contactLines.length > 1 ? '...' : ''), 15, 36);

      if (user.taxNumber) {
        doc.setFont('Helvetica', 'bold');
        doc.text(`TRN / Tax Ref ID: ${user.taxNumber}`, 15, 41);
      }

      // Statement Header Info Right Column
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      doc.text('CUSTOMER LEDGER STATEMENT', 195, 25, { align: 'right' });

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text(`Run Date: ${new Date().toISOString().split('T')[0]}`, 195, 31, { align: 'right' });
      doc.text(`Account Code: ${cust.id}`, 195, 36, { align: 'right' });

      drawDivider(48);

      // Billed To Column
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('STATEMENT ISSUED FOR (CLIENT)', 15, 56);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      const custNameLines = doc.splitTextToSize(cust.name, 100);
      doc.text(custNameLines[0] + (custNameLines.length > 1 ? '...' : ''), 15, 62);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      let yOffset = 67;
      if (cust.phone) {
        const phoneLines = doc.splitTextToSize(`Phone: ${cust.phone}`, 100);
        doc.text(phoneLines[0] + (phoneLines.length > 1 ? '...' : ''), 15, yOffset);
        yOffset += 5;
      }
      if (cust.email) {
        const emailLines = doc.splitTextToSize(`Email: ${cust.email}`, 100);
        doc.text(emailLines[0] + (emailLines.length > 1 ? '...' : ''), 15, yOffset);
        yOffset += 5;
      }
      if (cust.address) {
        const addrLines = doc.splitTextToSize(`Address: ${cust.address}`, 100);
        doc.text(addrLines, 15, yOffset);
        yOffset += addrLines.length * 4.5;
      }

      // Outstanding Box on the Right Section
      doc.setFillColor(lightNeutral[0], lightNeutral[1], lightNeutral[2]);
      doc.rect(125, 52, 70, 24, 'F');
      
      const totalDebits = timeline.reduce((sum, item) => sum + item.debit, 0);
      const totalCredits = timeline.reduce((sum, item) => sum + item.credit, 0);
      const finalBal = totalDebits - totalCredits;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('NET RECONCILED OUTSTANDING', 129, 58);
      
      doc.setFontSize(14);
      if (finalBal > 0) {
        doc.setTextColor(190, 24, 74); // Rose-700 Red
      } else {
        doc.setTextColor(5, 150, 105); // Emerald-600 Green
      }
      doc.text(`${symbol}${finalBal.toFixed(2)}`, 129, 66);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(grayText[0], grayText[1], grayText[2]);
      doc.text('Net Balance Receivable / Due', 129, 71);

      // Stats Summary Box bar - Dynamically compute positions to avoid overlap or border overflow
      let currentY = 88;
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY, 180, 12, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      
      doc.text('Total Purchases (Debits):', 18, currentY + 7.5);
      const label1Width = doc.getTextWidth('Total Purchases (Debits):');
      doc.setFont('Helvetica', 'normal');
      doc.text(`${symbol}${totalDebits.toFixed(2)}`, 18 + label1Width + 3, currentY + 7.5);

      doc.setFont('Helvetica', 'bold');
      doc.text('Total Payments Received (Credits):', 105, currentY + 7.5);
      const label2Width = doc.getTextWidth('Total Payments Received (Credits):');
      doc.setFont('Helvetica', 'normal');
      doc.text(`${symbol}${totalCredits.toFixed(2)}`, 105 + label2Width + 3, currentY + 7.5);

      currentY += 18;

      // Table draw setup
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(15, currentY, 180, 8, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('Date', 18, currentY + 5.5);
      doc.text('Transaction / Voucher Details', 42, currentY + 5.5);
      doc.text('Debit (+)', 115, currentY + 5.5, { align: 'right' });
      doc.text('Credit (-)', 150, currentY + 5.5, { align: 'right' });
      doc.text('Balance Due', 192, currentY + 5.5, { align: 'right' });

      currentY += 8;

      // Draw chronological ledger rows
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
      
      timeline.forEach((item, index) => {
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(15, currentY, 180, 8, 'F');
        }
        
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
        doc.text(item.date, 18, currentY + 5.5);

        // Safely split / wrap/ truncate description inside 65mm column width to prevent column overlapping
        const rDescLines = doc.splitTextToSize(item.description, 65);
        let displayDesc = rDescLines[0];
        if (rDescLines.length > 1) {
          displayDesc = displayDesc.substring(0, Math.max(5, displayDesc.length - 3)) + '...';
        }
        doc.text(displayDesc, 42, currentY + 5.5);

        // Debit
        if (item.debit > 0) {
          doc.setFont('Helvetica', 'bold');
          doc.text(`+${symbol}${item.debit.toFixed(2)}`, 115, currentY + 5.5, { align: 'right' });
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.text('-', 115, currentY + 5.5, { align: 'right' });
        }

        // Credit
        if (item.credit > 0) {
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(16, 185, 129); // Green text
          doc.text(`-${symbol}${item.credit.toFixed(2)}`, 150, currentY + 5.5, { align: 'right' });
          doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.text('-', 150, currentY + 5.5, { align: 'right' });
        }

        // Running balance
        doc.setFont('Helvetica', 'bold');
        doc.text(`${symbol}${item.runningBalance.toFixed(2)}`, 192, currentY + 5.5, { align: 'right' });

        currentY += 8;

        // Check page overflow
        if (currentY > 265) {
          doc.addPage();
          currentY = 20;
          
          doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.rect(15, currentY, 180, 8, 'F');
          
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(255, 255, 255);
          doc.text('Date', 18, currentY + 5.5);
          doc.text('Transaction / Voucher Details', 42, currentY + 5.5);
          doc.text('Debit (+)', 115, currentY + 5.5, { align: 'right' });
          doc.text('Credit (-)', 150, currentY + 5.5, { align: 'right' });
          doc.text('Balance Due', 192, currentY + 5.5, { align: 'right' });
          currentY += 8;
        }
      });

      // SECTION: PRODUCT-WISE STOCK RETURNED DETAILS SUMMARY
      const returnRecords = timeline.filter(t => t.type === 'stock_return');
      if (returnRecords.length > 0) {
        currentY += 10;
        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text('ITEMIZED STOCK RETURNS LOG (RETURNS SUMMARY & VALUES)', 15, currentY);
        currentY += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, currentY, 195, currentY);
        currentY += 4;

        // Aggregate product returns to show product-wise and amount-wise list
        const productReturnedMap: Record<string, { productName: string, totalQty: number, avgPrice: number, totalAmount: number }> = {};
        
        returnRecords.forEach(r => {
          const rawReturn = r.rawObject as CustomerReturn;
          rawReturn.items.forEach(item => {
            const key = item.productId || item.productName;
            if (productReturnedMap[key]) {
              productReturnedMap[key].totalQty += item.quantity;
              productReturnedMap[key].totalAmount += item.total;
              productReturnedMap[key].avgPrice = productReturnedMap[key].totalAmount / productReturnedMap[key].totalQty;
            } else {
              productReturnedMap[key] = {
                productName: item.productName,
                totalQty: item.quantity,
                avgPrice: item.price,
                totalAmount: item.total
              };
            }
          });
        });

        // Draw header
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY, 180, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(darkNeutral[0], darkNeutral[1], darkNeutral[2]);
        doc.text('Returned Product Description', 18, currentY + 4.5);
        doc.text('Quantity Returned', 115, currentY + 4.5, { align: 'right' });
        doc.text('Refund Rate', 150, currentY + 4.5, { align: 'right' });
        doc.text('Refund Amount Credited', 192, currentY + 4.5, { align: 'right' });
        currentY += 7;

        // Rows
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        Object.values(productReturnedMap).forEach((p, idx) => {
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(15, currentY, 180, 6, 'F');
          }
          // Safely wrap/split long returned product descriptions to 85mm to avoid overlap
          const pNameLines = doc.splitTextToSize(p.productName, 85);
          let displayPName = pNameLines[0];
          if (pNameLines.length > 1) {
            displayPName = displayPName.substring(0, Math.max(5, displayPName.length - 3)) + '...';
          }
          doc.text(displayPName, 18, currentY + 4.5);
          doc.text(p.totalQty.toString(), 115, currentY + 4.5, { align: 'right' });
          doc.text(`${symbol}${p.avgPrice.toFixed(2)}`, 150, currentY + 4.5, { align: 'right' });
          doc.setFont('Helvetica', 'bold');
          doc.text(`${symbol}${p.totalAmount.toFixed(2)}`, 192, currentY + 4.5, { align: 'right' });
          doc.setFont('Helvetica', 'normal');
          currentY += 6;
        });

        drawDivider(currentY + 2);
      }

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text(`Official accounts ledger statement file. Compiled programmatically.`, 15, 285);
      doc.text(`Page 1 of 1 | ${user.companyName}`, 195, 285, { align: 'right' });

      doc.save(`Statement_${cust.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to export statement PDF:', err);
    }
  };

  const shareOnWhatsApp = (inv: Invoice, cust: Customer) => {
    const statusStr = inv.status === 'paid' ? 'PAID' : 'UNPAID';
    const amtPaid = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
    const balDue = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);
    const company = user.companyName || 'Our Business';
    
    // Auto deduce default prefix code
    const defaultCode = getDefaultPhoneCode(user.currency);
    const cleanedNum = cleanPhoneForWhatsApp(cust.phone || '', defaultCode);
    
    // Construct the secure client registration and lookup email linkage link:
    const portalUrl = `${window.location.origin}?customerEmail=${encodeURIComponent(cust.email || '')}&customerPhone=${encodeURIComponent(cust.phone || '')}&invoiceId=${inv.id}`;

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

  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Reminders and message controls states
  const [viewTab, setViewTab] = useState<'directory' | 'dues'>('directory');
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [defaultTemplate, setDefaultTemplate] = useState<string>(() => {
    const saved = localStorage.getItem(`reminderTemplate_${user.id}`);
    if (saved) return saved;
    return `Hello *{customer_name}*!\n\nHere is a friendly reminder regarding your outstanding account balance with *{company_name}*:\n\n*Outstanding Balance:* {outstanding_balance}\n*Pending Invoices:* {invoices_list}\n\nPlease click on the secure link below to view your real-time statement, invoice history, and pay online inside your portal:\n{portal_link}\n\nThank you for your valued business!\n*{company_name}*`;
  });
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [customDraftText, setCustomDraftText] = useState('');

  // Live outstanding customer dues calculations
  const allInvoices = getInvoices(user.id);
  const unpaidInvoicesAll = allInvoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue' || (inv.balanceDue !== undefined && inv.balanceDue > 0));

  const customersWithDues = customers.map(cust => {
    const custInvoices = unpaidInvoicesAll.filter(inv => inv.customerId === cust.id);
    const totalDues = custInvoices.reduce((sum, inv) => {
      const dueVal = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);
      return sum + dueVal;
    }, 0);
    return {
      customer: cust,
      invoices: custInvoices,
      totalDues
    };
  }).filter(item => item.totalDues > 0);

  const resolveTemplateText = (templateStr: string, item: { customer: Customer; totalDues: number; invoices: Invoice[] }) => {
    const symbol = user.currency === 'USD' ? '$' : user.currency === 'AED' ? 'AED ' : user.currency === 'PKR' ? 'Rs ' : user.currency === 'SAR' ? 'SAR ' : user.currency === 'EUR' ? '€' : '';
    const totalVal = `${symbol}${item.totalDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    const invoicesStr = item.invoices.map(inv => inv.invoiceNumber).join(', ');
    const magicClientLink = `${window.location.origin}/?customerEmail=${encodeURIComponent(item.customer.email || '')}&customerPhone=${encodeURIComponent(item.customer.phone || '')}`;
    
    return templateStr
      .replaceAll('{customer_name}', item.customer.name)
      .replaceAll('{outstanding_balance}', totalVal)
      .replaceAll('{invoices_list}', invoicesStr || 'N/A')
      .replaceAll('{portal_link}', magicClientLink)
      .replaceAll('{company_name}', user.companyName || 'Our Business');
  };

  // States to block / unblock customers and generate magic portal links
  const [selectedAccessCust, setSelectedAccessCust] = useState<Customer | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Profile View States
  const [selectedProfileCustomerId, setSelectedProfileCustomerId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'details' | 'all' | 'paid' | 'unpaid' | 'bank' | 'statement'>('details');
  const [profileSearchTerm, setProfileSearchTerm] = useState('');
  const [quickInvoiceView, setQuickInvoiceView] = useState<Invoice | null>(null);
  const [copiedInvoiceLink, setCopiedInvoiceLink] = useState(false);

  // Payments & Returns Input Form States
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'bank' | 'other'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [showAddReturnModal, setShowAddReturnModal] = useState(false);
  const [returnProductId, setReturnProductId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnPrice, setReturnPrice] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleRefresh = () => {
    const list = getCustomers(user.id);
    setCustomers(list);
    onRefreshStats();
  };

  useEffect(() => {
    window.addEventListener('db-update', handleRefresh);
    return () => {
      window.removeEventListener('db-update', handleRefresh);
    };
  }, []);

  const handleCreateOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (editingItem) {
      editCustomer(user.id, {
        ...editingItem,
        name,
        email,
        phone,
        address,
      });
      setEditingItem(null);
    } else {
      addCustomer(user.id, {
        name,
        email,
        phone,
        address,
        isBlocked: false,
      });
    }

    // Reset Fields
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setShowAddModal(false);
    handleRefresh();
  };

  const handleStartEdit = (item: Customer) => {
    setEditingItem(item);
    setName(item.name);
    setEmail(item.email);
    setPhone(item.phone);
    setAddress(item.address);
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  // Toggle dynamic customer blocking status
  const handleToggleBlock = (cust: Customer) => {
    const nextBlocked = toggleCustomerBlock(user.id, cust.id);
    // Refresh modal focus too
    setSelectedAccessCust({ ...cust, isBlocked: nextBlocked });
    handleRefresh();
  };

  // Magic Clipboard Link Copy
  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const filteredCustomers = customers.filter(c => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    if (!cleanSearch) return true;

    const nameMatch = c.name.toLowerCase().includes(cleanSearch);
    const emailMatch = c.email.toLowerCase().includes(cleanSearch);
    
    // Normal phone substring match
    const phoneSubMatch = c.phone.replace(/\D/g, '').includes(cleanSearch.replace(/\D/g, ''));

    // Advanced match for ending 5 digits:
    // Strip all non-digits from both search term and phone number, and see if customer's phone ends with those digits
    const searchDigits = cleanSearch.replace(/\D/g, '');
    const phoneDigits = c.phone.replace(/\D/g, '');
    
    let endingDigitsMatch = false;
    if (searchDigits.length >= 5) {
      endingDigitsMatch = phoneDigits.endsWith(searchDigits);
    }

    return nameMatch || emailMatch || phoneSubMatch || endingDigitsMatch;
  });

  const isRtl = user.language === 'ar' || user.language === 'ur';

  // -------------------------------------------------------------
  // CUSTOMER PROFILE STUDIO & PURCHASE OVERVIEW ENVIRONMENT
  // -------------------------------------------------------------
  if (selectedProfileCustomerId) {
    const profileCust = customers.find(c => c.id === selectedProfileCustomerId);

    // Guard against deletion or missing referential points
    if (!profileCust) {
      setSelectedProfileCustomerId(null);
      return null;
    }

    // Pull Real Transactions for this client
    const rawInvoices = getInvoices(user.id);
    const profileInvoices = rawInvoices
      .filter(inv => inv.customerId === selectedProfileCustomerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Latest first

    // Calculate aggregated metrics
    const totalInvoicedSum = profileInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidInvoices = profileInvoices.filter(inv => inv.status === 'paid' || (inv.amountPaid !== undefined && inv.amountPaid > 0));
    const totalPaidSum = profileInvoices.reduce((sum, inv) => {
      const paidVal = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
      return sum + paidVal;
    }, 0);
    
    const unpaidInvoices = profileInvoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue' || (inv.balanceDue !== undefined && inv.balanceDue > 0));
    const totalUnpaidSum = profileInvoices.reduce((sum, inv) => {
      const dueVal = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total);
      return sum + dueVal;
    }, 0);

    const bankCardInvoices = profileInvoices.filter(inv => inv.paymentMethod === 'bank' || inv.paymentMethod === 'card');
    const cashInvoices = profileInvoices.filter(inv => inv.paymentMethod === 'cash');

    const totalBankSum = bankCardInvoices.reduce((sum, inv) => {
      const paidVal = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
      return sum + paidVal;
    }, 0);

    // Fetch payments and returns recorded for this specific customer
    const ledgerPayments = getCustomerPayments(user.id, selectedProfileCustomerId);
    const ledgerReturns = getCustomerReturns(user.id, selectedProfileCustomerId);
    const productsList = getProducts(user.id);

    // Merge everything into a chronological ledger line representation
    const ledgerTimeline: Array<{
      id: string;
      date: string;
      type: 'invoice' | 'invoice_payment' | 'direct_payment' | 'stock_return';
      description: string;
      debit: number;
      credit: number;
      referenceId: string;
      rawObject: any;
    }> = [];

    // Add Sales Invoices as debit entries (customer owes this money)
    profileInvoices.forEach(inv => {
      ledgerTimeline.push({
        id: `inv-${inv.id}`,
        date: inv.date,
        type: 'invoice',
        description: `${user.language === 'ur' ? 'مالیاتی انوائس' : 'Sales Invoice'} ${inv.invoiceNumber}`,
        debit: inv.total,
        credit: 0,
        referenceId: inv.id,
        rawObject: inv
      });

      // Add Invoice Payments as credit entries (payment received)
      const amtPaid = inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0);
      if (amtPaid > 0) {
        ledgerTimeline.push({
          id: `inv-pay-${inv.id}`,
          date: inv.date,
          type: 'invoice_payment',
          description: `${user.language === 'ur' ? 'انوائس کی چکوتی ادائیگی' : 'Payment for Invoice'} ${inv.invoiceNumber}`,
          debit: 0,
          credit: amtPaid,
          referenceId: inv.id,
          rawObject: inv
        });
      }
    });

    // Add Direct Payments as credit entries (direct customer payments)
    ledgerPayments.forEach(pay => {
      ledgerTimeline.push({
        id: `pay-${pay.id}`,
        date: pay.date,
        type: 'direct_payment',
        description: `${user.language === 'ur' ? 'براہ راست ادائیگی وصولی' : 'Receipt - Payment Received'} (${pay.paymentMethod.toUpperCase()})${pay.referenceNote ? ': ' + pay.referenceNote : ''}`,
        debit: 0,
        credit: pay.amount,
        referenceId: pay.id,
        rawObject: pay
      });
    });

    // Add Customer Stock Returns as credit entries (returned stock adds money credit to customer)
    ledgerReturns.forEach(ret => {
      const productSummaryStr = ret.items.map(item => `${item.quantity}x ${item.productName}`).join(', ');
      ledgerTimeline.push({
        id: `ret-${ret.id}`,
        date: ret.date,
        type: 'stock_return',
        description: `${user.language === 'ur' ? 'مصنوعات کی واپسی کریڈٹ' : 'Stock Return credit'} - [${productSummaryStr}]${ret.notes ? ': ' + ret.notes : ''}`,
        debit: 0,
        credit: ret.totalAmount,
        referenceId: ret.id,
        rawObject: ret
      });
    });

    // Sort by Date (oldest first to ensure correct cumulative running balance computation)
    ledgerTimeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute Running Balances
    let runningBalanceAccumulator = 0;
    const ledgerWithBalances = ledgerTimeline.map(line => {
      runningBalanceAccumulator = runningBalanceAccumulator + line.debit - line.credit;
      return {
        ...line,
        runningBalance: runningBalanceAccumulator
      };
    });

    // Reverse for displaying newest-first in the UI history table
    const reversedLedger = [...ledgerWithBalances].reverse();

    const totalStatementDebits = ledgerWithBalances.reduce((sum, item) => sum + item.debit, 0);
    const totalStatementCredits = ledgerWithBalances.reduce((sum, item) => sum + item.credit, 0);
    const netStatementBalance = totalStatementDebits - totalStatementCredits;

    // Filter invoices matching target in customer purchases view
    const matchSelectedInvoices = () => {
      let filtered = [...profileInvoices];
      
      // Filter by tab
      if (profileTab === 'paid') {
        filtered = paidInvoices;
      } else if (profileTab === 'unpaid') {
        filtered = unpaidInvoices;
      } else if (profileTab === 'bank') {
        filtered = bankCardInvoices;
      }

      // Filter by internal search bar on the profile page
      if (profileSearchTerm.trim() !== '') {
        const query = profileSearchTerm.toLowerCase();
        filtered = filtered.filter(inv => 
          inv.invoiceNumber.toLowerCase().includes(query) ||
          inv.items.some(item => item.productName.toLowerCase().includes(query)) ||
          inv.notes.toLowerCase().includes(query)
        );
      }
      return filtered;
    };

    const currentTabInvoices = matchSelectedInvoices();

    // Suggest other clients for swift context switching on search typing
    const otherSearchValue = profileSearchTerm.trim().toLowerCase();
    const otherProfileSuggestions = otherSearchValue === ''
      ? []
      : customers.filter(c => {
          if (c.id === selectedProfileCustomerId) return false;
          const nameMatch = c.name.toLowerCase().includes(otherSearchValue);
          const emailMatch = c.email && c.email.toLowerCase().includes(otherSearchValue);
          const phoneMatch = c.phone && c.phone.replace(/\D/g, '').includes(otherSearchValue.replace(/\D/g, ''));
          return nameMatch || emailMatch || phoneMatch;
        });

    // Use elevated currencySymbol value
    // Bilingual vocabulary specific to the invoice viewer
    const voc = {
      title: { en: 'CUSTOMER FINANCIAL PROFILE', ar: 'الملف المالي المتكامل للعميل', ur: 'گاہک کی مالیاتی پروفائل', hi: 'ग्राहक वित्तीय विवरण' },
      searchPlaceholder: { en: 'Search & switch to another customer profile by name, email or phone...', ar: 'ابحث وانتقل إلى عميل آخر بالاسم أو الرقم أو البريد...', ur: 'نام، ای میل یا فون سے دوسرے گاہک کی پروفائل تلاش کریں...', hi: 'नाम, ईमेल या फोन नंबर से दूसरे ग्राहक की प्रोफाइल खोजें...' },
      backToDirectory: { en: 'Back to Customer Directory', ar: 'العودة إلى دليل العملاء', ur: 'ڈائریکٹری پر واپس جائیں', hi: 'ग्राहक सूची पर वापस' },
      editProfile: { en: 'Edit Base Profile', ar: 'تعديل الملف الأساسي', ur: 'پروفائل تبدیل کریں', hi: 'प्रोफ़ाइल संपादित करें' },
      ledgerCard: { en: 'Billing & Ledger Stats', ar: 'مؤشرات الفوترة والمستحقات', ur: 'بلنگ اور لیجر ریکارڈ', hi: 'बिलिंग एवं खाता आँकड़े' },
      totalInvoiced: { en: 'Total Invoiced', ar: 'إجمالي المفوتر', ur: 'کل انوائس کردہ رقم', hi: 'कुल चालान राशि' },
      totalPaid: { en: 'Total Paid Collection', ar: 'المبالغ المحصلة', ur: 'کل جمع شدہ ادائیگی', hi: 'कुल प्राप्त भुगतान' },
      totalUnpaid: { en: 'Outstanding Balance', ar: 'الرصيد المتبقي المستحق', ur: 'بقایا واجب الادا رقم', hi: 'शेष बकाया राशि' },
      bankPaid: { en: 'Bank Settlements', ar: 'تحصيلات البنك والبطاقات', ur: 'بینک اور کارڈ ادائیگی', hi: 'बैंक भुगतान विवरण' },
      accessControl: { en: 'Authorization Status', ar: 'صلاحيات الدخول والربط', ur: 'رسائی کا اختیار', hi: 'अनुमति स्थिति ($)' }
    };

    const getVocStr = (key: keyof typeof voc) => {
      const item = voc[key];
      return item[user.language] || item.en;
    };

    return (
      <div className="space-y-6 font-sans text-xs text-slate-300">
        
        {/* TOP PROFILE HEADER CONTROLS (Back button + Customer Search bar to jump profiles) */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-slate-900/60 p-4 border border-indigo-500/10 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedProfileCustomerId(null);
                setProfileSearchTerm('');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-200 hover:text-white transition duration-150 cursor-pointer text-xs font-bold"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span>{getVocStr('backToDirectory')}</span>
            </button>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div className="hidden sm:block">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block font-mono">WORKSPACE PROFILE</span>
              <h2 className="text-sm font-black text-white truncate max-w-[200px]">{profileCust.name}</h2>
            </div>
          </div>

          {/* DYNAMIC SEARCH SWITCH BAR FOR JUMPING TO OTHER CUSTOMERS */}
          <div className="relative flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-indigo-400" />
              <input
                type="text"
                placeholder={getVocStr('searchPlaceholder')}
                value={profileSearchTerm}
                onChange={(e) => setProfileSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-indigo-900/40 focus:border-indigo-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition focus:ring-1 focus:ring-indigo-500/25"
              />
              {profileSearchTerm && (
                <button
                  onClick={() => setProfileSearchTerm('')}
                  className="absolute right-3.5 top-3 text-[10px] text-slate-500 hover:text-white font-extrabold hover:underline"
                >
                  CLEAR
                </button>
              )}
            </div>

            {/* LIVE AUTOCOMPLETE DROP-DOWN SEARCH LIST FOR OTHER CLIENTS */}
            <AnimatePresence>
              {otherProfileSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute left-0 right-0 mt-2 bg-slate-950/95 border border-indigo-500/20 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-900/80 backdrop-blur-md"
                >
                  <div className="px-3 py-1.5 bg-indigo-950/40 text-[9px] text-indigo-300 font-bold uppercase tracking-wider block">
                    Switch profile context to target: ({otherProfileSuggestions.length} found)
                  </div>
                  {otherProfileSuggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedProfileCustomerId(s.id);
                        setProfileSearchTerm('');
                        setProfileTab('details');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-600/10 flex items-center justify-between transition group-hover:border-slate-700 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                          {s.name.substring(0,2)}
                        </div>
                        <div>
                          <p className="font-extrabold text-white text-xs group-hover:text-indigo-400">{s.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">{s.phone || s.email || 'No reference lines'}</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-indigo-400 flex items-center gap-1 font-bold">
                        OPEN PROFILE ➔
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* MAIN PROFILE BENTO WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
          
          {/* LEFT COLUMN: STATIC BIO CARD & PORTAL CONTROLS (4 Cols) */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* 1. PRIMARY IDENTITY CARD */}
            <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl shadow-xl text-center relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500" />
              
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 text-indigo-400 font-extrabold text-xl flex items-center justify-center select-none shadow-md mt-2">
                {profileCust.name.substring(0,2).toUpperCase()}
              </div>

              <h3 className="text-base font-black text-white mt-4">{profileCust.name}</h3>
              <p className="text-[10px] text-indigo-400 font-mono mt-0.5 tracking-wider uppercase">CLIENT ID: {profileCust.id}</p>
              
              <div className="mt-5 space-y-2 text-left bg-slate-950/50 p-3.5 rounded-xl border border-slate-900 text-xs">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">EMAIL ADDRESS</span>
                    {profileCust.email ? (
                      <a href={`mailto:${profileCust.email}`} className="text-slate-200 font-semibold hover:text-indigo-400 underline decoration-dotted truncate block max-w-[220px]">
                        {profileCust.email}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">No email defined</span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-slate-900/60 my-2" />

                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">MOBILE PHONE</span>
                    {profileCust.phone ? (
                      <a href={`tel:${profileCust.phone}`} className="text-slate-200 font-mono font-semibold hover:text-indigo-400 block">
                        {profileCust.phone}
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">No phone logged</span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-slate-900/60 my-2" />

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">STREET ADDRESS</span>
                    {profileCust.address ? (
                      <span className="text-slate-400 line-clamp-3 block leading-relaxed">{profileCust.address}</span>
                    ) : (
                      <span className="text-slate-500 italic">No address provided</span>
                    )}
                  </div>
                </div>

                <div className="h-px bg-slate-900/60 my-2" />

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">REGISTRATION DATE</span>
                    <span className="text-slate-400 font-semibold">{profileCust.createdAt ? profileCust.createdAt.split('T')[0] : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleStartEdit(profileCust)}
                  className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {getVocStr('editProfile')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(profileCust.id)}
                  className="px-3 bg-rose-950/45 hover:bg-rose-600 hover:text-white border border-rose-900/30 text-rose-400 rounded-xl transition cursor-pointer"
                  title="Delete Customer Profile Record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. DIRECT PORTAL ACCESS MANAGEMENT */}
            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">PORTAL ACCESS</h4>
                
                {profileCust.isApproved === false ? (
                  <span className="px-1.5 py-0.5 bg-amber-950 text-[7.5px] text-amber-400 font-black border border-amber-800/40 rounded animate-pulse">
                    PENDING
                  </span>
                ) : profileCust.isBlocked ? (
                  <span className="px-1.5 py-0.5 bg-rose-950 text-[7.5px] text-rose-400 font-black border border-rose-800/40 rounded">
                    SUSPENDED
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-emerald-950 text-[7.5px] text-emerald-400 font-black border border-emerald-800/40 rounded">
                    ACTIVE
                  </span>
                )}
              </div>

              {profileCust.isApproved === false ? (
                <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl space-y-2">
                  <p className="text-[10px] text-amber-300">This account was registered online and is awaiting administrative approval before gaining access.</p>
                  <button
                    onClick={() => {
                      toggleCustomerApproval(user.id, profileCust.id);
                      handleRefresh();
                    }}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition text-[10px] tracking-wide uppercase cursor-pointer"
                  >
                    Approve Client Portal Account
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-2.5 bg-slate-950/70 border border-slate-900 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[10px] text-slate-400 uppercase block">AUTHORIZED LOGIN STATE</span>
                      <span className="text-[9px] text-slate-500">Toggle customer global block status</span>
                    </div>
                    
                    <button
                      onClick={() => {
                        const nextState = toggleCustomerBlock(user.id, profileCust.id);
                        handleRefresh();
                      }}
                      className={`px-3 py-1 text-[10px] uppercase font-bold tracking-wide rounded-lg border transition ${
                        profileCust.isBlocked
                          ? 'bg-emerald-600 border-transparent text-white'
                          : 'bg-rose-950/80 border-rose-850 text-rose-400 hover:bg-rose-900'
                      }`}
                    >
                      {profileCust.isBlocked ? '✓ Unblock' : '🚫 Block Access'}
                    </button>
                  </div>

                  {/* Magic portals link */}
                  {!profileCust.isBlocked && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-widest block">MAGIC STATEMENTS PORTAL LINKS</span>
                      
                      {profileCust.email && (
                        <button
                          onClick={() => {
                            const url = window.location.origin + "?customerEmail=" + encodeURIComponent(profileCust.email);
                            navigator.clipboard.writeText(url);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="w-full text-left p-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 rounded-xl flex items-center justify-between transition text-[10px]"
                        >
                          <span className="truncate pr-2 font-mono text-slate-500">Copy magic loop link for EMAIL login</span>
                          <span className="shrink-0 text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-0.5">
                            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedLink ? 'Copied' : 'COPY'}
                          </span>
                        </button>
                      )}

                      {profileCust.phone && (
                        <button
                          onClick={() => {
                            const url = window.location.origin + "?customerPhone=" + encodeURIComponent(profileCust.phone);
                            navigator.clipboard.writeText(url);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="w-full text-left p-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 rounded-xl flex items-center justify-between transition text-[10px]"
                        >
                          <span className="truncate pr-2 font-mono text-slate-500">Copy magic link for PHONE login</span>
                          <span className="shrink-0 text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-0.5">
                            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedLink ? 'Copied' : 'COPY'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: FINANCIAL STUDIO & TRANSACTIONS REGISTER (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* FINANCIAL OVERVIEW GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Grand Total invoiced */}
              <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1">
                  <Receipt className="w-8 h-8 text-indigo-500/10" />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block">{getVocStr('totalInvoiced')}</span>
                <p className="text-lg font-black text-white mt-2 font-mono">{currencySymbol}{totalInvoicedSum.toFixed(2)}</p>
                <span className="text-[9.5px] text-slate-500 block mt-1">From {profileInvoices.length} billing instances</span>
              </div>

              {/* Total Collect Cleaned */}
              <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1">
                  <CheckCircle className="w-8 h-8 text-emerald-500/10" />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block">{getVocStr('totalPaid')}</span>
                <p className="text-lg font-black text-emerald-400 mt-2 font-mono">{currencySymbol}{totalPaidSum.toFixed(2)}</p>
                <span className="text-[9.5px] text-slate-500 block mt-1">Paid off / cleared</span>
              </div>

              {/* Unpaid Outstanding Balance */}
              <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1">
                  <Clock className="w-8 h-8 text-amber-500/10 animate-pulse" />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block">{getVocStr('totalUnpaid')}</span>
                <p className="text-lg font-black text-rose-400 mt-2 font-mono">{currencySymbol}{totalUnpaidSum.toFixed(2)}</p>
                <span className="text-[9.5px] text-slate-500 block mt-1">Unbilled / balance due</span>
              </div>

              {/* Bank share */}
              <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-2xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1">
                  <CreditCard className="w-8 h-8 text-cyan-500/10" />
                </div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block">{getVocStr('bankPaid')}</span>
                <p className="text-lg font-black text-cyan-400 mt-2 font-mono">{currencySymbol}{totalBankSum.toFixed(2)}</p>
                <span className="text-[9.5px] text-slate-500 block mt-1">{bankCardInvoices.length} bank-wired / card records</span>
              </div>
            </div>

            {/* TAB CONTROLS (Details, Paid, Unpaid, Bank) */}
            <div className="bg-slate-900/50 p-1 rounded-2xl border border-slate-850 flex flex-wrap gap-1 font-sans">
              
              <button
                onClick={() => setProfileTab('details')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 text-[11px] cursor-pointer ${
                  profileTab === 'details'
                    ? 'bg-gradient-to-r from-indigo-650 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850/60'
                }`}
              >
                <Contact className="w-3.5 h-3.5" />
                <span>Base Profile</span>
              </button>

              <button
                onClick={() => setProfileTab('all')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 text-[11px] cursor-pointer ${
                  profileTab === 'all'
                    ? 'bg-gradient-to-r from-indigo-650 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850/60'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>All Purchases ({profileInvoices.length})</span>
              </button>

              <button
                onClick={() => setProfileTab('paid')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 text-[11px] cursor-pointer ${
                  profileTab === 'paid'
                    ? 'bg-gradient-to-r from-indigo-650 to-indigo-600 text-white shadow-lg font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850/60'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-450" />
                <span>Paid Purchases ({paidInvoices.length})</span>
              </button>

              <button
                onClick={() => setProfileTab('unpaid')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 text-[11px] cursor-pointer ${
                  profileTab === 'unpaid'
                    ? 'bg-gradient-to-r from-indigo-650 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Unpaid / Pending ({unpaidInvoices.length})</span>
              </button>

              <button
                onClick={() => setProfileTab('bank')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 text-[11px] cursor-pointer ${
                  profileTab === 'bank'
                    ? 'bg-gradient-to-r from-indigo-650 to-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850/60'
                }`}
              >
                <Building className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bank & Card ({bankCardInvoices.length})</span>
              </button>

              <button
                onClick={() => setProfileTab('statement')}
                className={`flex-1 py-2.5 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1 text-[11px] cursor-pointer ${
                  profileTab === 'statement'
                    ? 'bg-gradient-to-r from-indigo-650 to-indigo-600 text-white shadow-lg'
                    : 'text-indigo-400 hover:text-white hover:bg-slate-850/60'
                }`}
              >
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                <span>{user.language === 'ur' ? 'کھاتہ اور واپسی' : 'Ledger & Returns'}</span>
              </button>
            </div>

            {/* TAB PANELS RENDERING */}
            <div className="bg-slate-900/30 border border-slate-850 rounded-2xl shadow-xl overflow-hidden min-h-[300px]">
              
              {profileTab === 'details' ? (
                // 1. RAW DETAILS VIEW (Essential phone and data fields)
                <div className="p-6 space-y-6">
                  <div>
                    <h4 className="text-sm font-black text-white mb-1">Customer Essential Data Profile</h4>
                    <p className="text-slate-400 text-xs">A comprehensive breakdown of this customer profile database record.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block font-mono">Customer Name Link</span>
                      <p className="text-sm font-bold text-white leading-tight">{profileCust.name}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block font-mono">Electronic Mail ID</span>
                      <p className="text-sm font-bold text-slate-200">{profileCust.email || "No email assigned to this account"}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block font-mono">Mobile Contact Number</span>
                      <p className="text-sm font-bold text-slate-200 font-mono">{profileCust.phone || "No designated contact number"}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block font-mono">Permanent Registered Address</span>
                      <p className="text-xs text-slate-350 leading-relaxed font-semibold">{profileCust.address || "No address logged for delivery or billing"}</p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block font-mono">Portal Login Credentials Status</span>
                      <p className={`text-xs font-bold font-mono ${profileCust.isBlocked ? 'text-red-400' : 'text-emerald-400'}`}>
                        {profileCust.isBlocked ? "Suspended / Login Suspended" : "Active / Verified Portal Linkable"}
                      </p>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 space-y-1">
                      <span className="text-[10px] text-slate-500 font-extrabold uppercase block font-mono">Cumulative Customer Statistics</span>
                      <p className="text-xs text-slate-300 font-semibold font-sans">
                        Generated Invoices: <strong className="text-white">{profileInvoices.length} orders</strong> • Paid in full: <strong className="text-emerald-400">{paidInvoices.length}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-950/20 border border-indigo-900/30 rounded-xl space-y-2">
                    <span className="font-extrabold text-white block text-xs">💡 Quick Client Note:</span>
                    <p className="text-slate-300 leading-relaxed">
                      This directory node controls all references to "{profileCust.name}" inside newly generated bills or invoices. Opening, editing, or deleting this customer record maintains full referential accounting integrity.
                    </p>
                  </div>
                </div>
              ) : profileTab === 'statement' ? (
                // 3. LEDGER ACCOUNT STATEMENT & PRODUCT RETURNS (Bilingual English & Urdu)
                <div className="p-6 space-y-6">
                  
                  {/* Ledger Stat Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Reconciled Balance Card */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block font-mono">Net Balance Receivable</span>
                        <span className={`text-xl font-extrabold font-mono ${netStatementBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}
                          {netStatementBalance.toFixed(2)}
                        </span>
                      </div>
                      <div className={`p-2.5 rounded-lg ${netStatementBalance > 0 ? 'bg-rose-950/40 text-rose-400' : 'bg-emerald-950/40 text-emerald-400'}`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Total Purchases -- Debits */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block font-mono">Total Debits (Purchases)</span>
                        <span className="text-xl font-extrabold font-mono text-indigo-400">
                          {user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}
                          {totalStatementDebits.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-indigo-950/40 text-indigo-400 rounded-lg">
                        <Receipt className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Total Reconciled Payments & Returns -- Credits */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block font-mono">Total Credits (Paid/Returned)</span>
                        <span className="text-xl font-extrabold font-mono text-emerald-400">
                          {user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}
                          {totalStatementCredits.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-2.5 bg-emerald-950/40 text-emerald-400 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Operational Controls Buttons Panel */}
                  <div className="flex flex-wrap gap-3 p-4 bg-slate-950/40 rounded-xl border border-slate-900 justify-between items-center sm:flex-row flex-col">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-300">Customer Ledger Operations</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowAddPaymentModal(true)}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{user.language === 'ur' ? 'ادائیگی جمع کریں' : 'Record Payment'}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (productsList.length > 0) {
                            setReturnProductId(productsList[0].id);
                            setReturnPrice(productsList[0].price.toString());
                          }
                          setReturnQuantity('1');
                          setShowAddReturnModal(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{user.language === 'ur' ? 'مال کی واپسی' : 'Record Return'}</span>
                      </button>

                      <button
                        onClick={() => generateStatementPDF(profileCust, ledgerWithBalances)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-indigo-400 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-indigo-900/30"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{user.language === 'ur' ? 'اسٹیٹمنٹ ڈاؤن لوڈ' : 'Download PDF Statement'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Detailed Chronological History Table */}
                  <div className="bg-slate-950 rounded-xl border border-slate-900 overflow-hidden">
                    <div className="p-4 border-b border-slate-900 flex justify-between items-center bg-slate-950/60">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                        {user.language === 'ur' ? 'تفصیلی رجسٹر کھاتہ' : 'Chronological Account Ledger'}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono font-bold">Total Entries: {reversedLedger.length}</span>
                    </div>

                    {reversedLedger.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-500 italic">
                        No transactions, payments, or returns recorded for this client.
                      </div>
                    ) : (
                      <div className="overflow-x-auto text-[11px]">
                        <table className="w-full text-left border-collapse font-sans">
                          <thead>
                            <tr className="bg-slate-910/20 border-b border-slate-900 text-slate-400 font-mono text-[10px] uppercase">
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Description / Reference Details</th>
                              <th className="py-3 px-4 text-right">Debit (+)</th>
                              <th className="py-3 px-4 text-right text-emerald-450">Credit (-)</th>
                              <th className="py-3 px-4 text-right">Running Balance</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 text-slate-350">
                            {reversedLedger.map((item) => (
                              <tr 
                                key={item.id} 
                                className={`font-sans transition-all ${(item.type === 'invoice' || item.type === 'invoice_payment') ? 'hover:bg-slate-900/60 cursor-pointer active:bg-slate-800/40' : 'hover:bg-slate-900/20'}`}
                                onClick={() => {
                                  if (item.type === 'invoice' || item.type === 'invoice_payment') {
                                    setQuickInvoiceView(item.rawObject as Invoice);
                                  }
                                }}
                              >
                                <td className="py-3 px-4 font-mono text-slate-400">{item.date}</td>
                                <td className="py-3 px-4 font-semibold text-slate-200">
                                  {(item.type === 'invoice' || item.type === 'invoice_payment') ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickInvoiceView(item.rawObject as Invoice);
                                      }}
                                      className="line-clamp-2 md:line-clamp-1 hover:text-indigo-400 text-indigo-300 font-extrabold flex items-center gap-1 cursor-pointer transition text-left [background:none] border-none p-0"
                                    >
                                      <span>{item.description}</span>
                                      <ExternalLink className="w-3 h-3 text-indigo-500 shrink-0 inline-block" />
                                    </button>
                                  ) : (
                                    <div className="line-clamp-2 md:line-clamp-1">{item.description}</div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                                  {item.debit > 0 ? `+${user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}${item.debit.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-450">
                                  {item.credit > 0 ? `-${user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}${item.credit.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-slate-300">
                                  {user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}{item.runningBalance.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-right flex justify-end gap-1.5 items-center">
                                  {/* Allow deleting custom recorded direct payments or returns */}
                                  {item.type === 'direct_payment' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteCustomerPayment(user.id, item.referenceId);
                                        handleRefresh();
                                      }}
                                      className="p-1 hover:bg-slate-800 text-rose-500 rounded-lg hover:text-rose-450 transition"
                                      title="Delete Payment"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {item.type === 'stock_return' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteCustomerReturn(user.id, item.referenceId);
                                        handleRefresh();
                                      }}
                                      className="p-1 hover:bg-slate-800 text-rose-500 rounded-lg hover:text-rose-450 transition"
                                      title="Delete Return (Restores Stock automatically)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {item.type === 'invoice' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickInvoiceView(item.rawObject as Invoice);
                                      }}
                                      className="px-2 py-0.5 bg-indigo-950/40 border border-indigo-900/30 hover:bg-indigo-900/45 text-indigo-400 font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition select-none"
                                    >
                                      <span>{user.language === 'ur' ? 'تفصیل' : 'Details'}</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                  {item.type === 'invoice_payment' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickInvoiceView(item.rawObject as Invoice);
                                      }}
                                      className="px-2 py-0.5 bg-indigo-950/40 border border-indigo-900/30 hover:bg-indigo-900/45 text-indigo-400 font-bold rounded-lg text-[10px] flex items-center gap-1 cursor-pointer transition select-none"
                                    >
                                      <span>{user.language === 'ur' ? 'انوائس' : 'Invoice'}</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Stock Returns Aggregation Product-wise & Amount-wise summary box list */}
                  <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                          {user.language === 'ur' ? 'واپس کردہ مال کا تفصیلی جائزہ (مصنوعات و مالیت کے لحاظ سے)' : 'Product-Wise Stock Returns Summary'}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Total returns logged by product quantities and refunded values.</p>
                      </div>
                      <div className="p-2 bg-amber-950/20 text-amber-500 rounded-lg">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                    </div>

                    {ledgerReturns.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 italic text-xs">
                        No product returns registered yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                        {/* Calculate dynamic list of aggregated returns */}
                        {(() => {
                          const aggregationMap: Record<string, { productName: string; totalQty: number; totalRefund: number; lastReturnDate: string }> = {};
                          ledgerReturns.forEach(ret => {
                            ret.items.forEach(it => {
                              const key = it.productId || it.productName;
                              if (aggregationMap[key]) {
                                aggregationMap[key].totalQty += it.quantity;
                                aggregationMap[key].totalRefund += it.total;
                                if (new Date(ret.date).getTime() > new Date(aggregationMap[key].lastReturnDate).getTime()) {
                                  aggregationMap[key].lastReturnDate = ret.date;
                                }
                              } else {
                                aggregationMap[key] = {
                                  productName: it.productName,
                                  totalQty: it.quantity,
                                  totalRefund: it.total,
                                  lastReturnDate: ret.date
                                };
                              }
                            });
                          });

                          return Object.values(aggregationMap).map((agg, idx) => (
                            <div key={idx} className="bg-slate-900/60 p-4 rounded-xl border border-slate-850/80 space-y-2 flex flex-col justify-between">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <span className="text-[10px] text-slate-500 font-extrabold uppercase font-mono tracking-wider">Product Name</span>
                                  <p className="text-xs font-black text-slate-200 mt-0.5">{agg.productName}</p>
                                </div>
                                <span className="px-2.5 py-1 bg-amber-950/40 text-amber-500 font-mono font-extrabold rounded-lg text-[10px] border border-amber-500/20 shrink-0">
                                  {agg.totalQty} Units Returned
                                </span>
                              </div>
                              <div className="flex justify-between items-end border-t border-slate-850/60 pt-2 text-[11px] font-semibold text-slate-400">
                                <span>Total Refund Credits:</span>
                                <span className="font-mono text-emerald-400 font-bold">
                                  {user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}
                                  {agg.totalRefund.toFixed(2)}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-500 text-right mt-1 font-mono">
                                Last returned: {agg.lastReturnDate}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // 2. TRANSACTIONS/INVOICES LEDGER SHEETS (All, Paid, Unpaid, Bank)
                <div>
                  
                  {/* SEARCH FILTER FOR BILLING ENTRIES */}
                  <div className="p-4 border-b border-slate-850/70 bg-slate-950/40 flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Filter transactions below by invoice # / notes / item name..."
                        value={profileSearchTerm}
                        onChange={(e) => setProfileSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-900 rounded-lg pl-9 pr-4 py-2 text-[11px] text-slate-200 outline-none focus:border-indigo-500/80"
                      />
                    </div>
                    {profileSearchTerm && (
                      <button
                        onClick={() => setProfileSearchTerm('')}
                        className="text-[10px] text-indigo-400 font-bold hover:underline shrink-0"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>

                  {/* INVOICE REGISTRY GRID/LIST */}
                  {currentTabInvoices.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 italic text-xs">
                      No matching purchases matching this tab criteria logged for this profile.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950/80 border-b border-slate-850 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                            <th className="py-3 px-4">Invoice #</th>
                            <th className="py-3 px-4">Issue Date</th>
                            <th className="py-3 px-4">Payment Method</th>
                            <th className="py-3 px-4 text-right">Total Bill</th>
                            <th className="py-3 px-4 text-right text-emerald-400 font-bold">Paid Collection</th>
                            <th className="py-3 px-4 text-right text-rose-400 font-bold">Due Balance</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/60 text-slate-350">
                          {currentTabInvoices.map((inv) => (
                            <tr 
                              key={inv.id} 
                              className="hover:bg-slate-850/20 active:bg-slate-800/20 transition-all font-sans text-xs cursor-pointer"
                              onClick={() => setQuickInvoiceView(inv)}
                            >
                               <td className="py-3 px-4 font-mono font-extrabold">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickInvoiceView(inv);
                                  }}
                                  className="hover:text-indigo-400 text-indigo-300 font-extrabold tracking-wide transition flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 text-left outline-none"
                                >
                                  <span>{inv.invoiceNumber}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-indigo-500 shrink-0 inline-block font-normal" />
                                </button>
                              </td>
                              
                              <td className="py-3 px-4 font-mono text-xs">
                                {inv.date}
                              </td>

                              <td className="py-3 px-4">
                                {inv.paymentMethod === 'bank' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 font-bold bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-900/40">
                                    🏛️ Bank Transfer
                                  </span>
                                ) : inv.paymentMethod === 'card' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-bold bg-sky-950/30 px-2 py-0.5 rounded border border-sky-900/40">
                                    💳 Credit Card
                                  </span>
                                ) : inv.paymentMethod === 'cash' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-bold bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/40">
                                    💵 Cash
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic text-[11px]">
                                    Other / Not set
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right font-mono text-white font-extrabold">
                                {currencySymbol}{inv.total.toFixed(2)}
                              </td>

                              <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">
                                {currencySymbol}{(inv.amountPaid !== undefined ? inv.amountPaid : (inv.status === 'paid' ? inv.total : 0)).toFixed(2)}
                              </td>

                              <td className="py-3 px-4 text-right font-mono text-rose-400 font-bold">
                                {currencySymbol}{(inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.total)).toFixed(2)}
                              </td>

                              <td className="py-3 px-4 text-center">
                                {inv.status === 'paid' ? (
                                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 text-[9px] font-black uppercase rounded border border-emerald-900/50">
                                    PAID
                                  </span>
                                ) : inv.status === 'overdue' ? (
                                  <span className="px-2 py-0.5 bg-rose-950 text-rose-400 text-[9px] font-black uppercase rounded border border-rose-900/50 animate-pulse">
                                    OVERDUE
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-950 text-amber-400 text-[9px] font-black uppercase rounded border border-amber-900/50">
                                    UNPAID
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuickInvoiceView(inv);
                                    }}
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-slate-950 hover:bg-slate-900 hover:text-white text-indigo-400 border border-slate-800 rounded-lg cursor-pointer transition flex items-center gap-1 hover:border-indigo-500/50"
                                    title="Open Details Panel"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>View</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      generateInvoicePDF(inv, profileCust!);
                                    }}
                                    className="p-1 px-2.5 bg-indigo-650/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/35 rounded-lg cursor-pointer transition flex items-center gap-1 text-[10px] font-bold"
                                    title="Download PDF Invoice"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>PDF</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      shareOnWhatsApp(inv, profileCust!);
                                    }}
                                    className="p-1 px-2.5 bg-emerald-650/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/35 rounded-lg cursor-pointer transition flex items-center gap-1 text-[10px] font-bold"
                                    title="Send Directly on WhatsApp"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            MODAL OVERLAY FOR MULTI-LINGUAL HIGH FIDELITY INVOICE PREVIEW
            ------------------------------------------------------------- */}
        <AnimatePresence>
          {quickInvoiceView && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
              <div 
                className="absolute inset-0 cursor-zoom-out" 
                onClick={() => setQuickInvoiceView(null)} 
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 15 }}
                className="bg-white border border-slate-300 rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative z-10 text-slate-800 font-sans my-8"
              >
                
                {/* Close Overlay & Print commands */}
                <div className="absolute top-4 right-4 flex items-center gap-2 no-print">
                  <button
                    onClick={() => generateInvoicePDF(quickInvoiceView, profileCust!)}
                    className="p-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] uppercase transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF Download
                  </button>
                  <button
                    onClick={() => shareOnWhatsApp(quickInvoiceView, profileCust!)}
                    className="p-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] uppercase transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      window.print();
                    }}
                    className="p-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-[11px] uppercase transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </button>
                  <button
                    onClick={() => setQuickInvoiceView(null)}
                    className="p-1 px-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Info banner explaining click to download */}
                <div 
                  onClick={() => generateInvoicePDF(quickInvoiceView, profileCust!)}
                  className="mt-2 mb-4 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 rounded-xl p-3 flex items-center gap-3 text-indigo-900 transition-colors duration-200 cursor-pointer text-xs select-none"
                  title={user.language === 'ur' ? 'ڈاؤن لوڈ کرنے کے لیے کلک کریں' : 'Click to download PDF'}
                >
                  <span className="text-base shrink-0">📥</span>
                  <div className="font-semibold">
                    <p>{user.language === 'ur' ? 'اس انوائس پر یا نیچے کسی بھی جگہ کلک کر کے پی ڈی ایف فائل حاصل کریں!' : 'Click anywhere on the invoice details card below to download instant PDF!'}</p>
                  </div>
                </div>

                {/* DUAL ARABIC / ENGLISH BILL OF SALE AND TAX DOCUMENT */}
                <div 
                  className="space-y-6 text-xs leading-relaxed cursor-pointer hover:bg-slate-50/50 hover:opacity-95 p-3 rounded-xl border border-transparent hover:border-slate-200 transition-all duration-200" 
                  id="printable-area"
                  onClick={() => generateInvoicePDF(quickInvoiceView, profileCust!)}
                  title={user.language === 'ur' ? 'انوائس فائل ڈاؤن لوڈ کرنے کے لیے یہاں کلک کریں' : 'Click anywhere on this layout to download high-fidelity PDF invoice'}
                >
                  <div className="flex justify-between items-start border-b pb-6 border-slate-200">
                    <div>
                      {user.logoUrl ? (
                        <img src={user.logoUrl} alt="Company Logo" className="h-10 object-contain mb-3 referrer-policy" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-20 h-10 bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black rounded-lg text-sm mb-3">LOGO</div>
                      )}
                      <p className="font-bold text-slate-800 text-sm">{user.companyName}</p>
                      <p className="text-slate-500 text-[11px]">{user.address || 'Capital Headquarters'}</p>
                      <p className="text-slate-500 text-[11px]">Phone: {user.phone || '-'}</p>
                      {user.taxNumber && <p className="text-slate-900 font-extrabold font-mono text-[11px] mt-1">TRN Tax ID: {user.taxNumber}</p>}
                    </div>
                    <div className="text-right">
                      <h1 className="text-xl font-black text-indigo-950 uppercase">
                        {user.language === 'ar' ? 'فاتورة ضريبية مبسطة' : user.language === 'ur' ? 'ٹیکس انوائس' : 'TAX INVOICE'}
                      </h1>
                      <p className="font-mono font-black text-base text-slate-950 mt-1">{quickInvoiceView.invoiceNumber}</p>
                      
                      <div className="mt-4 space-y-1 text-slate-500 text-[11px]">
                        <p>Date: <strong className="text-slate-800 font-mono">{quickInvoiceView.date}</strong></p>
                        <p>Due Date: <strong className="text-slate-800 font-mono">{quickInvoiceView.dueDate}</strong></p>
                        <p>Status: <strong className="uppercase font-extrabold text-emerald-600">{quickInvoiceView.status}</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Billed To Customer Bio Section */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-[11px]">
                    <div>
                      <span className="font-black text-slate-400 text-[9px] uppercase block tracking-wider">Billed To (Buyer) / العميل:</span>
                      <p className="font-black text-slate-900 text-sm mt-1">{profileCust.name}</p>
                      <p className="text-slate-500">{profileCust.email}</p>
                      <p className="text-slate-500">{profileCust.phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-400 text-[9px] uppercase block tracking-wider">Billing Node Registry</span>
                      <p className="text-slate-600 mt-1 font-mono">Location Domain: {profileCust.address || 'Address not registered'}</p>
                      <p className="text-slate-500">Channel Type: Client Account Portal</p>
                    </div>
                  </div>

                  {/* Items list table */}
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-400 font-black uppercase text-[9px] bg-slate-50">
                        <th className="py-2 px-3">Description / البيان</th>
                        <th className="py-2 px-3 text-right">Price / السعر</th>
                        <th className="py-2 px-3 text-center">Qty / الكمية</th>
                        <th className="py-2 px-3 text-right text-indigo-900">Tax (%)</th>
                        <th className="py-2 px-3 text-right">Total Net / المجموع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {quickInvoiceView.items.map((item, idx) => (
                        <tr key={idx} className="font-sans">
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-900">{item.productName}</p>
                            <p className="text-[10px] text-slate-400">Standard Product SKU Reference Code</p>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900">{currencySymbol}{item.price.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-900">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{quickInvoiceView.taxRate || user.taxRate}%</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{currencySymbol}{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pricing aggregation summaries */}
                  <div className="flex justify-end pt-5 text-xs text-slate-900 border-t">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Subtotal / المجموع الفرعي:</span>
                        <span className="font-mono font-bold">{currencySymbol}{quickInvoiceView.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Tax / قيمة الضريبة ({quickInvoiceView.taxRate || user.taxRate}%):</span>
                        <span className="font-mono text-slate-700">{currencySymbol}{quickInvoiceView.taxAmount.toFixed(2)}</span>
                      </div>
                      {quickInvoiceView.discount > 0 && (
                        <div className="flex justify-between text-rose-650">
                          <span className="text-rose-600 font-semibold">Discount / الخصم:</span>
                          <span className="font-mono font-bold">-{currencySymbol}{quickInvoiceView.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-dashed pt-2 text-sm font-black text-indigo-950">
                        <span>Total Payable / إجمالي المبلغ:</span>
                        <span className="font-mono">{currencySymbol}{quickInvoiceView.total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Amount Paid / المبلغ المدفوع:</span>
                        <span className="font-mono">{currencySymbol}{(quickInvoiceView.amountPaid !== undefined ? quickInvoiceView.amountPaid : (quickInvoiceView.status === 'paid' ? quickInvoiceView.total : 0)).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-rose-600 font-extrabold border-t border-slate-100 pt-1">
                        <span>Due Balance / المتبقي المستحق:</span>
                        <span className="font-mono text-sm">{currencySymbol}{(quickInvoiceView.balanceDue !== undefined ? quickInvoiceView.balanceDue : (quickInvoiceView.status === 'paid' ? 0 : quickInvoiceView.total)).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-400 font-mono">
                    <p>Thank you for your trusted business relationship with {user.companyName}!</p>
                    <p className="mt-1">Invoice Code: {quickInvoiceView.id} via secure SSL network registry.</p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setQuickInvoiceView(null)}
                    className="px-5 py-2 bg-slate-950 text-slate-200 hover:text-white rounded-xl font-bold transition cursor-pointer"
                  >
                    Close Document Review
                  </button>
                </div>

              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add / Edit customers modal inside profile view */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300 animate-in fade-in zoom-in-95 duration-200"
            >
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-1.5 font-sans">
                <Contact className="w-5 h-5 text-indigo-400" />
                {editingItem ? t.editCustomer : t.addCustomer}
              </h3>

              <form onSubmit={handleCreateOrUpdate} className="space-y-4">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850/80 space-y-1 font-sans">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer ID :</span>
                  <span className="font-mono text-sm font-extrabold text-indigo-400 font-sans">
                    {editingItem ? editingItem.id : getNextCustomerId(user.id)}
                  </span>
                  <span className="text-[9px] text-slate-500 block italic leading-none">(Auto-generated & cannot be edited)</span>
                </div>
                <div className="space-y-1 font-sans">
                  <label className="font-bold text-slate-400">{t.customerName} *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                    <input
                      type="text"
                      required
                      placeholder="Wile E. Coyote Ventures"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1 font-sans">
                  <label className="font-bold text-slate-400">{t.customerEmail}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                    <input
                      type="email"
                      placeholder="customer@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1 font-sans">
                  <label className="font-bold text-slate-400">{t.customerPhone}</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                    <input
                      type="tel"
                      placeholder="+971 50 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1 font-sans">
                  <label className="font-bold text-slate-400">{t.customerAddress}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                    <input
                      type="text"
                      placeholder="Downtown Boulevard, Tower B, Dubai"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 justify-end pt-3 font-sans">
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
                    {editingItem ? t.save : t.add}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal form to Record a Customer Payment */}
        {showAddPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddPaymentModal(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300 font-sans"
            >
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-1.5 font-sans">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>{user.language === 'ur' ? 'گاہک کی ادائیگی درج کریں' : 'Record Customer Payment'}</span>
              </h3>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const amt = parseFloat(paymentAmount);
                  if (isNaN(amt) || amt <= 0) return;
                  addCustomerPayment(user.id, {
                    customerId: selectedProfileCustomerId!,
                    amount: amt,
                    date: paymentDate,
                    paymentMethod: payMethod,
                    referenceNote: paymentNotes
                  });
                  setPaymentAmount('');
                  setPaymentNotes('');
                  setShowAddPaymentModal(false);
                  handleRefresh();
                }}
                className="space-y-4 font-sans"
              >
                {/* Amount input */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">Payment Amount ({user.currency === 'PKR' ? 'Rs' : user.currency === 'AED' ? 'AED' : '$'}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>

                {/* Date input */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white font-mono"
                  />
                </div>

                {/* Method selector */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">Payment Method *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white capitalize cursor-pointer"
                  >
                    <option value="cash">Cash (نقدی)</option>
                    <option value="bank">Bank Transfer (بینک ٹرانسفر)</option>
                    <option value="card">Card Payment (کارڈ ادائیگی)</option>
                    <option value="other">Other (دیگر)</option>
                  </select>
                </div>

                {/* Note references */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-400">Reference Note / Voucher Code</label>
                  <input
                    type="text"
                    placeholder="e.g. Bank slip #9482, check voucher"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>

                <div className="flex gap-2.5 justify-end pt-3 text-[11px] font-semibold font-sans">
                  <button
                    type="button"
                    onClick={() => setShowAddPaymentModal(false)}
                    className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
                  >
                    Record Receipt
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal form to Record a Customer Stock Return */}
        {showAddReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddReturnModal(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300 font-sans"
            >
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-1.5 font-sans">
                <RefreshCw className="w-5 h-5 text-amber-500" />
                <span>{user.language === 'ur' ? 'واپس کردہ مال کا اندراج' : 'Record Stock Return'}</span>
              </h3>

              {productsList.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-slate-400 italic font-sans text-xs">No products registered in your inventory directory. You must first declare products under stock management to return items.</p>
                  <button
                    onClick={() => setShowAddReturnModal(false)}
                    className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl font-extrabold text-white transition font-sans"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const prodId = returnProductId || (productsList[0] && productsList[0].id);
                    const qty = parseInt(returnQuantity);
                    const prc = parseFloat(returnPrice);
                    if (!prodId || isNaN(qty) || qty <= 0 || isNaN(prc) || prc <= 0) return;

                    const matchedProduct = productsList.find(p => p.id === prodId);
                    const prodName = matchedProduct ? matchedProduct.name : 'Unknown Product';

                    addCustomerReturn(user.id, {
                      customerId: selectedProfileCustomerId!,
                      date: returnDate,
                      items: [{
                        productId: prodId,
                        productName: prodName,
                        quantity: qty,
                        price: prc,
                        total: qty * prc
                      }],
                      totalAmount: qty * prc,
                      notes: returnNotes
                    });

                    setReturnProductId('');
                    setReturnQuantity('1');
                    setReturnPrice('');
                    setReturnNotes('');
                    setShowAddReturnModal(false);
                    handleRefresh();
                  }}
                  className="space-y-4 font-sans"
                >
                  {/* Select Product */}
                  <div className="space-y-1 font-sans">
                    <label className="font-bold text-slate-400">Select Returned Product *</label>
                    <select
                      value={returnProductId}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        setReturnProductId(targetId);
                        const matched = productsList.find(p => p.id === targetId);
                        if (matched) {
                          setReturnPrice(matched.price.toString());
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white capitalize cursor-pointer font-sans text-xs"
                    >
                      {productsList.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} (Stock: {prod.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity and Price Row */}
                  <div className="grid grid-cols-2 gap-3 font-sans">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={returnQuantity}
                        onChange={(e) => setReturnQuantity(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-400">Refund Price (@) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={returnPrice}
                        onChange={(e) => setReturnPrice(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Return Date */}
                  <div className="space-y-1 font-sans">
                    <label className="font-bold text-slate-400">Return Date *</label>
                    <input
                      type="date"
                      required
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white font-mono"
                    />
                  </div>

                  {/* Return Notes */}
                  <div className="space-y-1 font-sans">
                    <label className="font-bold text-slate-400">Return Reason notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Size didn't fit, defective piece"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white"
                    />
                  </div>

                  {/* Aggregation summary */}
                  {parseFloat(returnPrice) > 0 && parseInt(returnQuantity) > 0 && (
                    <div className="bg-amber-950/20 p-3 rounded-lg border border-amber-500/20 flex justify-between items-center font-sans">
                      <span className="font-bold text-amber-500 text-[10px]">Total Balanced Credit:</span>
                      <span className="font-mono font-extrabold text-amber-450">
                        {user.currency === 'PKR' ? 'Rs ' : user.currency === 'AED' ? 'AED ' : '$'}
                        {(parseFloat(returnPrice) * parseInt(returnQuantity)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2.5 justify-end pt-3 text-[11px] font-semibold font-sans">
                    <button
                      type="button"
                      onClick={() => setShowAddReturnModal(false)}
                      className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 rounded-xl text-slate-300 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-650 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl font-bold hover:shadow-lg transition cursor-pointer"
                    >
                      Approve Stock Return
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Contact className="w-5 h-5 text-indigo-400" />
            {t.customers}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Maintain global client profiles, contact points, and portal block configurations.</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setName('');
            setEmail('');
            setPhone('');
            setAddress('');
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t.addCustomer}
        </button>
      </div>

      {/* Sub tabs layout switch */}
      <div className="flex border-b border-slate-850 gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => {
            setViewTab('directory');
            setExpandedCustomerId(null);
          }}
          className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 shrink-0 cursor-pointer flex items-center gap-1.5 ${
            viewTab === 'directory'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{user.language === 'ur' ? 'گاہکوں کی ڈائرکٹری' : 'Customers Directory'}</span>
          <span className="ml-1 text-[10px] bg-slate-800 font-mono text-slate-300 px-1.5 py-0.5 rounded-full font-bold">
            {filteredCustomers.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setViewTab('dues');
            setExpandedCustomerId(null);
          }}
          className={`px-5 py-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 shrink-0 cursor-pointer flex items-center gap-1.5 ${
            viewTab === 'dues'
              ? 'border-rose-500 text-rose-400 bg-rose-500/5'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/40'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>{user.language === 'ur' ? 'بقایا جات یاد دہانی' : 'Dues Reminders'}</span>
          <span className="ml-1 text-[10px] bg-rose-950/40 text-rose-400 px-1.5 py-0.5 rounded-full font-extrabold border border-rose-900/10">
            {customersWithDues.length}
          </span>
        </button>
      </div>

      {viewTab === 'directory' ? (
        <>
          {/* Filters Search */}
          <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={`absolute top-3 w-4 h-4 text-slate-400 ${isRtl ? 'left-3' : 'right-3'}`} />
              <input
                type="text"
                placeholder={t.search}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-indigo-500 transition"
              />
            </div>
            
            <button
              onClick={handleRefresh}
              className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0 hover:border-slate-700 text-xs font-bold"
              title="Sync & refresh customers from cloud datastore"
            >
              <RefreshCw className="w-4 h-4 text-sky-400 animate-spin-hover" />
              <span className="hidden sm:inline">Refresh Directory</span>
            </button>

            <div className="bg-slate-950/40 text-[10px] text-slate-400 font-mono border border-slate-900 rounded-xl px-3.5 py-2 shrink-0">
              Total Directory Size: <strong>{filteredCustomers.length}</strong>
            </div>
          </div>

          {/* Info Notice about customer logins */}
          <div className="p-3 bg-blue-950/30 border border-blue-500/20 text-[11px] text-blue-300 rounded-xl flex items-center gap-2">
            <span>💡 <strong>Direct Access Controls</strong>: Click on any customer's <strong>Email</strong> or <strong>Phone Number</strong> to block/unblock their login, view login methods, or copy magic direct link credentials.</span>
          </div>

          {/* Grid of customer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-sans">
            {filteredCustomers.length === 0 ? (
              <div className="col-span-full bg-slate-900/10 border border-slate-850 py-12 rounded-2xl text-center text-xs italic text-slate-500">
                No active customer profiles logged. Add profile above to attach within Invoices.
              </div>
            ) : (
              filteredCustomers.map((cust) => (
                <div 
                  key={cust.id}
                  className={`bg-slate-900/40 border p-5 rounded-2xl flex flex-col justify-between shadow-lg relative group transition ${
                    cust.isBlocked 
                      ? 'border-rose-900/40 bg-rose-950/5' 
                      : 'border-slate-850/80 hover:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div 
                        onClick={() => {
                          setSelectedProfileCustomerId(cust.id);
                          setProfileTab('details');
                        }}
                        className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 active:scale-95 transition-all group/header"
                        title="Click to view purchase profile & ledger"
                      >
                        <div className={`w-10 h-10 rounded-xl text-indigo-400 flex items-center justify-center font-bold text-base shrink-0 border ${
                          cust.isBlocked 
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                            : 'bg-indigo-500/10 border-indigo-500/20 group-hover/header:border-indigo-500 group-hover/header:bg-indigo-500/20'
                        }`}>
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-extrabold text-white text-sm line-clamp-1 group-hover/header:text-indigo-400 group-hover/header:underline decoration-dotted">{cust.name}</h4>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefresh();
                              }}
                              className="p-1 text-slate-500 hover:text-sky-400 hover:bg-slate-850 rounded transition cursor-pointer shrink-0"
                              title="Reload this user data status"
                            >
                              <RefreshCw className="w-3 h-3 active:animate-spin" />
                            </button>
                          </div>
                          <p className="text-[10px] text-indigo-400 font-mono mt-0.5">ID: {cust.id} • <span className="text-emerald-400 font-bold decoration-solid">View Profile ➔</span></p>
                        </div>
                      </div>

                      {/* Approval or Blocked Badge indicator */}
                      {cust.isApproved === false ? (
                        <span className="px-2 py-0.5 bg-amber-950 text-[8px] text-amber-400 font-extrabold border border-amber-800/50 rounded-md animate-pulse">
                          ⏳ PENDING
                        </span>
                      ) : cust.isBlocked ? (
                        <span className="px-2 py-0.5 bg-rose-950 text-[8px] text-rose-400 font-extrabold border border-rose-800/50 rounded-md">
                          🚫 BLOCKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-950 text-[8px] text-emerald-400 font-extrabold border border-emerald-800/50 rounded-md">
                          ✓ APPROVED
                        </span>
                      )}
                    </div>

                    {/* Info block lines - clickable triggers for block operations */}
                    <div className="space-y-2.5 mt-4 text-xs">
                      {cust.email ? (
                        <button
                          type="button"
                          title="Click to check access permissions"
                          onClick={() => {
                            setSelectedAccessCust(cust);
                            setShowAccessModal(true);
                          }}
                          className="flex items-center gap-2 text-slate-300 hover:text-indigo-400 font-medium transition cursor-pointer text-left w-full group/email"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-500 group-hover/email:text-indigo-400" />
                          <span className="truncate underline decoration-dotted decoration-indigo-500/40">{cust.email}</span>
                        </button>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic block">No corporate email saved</div>
                      )}

                      {cust.phone ? (
                        <button
                          type="button"
                          title="Click to check access permissions"
                          onClick={() => {
                            setSelectedAccessCust(cust);
                            setShowAccessModal(true);
                          }}
                          className="flex items-center gap-2 text-slate-300 hover:text-indigo-400 font-medium transition cursor-pointer text-left w-full group/phone"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-500 group-hover/phone:text-indigo-400 shrink-0" />
                          <span className="underline decoration-dotted decoration-indigo-500/40">{cust.phone}</span>
                        </button>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic block">No mobile phone saved</div>
                      )}

                      {cust.address && (
                        <div className="flex items-start gap-2 text-slate-400 pt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 text-[11px] leading-relaxed text-slate-400" title={cust.address}>
                            {cust.address}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Direct Access Block/Allow toggle switch bar */}
                    {cust.isApproved !== false && (
                      <div className="mt-4 p-2.5 bg-slate-950/60 rounded-xl border border-slate-850 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${cust.isBlocked ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                          <span className="text-[10px] font-bold tracking-wide uppercase">
                            {cust.isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleBlock(cust)}
                          className={`px-3 py-1 font-extrabold text-[9px] rounded-lg border uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            cust.isBlocked
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                              : 'bg-rose-950 hover:bg-rose-900 border-rose-800/40 text-rose-400 hover:text-rose-300'
                          }`}
                        >
                          {cust.isBlocked ? '✓ Allow Access' : '🚫 Block'}
                        </button>
                      </div>
                    )}

                    {/* Direct Ledger Hub trigger button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProfileCustomerId(cust.id);
                        setProfileTab('all'); // Go straight to the purchases tab!
                      }}
                      className="mt-3.5 w-full py-2 bg-indigo-650/15 hover:bg-indigo-600 border border-indigo-500/20 hover:border-transparent text-indigo-300 hover:text-white rounded-xl text-[11px] font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View Purchases & Profile Ledger
                    </button>
                  </div>

                  {/* Actions row footer */}
                  <div className="mt-5 pt-3.5 border-t border-slate-850/80 flex flex-col gap-2.5">
                    {cust.isApproved === false && (
                      <div className="flex gap-1.5 w-full bg-amber-950/25 p-2 rounded-xl border border-amber-900/40">
                        <button
                          type="button"
                          onClick={() => {
                            toggleCustomerApproval(user.id, cust.id);
                            handleRefresh();
                          }}
                          className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg transition text-center cursor-pointer"
                        >
                          ✓ Approve Account
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cust.id)}
                          className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] rounded-lg transition text-center cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] w-full">
                      <p className="text-slate-500 font-mono">Since {cust.createdAt.split('T')[0]}</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedAccessCust(cust);
                            setShowAccessModal(true);
                          }}
                          className="p-1 px-2 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition cursor-pointer text-[9px] font-black uppercase tracking-wider"
                          title="Access controls"
                        >
                          Portal setup
                        </button>
                        <button
                          onClick={() => handleStartEdit(cust)}
                          className="p-1.5 hover:bg-indigo-500/10 text-indigo-400 rounded transition cursor-pointer border border-transparent"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cust.id)}
                          className="p-1.5 hover:bg-rose-500/10 text-rose-400 rounded transition cursor-pointer border border-transparent"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* DUES REMINDERS WORKSPACE */
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl text-xs space-y-1">
              <span className="text-slate-400 font-extrabold uppercase tracking-wider block text-[10px]">TOTAL OUTSTANDING DUES (کل بقایا جات)</span>
              <span className="text-rose-500 font-black text-lg block font-mono">
                {currencySymbol}{customersWithDues.reduce((sum, item) => sum + item.totalDues, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl text-xs space-y-1">
              <span className="text-slate-400 font-extrabold uppercase tracking-wider block text-[10px]">ACTIVE DEBTORS (قرض دار کسٹمرز)</span>
              <span className="text-indigo-400 font-black text-lg block font-mono">
                {customersWithDues.length} {customersWithDues.length === 1 ? 'Customer' : 'Customers'}
              </span>
            </div>
            <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl text-xs space-y-1 flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-extrabold uppercase tracking-wider block text-[10px]">REMINDER SMS TEMPLATE</span>
                <span className="text-slate-300 font-medium block text-[11px]">
                  {isTemplateEditorOpen ? 'Editing Default Template' : 'Default message configured'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateEditorOpen(!isTemplateEditorOpen)}
                className="px-3 py-1 bg-slate-950 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold border border-slate-800 cursor-pointer"
              >
                {isTemplateEditorOpen ? 'Close ✕' : 'Configure default ⚙️'}
              </button>
            </div>
          </div>

          {isTemplateEditorOpen && (
            <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-4 font-sans animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                <span className="text-white font-extrabold text-xs uppercase tracking-wider block flex items-center gap-1.5">
                  <Edit2 className="w-4 h-4 text-indigo-400" />
                  <span>Configure Default Dues Reminder Text Template (ڈیفالٹ پیغام مرتب کریں)</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Saved in browser storage</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Default Message Text:</label>
                  <textarea
                    value={defaultTemplate}
                    onChange={(e) => setDefaultTemplate(e.target.value)}
                    rows={7}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-3.5 text-xs text-white placeholder-slate-600 outline-none font-sans resize-y leading-relaxed"
                    placeholder="Enter default reminder message text template here..."
                  />
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem(`reminderTemplate_${user.id}`, defaultTemplate);
                        alert(user.language === 'ur' ? 'یاد دہانی کا پیغام کامیابی سے سب کے لیے ڈیفالٹ محفوظ کر دیا گیا ہے!' : 'Default template message successfully updated for all debtors!');
                        setIsTemplateEditorOpen(false);
                      }}
                      className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-black rounded-lg text-[11px] uppercase tracking-wide cursor-pointer shadow transition"
                    >
                      Save Configuration (محفوظ کریں)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-850/60 text-[11px] leading-relaxed space-y-3 shrink-0">
                  <span className="text-indigo-400 font-extrabold uppercase tracking-wider block text-[10px]">📋 Placeholder Tags</span>
                  <p className="text-slate-400">Use special keys. We replace them with live customer data instantly on click:</p>
                  <ul className="space-y-1.5 font-mono text-[10px]">
                    <li><strong className="text-white font-bold bg-slate-950 px-1 py-0.5 rounded">{'{customer_name}'}</strong> : Customer name</li>
                    <li><strong className="text-white font-bold bg-slate-950 px-1 py-0.5 rounded">{'{outstanding_balance}'}</strong> : Due balance</li>
                    <li><strong className="text-white font-bold bg-slate-950 px-1 py-0.5 rounded">{'{invoices_list}'}</strong> : List of unpaid invoices</li>
                    <li><strong className="text-white font-bold bg-slate-950 px-1 py-0.5 rounded">{'{portal_link}'}</strong> : Customer direct link</li>
                    <li><strong className="text-white font-bold bg-slate-950 px-1 py-0.5 rounded">{'{company_name}'}</strong> : Your company name</li>
                  </ul>
                  <div className="pt-2 border-t border-slate-855 text-[9px] text-slate-500 font-sans">
                    💡 <em>Pro-Tip: Standard markdown *bold* and linebreaks render perfectly in WhatsApp!</em>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 font-sans">
            <div className="p-3 bg-indigo-950/20 border border-indigo-500/10 text-[11px] text-slate-300 rounded-xl flex items-start gap-2">
              <span className="text-xs">💡</span>
              <p>
                <strong>Outstanding Dues Management:</strong> List of customers with positive unpaid balances. Click **Edit Notice** to write a customized draft just for that customer, or click **WhatsApp/Email** to dispatch pre-filled template reminders immediately without any manual setup.
              </p>
            </div>

            {customersWithDues.length === 0 ? (
              <div className="bg-slate-900/10 border border-slate-850 py-12 rounded-2xl text-center text-xs italic text-slate-500">
                Excellent! No customers currently have outstanding balances.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customersWithDues.map((item) => {
                  const isExpanded = expandedCustomerId === item.customer.id;
                  
                  // Phone cleaning
                  const defaultPhoneCode = getDefaultPhoneCode(user.currency);
                  const cleanedPhone = cleanPhoneForWhatsApp(item.customer.phone || '', defaultPhoneCode);

                  const resolvedMessage = resolveTemplateText(defaultTemplate, item);
                  const handleDirectWhatsApp = () => {
                    const url = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(resolvedMessage)}`;
                    window.open(url, '_blank');
                  };

                  const handleDirectEmail = () => {
                    const subject = `Pending Accounts Statement Notice - ${user.companyName}`;
                    const url = `mailto:${encodeURIComponent(item.customer.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(resolvedMessage)}`;
                    window.location.href = url;
                  };

                  const handleToggleEditDraft = () => {
                    if (expandedCustomerId === item.customer.id) {
                      setExpandedCustomerId(null);
                      setCustomDraftText('');
                    } else {
                      setExpandedCustomerId(item.customer.id);
                      setCustomDraftText(resolveTemplateText(defaultTemplate, item));
                    }
                  };

                  const handleSendCustomWhatsApp = () => {
                    const url = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodeURIComponent(customDraftText)}`;
                    window.open(url, '_blank');
                  };

                  const handleSendCustomEmail = () => {
                    const subject = `Accounts Statement Notice - ${user.companyName}`;
                    const url = `mailto:${encodeURIComponent(item.customer.email || '')}?subject=${encodeURIComponent(customDraftText)}`;
                    window.location.href = url;
                  };

                  return (
                    <div 
                      key={item.customer.id} 
                      className={`bg-slate-900/40 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-250 relative overflow-hidden ${
                        isExpanded ? 'border-rose-500/40 bg-rose-950/5 shadow-rose-950/10 shadow-xl' : 'border-slate-850 hover:border-slate-800'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start gap-2.5">
                          <div>
                            <h4 className="font-black text-white text-sm line-clamp-1">{item.customer.name}</h4>
                            <p className="text-[9px] text-slate-500 font-mono uppercase mt-0.5">ID: {item.customer.id}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-extrabold text-xs text-rose-500 font-mono pl-2 block">
                              {currencySymbol}{item.totalDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[8px] tracking-widest text-[9px] uppercase font-bold text-slate-500 block">Dues Total</span>
                          </div>
                        </div>

                        {/* Unpaid items summary line */}
                        <div className="bg-slate-950/75 border border-slate-900 p-3 rounded-xl space-y-1.5 text-[11px]">
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Unpaid Invoices Breakdown:</div>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {item.invoices.map(inv => (
                              <span key={inv.id} className="bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold text-slate-300">
                                #{inv.invoiceNumber} ({(inv.balanceDue !== undefined ? inv.balanceDue : inv.total).toLocaleString(undefined, { minimumFractionDigits: 0 })} {user.currency || 'PKR'})
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Expandable customized content editor specifically for this customer */}
                        {isExpanded && (
                          <div className="bg-slate-950 p-3 rounded-xl border border-indigo-500/10 space-y-3 animate-fade-in">
                            <div className="flex justify-between items-center pb-1 border-b border-slate-900">
                              <span className="text-[9.5px] uppercase font-bold text-rose-400 tracking-wider">✏️ Custom Message Draft</span>
                              <span className="text-[8.5px] text-slate-500">Edit manually before dispatch</span>
                            </div>
                            <textarea
                              value={customDraftText}
                              onChange={(e) => setCustomDraftText(e.target.value)}
                              rows={6}
                              className="w-full bg-slate-900 border border-slate-850 focus:border-indigo-500 rounded-xl p-2.5 text-[11px] text-white leading-relaxed font-mono resize-none"
                            />
                            <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                              <button
                                type="button"
                                onClick={handleSendCustomWhatsApp}
                                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg transition duration-200 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>WA Send (کسٹم)</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleSendCustomEmail}
                                className="w-full py-2 bg-indigo-650 hover:bg-indigo-600 text-white font-extrabold text-[10px] rounded-lg transition duration-200 flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Email (کسٹم)</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Default action trigger row */}
                      {!isExpanded && (
                        <div className="mt-5 pt-3.5 border-t border-slate-850 flex items-center justify-between gap-1.5 font-sans">
                          <button
                            type="button"
                            onClick={handleToggleEditDraft}
                            className="flex-1 py-1.5 px-2 bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-800 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                            title="Edit message draft specifically for this customer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{user.language === 'ur' ? 'پیغام تبدیل کریں' : 'Edit Notice'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDirectWhatsApp}
                            className="py-1.5 px-2.5 bg-emerald-650/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/25 rounded-lg text-[10px] font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1"
                            title="Send pre-filled message on WhatsApp instantly"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{user.language === 'ur' ? 'واٹس ایپ' : 'WhatsApp'}</span>
                          </button>

                          {item.customer.email && (
                            <button
                              type="button"
                              onClick={handleDirectEmail}
                              className="py-1.5 px-2.5 bg-indigo-650/12 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/25 rounded-lg text-[10px] font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1"
                              title="Send pre-filled accounts statement notice by email"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-500" />
                              <span>{user.language === 'ur' ? 'ای میل' : 'Email'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* If expanded, provide a close custom panel button at the footer */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-slate-850 flex justify-end font-sans">
                          <button
                            type="button"
                            onClick={() => setExpandedCustomerId(null)}
                            className="px-3 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-extrabold text-[10px] tracking-wide uppercase transition cursor-pointer"
                          >
                            Cancel Draft ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Portal Setup & Live Block Actions Modal */}
      <AnimatePresence>
        {showAccessModal && selectedAccessCust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAccessModal(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300"
            >
              <h3 className="text-base font-extrabold text-white mb-2 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                CUSTOMER PORTAL CONTROLS
              </h3>
              <p className="text-[11px] text-slate-400 mb-4 font-medium">Verify credentials permissions and block access metrics instantly.</p>

              <div className="space-y-4">
                {/* Details segment */}
                <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-850/85 space-y-2">
                  <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">Customer Node</span>
                  <div className="text-white font-extrabold text-sm">{selectedAccessCust.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">ID Ref: {selectedAccessCust.id}</div>
                </div>

                {/* Approval Action Banner inside modal */}
                {selectedAccessCust.isApproved === false && (
                  <div className="p-3.5 bg-amber-950/20 rounded-xl border border-amber-800/40 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-extrabold text-amber-300 text-xs block">Registration Approval Needed</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">This customer self-registered online.</span>
                      </div>
                      <span className="px-2 py-0.5 bg-amber-950 text-[8px] text-amber-400 font-extrabold border border-amber-800/50 rounded-md animate-pulse">
                        PENDING
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-850 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          toggleCustomerApproval(user.id, selectedAccessCust.id);
                          setSelectedAccessCust({ ...selectedAccessCust, isApproved: true });
                          handleRefresh();
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase py-1.5 px-3.5 rounded-lg transition duration-300 cursor-pointer text-center"
                      >
                        ✓ Approve
                      </button>
                    </div>
                  </div>
                )}

                {/* Status Toggle control panel */}
                <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-black text-white text-xs block">Portal Access State</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Allows customer login on statements</span>
                    </div>

                    <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border ${
                      selectedAccessCust.isBlocked 
                        ? 'bg-rose-950/60 border-rose-800/50 text-rose-400' 
                        : 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400'
                    }`}>
                      {selectedAccessCust.isBlocked ? '🚫 Blocked' : '✅ Active'}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex justify-end">
                    <button
                      onClick={() => handleToggleBlock(selectedAccessCust)}
                      className={`font-black text-[10px] uppercase tracking-wider py-1.5 px-3.5 rounded-lg transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                        selectedAccessCust.isBlocked 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {selectedAccessCust.isBlocked ? 'Unblock customer' : 'Block customer'}
                    </button>
                  </div>
                </div>

                {/* Magic direct link copy panel */}
                <div className="space-y-2">
                  <span className="text-[10px] text-indigo-300 font-black block uppercase tracking-wider">🔗 Get Magic Login Links:</span>
                  
                  {selectedAccessCust.isBlocked ? (
                    <div className="p-2.5 bg-rose-950/15 border border-rose-900/30 rounded-xl text-[10px] text-rose-400 italic">
                      This customer is blocked. Remove suspension to enable login credentials.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedAccessCust.email && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = window.location.origin + "?customerEmail=" + encodeURIComponent(selectedAccessCust.email);
                            handleCopyLink(url);
                          }}
                          className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-indigo-500/40 rounded-xl flex items-center justify-between transition cursor-pointer text-[11px]"
                        >
                          <span className="truncate pr-2 font-mono text-slate-400">Email magic link login</span>
                          <span className="shrink-0 text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1">
                            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            COPY
                          </span>
                        </button>
                      )}

                      {selectedAccessCust.phone && (
                        <button
                          type="button"
                          onClick={() => {
                            const url = window.location.origin + "?customerPhone=" + encodeURIComponent(selectedAccessCust.phone);
                            handleCopyLink(url);
                          }}
                          className="w-full text-left p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-indigo-500/40 rounded-xl flex items-center justify-between transition cursor-pointer text-[11px]"
                        >
                          <span className="truncate pr-2 font-mono text-slate-400">Phone magic link login</span>
                          <span className="shrink-0 text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1">
                            {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            COPY
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit Close */}
                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => setShowAccessModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl font-bold transition cursor-pointer"
                  >
                    Close setup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit customers modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative overflow-hidden text-xs text-slate-300"
          >
            <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-1.5">
              <Contact className="w-5 h-5 text-indigo-400" />
              {editingItem ? t.editCustomer : t.addCustomer}
            </h3>

            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850/80 space-y-1 font-sans">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer ID :</span>
                <span className="font-mono text-sm font-extrabold text-indigo-400 font-sans">
                  {editingItem ? editingItem.id : getNextCustomerId(user.id)}
                </span>
                <span className="text-[9px] text-slate-500 block italic leading-none">(Auto-generated & cannot be edited)</span>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.customerName} *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    required
                    placeholder="Wile E. Coyote Ventures"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.customerEmail}</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                  <input
                    type="email"
                    placeholder="customer@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.customerPhone}</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                  <input
                    type="tel"
                    placeholder="+971 50 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.customerAddress}</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    placeholder="Downtown Boulevard, Tower B, Dubai"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 justify-end pt-3">
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
                  {editingItem ? t.save : t.add}
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
            deleteCustomer(user.id, deleteId);
            if (deleteId === selectedProfileCustomerId) {
              setSelectedProfileCustomerId(null);
            }
            setDeleteId(null);
            handleRefresh();
          }
        }}
        message="Are you sure you want to delete this customer account? All history will remain recorded, but you cannot issue new transactions targeting this node. This cannot be undone."
        language={user.language}
      />
    </div>
  );
}
