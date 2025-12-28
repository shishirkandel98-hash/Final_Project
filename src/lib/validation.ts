// List of temporary/disposable email domains
const TEMP_EMAIL_DOMAINS = [
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'mailinator.com',
  '10minutemail.com', 'throwaway.email', 'fakeinbox.com', 'yopmail.com',
  'dispostable.com', 'mailnesia.com', 'tempail.com', 'tempmailaddress.com',
  'trashmail.com', 'sharklasers.com', 'spam4.me', 'getnada.com',
  'mohmal.com', 'emailondeck.com', 'spamgourmet.com', 'mytemp.email',
  'getairmail.com', 'tempmailo.com', 'temp-mail.io', 'fakemailgenerator.com',
  'burnermail.io', 'tempr.email', 'tmpmail.org', 'tmpmail.net',
  'maildrop.cc', 'mintemail.com', 'harakirimail.com', 'throwawaymail.com'
];

export const isValidEmail = (email: string): { valid: boolean; error?: string } => {
  // Security: Check input type and length
  if (!email || typeof email !== 'string') {
    return { valid: false, error: "Email is required" };
  }

  // Security: Limit email length to prevent DoS
  if (email.length > 255) {
    return { valid: false, error: "Email is too long (max 255 characters)" };
  }

  const sanitizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitizedEmail)) {
    return { valid: false, error: "Please enter a valid email address" };
  }

  // Security: Check for potential injection patterns
  if (/[<>'"`;\\]/.test(sanitizedEmail)) {
    return { valid: false, error: "Email contains invalid characters" };
  }

  const domain = sanitizedEmail.split('@')[1]?.toLowerCase();
  
  if (TEMP_EMAIL_DOMAINS.includes(domain)) {
    return { valid: false, error: "Temporary/disposable emails are not allowed. Please use a permanent email." };
  }

  // Check for valid email providers
  const validDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com'];
  const isBusinessEmail = !validDomains.includes(domain) && domain.includes('.');
  
  if (!validDomains.includes(domain) && !isBusinessEmail) {
    return { valid: false, error: "Please use a valid email provider (Gmail, Yahoo, Outlook, etc.) or business email" };
  }

  return { valid: true };
};

export const isValidPhone = (phone: string): { valid: boolean; error?: string } => {
  // Security: Check input type
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: "Phone number is required" };
  }

  // Remove any non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check if it's exactly 10 digits or has country code + 10 digits
  const digitsOnly = cleaned.replace(/\D/g, '');
  
  if (digitsOnly.length < 10) {
    return { valid: false, error: "Phone number must be at least 10 digits" };
  }

  if (digitsOnly.length === 10) {
    return { valid: true };
  }

  // Allow country codes (up to 3 digits) + 10 digit number
  if (digitsOnly.length > 13) {
    return { valid: false, error: "Phone number is too long" };
  }

  return { valid: true };
};

export const isValidName = (name: string): { valid: boolean; error?: string } => {
  // Security: Check input type
  if (!name || typeof name !== 'string') {
    return { valid: false, error: "Name is required" };
  }

  // Security: Limit name length
  if (name.length > 100) {
    return { valid: false, error: "Name is too long (max 100 characters)" };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: "Name must be at least 2 characters" };
  }

  // Security: Only allow safe characters for names
  if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) {
    return { valid: false, error: "Name can only contain letters, spaces, hyphens, and apostrophes" };
  }

  // Security: Check for potential injection patterns
  if (/[<>'"`;\\]/.test(name)) {
    return { valid: false, error: "Name contains invalid characters" };
  }

  return { valid: true };
};

/**
 * Validate password strength
 */
export const isValidPassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: "Password is required" };
  }

  if (password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters" };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password is too long (max 128 characters)" };
  }

  return { valid: true };
};

/**
 * Validate amount/number input
 */
export const isValidAmount = (amount: string | number): { valid: boolean; error?: string; value?: number } => {
  const numValue = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  
  if (isNaN(numValue)) {
    return { valid: false, error: "Invalid amount" };
  }

  if (numValue < 0) {
    return { valid: false, error: "Amount cannot be negative" };
  }

  if (numValue > 999999999999) {
    return { valid: false, error: "Amount is too large" };
  }

  return { valid: true, value: numValue };
};

/**
 * Validate description/text fields
 */
export const isValidDescription = (description: string, maxLength: number = 5000): { valid: boolean; error?: string } => {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: "Description is required" };
  }

  if (description.length > maxLength) {
    return { valid: false, error: `Description is too long (max ${maxLength} characters)` };
  }

  // Check for potential injection patterns
  if (/<script|javascript:|on\w+=/i.test(description)) {
    return { valid: false, error: "Description contains invalid content" };
  }

  return { valid: true };
};
