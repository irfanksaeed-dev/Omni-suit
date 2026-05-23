import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { translations } from '../translations';
import { Language } from '../types';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  language?: Language;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  language = 'en',
}: ConfirmModalProps) {
  const t = translations[language];
  const isRtl = language === 'ar' || language === 'ur';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className={`relative w-full max-w-sm glass p-6 rounded-2xl shadow-2xl border-rose-500/20 text-white overflow-hidden ${
              isRtl ? 'text-right' : 'text-left'
            }`}
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            {/* Top light accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />

            <div className="flex gap-4 items-start">
              {/* Alert icon */}
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>

              {/* Text content */}
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-white tracking-wide">
                  {title || t.delete || 'Confirm Action'}
                </h3>
                <p className="text-xs text-indigo-200/70 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className={`mt-6 flex justify-end gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-white/5 hover:bg-white/5 text-slate-350 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.delete || 'Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
