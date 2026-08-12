export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'UAH', name: 'Украинская гривна', symbol: '₴', flag: '🇺🇦' },
  { code: 'USD', name: 'Доллар США', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Евро', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'Фунт стерлингов', symbol: '£', flag: '🇬🇧' },
  { code: 'PLN', name: 'Польский злотый', symbol: 'zł', flag: '🇵🇱' },
  { code: 'MDL', name: 'Молдавский лей', symbol: 'L', flag: '🇲🇩' },
  { code: 'CZK', name: 'Чешская крона', symbol: 'Kč', flag: '🇨🇿' },
  { code: 'RON', name: 'Румынский лей', symbol: 'lei', flag: '🇷🇴' },
  { code: 'CHF', name: 'Швейцарский франк', symbol: 'Fr', flag: '🇨🇭' },
  { code: 'CAD', name: 'Канадский доллар', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Австралийский доллар', symbol: 'A$', flag: '🇦🇺' },
  { code: 'JPY', name: 'Японская иена', symbol: '¥', flag: '🇯🇵' },
  { code: 'CNY', name: 'Китайский юань', symbol: '¥', flag: '🇨🇳' },
  { code: 'HUF', name: 'Венгерский форинт', symbol: 'Ft', flag: '🇭🇺' },
  { code: 'BGN', name: 'Болгарский лев', symbol: 'лв', flag: '🇧🇬' },
  { code: 'HRK', name: 'Хорватская куна', symbol: 'kn', flag: '🇭🇷' },
  { code: 'RSD', name: 'Сербский динар', symbol: 'дин', flag: '🇷🇸' },
  { code: 'NOK', name: 'Норвежская крона', symbol: 'kr', flag: '🇳🇴' },
  { code: 'SEK', name: 'Шведская крона', symbol: 'kr', flag: '🇸🇪' },
  { code: 'DKK', name: 'Датская крона', symbol: 'kr', flag: '🇩🇰' },
  { code: 'TRY', name: 'Турецкая лира', symbol: '₺', flag: '🇹🇷' },
  { code: 'ILS', name: 'Израильский шекель', symbol: '₪', flag: '🇮🇱' },
  { code: 'AED', name: 'Дирхам ОАЭ', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SGD', name: 'Сингапурский доллар', symbol: 'S$', flag: '🇸🇬' },
  { code: 'NZD', name: 'Новозеландский доллар', symbol: 'NZ$', flag: '🇳🇿' },
];

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function searchCurrencies(query: string): CurrencyInfo[] {
  const q = query.toLowerCase();
  return CURRENCIES.filter(
    (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
  );
}
