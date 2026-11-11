import React, { useState } from 'react';
import { 
  getTenants, 
  registerTenant, 
  setActiveUser, 
  customerLoginLookup, 
  addCustomer, 
  logAccess, 
  getInvoices, 
  editCustomer, 
  resolveTenantByCode, 
  provisionGuestPassTenant,
  getCustomInviteByToken,
  claimCustomInvite,
  pullServerSync
} from '../db';
import { UserTenant, Language, Currency, Customer, CustomInvite } from '../types';
import { translations } from '../translations';
import { loginWithGooglePopup } from '../utils/firebaseAuth';
import { Briefcase, Key, Mail, Building, Globe, Landmark, Languages, Phone, ArrowRight, UserCheck, ShieldAlert, User, MapPin, Sparkles, Clock, CheckCircle2, Zap, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreenProps {
  onAuthSuccess: (user: UserTenant) => void;
  onCustomerAuthSuccess: (customer: Customer, tenant: UserTenant) => void;
  initialLanguage: Language;
  onLanguageChange: (lang: Language) => void;
}

export const LANGUAGE_OPTIONS: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'bn', name: 'Bangali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
];

export default function AuthScreen({ onAuthSuccess, onCustomerAuthSuccess, initialLanguage, onLanguageChange }: AuthScreenProps) {
  const [loginMode, setLoginMode] = useState<'staff' | 'sharecode' | 'customer'>(() => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const type = params.get('type');
      if (mode === 'customer' || mode === 'customer_register' || type === 'customer') {
        return 'customer';
      }
      if (mode === 'sharecode' || params.has('code') || params.has('shortcode') || params.has('sharecode')) {
        return 'sharecode';
      }
    }
    return 'staff';
  });

  const [shareCodeInput, setShareCodeInput] = useState('');
  
  const [isLogin, setIsLogin] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const action = params.get('action');
      if (
        mode === 'register' || 
        mode === 'signup' || 
        action === 'signup' || 
        action === 'register' || 
        params.get('register') === 'true' || 
        params.get('signup') === 'true' ||
        params.has('invite') ||
        params.has('inviteToken') ||
        params.has('token') ||
        params.has('inv')
      ) {
        return false;
      }
    }
    return true;
  });

  const isCustomerLogin = loginMode === 'customer';
  const isShareCodeLogin = loginMode === 'sharecode';
  const [customerInput, setCustomerInput] = useState('');
  
  // Custom customer registration states
  const [isCustomerRegister, setIsCustomerRegister] = useState(() => {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      return mode === 'customer_register' || params.get('customerRegister') === 'true';
    }
    return false;
  });
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // Multi-match company options selection
  const [matchingAccounts, setMatchingAccounts] = useState<{ customer: Customer; tenant: UserTenant }[]>([]);

  // Guest/Walk-in Quick Lookup States
  const [unregisteredMode, setUnregisteredMode] = useState(false);
  const [lookupTenantId, setLookupTenantId] = useState('');
  const [lookupInvoiceNum, setLookupInvoiceNum] = useState('');
  const [lookupWhatsApp, setLookupWhatsApp] = useState('');

  const [email, setEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('biz_suite_language') as Language;
      if (saved && ['en', 'ar', 'ur', 'bn', 'hi'].includes(saved)) {
        return saved;
      }
    }
    return initialLanguage || 'en';
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [activeInvite, setActiveInvite] = useState<CustomInvite | null>(null);

  React.useEffect(() => {
    async function resolveInviteParams() {
      if (typeof window === 'undefined' || !window.location) return;
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get('inviteToken') || params.get('token') || params.get('invite') || params.get('inv');
      
      if (inviteToken) {
        let inv = getCustomInviteByToken(inviteToken);
        if (!inv) {
          try {
            await pullServerSync();
            inv = getCustomInviteByToken(inviteToken);
          } catch (e) {}
        }

        if (inv) {
          if (inv.status === 'active') {
            setActiveInvite(inv);
            if (inv.email) setEmail(inv.email);
            if (inv.companyName) setCompanyName(inv.companyName);
            if (inv.phone) setTenantPhone(inv.phone);
            setIsLogin(false);
            setLoginMode('staff');
          } else if (inv.status === 'expired') {
            setError('⚠️ This invitation link has EXPIRED. Please contact Super Admin Irfan Saeed for a refreshed link.');
          } else if (inv.status === 'revoked') {
            setError('🚫 This invitation link has been revoked by Super Admin.');
          }
        }
      } else if (params.get('action') === 'signup' || params.get('signup') === 'true' || params.get('register') === 'true' || params.get('mode') === 'register' || params.get('mode') === 'signup') {
        setIsLogin(false);
        setLoginMode('staff');
      }
    }
    resolveInviteParams();
  }, []);

  // Password Recovery / Forgotten password states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveredPassword, setRecoveredPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const t = translations[lang];

  const handleLanguageSelect = (selected: Language) => {
    setLang(selected);
    onLanguageChange(selected);
    try {
      localStorage.setItem('biz_suite_language', selected);
    } catch (e) {}
  };

  const handleProceedToLogin = (targetEmail: string, targetPass: string, autoSignIn: boolean = false) => {
    setError('');
    const cleanEmail = targetEmail.trim().toLowerCase();
    const tenantsList = getTenants();
    const found = tenantsList.find(t => 
      t.email.toLowerCase() === cleanEmail && 
      (t.passwordSha === targetPass || !targetPass)
    );

    if (autoSignIn && found) {
      if (found.isActive === false) {
        setError(
          lang === 'ur'
            ? '🚫 آپ کا اکاؤنٹ ایڈمن کی طرف سے بلاک / غیر فعال کر دیا گیا ہے۔'
            : lang === 'ar'
            ? '🚫 تم حظر حسابك أو إلغاء تنشيطه بواسطة المسؤول.'
            : lang === 'bn'
            ? '🚫 আপনার অ্যাকাউন্টটি অ্যাডমিন দ্বারা নিষ্ক্রিয় করা হয়েছে।'
            : lang === 'hi'
            ? '🚫 आपका खाता व्यवस्थापक द्वारा निष्क्रिय कर दिया गया है।'
            : '🚫 Your account has been blocked or deactivated by Super Admin. Please contact support.'
        );
        return;
      }
      if (found.isApproved === false && found.email.toLowerCase() !== 'irfanksaeed@gmail.com') {
        setError(
          lang === 'ur'
            ? '⏳ آپ کا اکاؤنٹ ایڈمن منظوری کے منتظر ہے۔'
            : lang === 'ar'
            ? '⏳ حسابك قيد انتظار موافقة المسؤول.'
            : '⏳ Your account is awaiting admin approval.'
        );
        return;
      }

      found.lastLoginTime = new Date().toISOString();
      const foundIdx = tenantsList.findIndex(t => t.id === found.id);
      if (foundIdx !== -1) {
        tenantsList[foundIdx].lastLoginTime = found.lastLoginTime;
        localStorage.setItem('biz_suite_tenants', JSON.stringify(tenantsList));
      }

      logAccess('merchant', found.id, found.companyName, found.email, 'Logged in after password recovery/reset');
      setActiveUser(found);
      onAuthSuccess(found);
      return;
    }

    // Switch to standard login view with pre-filled credentials
    setEmail(found ? found.email : targetEmail);
    setPassword(targetPass || (found ? found.passwordSha : ''));
    setIsLogin(true);
    setIsForgotPassword(false);
    setSuccess(
      lang === 'ur'
        ? '✓ لاگ ان کی تفصیلات درج ہو گئیں۔ آگے بڑھنے کے لیے سائن ان پر کلک کریں۔'
        : lang === 'ar'
        ? '✓ تم ملء بيانات الدخول تلقائياً. اضغط على تسجيل الدخول للمتابعة.'
        : '✓ Login credentials pre-filled. Click Sign In to continue.'
    );
  };

  const handleGoogleAuth = async () => {
    setError('');
    setSuccess('');
    setIsGoogleLoading(true);
    try {
      const googleUser = await loginWithGooglePopup();
      
      if (isCustomerLogin) {
        // Customer Portal Google login
        const matches = customerLoginLookup(googleUser.email);
        if (matches.length === 0) {
          // Auto pre-fill registration with Google info
          setIsCustomerRegister(true);
          setRegEmail(googleUser.email);
          setRegName(googleUser.displayName || '');
          setSuccess(`Google Account linked (${googleUser.email})! Please complete the registration details.`);
          return;
        }

        const allPending = matches.every(m => m.customer.isApproved === false);
        if (allPending) {
          setError('⏳ Registration Pending: Your account linked with this Google email is awaiting merchant approval.');
          return;
        }

        const approvedMatches = matches.filter(m => m.customer.isApproved !== false);
        if (approvedMatches.length === 0) {
          setError('⏳ Registration Pending: Please wait for merchant approval.');
          return;
        }

        if (approvedMatches.length === 1) {
          const match = approvedMatches[0];
          if (match.customer.isBlocked) {
            setError('⚠️ This customer account index has been deactivated or blocked');
            return;
          }
          const updatedCustomer = {
            ...match.customer,
            lastLoginTime: new Date().toISOString()
          };
          try {
            editCustomer(match.tenant.id, updatedCustomer);
          } catch (e) {}
          logAccess('customer', match.customer.id, match.customer.name, match.customer.email, `Logged in via Google Account (${googleUser.email})`);
          setSuccess(`✅ Google Verified! Welcome, ${match.customer.name}!`);
          setTimeout(() => {
            onCustomerAuthSuccess(updatedCustomer, match.tenant);
          }, 600);
        } else {
          setMatchingAccounts(approvedMatches.filter(m => !m.customer.isBlocked));
        }
      } else {
        // Staff / Merchant / Business Workspace Google login
        const tenants = getTenants();
        const existing = tenants.find(t => t.email.toLowerCase() === googleUser.email.toLowerCase());
        
        if (existing) {
          if (existing.isActive === false) {
            setError('🚫 This business workspace is deactivated. Please contact Super Admin.');
            return;
          }
          if (existing.isApproved === false) {
            setError('⏳ This business account is awaiting approval by Super Admin Irfan Saeed.');
            return;
          }
          existing.lastLoginTime = new Date().toISOString();
          const foundIdx = tenants.findIndex(t => t.id === existing.id);
          if (foundIdx !== -1) {
            tenants[foundIdx].lastLoginTime = existing.lastLoginTime;
            localStorage.setItem('biz_suite_tenants', JSON.stringify(tenants));
          }
          logAccess('merchant', existing.id, existing.companyName, existing.email, `Logged in with Google Account (${googleUser.email})`);
          setSuccess(`🎉 Google Verified! Welcome back, ${existing.companyName}!`);
          setTimeout(() => {
            setActiveUser(existing);
            onAuthSuccess(existing);
          }, 500);
        } else {
          // New Google User registration:
          // Immediately create record in database so user details appear in Admin Panel!
          const newGoogleTenant: UserTenant = {
            id: 'tenant-' + Math.random().toString(36).substring(2, 9),
            email: googleUser.email.toLowerCase(),
            passwordSha: 'google-oauth-' + Math.random().toString(36).substring(2, 8),
            companyName: (googleUser.displayName || 'Google Business User').trim(),
            phone: '',
            currency: currency || 'USD',
            language: lang,
            taxRate: 5,
            invoicePrefix: 'INV-',
            invoiceNotes: 'Prepared under standard company operational terms and conditions.',
            subscriptionExpiry: activeInvite ? activeInvite.expiresAt : undefined,
            allowedHoursStart: activeInvite?.allowedHoursStart,
            allowedHoursEnd: activeInvite?.allowedHoursEnd,
            isApproved: activeInvite ? true : false, // Pending Super Admin approval unless pre-approved VIP invite
            isActive: true,
            subscriptionStatus: 'active',
            createdAt: new Date().toISOString()
          };

          const regRes = registerTenant(newGoogleTenant, !!activeInvite);
          if (regRes.success) {
            if (activeInvite) {
              claimCustomInvite(activeInvite.id, newGoogleTenant.id);
              logAccess('merchant', newGoogleTenant.id, newGoogleTenant.companyName, newGoogleTenant.email, `VIP Workspace Activated with Google (${googleUser.email})`);
              setSuccess('🎉 VIP Workspace Activated with Google! Launching dashboard...');
              setTimeout(() => {
                setActiveUser(newGoogleTenant);
                onAuthSuccess(newGoogleTenant);
              }, 600);
            } else {
              logAccess('merchant', newGoogleTenant.id, newGoogleTenant.companyName, newGoogleTenant.email, `New Google user registered: ${googleUser.email} (Pending Admin Approval)`);
              setSuccess(
                lang === 'ur'
                  ? `🎉 آپ کا گوگل اکاؤنٹ (${googleUser.email}) رجسٹر ہو گیا ہے اور ایڈمن پینل میں موصول ہو چکا ہے!\nایڈمن (عرفان سعید) کے پاس کنٹرول ہے۔ ایڈمن کی منظوری کے بعد آپ اسی گوگل اکاؤنٹ سے لاگ اِن کر سکیں گے۔`
                  : `🎉 Google account registered (${googleUser.email})! Your details are now recorded in the Admin Panel. Waiting for Super Admin approval before you can access the platform.`
              );
            }
          } else {
            setError(regRes.error || 'Registration failed. Please contact admin.');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleCustomerLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setMatchingAccounts([]);

    if (!customerInput.trim()) {
      setError('Please enter your email address or phone number');
      return;
    }

    const matches = customerLoginLookup(customerInput);
    if (matches.length === 0) {
      setError('No customer account found with this email or phone number in database');
      return;
    }

    // Check if matching account is pending approval
    const allPending = matches.every(m => m.customer.isApproved === false);
    if (allPending) {
      setError('⏳ Registration Pending Approval: Your account has been received and is awaiting approval by the business merchant.');
      return;
    }

    // Filter out unapproved matches from general login sequence
    const approvedMatches = matches.filter(m => m.customer.isApproved !== false);
    if (approvedMatches.length === 0) {
      setError('⏳ Registration Pending Approval: Please wait for the merchant to approve your self-service registration.');
      return;
    }

    // Filter blocked ones to verify straight away or count
    const allBlocked = approvedMatches.every(m => m.customer.isBlocked === true);
    if (allBlocked) {
      setError('⚠️ Access Suspended: Your customer portal access has been blocked by the merchant');
      return;
    }

    if (approvedMatches.length === 1) {
      const match = approvedMatches[0];
      if (match.customer.isBlocked) {
        setError('⚠️ This customer account index has been deactivated or blocked');
        return;
      }
      
      // Update last login time
      const updatedCustomer = {
        ...match.customer,
        lastLoginTime: new Date().toISOString()
      };
      try {
        editCustomer(match.tenant.id, updatedCustomer);
      } catch (err) {
        console.error("Failed to update customer login time:", err);
      }

      logAccess('customer', match.customer.id, match.customer.name, match.customer.email, `Logged in to view portal with merchant: ${match.tenant.companyName}`);
      setSuccess('Customer session authenticated successfully! Loading receipts...');
      setTimeout(() => {
        onCustomerAuthSuccess(updatedCustomer, match.tenant);
      }, 1000);
    } else {
      // Multiple businesses matching this customer email or phone
      const activeMatches = approvedMatches.filter(m => !m.customer.isBlocked);
      if (activeMatches.length === 0) {
        setError('⚠️ Your profiles are blocked across linked corporate accounts');
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
      setError('Please fill in all required fields');
      return;
    }

    try {
      addCustomer(selectedTenantId, {
        name: regName.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        address: regAddress.trim(),
        isBlocked: false,
        isApproved: false, // Customer registrations strictly require merchant / admin approval
      });

      setSuccess(
        lang === 'ur'
          ? '🎉 رجسٹریشن موصول ہو گئی! آپ کا کسٹمر اکاؤنٹ بزنس اونر / ایڈمن کی منظوری کے لیے بھیج دیا گیا ہے۔ منظوری کے بعد آپ لاگ اِن کر سکیں گے۔'
          : '🎉 Registration submitted! Your customer portal account is pending business merchant approval.'
      );
      
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

  const handleUnregisteredCustomerLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!lookupTenantId) {
      setError('Please select the merchant business company');
      return;
    }
    if (!lookupInvoiceNum.trim()) {
      setError('Please enter the Invoice Number');
      return;
    }
    if (!lookupWhatsApp.trim()) {
      setError('Please enter your WhatsApp or Phone number to authenticate');
      return;
    }

    const invoices = getInvoices(lookupTenantId);
    const matched = invoices.find(
      inv => inv.invoiceNumber.trim().toLowerCase() === lookupInvoiceNum.trim().toLowerCase()
    );

    if (!matched) {
      setError('No matching invoice found with this number for the selected merchant.');
      return;
    }

    const tenants = getTenants();
    const tenant = tenants.find(t => t.id === lookupTenantId);

    if (!tenant) {
      setError('Company configurations error. Please retry.');
      return;
    }

    // Dynamic guest customer construction
    const guestCustomer: Customer = {
      id: 'guest-' + matched.id,
      tenantId: lookupTenantId,
      name: matched.customerName || 'Walk-In Customer',
      email: 'unregistered@portal.guest',
      phone: lookupWhatsApp.trim(),
      address: 'Unregistered / Walk-In Account',
      createdAt: matched.createdAt,
      isApproved: true,
    };

    logAccess('customer', guestCustomer.id, guestCustomer.name, 'Unregistered', `Accessed Invoice ${matched.invoiceNumber} with WhatsApp ${lookupWhatsApp.trim()}`);
    setSuccess('Invoice matched successfully! Routing guest portal...');

    setTimeout(() => {
      onCustomerAuthSuccess(guestCustomer, tenant);
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (isCustomerLogin) {
      if (unregisteredMode) {
        handleUnregisteredCustomerLookup(e);
      } else if (isCustomerRegister) {
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
      const submitted = email.trim().toLowerCase();
      const cleanSubmitted = submitted.replace(/[^\d+]/g, '');

      const found = tenants.find(u => {
        const registeredEmail = u.email.toLowerCase();
        const registeredPhone = (u.phone || '').trim().replace(/[^\d+]/g, '');

        const emailMatches = registeredEmail === submitted;
        const phoneMatches = registeredPhone.length > 0 && cleanSubmitted.length > 0 && (registeredPhone === cleanSubmitted || registeredPhone.endsWith(cleanSubmitted) || cleanSubmitted.endsWith(registeredPhone));

        return (emailMatches || phoneMatches) && u.passwordSha === password;
      });

      if (found) {
        if (found.isApproved === false) {
          setError(
            lang === 'ur'
              ? '⏳ آپ کی رجسٹریشن سپر ایڈمن (عرفان سعید) کی منظوری کے لیے زیر التواء ہے۔ منظوری کے بعد آپ لاگ اِن کر سکیں گے۔'
              : lang === 'ar'
              ? '⏳ تسجيلك قيد موافقة المشرف العام (عرفان سعيد). ستتمكن من تسجيل الدخول فور الموافقة.'
              : lang === 'bn'
              ? '⏳ আপনার নিবন্ধনটি সুপার অ্যাডমিনের (عرفان سعید) অনুমোদনের অপেক্ষায় রয়েছে। অনুমোদনের পর আপনি লগ ইন করতে পারবেন।'
              : lang === 'hi'
              ? '⏳ आपका पंजीकरण सुपर व्यवस्थापक की मंजूरी के लिए लंबित है। मंजूरी मिलने के बाद आप लॉग इन कर सकेंगे।'
              : '⏳ Your registration is pending Super Admin APPROVAL before you can access the platform. Please contact Irfan at irfanksaeed@gmail.com.'
          );
          return;
        }
        if (found.isActive === false) {
          setError(
            lang === 'ur'
              ? '🚫 آپ کا اکاؤنٹ سپر ایڈمن کی جانب سے بلاک / معطل کر دیا گیا ہے۔ بحالی کے لیے ایڈمن سے رابطہ کریں۔'
              : lang === 'ar'
              ? '🚫 تم قفل حسابك بواسطة المشرف العام. يرجى التواصل مع الدعم لفك الحظر.'
              : lang === 'bn'
              ? '🚫 আপনার অ্যাকাউন্টটি সুপার অ্যাডমিন কর্তৃক ব্লক / নিষ্ক্রিয় করা হয়েছে। পুনরায় সক্রিয় করতে যোগাযোগ করুন।'
              : lang === 'hi'
              ? '🚫 आपका खाता सुपर एडमिन द्वारा ब्लॉक / निष्क्रिय कर दिया गया है। सहायता के लिए संपर्क करें।'
              : '🚫 Your account has been BLOCKED or deactivated by Super Admin. Please contact support.'
          );
          return;
        }
        // Save last login time
        found.lastLoginTime = new Date().toISOString();
        const tenantsList = getTenants();
        const foundIdx = tenantsList.findIndex(t => t.id === found.id);
        if (foundIdx !== -1) {
          tenantsList[foundIdx].lastLoginTime = found.lastLoginTime;
          localStorage.setItem('biz_suite_tenants', JSON.stringify(tenantsList));
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
        email: email.trim().toLowerCase(),
        passwordSha: password,
        companyName: companyName.trim(),
        phone: tenantPhone.trim(),
        currency,
        language: lang,
        taxRate: 5, // Default 5% standard tax
        invoicePrefix: 'INV-',
        invoiceNotes: 'Prepared under standard company operational terms and conditions.',
        subscriptionExpiry: activeInvite ? activeInvite.expiresAt : undefined,
        allowedHoursStart: activeInvite?.allowedHoursStart,
        allowedHoursEnd: activeInvite?.allowedHoursEnd,
        isApproved: activeInvite ? true : false,
        isActive: true,
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString()
      };

      const regResult = registerTenant(newTenant, !!activeInvite);
      if (regResult.success) {
        if (activeInvite) {
          claimCustomInvite(activeInvite.id, newTenant.id);
        }
        if (regResult.requiresApproval) {
          setSuccess(
            lang === 'ur'
              ? '🎉 رجسٹریشن موصول ہو گئی! آپ کی تفصیلات ایڈمن پینل میں ظاہر ہو چکی ہیں۔ ایڈمن (عرفان سعید) کے پاس مکمل کنٹرول ہے۔ جیسے ہی ایڈمن آپ کے اکاؤنٹ کی منظوری دے گا، آپ اسی ای میل اور پاس ورڈ سے لاگ اِن کر سکیں گے۔'
              : lang === 'ar'
              ? '🎉 تم استلام طلب التسجيل بنجاح! بياناتك مسجلة في لوحة تحكم المشرف العام. ستتمكن من الدخول فور موافقة المشرف.'
              : lang === 'bn'
              ? '🎉 নিবন্ধন সম্পন্ন হয়েছে! আপনার অ্যাকাউন্টের বিবরণ অ্যাডমিন প্যানেলে সংরক্ষিত হয়েছে। সুপার অ্যাডমিনের (عرفان سعید) অনুমোদনের পর আপনি এই ইমেল ও পাসওয়ার্ড দিয়ে লগ ইন করতে পারবেন।'
              : lang === 'hi'
              ? '🎉 पंजीकरण प्राप्त हुआ! आपका विवरण एडमिन पैनल में दर्ज हो गया है। सुपर एडमिन की मंजूरी के बाद आप लॉगिन कर सकेंगे।'
              : '🎉 Registration received! Your profile details are now visible in the Admin Panel. Waiting for Super Admin Irfan Saeed to approve your access.'
          );
          logAccess('merchant', newTenant.id, newTenant.companyName, newTenant.email, `New user registered via Email: ${newTenant.email} (Pending Admin Approval)`);
          setTimeout(() => {
            setIsLogin(true);
            setSuccess('');
          }, 4500);
        } else {
          setSuccess(
            lang === 'ur'
              ? '🎉 رجسٹریشن کامیاب! آپ کا ورک اسپیس تیار ہو رہا ہے...'
              : lang === 'ar'
              ? '🎉 نجح التسجيل! يتم الآن تجهيز مساحة العمل الخاصة بك...'
              : '🎉 Registration successful! Setting up your workspace and logging you in...'
          );
          logAccess('merchant', newTenant.id, newTenant.companyName, newTenant.email, 'Completed self-onboarding and workspace provisioning');
          setTimeout(() => {
            setActiveUser(newTenant);
            onAuthSuccess(newTenant);
          }, 1000);
        }
      } else {
        setError(t.emailRegistered || 'This email is already registered in the system.');
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
      <div className="flex flex-wrap justify-between items-center max-w-6xl mx-auto w-full mb-4 sm:mb-6 gap-3">
        <div className="flex items-center gap-2.5 text-indigo-200">
          <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-xl shadow-md">
            <Briefcase className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <span className="font-sans font-black tracking-tight text-white text-lg block leading-tight">BIZ SUITE</span>
            <span className="text-[10px] text-indigo-300 font-mono tracking-wider">OMNI ENTERPRISE ERP</span>
          </div>
        </div>
        
        {/* Localized Lang Selectors */}
        <div className="glass p-1 rounded-full border-white/10 flex items-center gap-1 shadow-md overflow-x-auto max-w-full">
          <Languages className="w-4 h-4 text-indigo-300 mx-2 animate-pulse shrink-0" />
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => handleLanguageSelect(opt.code)}
              className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                lang === opt.code 
                  ? 'accent-gradient text-white shadow-md font-bold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title={`${opt.name} (${opt.nativeName})`}
            >
              <span>{opt.flag}</span>
              <span>{opt.nativeName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full mx-auto my-auto">
        {/* Prominent Multi-Language Selector at the Start of Application */}
        <div className="w-full mb-3.5">
          <div className="bg-slate-950/85 backdrop-blur-md p-3 rounded-2xl border border-indigo-500/35 shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-2 mb-2 border-b border-indigo-900/40">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>
                  {lang === 'ar' 
                    ? 'اختر لغتك المفضلة' 
                    : lang === 'ur' 
                    ? 'اپنی زبان منتخب کریں' 
                    : lang === 'bn' 
                    ? 'আপনার ভাষা নির্বাচন করুন' 
                    : lang === 'hi' 
                    ? 'अपनी भाषा चुनें' 
                    : 'Choose Your Language'}
                </span>
              </span>
              <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                5 Languages Available
              </span>
            </div>

            {/* 5 Language Buttons Grid */}
            <div className="grid grid-cols-5 gap-1.5">
              {LANGUAGE_OPTIONS.map((opt) => {
                const isSelected = lang === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => handleLanguageSelect(opt.code)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 cursor-pointer text-center relative ${
                      isSelected
                        ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-lg ring-2 ring-indigo-400 scale-[1.03]'
                        : 'bg-slate-900/90 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 hover:border-indigo-500/40'
                    }`}
                  >
                    <span className="text-base leading-none mb-0.5">{opt.flag}</span>
                    <span className="text-[11px] font-bold leading-tight truncate max-w-full">{opt.nativeName}</span>
                    <span className="text-[8px] opacity-75 font-mono uppercase mt-0.5">{opt.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full glass p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden border-indigo-500/25"
        >
          {/* Subtle top light effect */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent animate-pulse" />

          {/* Strict Authentication Switch: Staff / Admin ERP vs Customer Portal */}
          <div className="grid grid-cols-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800 mb-4 font-sans gap-1">
            <button
              type="button"
              onClick={() => {
                setLoginMode('staff');
                setError('');
                setSuccess('');
                setMatchingAccounts([]);
              }}
              className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer truncate px-2 flex items-center justify-center gap-1.5 ${
                loginMode === 'staff' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💼 Staff & Admin ERP
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMode('customer');
                setError('');
                setSuccess('');
                setMatchingAccounts([]);
              }}
              className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer truncate px-2 flex items-center justify-center gap-1.5 ${
                loginMode === 'customer' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👤 Customer Portal
            </button>
          </div>

          {/* Strict Security Policy Notice */}
          <div className="mb-4 bg-indigo-950/50 border border-indigo-500/35 rounded-xl p-2.5 flex items-center gap-2 text-left">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-[10px] text-indigo-200 leading-tight">
              {lang === 'ur'
                ? 'ای میل لاگ اِن لازمی ہے • ہر نیا صارف ایڈمن پینل میں ظاہر ہو گا اور ایڈمن کی منظوری کے بعد رسائی ملے گی'
                : 'Email Login Required • All new user registrations are audited and controlled by Super Admin.'}
            </p>
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isCustomerLogin ? (
                <>CUSTOMER INBOX</>
              ) : isShareCodeLogin ? (
                <>SHARE CODE LOGIN</>
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
                Select Business to view Invoices:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {matchingAccounts.map((item) => (
                  <button
                    key={item.customer.id}
                    onClick={() => {
                      setSuccess(`Authenticated with ${item.tenant.companyName}!`);
                      
                      const updatedCustomer = {
                        ...item.customer,
                        lastLoginTime: new Date().toISOString()
                      };
                      try {
                        editCustomer(item.tenant.id, updatedCustomer);
                      } catch (err) {
                        console.error("Failed to save customer login trace:", err);
                      }

                      logAccess('customer', item.customer.id, item.customer.name, item.customer.email, `Selected workspace portal of merchant: ${item.tenant.companyName}`);
                      setTimeout(() => {
                        onCustomerAuthSuccess(updatedCustomer, item.tenant);
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

              const input = shareCodeInput.trim();
              if (!input) {
                setError('Please enter a valid short code or Tenant ID.');
                return;
              }

              const found = resolveTenantByCode(input, getTenants());

              if (found) {
                if (found.isApproved === false) {
                  setError('This workspace is pending Super Admin APPROVAL before it can be accessed.');
                  return;
                }
                if (found.isActive === false) {
                  setError('The workspace for this share code is deactivated');
                  return;
                }
                // Save last login time
                found.lastLoginTime = new Date().toISOString();
                const tenantsList = getTenants();
                const foundIdx = tenantsList.findIndex(t => t.id === found.id);
                if (foundIdx !== -1) {
                  tenantsList[foundIdx].lastLoginTime = found.lastLoginTime;
                  localStorage.setItem('biz_suite_tenants', JSON.stringify(tenantsList));
                }

                setSuccess('🎉 Secure magic code matching! Mounting isolated tenant database namespace...');
                logAccess('merchant', found.id, found.companyName, found.email, `Logged in via Share Code: ${input}`);
                setTimeout(() => {
                  onAuthSuccess(found);
                }, 1000);
              } else {
                setError('Workspace not matched in sandboxed registry. Please verify spelling or code.');
              }
            }} className="space-y-4 font-sans">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    Secure Workspace Short Code
                  </span>
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
                Connect Workspace →
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
                    Full Name *
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
                    Email Address *
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
                    Phone Number *
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
                    Physical Address
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
                    Select Company *
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
                  ✓ Submit Registration
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
                    Already requested? Back to Login
                  </button>
                </div>
              </form>
            ) : (
              /* Customer Portal Form Group */
              <div className="space-y-4">
                {/* Sub tabs: Registered Client vs Unregistered Walk-in */}
                <div className="flex bg-slate-950/40 p-1 rounded-lg border border-slate-900 mb-4 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setUnregisteredMode(false);
                      setError('');
                    }}
                    className={`flex-1 py-1.5 rounded transition cursor-pointer ${
                      !unregisteredMode 
                        ? 'bg-slate-800 text-white font-black border border-slate-700' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🔐 Registered Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnregisteredMode(true);
                      setError('');
                    }}
                    className={`flex-1 py-1.5 rounded transition cursor-pointer ${
                      unregisteredMode 
                        ? 'bg-slate-800 text-white font-black border border-slate-700' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🚶 Walk-In / Unregistered
                  </button>
                </div>

                {!unregisteredMode ? (
                  /* Customer Portal Email/Phone Access form */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Google Sign-in for Customer Portal */}
                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={isGoogleLoading}
                      className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2.5 transition shadow-md border border-slate-200 cursor-pointer disabled:opacity-60"
                    >
                      {isGoogleLoading ? (
                        <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                        </svg>
                      )}
                      <span>
                        {isGoogleLoading
                          ? 'Connecting Google...'
                          : (lang === 'ur' ? 'گوگل اکاؤنٹ سے لاگ اِن کریں' : lang === 'ar' ? 'الدخول باستخدام Google' : 'Sign in with Google Account')}
                      </span>
                    </button>

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-slate-800"></div>
                      <span className="flex-shrink mx-3 text-[10px] uppercase font-mono tracking-wider text-slate-500">
                        {lang === 'ur' ? 'یا ای میل / فون نمبر سے' : lang === 'ar' ? 'أو عبر البريد / الهاتف' : 'or enter email / phone'}
                      </span>
                      <div className="flex-grow border-t border-slate-800"></div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">
                        Registered Email or Phone Number *
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
                      Access Invoice Portal
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
                          Register profile online
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-950/30 rounded-xl border border-indigo-900/30 text-[10px] text-indigo-300/80 leading-relaxed">
                      ℹ️ <strong>Demo Simulation Access</strong>:<br />
                      Login using Customer email or phone (e.g., <strong>billing@alkhaleej.ae</strong> or <strong>+971 4 394 1029</strong> loaded with invoices).
                    </div>
                  </form>
                ) : (
                  /* Walk-In / Unregistered Guest Invoice Look up Form */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-400" />
                        Select Merchant Company *
                      </label>
                      <select
                        value={lookupTenantId}
                        required
                        onChange={(e) => setLookupTenantId(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
                      >
                        <option value="" className="bg-slate-950 text-slate-400">-- Choose Company --</option>
                        {getTenants().map(tenant => (
                          <option key={tenant.id} value={tenant.id} className="bg-slate-950 text-white">
                            {tenant.companyName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 font-sans">
                        Invoice Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="E.g., INV-2026-1002"
                        value={lookupInvoiceNum}
                        onChange={(e) => setLookupInvoiceNum(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition-all font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-indigo-400" />
                        Your Manual WhatsApp Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="E.g., +971501234567"
                        value={lookupWhatsApp}
                        onChange={(e) => setLookupWhatsApp(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition-all font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:opacity-95 text-white font-black py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg tracking-wider uppercase cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      Verify & Access Invoice
                    </button>

                    <div className="p-2.5 bg-emerald-950/25 border border-emerald-900/30 text-[10px] text-emerald-300 leading-relaxed rounded-xl font-sans">
                      ℹ️ <strong>Quick Account Lookup</strong>:<br />
                      Quickly lookup walk-in billing records. We will authenticate your manual WhatsApp details dynamically of any system billings.
                    </div>
                  </form>
                )}
              </div>
            )
          ) : isForgotPassword ? (
            /* Forgot Password / Password Recovery Form for Staff Tenants */
            <form onSubmit={(e) => {
              e.preventDefault();
              setError('');
              setSuccess('');
              setRecoveredPassword('');
              
              const searchKey = forgotEmail.trim().toLowerCase();
              const cleanSearchKey = searchKey.replace(/[^\d+]/g, '');

              if (!searchKey) {
                setError(
                  lang === 'ur' 
                    ? 'براہ کرم اپنا ای میل یا فون نمبر درج کریں۔' 
                    : lang === 'ar' 
                    ? 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف.' 
                    : lang === 'bn'
                    ? 'অনুগ্রহ করে আপনার ইমেল বা ফোন নম্বর লিখুন।'
                    : lang === 'hi'
                    ? 'कृपया अपना ईमेल या फ़ोन नंबर दर्ज करें।'
                    : 'Please enter your email or phone number.'
                );
                return;
              }

              const tenants = getTenants();
              const foundIndex = tenants.findIndex(u => {
                const registeredEmail = u.email.toLowerCase();
                const registeredPhone = (u.phone || '').trim().replace(/[^\d+]/g, '');
                
                const emailMatches = registeredEmail === searchKey;
                const phoneMatches = registeredPhone.length > 0 && cleanSearchKey.length > 0 && (registeredPhone === cleanSearchKey || registeredPhone.endsWith(cleanSearchKey) || cleanSearchKey.endsWith(registeredPhone));

                return emailMatches || phoneMatches;
              });

              if (foundIndex !== -1) {
                const matchedTenant = tenants[foundIndex];
                const activePass = matchedTenant.passwordSha || 'N/A';
                setRecoveredPassword(activePass);
                // Store their email so update function matches correctly
                setForgotEmail(matchedTenant.email);
                setSuccess(
                  lang === 'ur'
                    ? '🔐 اکاؤنٹ مل گیا! نیچے دیے گئے بٹن سے فوری لاگ ان کریں یا نیا پاس ورڈ سیٹ کریں۔'
                    : lang === 'ar' 
                    ? '🔐 تم العثور على الحساب! يمكنك تسجيل الدخول أدناه أو تعديل كلمة المرور.'
                    : lang === 'bn'
                    ? '🔐 অ্যাকাউন্ট পাওয়া গেছে! নিচে সরাসরি লগ ইন করুন অথবা পাসওয়ার্ড পরিবর্তন করুন।'
                    : lang === 'hi'
                    ? '🔐 खाता मिल गया! नीचे सीधे लॉगिन करें या नया पासवर्ड सेट करें।'
                    : '🔐 Account detected! Log in directly below or update your password.'
                );
              } else {
                setError(
                  lang === 'ur'
                    ? '❌ یہ ای میل یا فون نمبر سسٹم میں رجسٹرڈ نہیں ہے۔ براہ کرم دوبارہ کوشش کریں یا ایڈمن عرفان سے رابطہ کریں۔'
                    : lang === 'ar' 
                    ? '❌ هذا الحساب غير مسجل في النظام. يرجى المحاولة مرة أخرى أو الاتصال بـ عرفان.'
                    : lang === 'bn'
                    ? '❌ এই ইমেল বা ফোন নম্বরটি নিবন্ধিত নয়। পুনরায় চেষ্টা করুন বা অ্যাডমিনের সাথে যোগাযোগ করুন।'
                    : lang === 'hi'
                    ? '❌ यह ईमेल या फ़ोन नंबर पंजीकृत नहीं है। कृपया पुन: प्रयास करें।'
                    : '❌ Email/Phone number not registered in system index. Please try again or contact Admin.'
                );
              }
            }} className="space-y-4 font-sans">
              <div className="space-y-1.5 text-center">
                <span className="text-xs text-amber-400 font-extrabold uppercase tracking-widest block bg-amber-950/30 py-1.5 px-2 rounded-lg border border-amber-500/20">
                  {lang === 'ur' ? '⚠️ پاس ورڈ بازیافت اور لاگ ان' : lang === 'ar' ? '⚠️ استعادة كلمة المرور والدخول' : lang === 'bn' ? '⚠️ পাসওয়ার্ড পুনরুদ্ধার ও লগইন' : lang === 'hi' ? '⚠️ पासवर्ड पुनर्प्राप्ति और लॉगिन' : '⚠️ Password Retrieval & Direct Login'}
                </span>
                <p className="text-[11px] text-slate-300 mt-1 leading-normal">
                  {lang === 'ur' 
                    ? 'اپنا رجسٹرڈ ای میل یا فون نمبر درج کریں تاکہ پاس ورڈ فوری حاصل اور تبدیل کر کے لاگ ان کر سکیں۔' 
                    : lang === 'ar' 
                    ? 'أدخل البريد الإلكتروني المسجل أو رقم الهاتف لاسترداد كلمة المرور وتعديلها وتسجيل الدخول فوراً.'
                    : lang === 'bn'
                    ? 'আপনার নিবন্ধিত ইমেল বা ফোন নম্বর লিখুন এবং পাসওয়ার্ড পুনরুদ্ধার করে লগইন করুন।'
                    : lang === 'hi'
                    ? 'अपना पंजीकृत ईमेल या फ़ोन नंबर दर्ज करें और तुरंत पासवर्ड प्राप्त करके लॉगिन करें।'
                    : 'Enter your registered business account email or phone number to retrieve your password and sign in instantly.'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  {lang === 'ur' ? 'رجسٹرڈ ای میل یا فون نمبر' : lang === 'ar' ? 'البريد الإلكتروني أو رقم الهاتف المسجل' : lang === 'bn' ? 'নিবন্ধিত ইমেল বা ফোন নম্বর' : lang === 'hi' ? 'पंजीकृत ईमेल या फ़ोन नंबर' : 'Registered Email or Phone Number'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'ur' ? 'مثال: +923001234567 یا user@business.com' : lang === 'ar' ? 'مثال: +971501234567 أو CEO@business.com' : 'E.g., +971501234567 or CEO@business.com'}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              {recoveredPassword && (
                <div className="space-y-3.5 p-4 bg-indigo-950/70 border border-indigo-500/40 rounded-2xl text-center shadow-xl animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-900/50">
                    <span className="text-[11px] font-bold text-indigo-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      {lang === 'ur' ? 'اکاؤنٹ کا فعال پاس ورڈ:' : lang === 'ar' ? 'كلمة مرور الحساب الحالية:' : lang === 'bn' ? 'অ্যাকাউন্টের পাসওয়ার্ড:' : lang === 'hi' ? 'खाता पासवर्ड:' : 'Current Account Password:'}
                    </span>
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      {lang === 'ur' ? 'تصدیق شدہ' : lang === 'ar' ? 'تم التحقق' : 'Verified'}
                    </span>
                  </div>

                  <div className="py-2.5 px-3 bg-black/60 rounded-xl border border-emerald-500/25 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-mono truncate max-w-[180px]">
                      {forgotEmail}
                    </span>
                    <strong className="text-emerald-300 text-sm tracking-wider select-all font-mono bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                      {recoveredPassword}
                    </strong>
                  </div>

                  {/* PROMINENT DIRECT LOGIN BUTTONS ON THIS EXACT PAGE */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleProceedToLogin(forgotEmail, recoveredPassword, true)}
                      className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>
                        {lang === 'ur' 
                          ? '🔑 اسی پاس ورڈ سے براہ راست لاگ ان کریں (1-Click)' 
                          : lang === 'ar' 
                          ? '🔑 تسجيل الدخول الفوري بهذه الكلمة' 
                          : lang === 'bn' 
                          ? '🔑 এই পাসওয়ার্ড দিয়ে সরাসরি লগ ইন করুন' 
                          : lang === 'hi' 
                          ? '🔑 इस पासवर्ड से अभी लॉगिन करें' 
                          : '🔑 Log In With This Password (1-Click)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleProceedToLogin(forgotEmail, recoveredPassword, false)}
                      className="w-full bg-indigo-900/50 hover:bg-indigo-900/80 border border-indigo-700/50 text-indigo-200 hover:text-white font-bold py-2.5 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>
                        {lang === 'ur' 
                          ? 'لاگ ان فارم پر جائیں (پاس ورڈ خودکار درج ہو جائے گا)' 
                          : lang === 'ar' 
                          ? 'الانتقال لنموذج تسجيل الدخول (معبأة مسبقاً)' 
                          : lang === 'bn'
                          ? 'লগইন ফর্মে যান (স্বয়ংক্রিয় পূরণ)'
                          : lang === 'hi'
                          ? 'लॉगिन स्क्रीन पर जाएं (ऑटो-भरा हुआ)'
                          : 'Go to Standard Login Form (Auto-filled)'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  {/* Optional password update field */}
                  <div className="pt-3 border-t border-indigo-900/50 space-y-2 text-left">
                     <label className="text-[11px] font-bold text-slate-300 block">
                       {lang === 'ur' ? '✏️ یا نیا پاس ورڈ سیٹ کریں:' : lang === 'ar' ? '✏️ أو تعيين كلمة مرور جديدة:' : lang === 'bn' ? '✏️ অথবা নতুন পাসওয়ার্ড দিন:' : lang === 'hi' ? '✏️ या नया पासवर्ड सेट करें:' : '✏️ Or Update Password Instantly:'}
                     </label>
                     <div className="flex gap-2">
                       <input
                         type="text"
                         placeholder={lang === 'ur' ? 'نیا پاس ورڈ لکھیں...' : lang === 'ar' ? 'اكتب كلمة مرور جديدة...' : 'Type new secure password...'}
                         value={newPassword}
                         onChange={(e) => setNewPassword(e.target.value)}
                         className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 outline-none"
                       />
                       <button
                         type="button"
                         onClick={() => {
                           if (!newPassword.trim()) {
                             alert(lang === 'ur' ? 'براہ کرم نیا پاس ورڈ درج کریں۔' : 'Please type a valid password.');
                             return;
                           }
                           const tenantsList = getTenants();
                           const foundIdx = tenantsList.findIndex(u => u.email.toLowerCase() === forgotEmail.trim().toLowerCase());
                           if (foundIdx !== -1) {
                             const updatedPass = newPassword.trim();
                             tenantsList[foundIdx].passwordSha = updatedPass;
                             localStorage.setItem('biz_suite_tenants', JSON.stringify(tenantsList));
                             setRecoveredPassword(updatedPass);
                             setNewPassword('');
                             setSuccess(
                               lang === 'ur' 
                                 ? '✅ نیا پاس ورڈ کامیابی سے محفوظ ہو گیا! لاگ ان کرنے کے لیے اوپر دیے گئے بٹن پر کلک کریں۔' 
                                 : lang === 'ar' 
                                 ? '✅ تم تحديث كلمة المرور بنجاح! اضغط على زر تسجيل الدخول للمتابعة.' 
                                 : '✅ Password updated successfully! Click "Log In With This Password" above to continue.'
                             );
                           }
                         }}
                         className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
                       >
                         {lang === 'ur' ? 'محفوظ کریں' : lang === 'ar' ? 'حفظ' : 'Save'}
                       </button>
                     </div>
                   </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                {recoveredPassword ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleProceedToLogin(forgotEmail, recoveredPassword, true)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs transition uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-600/25"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{lang === 'ur' ? 'لاگ ان کریں' : lang === 'ar' ? 'تسجيل الدخول' : lang === 'bn' ? 'লগ ইন করুন' : lang === 'hi' ? 'लॉगिन करें' : 'Log In Now'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleProceedToLogin(forgotEmail, recoveredPassword, false);
                      }}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition tracking-wider cursor-pointer"
                    >
                      {lang === 'ur' ? 'لاگ ان اسکرین' : lang === 'ar' ? 'شاشة الدخول' : 'Login Screen'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition uppercase tracking-wider cursor-pointer"
                    >
                      {lang === 'ur' ? 'اکاؤنٹ تلاش کریں' : lang === 'ar' ? 'التحقق واستعادة كلمة المرور' : lang === 'bn' ? 'অ্যাকাউন্ট খুঁজুন' : lang === 'hi' ? 'खाता खोजें' : 'Verify Email / Phone'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setForgotEmail('');
                        setRecoveredPassword('');
                        setNewPassword('');
                        setError('');
                        setSuccess('');
                      }}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition tracking-wider cursor-pointer"
                    >
                      {lang === 'ur' ? 'واپس لاگ ان' : lang === 'ar' ? 'العودة' : 'Back to Login'}
                    </button>
                  </>
                )}
              </div>

              <div className="bg-slate-900/40 border border-slate-800 p-2.5 rounded-lg text-[10px] text-indigo-400 mt-2 font-mono leading-relaxed text-center">
                📞 Need help? Contact Super Admin Irfan directly at: 
                <a href="mailto:irfanksaeed@gmail.com" className="hover:underline font-bold text-white block mt-0.5">irfanksaeed@gmail.com</a>
              </div>
            </form>
          ) : (
            /* Staff Merchant registration/login form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* VIP Custom Invite Pre-Approved Banner */}
              {activeInvite && (
                <div className="bg-gradient-to-r from-amber-950/60 via-indigo-950/60 to-amber-950/60 border border-amber-500/40 p-3.5 rounded-2xl space-y-2.5 shadow-lg animate-fadeIn text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🌟</span>
                    <span className="text-xs font-black text-amber-300 font-mono tracking-wider uppercase">
                      VIP Super Admin Invitation Link
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-snug">
                    You are invited by Super Admin Irfan Saeed. Validity granted: <strong className="text-amber-400 font-mono">{activeInvite.durationLabel}</strong>.
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Instant Pre-Approved Activation • No Wait Required</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const company = companyName || activeInvite.companyName || 'Business Enterprise';
                      const mail = email || activeInvite.email;
                      const phone = tenantPhone || activeInvite.phone || '';

                      const newTenant: UserTenant = {
                        id: 'tenant-' + Math.random().toString(36).substring(2, 9),
                        email: mail,
                        passwordSha: password || 'biz123',
                        companyName: company,
                        phone: phone.trim(),
                        currency: currency || 'USD',
                        language: lang,
                        taxRate: 5,
                        invoicePrefix: 'INV-',
                        invoiceNotes: 'Prepared under standard company operational terms and conditions.',
                        subscriptionExpiry: activeInvite.expiresAt,
                        allowedHoursStart: activeInvite.allowedHoursStart,
                        allowedHoursEnd: activeInvite.allowedHoursEnd,
                        isApproved: true,
                        isActive: true,
                        subscriptionStatus: 'active'
                      };

                      const regResult = registerTenant(newTenant, true);
                      if (regResult.success) {
                        claimCustomInvite(activeInvite.id, newTenant.id);
                        setSuccess('🎉 VIP Workspace Activated! Launching dashboard...');
                        logAccess('merchant', newTenant.id, newTenant.companyName, newTenant.email, 'Claimed VIP invitation via 1-Click Launch');
                        setTimeout(() => {
                          setActiveUser(newTenant);
                          onAuthSuccess(newTenant);
                        }, 600);
                      } else {
                        const existing = getTenants().find(t => t.email.toLowerCase() === mail.toLowerCase());
                        if (existing && existing.isActive !== false) {
                          setActiveUser(existing);
                          onAuthSuccess(existing);
                        } else {
                          setError(regResult.error || 'Please complete the form below to enter.');
                        }
                      }
                    }}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer transition active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4 fill-current text-amber-300" />
                    <span>1-Click Launch VIP Workspace Now →</span>
                  </button>
                </div>
              )}

              {/* Google Account Authentication Button (Available in standard login/register/invite) */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGoogleLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2.5 transition shadow-md border border-slate-200 cursor-pointer disabled:opacity-60 active:scale-[0.99]"
              >
                {isGoogleLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                )}
                <span>
                  {isGoogleLoading
                    ? 'Connecting Google...'
                    : isLogin
                      ? (lang === 'ur' ? 'گوگل اکاؤنٹ سے لاگ اِن کریں' : lang === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Continue with Google')
                      : (lang === 'ur' ? 'گوگل اکاؤنٹ سے رجسٹریشن کریں' : lang === 'ar' ? 'التسجيل باستخدام Google' : 'Sign up with Google')}
                </span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[10px] uppercase font-mono tracking-wider text-slate-500">
                  {lang === 'ur' ? 'یا لاگ اِن کی تفصیلات درج کریں' : lang === 'ar' ? 'أو أدخل بيانات الدخول' : 'or continue with credentials'}
                </span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

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
                  {isLogin ? (lang === 'ar' ? 'البريد الإلكتروني أو رقم الهاتف *' : 'Email or Phone Number *') : (lang === 'ar' ? 'البريد الإلكتروني *' : 'Email Address *')}
                </label>
                <input
                  type={isLogin ? "text" : "email"}
                  required
                  placeholder={isLogin ? (lang === 'ar' ? 'أدخل البريد الإلكتروني أو رقم الهاتف' : 'Enter email or phone number...') : "CEO@business.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-400" />
                    {lang === 'ar' ? 'رقم الهاتف / الجوال *' : 'Mobile / Phone Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+923001234567 or +971501234567"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    {t.password}
                  </label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError('');
                        setSuccess('');
                      }}
                      className="text-[11px] text-indigo-400 font-medium hover:underline hover:text-indigo-300 cursor-pointer outline-none"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
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
                        {LANGUAGE_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code} className="bg-slate-950">
                            {opt.flag} {opt.nativeName} ({opt.name})
                          </option>
                        ))}
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
          {loginMode === 'staff' && !isForgotPassword && (
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
        </motion.div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-[10px] text-slate-500 max-w-sm mx-auto w-full mt-4">
        © 2026 OmniSuite. Secure segregated business workspace.
      </div>
    </div>
  );
}
