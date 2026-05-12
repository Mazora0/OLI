export type Country =
  | 'EG' | 'US' | 'CA' | 'MX' | 'BR' | 'AR'
  | 'SA' | 'AE' | 'QA' | 'KW' | 'BH' | 'OM' | 'JO' | 'MA' | 'DZ' | 'TN'
  | 'GB' | 'EU' | 'FR' | 'DE' | 'IT' | 'ES' | 'NL'
  | 'TR' | 'IN' | 'PK' | 'BD' | 'ID' | 'PH' | 'MY' | 'SG'
  | 'JP' | 'KR' | 'CN' | 'AU' | 'ZA' | 'NG' | 'KE' | 'OTHER';

export const countries = [
  ['EG', 'Egypt 🇪🇬'], ['SA', 'Saudi Arabia 🇸🇦'], ['AE', 'UAE 🇦🇪'], ['QA', 'Qatar 🇶🇦'], ['KW', 'Kuwait 🇰🇼'], ['BH', 'Bahrain 🇧🇭'], ['OM', 'Oman 🇴🇲'], ['JO', 'Jordan 🇯🇴'], ['MA', 'Morocco 🇲🇦'], ['DZ', 'Algeria 🇩🇿'], ['TN', 'Tunisia 🇹🇳'],
  ['US', 'United States 🇺🇸'], ['CA', 'Canada 🇨🇦'], ['MX', 'Mexico 🇲🇽'], ['BR', 'Brazil 🇧🇷'], ['AR', 'Argentina 🇦🇷'],
  ['GB', 'United Kingdom 🇬🇧'], ['EU', 'Europe 🇪🇺'], ['FR', 'France 🇫🇷'], ['DE', 'Germany 🇩🇪'], ['IT', 'Italy 🇮🇹'], ['ES', 'Spain 🇪🇸'], ['NL', 'Netherlands 🇳🇱'],
  ['TR', 'Turkey 🇹🇷'], ['IN', 'India 🇮🇳'], ['PK', 'Pakistan 🇵🇰'], ['BD', 'Bangladesh 🇧🇩'], ['ID', 'Indonesia 🇮🇩'], ['PH', 'Philippines 🇵🇭'], ['MY', 'Malaysia 🇲🇾'], ['SG', 'Singapore 🇸🇬'],
  ['JP', 'Japan 🇯🇵'], ['KR', 'South Korea 🇰🇷'], ['CN', 'China 🇨🇳'], ['AU', 'Australia 🇦🇺'], ['ZA', 'South Africa 🇿🇦'], ['NG', 'Nigeria 🇳🇬'], ['KE', 'Kenya 🇰🇪'], ['OTHER', 'Other 🌍']
] as const;

