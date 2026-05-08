import { useState } from 'react';
import { Check } from 'lucide-react';
import { prices, countries, limits, type Country } from '../data/pricing';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

type PaidPlan = 'Standard' | 'Premium';

export default function Pricing(){
  const {country,setCountry,user}=useApp();
  const [status,setStatus]=useState('');
  const [loading,setLoading]=useState<string|null>(null);
  const p=prices[country];
  const cards=[
    {name:'Free',price:'$0',note:'Always free',items:limits.Free.features},
    {name:'Standard',price:p.standard,note:`per month • ${p.currency}`,items:limits.Standard.features},
    {name:'Premium',price:p.premium,note:`per month • ${p.currency}`,items:limits.Premium.features}
  ];

  async function requestInvoice(plan:PaidPlan){
    if(!user){ setStatus('Create an account or log in first, then request your PayPal invoice.'); return; }
    setLoading(plan); setStatus('');
    try{
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const headers:Record<string,string>={'Content-Type':'application/json'};
      if(session?.access_token) headers.Authorization=`Bearer ${session.access_token}`;
      const amount = plan==='Standard'?p.standard:p.premium;
      const r=await fetch('/api/request-invoice',{method:'POST',headers,body:JSON.stringify({plan,country,currency:p.currency,amount,email:user.email})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'Could not save request');
      setStatus('Upgrade request saved. Send the PayPal invoice from your PayPal dashboard, then update the user plan in Supabase after payment.');
    }catch(e:any){setStatus(e.message||'Request failed');}
    finally{setLoading(null)}
  }

  return <div className="mx-auto max-w-7xl px-4 py-10">
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-cyan-300">Regional pricing</p>
        <h1 className="text-3xl font-bold sm:text-5xl">Plans that scale with your Qalvero usage.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Egypt pricing is intentionally lower. PayPal invoice requests are ready now. Stripe, Lemon Squeezy, or Paymob webhooks can be connected later.</p>
      </div>
      <select value={country} onChange={e=>setCountry(e.target.value as Country)} className="rounded-2xl border border-white/10 bg-white/5 p-3">
        {countries.map(([c,n])=><option className="bg-slate-950" value={c} key={c}>{n}</option>)}
      </select>
    </div>
    {status&&<div className="mb-5 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-sm text-cyan-100">{status}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c,i)=><div key={c.name} className={`glass rounded-3xl p-6 ${i===2?'ring-1 ring-cyan-300/40':''}`}>
        <h2 className="text-2xl font-bold">{c.name}</h2>
        <p className="mt-4 text-4xl font-black">{c.price}</p>
        <p className="text-sm text-slate-400">{c.note}</p>
        <div className="mt-6 space-y-3">{c.items.map(x=><div className="flex gap-2 text-sm text-slate-300" key={x}><Check className="h-4 w-4 text-cyan-300"/>{x}</div>)}</div>
        {c.name==='Free'?<button className="mt-6 w-full rounded-2xl bg-white py-3 font-bold text-slate-950">{user?'Current plan':'Start free'}</button>:
          <button onClick={()=>requestInvoice(c.name as PaidPlan)} disabled={loading===c.name} className="mt-6 w-full rounded-2xl bg-white py-3 font-bold text-slate-950 disabled:opacity-60">{loading===c.name?'Saving request...':'Request PayPal invoice'}</button>}
      </div>)}
    </div>
  </div>
}
