export type Country = 'EG' | 'US' | 'SA' | 'AE' | 'GB' | 'EU' | 'TR' | 'JP' | 'OTHER';
export const countries = [['EG', 'Egypt 🇪🇬'], ['US', 'United States 🇺🇸'], ['SA', 'Saudi Arabia 🇸🇦'], ['AE', 'UAE 🇦🇪'], ['GB', 'United Kingdom 🇬🇧'], ['EU', 'Europe 🇪🇺'], ['TR', 'Turkey 🇹🇷'], ['JP', 'Japan 🇯🇵'], ['OTHER', 'Other 🌍']] as const;
export const regionalPricing: Record<Country, { c: string; standard: number; premium: number; max: number }> = {
  EG: { c: 'EGP', standard: 29, premium: 49, max: 99 },
  US: { c: 'USD', standard: 3, premium: 4.99, max: 9.99 },
  SA: { c: 'SAR', standard: 12, premium: 19, max: 39 },
  AE: { c: 'AED', standard: 12, premium: 19, max: 39 },
  GB: { c: 'GBP', standard: 3, premium: 5, max: 9 },
  EU: { c: 'EUR', standard: 3, premium: 5, max: 9 },
  TR: { c: 'TRY', standard: 99, premium: 149, max: 299 },
  JP: { c: 'JPY', standard: 450, premium: 750, max: 1400 },
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