export const regionalPricing: Record<Country, { c: string; standard: number; premium: number; max: number }> = {
  EG: { c: 'EGP', standard: 29, premium: 49, max: 99 },
  US: { c: 'USD', standard: 3, premium: 4.99, max: 9.99 },
  CA: { c: 'CAD', standard: 4, premium: 7, max: 14 },
  MX: { c: 'MXN', standard: 59, premium: 99, max: 199 },
  BR: { c: 'BRL', standard: 15, premium: 25, max: 49 },
  AR: { c: 'USD', standard: 3, premium: 4.99, max: 9.99 },
  SA: { c: 'SAR', standard: 12, premium: 19, max: 39 },
  AE: { c: 'AED', standard: 12, premium: 19, max: 39 },
  QA: { c: 'QAR', standard: 12, premium: 19, max: 39 },
  KW: { c: 'KWD', standard: 1, premium: 1.5, max: 3 },
  BH: { c: 'BHD', standard: 1.2, premium: 1.9, max: 3.8 },
  OM: { c: 'OMR', standard: 1.2, premium: 1.9, max: 3.8 },
  JO: { c: 'JOD', standard: 2.2, premium: 3.5, max: 7 },
  MA: { c: 'MAD', standard: 29, premium: 49, max: 99 },
  DZ: { c: 'DZD', standard: 390, premium: 690, max: 1390 },
  TN: { c: 'TND', standard: 9, premium: 15, max: 29 },
  GB: { c: 'GBP', standard: 3, premium: 5, max: 9 },
  EU: { c: 'EUR', standard: 3, premium: 5, max: 9 },
  FR: { c: 'EUR', standard: 3, premium: 5, max: 9 },
  DE: { c: 'EUR', standard: 3, premium: 5, max: 9 },
  IT: { c: 'EUR', standard: 3, premium: 5, max: 9 },
  ES: { c: 'EUR', standard: 3, premium: 5, max: 9 },
  NL: { c: 'EUR', standard: 3, premium: 5, max: 9 },
  TR: { c: 'TRY', standard: 99, premium: 149, max: 299 },
  IN: { c: 'INR', standard: 249, premium: 399, max: 799 },
  PK: { c: 'PKR', standard: 850, premium: 1400, max: 2800 },
  BD: { c: 'BDT', standard: 350, premium: 590, max: 1190 },
  ID: { c: 'IDR', standard: 49000, premium: 79000, max: 159000 },
  PH: { c: 'PHP', standard: 169, premium: 279, max: 549 },
  MY: { c: 'MYR', standard: 14, premium: 23, max: 45 },
  SG: { c: 'SGD', standard: 4, premium: 7, max: 14 },
  JP: { c: 'JPY', standard: 450, premium: 750, max: 1400 },
  KR: { c: 'KRW', standard: 3900, premium: 6900, max: 13900 },
  CN: { c: 'USD', standard: 3, premium: 4.99, max: 9.99 },
  AU: { c: 'AUD', standard: 5, premium: 8, max: 16 },
  ZA: { c: 'ZAR', standard: 55, premium: 89, max: 179 },
  NG: { c: 'NGN', standard: 4500, premium: 7500, max: 15000 },
  KE: { c: 'KES', standard: 390, premium: 650, max: 1290 },
  OTHER: { c: 'USD', standard: 3, premium: 4.99, max: 9.99 }
};
export const currencyOf = (country: Country) => regionalPricing[country]?.c || 'USD';
export const price = (country: Country, plan: 'standard' | 'premium' | 'max') => `${currencyOf(country)} ${regionalPricing[country][plan]}/mo`;
export const publicPlanName = (plan?: string) => plan || 'Free';
export const guestLimits = { messages: 'Guest: QLO 1.2 Flash only · login required for QLO 1.3 and Agent', flash: 2, pro: 0, agents: 0 };
export const limits = {
  Free: {
    messages: 'QLO 1.2 Flash: 30/6h · QLO 1.2 Pro: 4/6h after login · Agent: 1/day local limit',
    flash: 30,
    pro: 4,
    agents: 1,
    models: ['QLO 1.2 Flash', 'QLO 1.2 Study', 'Small QLO 1.2 Pro allowance'],
    tools: ['Chat credits refresh every 6 hours', 'Arabic/English replies', 'Compact memory', 'Saved chats on device', '1 smart Agent run/day']
  },
  Standard: {
    messages: 'QLO 1.2 Flash: 500/6h · QLO 1.3 Flash: 10/6h · Agent: 1/day',
    flash: 500,
    pro: 10,
    agents: 1,
    models: ['QLO 1.2 Flash', 'QLO 1.2 Study', 'QLO 1.2 Pro', 'QLO 1.3 Flash'],
    tools: ['More daily usage', 'Local project workspace', 'Saved chats', 'Better answers', 'HTML and raw text exports']
  },
  Premium: {
    messages: 'QLO 1.2 Flash: 2,000/6h · QLO 1.3 Pro: 100/6h · Agent: 2/day',
    flash: 2000,
    pro: 100,
    agents: 2,
    models: ['QLO 1.2 Pro', 'QLO 1.3 Flash', 'QLO 1.3 Pro'],
    tools: ['Advanced reasoning', 'Stronger coding support', '2 smart Agent runs/day', 'Local JSX/HTML preview', 'HTML/PDF/raw exports']
  },
  Max: {
    messages: 'QLO 1.2 Flash: 5,000/6h · QLO 1.3 Pro: 200/6h · Agent: 4/day',
    flash: 5000,
    pro: 200,
    agents: 4,
    models: ['QLO 1.3 Agent', 'QLO 1.3 Pro', 'QLO 1.3 Flash', 'QLO 1.2 Pro'],
    tools: ['Highest Agent limit', 'Full parallel Agent mode support', 'Local JSX/HTML engine', 'More credits', 'Priority access']
  }
};
