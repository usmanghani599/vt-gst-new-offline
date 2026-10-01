import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Decimal from 'decimal.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: Decimal.Value | number | string, currencySymbol: string = '₹'): string {
  try {
    const d = new Decimal(amount || 0);
    const parts = d.toFixed(2).split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1];

    // Format integer part for Indian grouping: 1,00,000.00
    const isNegative = integerPart.startsWith('-');
    if (isNegative) integerPart = integerPart.substring(1);

    const lastThree = integerPart.slice(-3);
    const otherNumbers = integerPart.slice(0, -3);
    const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    const formattedInteger = otherNumbers !== '' ? `${formattedOther},${lastThree}` : lastThree;

    return `${isNegative ? '-' : ''}${currencySymbol} ${formattedInteger}.${decimalPart}`;
  } catch {
    return `${currencySymbol} 0.00`;
  }
}

export function formatQuantity(qty: Decimal.Value | number | string): string {
  try {
    const d = new Decimal(qty || 0);
    // Trim trailing zeros if clean integer/decimal
    return d.toDecimalPlaces(4).toString();
  } catch {
    return '0';
  }
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function toDecimal(val: Decimal.Value | number | string | null | undefined, precision: number = 2): Decimal {
  if (val === null || val === undefined || val === '') return new Decimal(0);
  try {
    return new Decimal(val).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
  } catch {
    return new Decimal(0);
  }
}
