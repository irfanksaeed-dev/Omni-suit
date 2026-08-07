export function cleanPhoneForWhatsApp(phone: string, defaultCode: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';

  // 1. If it starts with '+' or '00', it's explicitly international.
  const isExplicitInternational = trimmed.startsWith('+') || trimmed.startsWith('00');
  
  let cleaned = trimmed.replace(/\D/g, ''); // strip all non-digits
  
  if (trimmed.startsWith('00')) {
    // strip the leading '00' digits
    cleaned = cleaned.substring(2);
  }

  if (isExplicitInternational) {
    return cleaned;
  }

  // 2. Local standard handling: if it starts with '0' e.g. 0300..., 050..., 055...
  if (cleaned.startsWith('0') && cleaned.length > 1) {
    // It's a local number with leading 0. Strip the 0 and prepend the default code.
    return defaultCode + cleaned.substring(1);
  }

  // 3. If it is already starting with the defaultCode (e.g. 92, 971, 966) and is of reasonable length
  if (cleaned.startsWith(defaultCode) && cleaned.length >= defaultCode.length + 7) {
    return cleaned;
  }

  // 4. Check if the length indicates it's likely a local number lacking a country code.
  // Most local numbers (after stripping non-digits) are 7 to 10 digits long.
  // If the length is less than 11 digits, and it doesn't look like it has a country prefix, prepend the default country code.
  if (cleaned.length >= 7 && cleaned.length <= 10) {
    return defaultCode + cleaned;
  }

  // 5. Otherwise, if it has 11+ digits, we assume the user already entered the country code directly.
  return cleaned;
}

export function getDefaultPhoneCode(currency?: string): string {
  if (!currency) return '92';
  const cur = currency.toUpperCase();
  if (cur === 'AED') return '971';
  if (cur === 'PKR') return '92';
  if (cur === 'SAR') return '966';
  if (cur === 'OMR') return '968';
  if (cur === 'QAR') return '974';
  if (cur === 'BHD') return '973';
  if (cur === 'KWD') return '965';
  if (cur === 'GBP') return '44';
  if (cur === 'USD') return '1';
  if (cur === 'CAD') return '1';
  if (cur === 'INR') return '91';
  if (cur === 'BDT') return '880';
  return '92'; // fallback Pakistan default
}
