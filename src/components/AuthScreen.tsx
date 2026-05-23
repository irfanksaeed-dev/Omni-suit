import React, { useState } from 'react';
import { getTenants, registerTenant, setActiveUser, customerLoginLookup, addCustomer, logAccess } from '../db';
import { UserTenant, Language, Currency, Customer } from '../types';
import { translations } from '../translations';
import { Briefcase, Key, Mail, Building, Globe, Landmark, Languages, Phone, ArrowRight, UserCheck, ShieldAlert, User, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreenProps {
  onAuthSuccess: (user: UserTenant) => void;
  onCustomerAuthSuccess: (customer: Customer, tenant: UserTenant) => void;
  initialLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function AuthScreen({ onAuthSuccess, onCustomerAuthSuccess, initialLanguage, onLanguageChange }: AuthScreenProps) {
  const [loginMode, setLoginMode] = useState<'staff' | 'sharecode' | 'customer'>('staff');
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const isCustomerLogin = loginMode === 'customer';
  const isShareCodeLogin = loginMode === 'sharecode';
  const [customerInput, setCustomerInput] = useState('');
  
  // Custom customer registration states
  const [isCustomerRegister, setIsCustomerRegister] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // Multi-match company options selection
  const [matchingAccounts, setMatchingAccounts] = useState<{ customer: Customer; tenant: UserTenant }[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const t = translations[lang];

  const handleLanguageSelect = (selected: Language) => {
    setLang(selected);
    onLanguageChange(selected);
  };

  const handleCustomerLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setMatchingAccounts([]);

    if (!customerInput.trim()) {
      setError('Please enter your email address or phone number / ای میل یا فون نمبر درج کریں');
      return;
    }

    const matches = customerLoginLookup(customerInput);
    if (matches.length === 0) {
      setError('No customer account found with this email or phone number in database / اس ای میل یا فون نمبر کے ساتھ کوئی گاہک نہیں ملا');
      return;
    }

    // Check if matching account is pending approval
    const allPending = matches.every(m => m.customer.isApproved === false);
    if (allPending) {
      setError('⏳ Registration Pending Approval: Your account has been received and is awaiting approval by the business merchant. / آپ کا اکاؤنٹ تاحال منظور نہیں ہوا ہے۔');
      return;
    }

    // Filter out unapproved matches from general login sequence
    const approvedMatches = matches.filter(m => m.customer.isApproved !== false);
    if (approvedMatches.length === 0) {
      setError('⏳ Registration Pending Approval: Please wait for the merchant to approve your self-service registration. / آپ کی رجسٹریشن کی منظوری کا انتظار ہے۔');
      return;
    }

    // Filter blocked ones to verify straight away or count
    const allBlocked = approvedMatches.every(m => m.customer.isBlocked === true);
    if (allBlocked) {
      setError('⚠️ Access Suspended: Your customer portal access has been blocked by the merchant / گاہک کا لاگ ان بلاک کر دیا گیا ہے۔');
      return;
    }

    if (approvedMatches.length === 1) {
      const match = approvedMatches[0];
      if (match.customer.isBlocked) {
        setError('⚠️ This customer account index has been deactivated or blocked / گاہک کا لاگ ان بلاک کر دیا گیا ہے۔');
        return;
      }
      logAccess('customer', match.customer.id, match.customer.name, match.customer.email, `Logged in to view portal with merchant: ${match.tenant.companyName}`);
      setSuccess('Customer session authenticated successfully! Loading receipts...');
      setTimeout(() => {
        onCustomerAuthSuccess(match.customer, match.tenant);
      }, 1000);
    } else {
      // Multiple businesses matching this customer email or phone
      const activeMatches = approvedMatches.filter(m => !m.customer.isBlocked);
      if (activeMatches.length === 0) {
        setError('⚠️ Your profiles are blocked across linked corporate accounts / گاہک کا لاگ ان بلاک کر دیا گیا ہے۔');
        return;
      }
      setMatchingAccounts(activeMatches);
    }
  };

  const handleCustomerSelfRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || !selectedTenantId) {
      setError('Please fill in all required fields / تمام ضروری فیلڈز پُر کریں');
      return;
    }

    try {
      addCustomer(selectedTenantId, {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        address: regAddress.trim(),
        isBlocked: false,
        isApproved: false, // Start as pending!
      });

      setSuccess('🎉 Registration Submitted! Please wait for the merchant to approve your account. / رجسٹریشن جمع ہو گئی۔ براہ کرم کاروباری ادارے کی جانب سے منظوری کا انتظار کریں۔');
      
      // Reset registration form
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegAddress('');
      
      // Auto switch back to login mode after 3.5 seconds
      setTimeout(() => {
        setIsCustomerRegister(false);
        setSuccess('');
        setError('');
      }, 3500);
    } catch (err: any) {
      setError('System lookup error. Please try again.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isCustomerLogin) {
      if (isCustomerRegister) {
        handleCustomerSelfRegister(e);
      } else {
        handleCustomerLoginSubmit(e);
      }
      return;
    }

    if (!email || !password) {
      setError(t.invalidCredentials);
      return;
    }

    if (isLogin) {
      const tenants = getTenants();
      const found = tenants.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.passwordSha === password
      );
      if (found) {
        if (found.isActive === false) {
          setError('Your account has been deactivated by the administrator. Please contact support.');
          return;
        }
        logAccess('merchant', found.id, found.companyName, found.email, 'Logged in via standard ERP login console');
        setActiveUser(found);
        onAuthSuccess(found);
      } else {
        setError(t.invalidCredentials);
      }
    } else {
      // Sign up
      if (password !== confirmPassword) {
        setError(t.passwordsDoNotMatch);
        return;
      }
      if (!companyName) {
        setError('Please enter your Company Name.');
        return;
      }

      const newTenant: UserTenant = {
        id: 'tenant-' + Math.random().toString(36).substring(2, 9),
        email,
        passwordSha: password,
        companyName,
        currency,
        language: lang,
        taxRate: 5, // Default 5% standard tax
        invoicePrefix: 'INV-',
        invoiceNotes: 'Prepared under standard company operational terms and conditions.',
      };

      const successReg = registerTenant(newTenant);
      if (successReg) {
        setSuccess('Business domain setup successful! Logging you in...');
        logAccess('merchant', newTenant.id, newTenant.companyName, newTenant.email, 'Completed self-onboarding and workspace provisioning');
        setTimeout(() => {
          setActiveUser(newTenant);
          onAuthSuccess(newTenant);
        }, 1200);
      } else {
        setError(t.emailRegistered);
      }
    }
  };

  const isRtl = lang === 'ar' || lang === 'ur';

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 flex flex-col justify-between p-4 sm:p-6 md:p-8"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Bar Language Toggles */}
      <div className="flex flex-wrap justify-between items-center max-w-6xl mx-auto w-full mb-6">
        <div className="flex items-center gap-2 text-indigo-200">
          <Briefcase className="w-6 h-6 text-indigo-400" />
          <span className="font-sans font-bold tracking-tight text-white text-lg">BIZ SUITE</span>
        </div>
        
        {/* Localized Lang Selectors */}
        <div className="glass p-1.5 rounded-full border-white/5 flex items-center gap-1">
          <Languages className="w-4 h-4 text-slate-400 mx-2 animate-pulse" />
          {(['en', 'ar', 'ur', 'hi'] as Language[]).map((ln) => {
            const labelsMap = { en: 'EN', ar: 'العربية', ur: 'اردو', hi: 'हिंदी' };
            return (
              <button
                key={ln}
                onClick={() => handleLanguageSelect(ln)}
                className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  lang === ln 
                    ? 'accent-gradient text-white shadow-md' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {labelsMap[ln]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center max-w-md w-full mx-auto my-auto">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full glass p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden border-indigo-500/25"
        >
          {/* Subtle top light effect */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" />

          {/* Toggle Tab between Staff, Magic Code and Customer Login */}
          <div className="flex bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 mb-6 font-sans">
            <button
              type="button"
              onClick={() => {
                setLoginMode('staff');
                setError('');
                setSuccess('');
                setMatchingAccounts([]);
              }}
              className={`flex-1 py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                loginMode === 'staff' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💼 Staff ERP
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('sharecode');
                setError('');
                setSuccess('');
                setMatchingAccounts([]);
              }}
              className={`flex-1 py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                loginMode === 'sharecode' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔑 Share Code
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('customer');
                setError('');
                setSuccess('');
                setMatchingAccounts([]);
              }}
              className={`flex-1 py-2.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                loginMode === 'customer' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👤 Customer Portal
            </button>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isCustomerLogin ? (
                <>CUSTOMER INBOX / گاہک پورٹل</>
              ) : isShareCodeLogin ? (
                <>SHARE CODE LOGIN / شیئر کوڈ</>
              ) : isLogin ? (
                t.welcomeBack
              ) : (
                t.registerAccount
              )}
            </h1>
            <p className="text-xs text-indigo-400 mt-2 font-medium">
              {isCustomerLogin ? (
                <>Access payments, VAT invoice copies and transaction ledgers instantly.</>
              ) : isShareCodeLogin ? (
                <>Enter the secure alphanumeric OMNI sharecode or Space identifier to join.</>
              ) : (
                t.tagline
              )}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-xs text-red-200 text-center font-bold">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-950/25 border border-emerald-500/35 rounded-xl text-xs text-emerald-200 text-center font-bold">
              {success}
            </div>
          )}

          {matchingAccounts.length > 0 ? (
            /* Choose which workspace the customer wants to log into */
            <div className="space-y-3.5">
              <p className="text-[11px] text-amber-300 font-bold bg-amber-950/25 border border-amber-900/30 p-2.5 rounded-lg text-center">
                Select Business to view Invoices:<br/>ایسے کاروبار کا انتخاب کریں جس کے بل دیکھنا چاہتے ہیں:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {matchingAccounts.map((item) => (
                  <button
                    key={item.customer.id}
                    onClick={() => {
                      setSuccess(`Authenticated with ${item.tenant.companyName}!`);
                      logAccess('customer', item.customer.id, item.customer.name, item.customer.email, `Selected workspace portal of merchant: ${item.tenant.companyName}`);
                      setTimeout(() => {
                        onCustomerAuthSuccess(item.customer, item.tenant);
                      }, 900);
                    }}
                    className="w-full p-3 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-xl flex items-center justify-between transition text-left text-xs text-white cursor-pointer"
                  >
                    <div>
                      <span className="font-extrabold text-sm block">{item.tenant.companyName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">Client Reference: {item.customer.id}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : isShareCodeLogin ? (
            /* Magic Share Code Form */
            <form onSubmit={(e) => {
              e.preventDefault();
              setError('');
              setSuccess('');

              const input = shareCodeInput.trim().toUpperCase();
              if (!input) {
                setError('Please enter a valid short code or Tenant ID. / براہ کرم کوڈ یا اسپیس آئی ڈی درج کریں۔');
                return;
              }

              // Strip prefix OMNI- and TENANT- for comparison
              const cleanInput = input.replace('OMNI-', '').replace('TENANT-', '').toLowerCase();
              const tenants = getTenants();
              const found = tenants.find(t => {
                const cleanId = t.id.replace('tenant-', '').toLowerCase();
                return cleanId === cleanInput || t.id.toLowerCase() === input.toLowerCase();
              });

              if (found) {
                if (found.isActive === false) {
                  setError('The workspace for this share code is deactivated / غیر فعال اکاؤنٹ۔');
                  return;
                }
                setSuccess('🎉 Secure magic code matching! Mounting isolated tenant database namespace...');
                logAccess('merchant', found.id, found.companyName, found.email, `Logged in via Share Code: ${input}`);
                setTimeout(() => {
                  onAuthSuccess(found);
                }, 1000);
              } else {
                setError('Workspace not matches in sandboxed index registry. Please check your spelling. / یہ کوڈ یا اسپیس آئی ڈی ریکارڈ میں موجود نہیں ہے۔');
              }
            }} className="space-y-4 font-sans">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    Secure Workspace Short Code
                  </span>
                  <span className="text-indigo-400 font-urdu font-medium text-[10px]">شیئر یا اسپیس کوڈ</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="E.g., OMNI-DEMO or OMNI-UX6A9R"
                  value={shareCodeInput}
                  onChange={(e) => setShareCodeInput(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm font-mono text-center text-white tracking-widest placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full accent-gradient hover:opacity-90 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-indigo-950/30 mt-2 cursor-pointer uppercase tracking-wider font-mono text-xs"
              >
                Connect Workspace / جوائن کریں →
              </button>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[10px] text-indigo-300/80 leading-relaxed font-sans">
                💡 <strong>Instant Access Integration</strong>:<br />
                Enter any active business partner's share code to instantly clone their viewport container session. Example: <strong>OMNI-DEMO</strong> (auto-linked to demo analytics).
              </div>
            </form>
          ) : isCustomerLogin ? (
            isCustomerRegister ? (
              /* Customer Portal Self-Registration Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="text-center bg-amber-950/20 py-2.5 px-3 rounded-xl border border-amber-900/35 mb-2">
                  <span className="text-amber-400 font-extrabold text-[11px] block">⏳ ONLINE REGISTER & WAIT FOR APPROVAL</span>
                  <p className="text-[10px] text-slate-300 mt-0.5 leading-tight">Your account will require manual merchant activation once registered.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Full Name (مکمل نام) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Al-Farooq Enterprises"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Email Address (ای میل ایڈرس) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="finance@ventures.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    Phone Number (فون نمبر) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+923001234567 or +971501234567"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    Physical Address (پتہ)
                  </label>
                  <input
                    type="text"
                    placeholder="Industrial Zone, Floor 2"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2 text-xs text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    Select Company (کاروبار منتخب کریں) *
                  </label>
                  <select
                    value={selectedTenantId}
                    required
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-2 py-2 text-xs text-slate-200 outline-none"
                  >
                    <option value="" className="bg-slate-950 text-slate-400">-- Choose Merchant Company --</option>
                    {getTenants().map(tenant => (
                      <option key={tenant.id} value={tenant.id} className="bg-slate-950 text-white">
                        {tenant.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all uppercase tracking-wider cursor-pointer mt-1"
                >
                  ✓ Submit Registration / رجسٹریشن کریں
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomerRegister(false);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer"
                  >
                    Already requested? Back to Login (لاگ ان پر واپس جائیں)
                  </button>
                </div>
              </form>
            ) : (
              /* Customer Portal Email/Phone Access form */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Registered Email or Phone Number (ای میل یا فون نمبر) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 flex items-center">
                      <Phone className="w-4 h-4 text-indigo-400" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="E.g., finance@ventures.com or +971501234567"
                      value={customerInput}
                      onChange={(e) => setCustomerInput(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full accent-gradient hover:opacity-90 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg tracking-wider uppercase cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  Access Invoice Portal / گاہک لاگ ان
                </button>

                <div className="flex flex-col gap-2 pt-1">
                  <div className="text-center text-xs">
                    <span className="text-slate-400">New Client? </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomerRegister(true);
                        setError('');
                        setSuccess('');
                      }}
                      className="text-indigo-400 font-black hover:underline cursor-pointer ml-1"
                    >
                      Register profile online / یہاں رجسٹر ہوں
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-900/30 text-[10px] text-indigo-300/80 leading-relaxed">
                  ℹ️ <strong>Demo Simulation Access</strong>:<br />
                  Login using Customer email or phone (e.g., <strong>billing@alkhaleej.ae</strong> or <strong>+971 4 394 1029</strong> loaded with invoices).
                </div>
              </form>
            )
          ) : (
            /* Staff Merchant registration/login form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    {t.companyName}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Apex Retail Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  {t.email}
                </label>
                <input
                  type="email"
                  required
                  placeholder="CEO@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  {t.password}
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-400" />
                      {t.confirmPassword}
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                        {t.currency}
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as Currency)}
                        className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-2.5 py-2 text-xs text-white outline-none transition-all"
                      >
                        <option value="USD" className="bg-slate-950">USD ($)</option>
                        <option value="AED" className="bg-slate-950">AED (د.إ)</option>
                        <option value="PKR" className="bg-slate-950">PKR (Rs)</option>
                        <option value="INR" className="bg-slate-950">INR (₹)</option>
                        <option value="SAR" className="bg-slate-950">SAR (ر.س)</option>
                        <option value="EUR" className="bg-slate-950">EUR (€)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-400" />
                        {t.language}
                      </label>
                      <select
                        value={lang}
                        onChange={(e) => handleLanguageSelect(e.target.value as Language)}
                        className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-2.5 py-2 text-xs text-white outline-none transition-all"
                      >
                        <option value="en" className="bg-slate-950">English</option>
                        <option value="ar" className="bg-slate-950">العربية</option>
                        <option value="ur" className="bg-slate-950">اردو</option>
                        <option value="hi" className="bg-slate-950">हिंदी</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full accent-gradient hover:opacity-90 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all active:scale-[0.98] shadow-lg shadow-indigo-950/30 mt-2 cursor-pointer"
              >
                {isLogin ? t.signIn : t.signUp}
              </button>
            </form>
          )}

          {/* Toggle Button */}
          {loginMode === 'staff' && (
            <div className="mt-6 text-center text-xs text-slate-400 font-sans">
              <span>{isLogin ? t.noAccount : t.alreadyHaveAccount} </span>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-indigo-400 font-bold hover:underline ml-1 cursor-pointer focus:outline-none"
              >
                {isLogin ? t.signUp : t.signIn}
              </button>
            </div>
          )}

          {/* Auto fill hint for demo */}
          {isLogin && loginMode === 'staff' && (
            <div className="mt-4 pt-4 border-t border-slate-800/60 text-center font-sans">
              <p className="text-[10px] text-indigo-300/70">
                💡 Hint: Log in under <strong>demo@business.com</strong> (PW: <strong>demo123</strong>) to explore seed analytics.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-[10px] text-slate-500 max-w-sm mx-auto w-full mt-4">
        © 2026 Complete Business Suite. Fully segregated multitenant environment. All data encrypted in offline client sandboxes.
      </div>
    </div>
  );
}
