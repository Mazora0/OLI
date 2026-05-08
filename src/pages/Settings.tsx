import { useEffect, useState } from 'react';
import { Brain, Globe2, Save, Settings as SettingsIcon, UserRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { countries, currencyOf, type Country } from '../lib/pricing';
import { getAccessToken, hasSupabase, supabase } from '../lib/supabase';

type Memory = { display_name?: string; language?: string; goals?: string; study_level?: string; interests?: string; tone?: string; projects?: string; notes?: string[] };

export default function Settings() {
  const { lang, setLang, theme, setTheme, country, setCountry, profile, refreshProfile } = useApp();
  const [memory, setMemory] = useState<Memory>({});
  const [msg, setMsg] = useState('');

  useEffect(() => { loadMemory(); }, []);
  async function loadMemory() {
    const token = await getAccessToken();
    if (!token) return;
    const r = await fetch('/api/memory', { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    if (data.memory) setMemory(data.memory);
  }
  async function saveMemory() {
    setMsg('');
    const token = await getAccessToken();
    if (!token) return setMsg('Login with Supabase first to save memory.');
    const r = await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ memory }) });
    const data = await r.json();
    setMsg(data.error || 'Memory saved.');
  }
  async function saveProfile() {
    localStorage.setItem('qv_country', country);
    if (hasSupabase && supabase && profile?.id) {
      await supabase.from('qv_profiles').update({ country, currency: currencyOf(country) }).eq('id', profile.id);
      await refreshProfile();
    }
    setMsg('Settings saved.');
  }

  return <section className="mx-auto max-w-5xl"><div className="mb-6"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[.18em]"><SettingsIcon size={14} /> Account settings</div><h1 className="mt-4 text-4xl font-black md:text-6xl">Personalize <span className="grad">QLO</span></h1><p className="mt-3 text-slate-400">Keep memory compact. QLO stores only basics, not full chat history, unless you add saved chats later.</p></div><div className="grid gap-5 lg:grid-cols-[1fr_1fr]"><div className="card rounded-[2rem] p-5"><div className="mb-4 flex items-center gap-2 text-xl font-black"><Globe2 className="text-cyan-300" /> Platform</div><div className="grid gap-3"><label className="text-sm font-bold">Language</label><select className="field" value={lang} onChange={(e) => setLang(e.target.value as any)}><option value="en">English 🇺🇸</option><option value="ar">عربي مصري 🇪🇬</option><option value="fr">French 🇫🇷</option><option value="es">Spanish 🇪🇸</option><option value="de">German 🇩🇪</option><option value="tr">Turkish 🇹🇷</option><option value="ja">Japanese 🇯🇵</option></select><label className="text-sm font-bold">Billing country</label><select className="field" value={country} onChange={(e) => setCountry(e.target.value as Country)}>{countries.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}</select><label className="text-sm font-bold">Theme</label><button className="btn btn-soft" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</button><button className="btn btn-primary" onClick={saveProfile}><Save size={18} /> Save platform settings</button></div></div><div className="card rounded-[2rem] p-5"><div className="mb-4 flex items-center gap-2 text-xl font-black"><Brain className="text-cyan-300" /> Compact QLO memory</div><div className="grid gap-3"><input className="field" placeholder="Preferred name" value={memory.display_name || ''} onChange={(e) => setMemory({ ...memory, display_name: e.target.value })} /><input className="field" placeholder="Main goal" value={memory.goals || ''} onChange={(e) => setMemory({ ...memory, goals: e.target.value })} /><input className="field" placeholder="Study level / work role" value={memory.study_level || ''} onChange={(e) => setMemory({ ...memory, study_level: e.target.value })} /><input className="field" placeholder="Interests" value={memory.interests || ''} onChange={(e) => setMemory({ ...memory, interests: e.target.value })} /><select className="field" value={memory.tone || ''} onChange={(e) => setMemory({ ...memory, tone: e.target.value })}><option value="">Preferred tone</option><option>Direct and short</option><option>Detailed teacher</option><option>Business professional</option><option>Egyptian Arabic casual</option></select><button className="btn btn-primary" onClick={saveMemory}><UserRound size={18} /> Save QLO memory</button></div></div></div><div className="mt-5 rounded-[2rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">{msg || 'Memory is intentionally small: name, country, goals, level, interests, tone, and a few notes. Big-company behavior without storing a digital diary of every sigh.'}</div></section>;
}
