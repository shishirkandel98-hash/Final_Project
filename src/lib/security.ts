// Security utility functions for input sanitization

/**
 * Sanitize string input to prevent XSS attacks
 * Removes or encodes dangerous characters
 */
export const sanitizeString = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 10000); // Limit length
};

/**
 * Sanitize email input
 */
export const sanitizeEmail = (email: string): string => {
  if (!email || typeof email !== 'string') return '';
  
  return email
    .toLowerCase()
    .trim()
    .replace(/[<>'"]/g, '')
    .slice(0, 255);
};

/**
 * Sanitize numeric string input (phone numbers, IDs)
 */
export const sanitizeNumeric = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input.replace(/\D/g, '').slice(0, 20);
};

/**
 * Sanitize description/text fields
 */
export const sanitizeDescription = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 5000); // Reasonable limit for descriptions
};

/**
 * Validate and sanitize amount input
 */
export const sanitizeAmount = (input: string | number): number => {
  if (typeof input === 'number') {
    return Math.max(0, Math.min(input, 999999999999)); // Reasonable max
  }
  
  const num = parseFloat(String(input).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : Math.max(0, Math.min(num, 999999999999));
};

/**
 * Check for potential SQL injection patterns
 */
export const hasSQLInjection = (input: string): boolean => {
  if (!input || typeof input !== 'string') return false;
  
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|UNION|JOIN)\b)/i,
    /(--|;|\/\*|\*\/)/,
    /('|")\s*(OR|AND)\s*('|"|\d)/i,
    /\b(1\s*=\s*1|true\s*=\s*true)\b/i,
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Rate limiting helper for client-side
 */
export class ClientRateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  canProceed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Filter out old attempts
    const recentAttempts = attempts.filter(time => now - time < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return false;
    }
    
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
  
  getRemainingTime(key: string, windowMs: number): number {
    const attempts = this.attempts.get(key) || [];
    if (attempts.length === 0) return 0;
    
    const oldestAttempt = Math.min(...attempts);
    const timeUntilReset = windowMs - (Date.now() - oldestAttempt);
    return Math.max(0, Math.ceil(timeUntilReset / 1000));
  }
}
