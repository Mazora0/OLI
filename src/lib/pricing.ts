export type Country = 'EG' | 'US' | 'SA' | 'AE' | 'GB' | 'EU' | 'TR' | 'JP' | 'OTHER';
export const countries = [['EG', 'Egypt 🇪🇬'], ['US', 'United States 🇺🇸'], ['SA', 'Saudi Arabia 🇸🇦'], ['AE', 'UAE 🇦🇪'], ['GB', 'United Kingdom 🇬🇧'], ['EU', 'Europe 🇪🇺'], ['TR', 'Turkey 🇹🇷'], ['JP', 'Japan 🇯🇵'], ['OTHER', 'Other 🌍']] as const;
export const regionalPricing: Record<Country, { c: string; standard: number; premium: number }> = { EG: { c: 'EGP', standard: 29, premium: 49 }, US: { c: 'USD', standard: 3, premium: 4.99 }, SA: { c: 'SAR', standard: 12, premium: 19 }, AE: { c: 'AED', standard: 12, premium: 19 }, GB: { c: 'GBP', standard: 3, premium: 5 }, EU: { c: 'EUR', standard: 3, premium: 5 }, TR: { c: 'TRY', standard: 99, premium: 149 }, JP: { c: 'JPY', standard: 450, premium: 750 }, OTHER: { c: 'USD', standard: 3, premium: 4.99 } };
export const currencyOf = (country: Country) => regionalPricing[country]?.c || 'USD';
export const price = (country: Country, plan: 'standard' | 'premium') => `${currencyOf(country)} ${regionalPricing[country][plan]}/mo`;
export const guestLimits = { messages: 'Guest: 2 Flash/day · login required for Pro+', flash: 2, pro: 0 };
export const limits = {
  Free: { messages: 'Flash: 30/day · Pro: 4/day after login', flash: 30, pro: 4, models: ['QLO Flash', 'QLO Study basic', '4 QLO Pro messages after login'], tools: ['Fast daily chat', 'Egyptian Arabic replies', 'Compact memory', 'Saved chats on device', 'Upgrade nudges'] },
  Standard: { messages: 'Flash: 500/day · Pro: 20/day', flash: 500, pro: 20, models: ['QLO Flash', 'QLO Pro', 'QLO Study', 'QLO Creative'], tools: ['No ads placeholder', 'Cloud sync structure', 'Saved chats', 'Better answers', 'More Pro access'] },
  Premium: { messages: 'Flash: 2,000/day · Pro: 100/day', flash: 2000, pro: 100, models: ['QLO Flash', 'QLO Pro', 'QLO Reason', 'QLO Code', 'QLO Study', 'QLO Creative'], tools: ['Advanced reasoning', 'DeepSeek route', 'Cloudflare fallback', 'Priority access', 'Premium support'] }
};
