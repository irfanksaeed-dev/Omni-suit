import React, { useState } from 'react';
import { UserTenant, Language, Currency } from '../types';
import { translations } from '../translations';
import { updateTenantSettings } from '../db';
import { Settings, Save, CheckCircle2, Sliders, FileText, Globe, Landmark, Upload, X } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsModuleProps {
  user: UserTenant;
  onUpdateUser: (updatedUser: UserTenant) => void;
}

export default function SettingsModule({ user, onUpdateUser }: SettingsModuleProps) {
  const t = translations[user.language];

  const [companyName, setCompanyName] = useState(user.companyName);
  const [currency, setCurrency] = useState<Currency>(user.currency);
  const [lang, setLang] = useState<Language>(user.language);
  const [taxRate, setTaxRate] = useState(user.taxRate.toString());
  const [taxNumber, setTaxNumber] = useState(user.taxNumber || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || '');
  const [invoicePrefix, setInvoicePrefix] = useState(user.invoicePrefix || 'INV-');
  const [invoiceNotes, setInvoiceNotes] = useState(user.invoiceNotes || '');
  const [logoUrl, setLogoUrl] = useState(user.logoUrl || '');

  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');

    const payload: Partial<UserTenant> = {
      companyName,
      currency,
      language: lang,
      taxRate: parseFloat(taxRate) || 0,
      taxNumber,
      phone,
      address,
      invoicePrefix,
      invoiceNotes,
      logoUrl,
    };

    const updated = updateTenantSettings(payload);
    if (updated) {
      onUpdateUser(updated);
      setSuccessMsg(t.settingsSaved);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          {t.companySettings}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Define business taxonomies, TRN designations, localized and currency overrides.</p>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl shadow-xl max-w-xl text-xs text-slate-300">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Section 1: Core Company block */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-indigo-300 text-[10px] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-850">
              <Sliders className="w-3.5 h-3.5" />
              {t.operationalDetails}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-400">Legal Company Name *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">Company Contact Phone</label>
                <input
                  type="text"
                  placeholder="+1 (555) 489-3940"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400">Headquarters Physical Address</label>
              <input
                type="text"
                placeholder="Downtown Block A, Silicon Valley, CA"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
              />
            </div>

            {/* Base64 Logo Uploader */}
            <div className="space-y-1">
              <label className="font-bold text-slate-400">Company Logo / لوگو اپ لوڈ کریں</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-1 bg-slate-950/50 p-3 rounded-2xl border border-slate-850">
                {logoUrl ? (
                  <div className="relative group shrink-0">
                    <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-contain bg-slate-900 border border-slate-800 p-1" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full p-1 transition opacity-80 hover:opacity-100 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 border-dashed flex flex-col items-center justify-center text-slate-500 shrink-0 text-[10px] text-center p-1 leading-snug font-bold">
                    No Logo Saved
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setLogoUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="logo-upload-input"
                    className="inline-flex items-center gap-1.5 bg-indigo-600/15 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white font-black py-1 px-3.5 rounded-lg text-[10px] transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    SELECT COMPANY LOGO
                  </label>
                  <p className="text-[9px] text-slate-500 leading-normal">
                    PNG, JPG or SVG formats accepted. Updates will reflect on invoice PDF exports, vouchers, and customer portals immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Financial overrides */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-indigo-300 text-[10px] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-850">
              <FileText className="w-3.5 h-3.5" />
              Invoicing & Taxes Default Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.invoicePrefix} *</label>
                <input
                  type="text"
                  required
                  placeholder="INV-"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">{t.taxRatePercentage} *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="5"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400">TRN / Tax Registration Number</label>
                <input
                  type="text"
                  placeholder="TRN-94050210"
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-400">{t.invoiceNotesDefault}</label>
              <textarea
                placeholder="Declare swift banking parameters, wire instructions, standard due rules..."
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                className="w-full h-20 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-white pin-y placeholder-slate-600 outline-none resize-none"
              />
            </div>
          </div>

          {/* Section 3: Localization parameters */}
          <div className="space-y-3">
            <h3 className="font-extrabold text-indigo-300 text-[10px] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-850">
              <Globe className="w-3.5 h-3.5" />
              System Language & Currency Settings
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-400 flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                  Default Billing Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-medium"
                >
                  <option value="USD">USD ($)</option>
                  <option value="AED">AED (د.إ)</option>
                  <option value="PKR">PKR (Rs)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="SAR">SAR (ر.س)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  Primary Interface Language
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Language)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="en">English (LTR)</option>
                  <option value="ar">العربية (RTL)</option>
                  <option value="ur">اردو (RTL)</option>
                  <option value="hi">हिंदी (LTR)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Trigger buttons */}
          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white font-black py-2.5 px-5 rounded-xl transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
