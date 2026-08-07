import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Bot, Loader2, ArrowRight, MessageSquare, Phone, Mail, Bell, AlertCircle, Check, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserTenant } from '../types';
import { getInvoices, getCustomers } from '../db';
import { currencySymbols } from '../translations';

interface AIAgentWidgetProps {
  user: UserTenant;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

// Simple Helper to Render Markdown-like patterns (strong blocks, line breaks, list elements, custom block triggers)
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Check for custom WA action button inline
    const actionRegex = /\[WA_ACTION:([^:]*):([^:]*):([^\]]*)\]/;
    const actionMatch = line.match(actionRegex);
    if (actionMatch) {
      const phone = actionMatch[1].trim();
      const msgEncoded = actionMatch[2].trim();
      const label = actionMatch[3].trim();
      
      const cleanPhone = phone.replace(/\D/g, '');
      let cleanMsg = '';
      try {
        cleanMsg = decodeURIComponent(msgEncoded);
      } catch (e) {
        cleanMsg = msgEncoded;
      }
      
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(cleanMsg)}`;
      
      return (
        <div key={i} className="my-3 flex justify-center">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black tracking-tight px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-950/40 transition-all cursor-pointer border border-emerald-500/30"
          >
            <MessageSquare className="w-4 h-4 text-white" />
            <span className="font-bold">{label}</span>
          </a>
        </div>
      );
    }

    // Check if list item
    const isListItem = line.trim().startsWith('* ') || line.trim().startsWith('- ');
    let cleanLine = line;
    if (isListItem) {
      cleanLine = line.trim().substring(2);
    }

    // Replace bold formatting (**text**)
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(cleanLine)) !== null) {
      if (match.index > lastIndex) {
        parts.push(cleanLine.substring(lastIndex, match.index));
      }
      parts.push(<strong key={match.index} className="font-bold text-white tracking-tight">{match[1]}</strong>);
      lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < cleanLine.length) {
      parts.push(cleanLine.substring(lastIndex));
    }

    if (isListItem) {
      return (
        <li key={i} className="list-disc ml-5 mb-1.5 text-xs text-slate-200 leading-relaxed">
          {parts.length > 0 ? parts : cleanLine}
        </li>
      );
    }

    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }

    return (
      <p key={i} className="text-xs text-slate-200 leading-relaxed mb-2">
        {parts.length > 0 ? parts : cleanLine}
      </p>
    );
  });
}

export default function AIAgentWidget({ user }: AIAgentWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'reminders'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Outstanding Reminders filter & edit states
  const [reminderSearch, setReminderSearch] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [customDraftText, setCustomDraftText] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lang = user.language || 'en';
  const isRtl = lang === 'ar' || lang === 'ur';
  const symbol = currencySymbols[user.currency] || '$';

  // Fetch real-time unpaid dues and group them by customer
  const invoices = getInvoices(user.id);
  const customers = getCustomers(user.id);
  const unpaidInvoices = invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue');

  const customersWithDues = customers.map(cust => {
    const custInvoices = unpaidInvoices.filter(inv => inv.customerId === cust.id);
    const totalDues = custInvoices.reduce((sum, inv) => sum + (inv.balanceDue !== undefined ? inv.balanceDue : inv.total), 0);
    return {
      customer: cust,
      invoices: custInvoices,
      totalDues
    };
  }).filter(item => item.totalDues > 0);

  const filteredReminders = customersWithDues.filter(item => {
    const term = reminderSearch.toLowerCase();
    return item.customer.name.toLowerCase().includes(term) ||
           (item.customer.phone && item.customer.phone.includes(term)) ||
           item.invoices.some(inv => inv.invoiceNumber.toLowerCase().includes(term));
  });

  const totalOutstandingSum = customersWithDues.reduce((sum, item) => sum + item.totalDues, 0);

  // Auto Scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, activeTab]);

  // Expand customer reminder draft text builder
  const handleToggleExpandCustomer = (customerId: string, item: typeof customersWithDues[0]) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null);
      setCustomDraftText('');
    } else {
      setExpandedCustomerId(customerId);
      const cleanPhone = item.customer.phone ? item.customer.phone.replace(/\D/g, '') : '';
      const totalVal = `${symbol} ${item.totalDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      const invoicesStr = item.invoices.map(inv => inv.invoiceNumber).join(', ');
      
      // Portal link for directly viewing statement / settling online
      const magicClientLink = `${window.location.origin}/?customerEmail=${encodeURIComponent(item.customer.email)}`;
      
      const template = `Hello *${item.customer.name}*!\n\nThis is a friendly sales account reminder from *${user.companyName}* regarding your outstanding dues.\n\n*Total Balance:* ${totalVal}\n*Pending Invoices:* ${invoicesStr}\n\nYou can click on the secure direct statement link below to view details and pay online inside your portal:\n${magicClientLink}\n\nThank you for your valued business!\n*${user.companyName}*`;
      
      setCustomDraftText(template);
    }
  };

  // Launch prefilled WhatsApp url
  const handleLaunchWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Multilingual configurations
  const textConfig = {
    en: {
      agentTitle: 'OmniAI Business Counselor',
      agentStatus: 'ERP Advisor Active',
      welcome: 'Greetings! I am OmniAI, your virtual ERP supervisor bound securely to your business data. How can I analyze your financial records, sales transactions, active margins, or stock positions today?',
      placeholder: 'Ask OmniAI about your business health...',
      btnAnalyze: '📊 Financial Summary',
      btnStock: '🚩 Stock Positions Alert',
      btnSuggestions: '💡 Suggest Margin Improvements',
      btnEmail: '✉️ Draft Customer Reminder',
      networkError: 'Sorry, the AI service is currently busy or configured offline. Please verify connectivity or check your settings.',
    },
    ar: {
      agentTitle: 'OmniAI المستشار المالي',
      agentStatus: 'متتبع الـ ERP نشط',
      welcome: 'مرحباً بك! أنا OmniAI، مستشارك المالي والمهني الافتراضي المرتبط ببيانات مؤسستك بشكل آمن ومغلق. كيف يمكنني مساعدتك برؤية وتلخيص أرباح مبيعاتك، المصروفات، أو حالة السلع اليوم لقراءة أداء عملك التجاري؟',
      placeholder: 'اسأل OmniAI حول أداء وتفاصيل عملك...',
      btnAnalyze: '📊 ملخص الأداء المالي والربح',
      btnStock: '🚩 تنبيهات نقص كمية المخزون',
      btnSuggestions: '💡 نصائح للتنويع وزيادة الأرباح',
      btnEmail: '✉️ صياغة بريد ومتابعة دفع العميل',
      networkError: 'عذراً، خدمة الذكاء الاصطناعي مشغولة حالياً أو غير متصلة بالشبكة. يرجى تكرار المحاولة لاحقاً.',
    },
    hi: {
      agentTitle: 'OmniAI बिजनेस काउंसलर',
      agentStatus: 'ERP सलाहकार सक्रिय',
      welcome: 'नमस्ते! मैं OmniAI हूं, आपका वर्चुअल व्यावसायिक सलाहकार। आपके उद्यम डेटा के साथ सुरक्षित रूप से जुड़ा हुआ हूं। आज मैं आपके वित्तीय विवरण, स्टॉक संख्या, या बिक्री प्रदर्शन को जानने में कैसे मदद कर सकता हूं?',
      placeholder: 'OmniAI से अपने व्यवसाय के स्वास्थ्य के बारे में पूछें...',
      btnAnalyze: '📊 वित्तीय प्रदर्शन रिपोर्ट',
      btnStock: '🚩 स्टॉक कम संख्या चेतावनी',
      btnSuggestions: '💡 लाभ वृद्धि रणनीतियाँ',
      btnEmail: '✉️ भुगतान याद दिलाने वाला पत्र',
      networkError: 'क्षमा करें, AI सेवा वर्तमान में व्यस्त है या ऑफ़लाइन कॉन्फ़िगर की गई है। कृपया नेटवर्क सत्यापित करें।',
    }
  };

  const activeText = textConfig[lang as keyof typeof textConfig] || textConfig.en;

  const quickPrompts = [
    activeText.btnAnalyze,
    activeText.btnStock,
    activeText.btnSuggestions,
    activeText.btnEmail,
  ];

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Math.random().toString(36).substring(2, 9),
      role: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const apiHistory = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          history: apiHistory,
          tenantId: user.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: 'msg-' + Math.random().toString(36).substring(2, 9),
          role: 'model',
          text: data.reply || 'Nothing generated.',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server non-ok status');
      }
    } catch (err: any) {
      console.error('Core AI connection failed:', err);
      const errorMsg: ChatMessage = {
        id: 'msg-err-' + Math.random().toString(36).substring(2, 9),
        role: 'model',
        text: `⚠️ **Error Code 500**:\n${activeText.networkError} (${err.message || 'Unknown'})`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-24 ${isRtl ? 'left-6' : 'right-6'} z-45`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-85 md:w-105 h-[530px] bg-slate-900 border border-indigo-500/20 rounded-3xl shadow-2xl flex flex-col overflow-hidden mb-4 select-text"
          >
            {/* High-Tech Cosmic Top Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-4 border-b border-indigo-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
                    <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse animate-spin-slow" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-indigo-400 border-2 border-slate-900 rounded-full animate-ping" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-white tracking-tight leading-none">
                    {activeText.agentTitle}
                  </h4>
                  <p className="text-[10px] text-indigo-300/80 font-mono tracking-wider mt-1.5 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {activeText.agentStatus}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Control Tabs Selector */}
            <div className="bg-slate-950/60 p-1 border-b border-indigo-500/10 flex text-[10px] select-none shrink-0">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 text-center font-bold tracking-tight transition-all rounded-lg flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'chat' 
                    ? 'bg-indigo-650/80 text-white shadow' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI CHAT ADVISOR</span>
              </button>
              <button
                onClick={() => setActiveTab('reminders')}
                className={`flex-1 py-2 text-center font-bold tracking-tight transition-all rounded-lg flex items-center justify-center gap-1.5 cursor-pointer relative ${
                  activeTab === 'reminders' 
                    ? 'bg-indigo-650/80 text-white shadow' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>WHATSAPP REMINDERS</span>
                {customersWithDues.length > 0 && (
                  <span className="absolute top-1 right-2 px-1.5 py-0.5 bg-emerald-500 text-white font-mono text-[8px] font-black rounded-full leading-none scale-90">
                    {customersWithDues.length}
                  </span>
                )}
              </button>
            </div>

            {/* Render Active Tab Body */}
            {activeTab === 'chat' ? (
              <>
                {/* Chat Messages Log */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col bg-slate-950/30">
                  {/* Grounding Welcome Card */}
                  <div className="bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 border border-indigo-500/10 p-4 rounded-2xl flex flex-col space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent blur-xl" />
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-300 font-mono">Real-Time Data Sandbox Enabled</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">
                      {activeText.welcome}
                    </p>
                  </div>

                  {/* Chat Thread Messages */}
                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[88%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                      >
                        <span className="text-[8px] text-slate-500 mb-0.5 font-bold font-mono uppercase tracking-wider">
                          {isUser ? 'You' : 'OmniAI Partner'}
                        </span>
                        <div
                          className={`px-4 py-2.5 rounded-2xl ${
                            isUser
                              ? 'bg-indigo-650 text-white rounded-tr-none shadow-md shadow-indigo-950/20'
                              : 'bg-slate-850 text-slate-200 rounded-tl-none border border-indigo-500/10 shadow-lg'
                          }`}
                        >
                          {renderMarkdown(msg.text)}
                        </div>
                        <span className="text-[8px] text-slate-650 mt-0.5 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })}

                  {/* Loader Typing Simulation */}
                  {loading && (
                    <div className="self-start flex flex-col items-start max-w-[80%]">
                      <span className="text-[8px] text-slate-500 mb-0.5 font-bold font-mono uppercase tracking-wider">
                        OmniAI Consulting
                      </span>
                      <div className="px-4 py-3 bg-slate-850 text-indigo-400 rounded-2xl rounded-tl-none border border-indigo-500/10 flex items-center gap-2 shadow-lg">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-[10px] text-slate-400 tracking-tight font-medium">Analyzing records & draft response...</span>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Suggested Prompts Shelf */}
                {messages.length === 0 && !loading && (
                  <div className="p-3 border-t border-indigo-500/5 bg-slate-900/40 space-y-1.5 shrink-0">
                    <p className="text-[9px] font-bold text-slate-400 px-2 uppercase tracking-widest font-mono">Consult Quick-Analysis Guides</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1">
                      {quickPrompts.map((p, index) => (
                        <button
                          key={index}
                          onClick={() => handleSendMessage(p)}
                          className="text-[10px] text-left text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-850/80 border border-white/5 hover:border-indigo-500/30 p-2 rounded-xl transition-all duration-150 flex items-center justify-between cursor-pointer group"
                        >
                          <span className="truncate mr-1">{p}</span>
                          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0 group-hover:text-indigo-400 transition" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat Footer Form input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage(inputText);
                  }}
                  className="p-3 bg-slate-900 border-t border-indigo-500/10 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={activeText.placeholder}
                    className="flex-1 bg-slate-950 border border-indigo-500/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/30 transition shadow-inner font-normal"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || loading}
                    className="p-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition cursor-pointer shrink-0 shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            ) : (
              /* Automated WhatsApp Reminders Tab */
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/40">
                {/* Search & outstanding summary */}
                <div className="p-3 bg-slate-900/60 border-b border-indigo-500/5 space-y-2.5 shrink-0">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Outstanding Dues Dashboard</span>
                    <span className="font-extrabold text-amber-500 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
                      {symbol} {totalOutstandingSum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by customer name, phone, or invoice..."
                    value={reminderSearch}
                    onChange={(e) => setReminderSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-indigo-500/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400/30 transition"
                  />
                </div>

                {/* Reminders List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {filteredReminders.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs italic">
                      {reminderSearch ? 'No matching outstanding balances found.' : 'Excellent! No customers currently have outstanding balances.'}
                    </div>
                  ) : (
                    filteredReminders.map((item) => {
                      const isExpanded = expandedCustomerId === item.customer.id;
                      return (
                        <div 
                          key={item.customer.id}
                          className={`bg-slate-900 border transition-all rounded-2xl overflow-hidden ${
                            isExpanded ? 'border-indigo-500/30 shadow-lg' : 'border-indigo-500/10 hover:border-indigo-500/20'
                          }`}
                        >
                          {/* Card Header row click to expand/customize */}
                          <div 
                            onClick={() => handleToggleExpandCustomer(item.customer.id, item)}
                            className="p-3 flex justify-between items-center cursor-pointer select-none"
                          >
                            <div className="space-y-1">
                              <h5 className="font-bold text-white text-xs">{item.customer.name}</h5>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded text-[9px] border border-slate-900">
                                  {item.invoices.length} {item.invoices.length === 1 ? 'invoice' : 'invoices'}
                                </span>
                                {item.customer.phone && <span className="font-mono truncate max-w-[120px]">{item.customer.phone}</span>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-black text-xs text-amber-500 font-mono">
                                {symbol} {item.totalDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </div>
                              <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider block mt-0.5">
                                {isExpanded ? 'Collapse ✕' : 'Review Draft 📲'}
                              </span>
                            </div>
                          </div>

                          {/* Extra Invoice Details & Template editor */}
                          {isExpanded && (
                            <div className="bg-slate-950/80 border-t border-indigo-500/10 p-3 space-y-3 text-[11px] animate-fade-in">
                              
                              {/* Invoice sub-pills */}
                              <div className="space-y-1">
                                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Unpaid sheets breakdown</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.invoices.map(inv => (
                                    <div key={inv.id} className="bg-slate-900 border border-slate-800 p-1.5 rounded-lg flex items-center gap-1.5 text-[10px]">
                                      <span className="font-mono text-white text-[9px]">{inv.invoiceNumber}</span>
                                      <span className="text-rose-400 font-mono font-bold">
                                        {symbol} {(inv.balanceDue !== undefined ? inv.balanceDue : inv.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Message Customization Frame */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Customize WhatsApp Message Draft</span>
                                  <span className="text-[8px] text-slate-500 font-mono">Markdown supported</span>
                                </div>
                                <textarea
                                  value={customDraftText}
                                  onChange={(e) => setCustomDraftText(e.target.value)}
                                  rows={5}
                                  className="w-full bg-slate-900 border border-indigo-500/15 rounded-xl p-2 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-400/40 leading-relaxed font-mono resize-none"
                                />
                              </div>

                              {/* Send Button Trigger */}
                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleLaunchWhatsApp(item.customer.phone || '', customDraftText)}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] py-2 px-3 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 shadow-md active:scale-98 cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>🚀 Send reminder on WhatsApp now</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Helpful explanatory notification bar */}
                <div className="p-3 bg-indigo-950/40 border-t border-indigo-500/10 text-[10px] text-slate-300 leading-relaxed flex items-start gap-2 shrink-0">
                  <span className="select-none text-xs">💡</span>
                  <p>
                    <strong>WhatsApp instant dispatch tracker:</strong> Select any customer with due balances above, review and customize the automated reminder draft, and launch the message! We auto-generate direct client-dashboard access links for quick verification and settlement.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher Button widget */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-700 to-violet-600 hover:from-indigo-600 hover:to-violet-500 text-white flex items-center justify-center shadow-2xl relative cursor-pointer border border-indigo-400/20"
        title="Open OmniAI Business Assistant"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <div className="relative">
            <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
            {customersWithDues.length > 0 && (
              <span className="absolute -top-3.5 -right-3.5 w-5 h-5 bg-rose-500 text-white font-mono font-black text-[9px] rounded-full flex items-center justify-center border border-slate-900 animate-pulse">
                {customersWithDues.length}
              </span>
            )}
          </div>
        )}
      </motion.button>
    </div>
  );
}
