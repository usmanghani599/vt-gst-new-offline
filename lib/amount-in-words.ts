import Decimal from 'decimal.js';

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertLessThanThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  const ten = tens[Math.floor(n / 10)];
  const one = ones[n % 10];
  return one ? `${ten} ${one}` : ten;
}

function convertIndianNumber(n: number): string {
  if (n === 0) return 'Zero';

  let result = '';

  const crores = Math.floor(n / 10000000);
  n %= 10000000;

  const lakhs = Math.floor(n / 100000);
  n %= 100000;

  const thousands = Math.floor(n / 1000);
  n %= 1000;

  const hundreds = Math.floor(n / 100);
  const remaining = n % 100;

  if (crores > 0) {
    result += `${convertIndianNumber(crores)} Crore `;
  }
  if (lakhs > 0) {
    result += `${convertLessThanThousand(lakhs)} Lakh `;
  }
  if (thousands > 0) {
    result += `${convertLessThanThousand(thousands)} Thousand `;
  }
  if (hundreds > 0) {
    result += `${convertLessThanThousand(hundreds)} Hundred `;
  }
  if (remaining > 0) {
    result += `${convertLessThanThousand(remaining)} `;
  }

  return result.trim();
}

export function numberToWordsINR(amount: Decimal.Value | number | string): string {
  try {
    const d = new Decimal(amount || 0);
    const isNegative = d.isNegative();
    const abs = d.abs();

    const rupees = Math.floor(abs.toNumber());
    const paise = Math.round(abs.minus(rupees).times(100).toNumber());

    let words = '';
    if (rupees === 0 && paise === 0) {
      return 'Zero Rupees Only';
    }

    if (rupees > 0) {
      words += `${convertIndianNumber(rupees)} Rupees`;
    }

    if (paise > 0) {
      if (words) words += ' and ';
      words += `${convertLessThanThousand(paise)} Paise`;
    }

    words += ' Only';
    return isNegative ? `Minus ${words}` : words;
  } catch {
    return '';
  }
}
