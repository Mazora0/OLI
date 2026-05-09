import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { hasSupabase, supabase, type QalveroSession } from '../lib/supabase';
import type { Lang } from '../lib/i18n';
import type { Country } from '../lib/pricing';

export type Profile = { id?: string; email?: string; full_name?: string; country?: Country; currency?: string; plan?: 'Free' | 'Standard' | 'Premium'; avatar_id?: string };
export type ThemeMode = 'dark' | 'light' | 'system';
export type AccentColor = 'orange' | 'violet' | 'blue' | 'emerald';

type Ctx = {
  lang: Lang;
  setLang: (v: Lang) => void;
  theme: ThemeMode;
  setTheme: (v: ThemeMode) => void;
  accent: AccentColor;
  setAccent: (v: AccentColor) => void;
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

const accentVars: Record<AccentColor, [string, string, string]> = {
  orange: ['#ff8a3d', '#ff4d8d', 'rgba(255,138,61,.28)'],
  violet: ['#8b7bff', '#ff69c6', 'rgba(139,123,255,.30)'],
  blue: ['#38bdf8', '#818cf8', 'rgba(56,189,248,.28)'],
  emerald: ['#22c55e', '#14b8a6', 'rgba(34,197,94,.26)']
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Lang>((localStorage.getItem('qv_lang') as Lang) || 'en');
  const [theme, setTheme] = useState<ThemeMode>((localStorage.getItem('qv_theme') as ThemeMode) || 'system');
  const [accent, setAccent] = useState<AccentColor>((localStorage.getItem('qv_accent') as AccentColor) || 'orange');
  const [country, setCountry] = useState<Country>('EG');
  const [session, setSession] = useState<QalveroSession>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  async function refreshProfile() {
    if (!supabase || !session?.user) {
      setProfile(null);
      setCountry('EG');
      return;
    }
    const { data } = await supabase.from('qv_profiles').select('*').eq('id', session.user.id).maybeSingle();
    setProfile(data as Profile | null);
    if (data?.country) setCountry(data.country as Country);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('qv_demo_email');
    setSession(null);
    setUser(null);
    setProfile(null);
    setCountry('EG');
  }

  useEffect(() => {
    let mounted = true;
    if (!hasSupabase || !supabase) {
      setLoadingAuth(false);
      setProfile(null);
      setCountry('EG');
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user || null);
      setLoadingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user || null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [session?.user?.id]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    localStorage.setItem('qv_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('qv_theme', theme);
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      document.body.classList.toggle('light', resolved === 'light');
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('qv_accent', accent);
    const [a1, a2, glow] = accentVars[accent];
    document.documentElement.style.setProperty('--accent-1', a1);
    document.documentElement.style.setProperty('--accent-2', a2);
    document.documentElement.style.setProperty('--accent-glow', glow);
  }, [accent]);

  async function updateCountry(next: Country) {
    if (!supabase || !session?.user) return;
    setCountry(next);
    await supabase
      .from('qv_profiles')
      .update({ country: next })
      .eq('id', session.user.id);
    await refreshProfile();
  }

  // Billing country is intentionally account-bound. Guests always use the default
  // preview country and cannot persist or switch regions through localStorage.

  const v = useMemo(
    () => ({ lang, setLang, theme, setTheme, accent, setAccent, country, setCountry: updateCountry, session, user, profile, loadingAuth, refreshProfile, signOut }),
    [lang, theme, accent, country, session, user, profile, loadingAuth]
  );
  return <C.Provider value={v}>{children}</C.Provider>;
};

export const useApp = () => useContext(C)!;
