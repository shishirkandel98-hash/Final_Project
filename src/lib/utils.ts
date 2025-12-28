import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number in Indian/Nepali numbering system (lakh, crore)
 * Example: 320290.03 -> 3,20,290.03
 */
export function formatIndianNumber(num: number, decimals: number = 2): string {
  const isNegative = num < 0;
  const absoluteNum = Math.abs(num);
  
  // Split into integer and decimal parts
  const [integerPart, decimalPart] = absoluteNum.toFixed(decimals).split('.');
  
  // Format integer part in Indian numbering system
  const lastThree = integerPart.slice(-3);
  const otherDigits = integerPart.slice(0, -3);
  
  let formattedInteger = lastThree;
  if (otherDigits.length > 0) {
    // Add commas every 2 digits for the remaining part
    const formatted = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInteger = formatted + ',' + lastThree;
  }
  
  const result = decimalPart ? `${formattedInteger}.${decimalPart}` : formattedInteger;
  return isNegative ? `-${result}` : result;
}

/**
 * Format currency with Indian/Nepali numbering system
 */
export function formatCurrency(amount: number, currency: string = 'NPR', decimals: number = 2): string {
  return `${currency} ${formatIndianNumber(amount, decimals)}`;
}

/**
 * Format number with international standard (comma every 3 digits)
 * Example: 320290.03 -> 320,290.03
 */
export function formatInternationalNumber(num: number, decimals: number = 2): string {
  const isNegative = num < 0;
  const absoluteNum = Math.abs(num);
  const formatted = absoluteNum.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format currency with international standard numbering
 */
export function formatCurrencyInternational(amount: number, currency: string = 'NPR', decimals: number = 2): string {
  return `${currency} ${formatInternationalNumber(amount, decimals)}`;
}
