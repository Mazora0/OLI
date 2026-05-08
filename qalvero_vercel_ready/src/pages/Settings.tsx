import { useState } from 'react';
import { countries, prices, type Country } from '../data/pricing';
import { languages } from '../lib/i18n';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

export default function Settings(){
  const {country,setCountry,lang,setLang,theme,toggleTheme,user,refresh}=useApp();
  const [msg,setMsg]=useState('');
  async function updateCountry(c:Country){
    setCountry(c); setMsg('');
    if(supabase&&user){
      const {data:{user:authUser}}=await supabase.auth.getUser();
      if(authUser){
        await supabase.from('qv_profiles').update({country:c,currency:prices[c].currency}).eq('id',authUser.id);
        setMsg('Billing country updated.');
        refresh();
      }
    }
  }
  return <div className="mx-auto max-w-3xl px-4 py-10"><div className="glass rounded-3xl p-6"><h1 className="text-3xl font-bold">Account Settings</h1><p className="mt-2 text-slate-400">{user?.email||'Guest mode. Add Supabase keys for real accounts.'}</p>{msg&&<p className="mt-3 rounded-2xl bg-cyan-300/10 p-3 text-sm text-cyan-200">{msg}</p>}<div className="mt-6 grid gap-4"><label>Billing country<select value={country} onChange={e=>updateCountry(e.target.value as Country)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3">{countries.map(([c,n])=><option className="bg-slate-950" value={c} key={c}>{n}</option>)}</select></label><label>Site language<select value={lang} onChange={e=>setLang(e.target.value as any)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3">{languages.map(([v,l])=><option className="bg-slate-950" value={v} key={v}>{l}</option>)}</select></label><button onClick={toggleTheme} className="rounded-2xl bg-white px-5 py-3 font-bold text-slate-950">Switch to {theme==='dark'?'light':'dark'} mode</button></div></div></div>
}
