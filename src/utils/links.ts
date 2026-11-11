/**
 * Universal Link & Navigation Utilities for Biz Suite ERP
 * Handles URL generation, responsive link opening, and robust clipboard copying across mobile, iframe, and webview environments.
 */

import { cleanPhoneForWhatsApp, getDefaultPhoneCode } from './phone';

/**
 * Returns the canonical publicly accessible base URL of the running application.
 * Automatically translates development preview hosts (ais-dev-) into public shared hosts (ais-pre-)
 * so that any recipient on WhatsApp, mobile, or desktop can open the links directly.
 */
export function getBaseAppUrl(): string {
  if (typeof window === 'undefined') return 'https://bizsuite.app';
  try {
    let origin = window.location.origin || '';
    if (origin === 'null' || !origin) {
      const url = new URL(window.location.href);
      origin = url.origin || '';
    }

    // Crucial: In Google AI Studio, ais-dev- URLs require developer auth and fail with 403 for external recipients.
    // ais-pre- URLs are publicly accessible to anyone without login barriers!
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }

    const pathname = window.location.pathname || '';
    // Strip trailing index.html or extra slash if needed
    const cleanPath = pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
    return (origin + cleanPath) || 'https://bizsuite.app';
  } catch (e) {
    let origin = window.location.origin || '';
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin || 'https://bizsuite.app';
  }
}

/**
 * Foolproof clipboard copying with modern navigator.clipboard and fallback document.execCommand
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Async Clipboard API
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Navigator clipboard writeText failed, attempting fallback...', err);
  }

  // 2. Fallback using temporary textarea element
  try {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) return true;
    }
  } catch (err) {
    console.error('Fallback document.execCommand copy failed:', err);
  }

  return false;
}

/**
 * Safely opens an external link without violating iframe constraints or triggering popup blockers
 */
export function openExternalLink(url: string, target = '_blank'): void {
  if (!url || typeof window === 'undefined') return;

  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = target;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    try {
      window.location.href = url;
    } catch (err) {
      console.error('Failed to open link:', err);
    }
  }
}

/**
 * Builds a clean WhatsApp chat URL
 */
export function buildWhatsAppLink(phone: string, message: string, currency?: string): string {
  const defaultCode = getDefaultPhoneCode(currency);
  const cleanPhone = cleanPhoneForWhatsApp(phone, defaultCode);
  const encodedText = encodeURIComponent(message);
  
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Builds a clean mailto URL
 */
export function buildMailtoLink(email: string, subject: string, body: string): string {
  const encSub = encodeURIComponent(subject);
  const encBody = encodeURIComponent(body);
  return `mailto:${email}?subject=${encSub}&body=${encBody}`;
}
