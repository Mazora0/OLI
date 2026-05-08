import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { hasSupabase, supabase, type QalveroSession } from '../lib/supabase';
import type { Lang } from '../lib/i18n';
import type { Country } from '../lib/pricing';

type Profile = { id?: string; email?: string; full_name?: string; country?: Country; currency?: string; plan?: 'Free' | 'Standard' | 'Premium' };

type Ctx = {
  lang: Lang;
  setLang: (v: Lang) => void;
  theme: 'dark' | 'light';
  setTheme: (v: 'dark' | 'light') => void;
  country: Country;
  setCountry: (v: Country) => void;
  session: QalveroSession;
  user: User | null;
  profile: Profile | null;
  loadingAuth: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('qv_lang') as Lang) || 'en');
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('qv_theme') as any) || 'dark');
  const [country, setCountry] = useState<Country>((localStorage.getItem('qv_country') as Country) || 'EG');
  const [session, setSession] = useState<QalveroSession>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  async function refreshProfile() {
    if (!supabase || !session?.user) {
      const demoEmail = localStorage.getItem('qv_demo_email');
      setProfile(demoEmail ? { email: demoEmail, country, currency: country === 'EG' ? 'EGP' : 'USD', plan: 'Free' } : null);
      return;
    }
    const { data } = await supabase.from('qv_profiles').select('*').eq('id', session.user.id).maybeSingle();
    setProfile(data as Profile | null);
    if (data?.country) setCountry(data.country as Country);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('qv_demo_email');
    setSession(null); setUser(null); setProfile(null);
  }

  useEffect(() => {
    let mounted = true;
    if (!hasSupabase || !supabase) {
      setLoadingAuth(false);
      const demoEmail = localStorage.getItem('qv_demo_email');
      if (demoEmail) setProfile({ email: demoEmail, country, currency: country === 'EG' ? 'EGP' : 'USD', plan: 'Free' });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session); setUser(data.session?.user || null); setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setUser(next?.user || null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { refreshProfile(); }, [session?.user?.id]);

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('qv_lang', lang);
    localStorage.setItem('qv_theme', theme);
    localStorage.setItem('qv_country', country);
  }, [lang, theme, country]);

  const v = useMemo(() => ({ lang, setLang, theme, setTheme, country, setCountry, session, user, profile, loadingAuth, refreshProfile, signOut }), [lang, theme, country, session, user, profile, loadingAuth]);
  return <C.Provider value={v}>{children}</C.Provider>;
};

export const useApp = () => useContext(C)!;
