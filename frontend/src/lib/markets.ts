/** Countries a store can sell in, for channels that span countries. Codes match the API. */
export const MARKETS: { code: string; en: string; ar: string }[] = [
  { code: 'sa', en: 'Saudi Arabia', ar: 'السعودية' },
  { code: 'ae', en: 'United Arab Emirates', ar: 'الإمارات' },
  { code: 'kw', en: 'Kuwait', ar: 'الكويت' },
  { code: 'qa', en: 'Qatar', ar: 'قطر' },
  { code: 'bh', en: 'Bahrain', ar: 'البحرين' },
  { code: 'om', en: 'Oman', ar: 'عُمان' },
  { code: 'eg', en: 'Egypt', ar: 'مصر' },
  { code: 'jo', en: 'Jordan', ar: 'الأردن' },
  { code: 'iq', en: 'Iraq', ar: 'العراق' },
  { code: 'ma', en: 'Morocco', ar: 'المغرب' },
  { code: 'tr', en: 'Türkiye', ar: 'تركيا' },
  { code: 'de', en: 'Germany', ar: 'ألمانيا' },
  { code: 'gb', en: 'United Kingdom', ar: 'المملكة المتحدة' },
  { code: 'us', en: 'United States', ar: 'الولايات المتحدة' },
];

/** Platforms whose one account can sell in several countries, so the country must be chosen. */
export const NEEDS_MARKET = new Set(['noon', 'trendyol']);
