import React, { useState } from 'react';
import { UserTenant, Customer } from '../types';
import { translations } from '../translations';
import { getCustomers, addCustomer, editCustomer, deleteCustomer, getNextCustomerId, toggleCustomerBlock, toggleCustomerApproval } from '../db';
import { Plus, Search, Trash2, Edit2, Contact, Phone, Mail, MapPin, User, ArrowRight, ShieldAlert, Check, Copy, KeyRound, Accessibility, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

interface CustomersModuleProps {
  user: UserTenant;
  onRefreshStats: () => void;
}

export default function CustomersModule({ user, onRefreshStats }: CustomersModuleProps) {
  const t = translations[user.language];

  const [customers, setCustomers] = useState<Customer[]>(() => getCustomers(user.id));
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // States to block / unblock customers and generate magic portal links
  const [selectedAccessCust, setSelectedAccessCust] = useState<Customer | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-xl text-indigo-400 flex items-center justify-center font-bold text-base shrink-0 border ${
                      cust.isBlocked 
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                        : 'bg-indigo-500/10 border-indigo-500/20'
                    }`}>
                      {cust.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-white text-sm line-clamp-1">{cust.name}</h4>
                        <button
                          type="button"
                          onClick={handleRefresh}
                          className="p-1 text-slate-500 hover:text-sky-400 hover:bg-slate-850 rounded transition cursor-pointer shrink-0"
                          title="Reload this user data status"
                        >
                          <RefreshCw className="w-3 h-3 active:animate-spin" />
                        </button>
                      </div>
                      <p className="text-[10px] text-indigo-400 font-mono mt-0.5">ID: {cust.id}</p>
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
                        {cust.isBlocked ? 'Blocked / بلاک شدہ' : 'Active / فعال (Allow)'}
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
                      ✓ Approve Account / منظور کریں
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
                        ✓ Approve / منظور کریں
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
                      {selectedAccessCust.isBlocked ? '🚫 Blocked / معطل' : '✅ Active / فعال'}
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
                      {selectedAccessCust.isBlocked ? 'Unblock customer / بحال کریں' : 'Block customer / بلاک کریں'}
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
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Customer ID / کسٹمر آئی ڈی :</span>
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
            handleRefresh();
          }
        }}
        message="Are you sure you want to delete this customer account? All history will remain recorded, but you cannot issue new transactions targeting this node. This cannot be undone."
        language={user.language}
      />
    </div>
  );
}
