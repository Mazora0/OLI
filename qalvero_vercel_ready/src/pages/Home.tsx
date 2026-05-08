import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles, Shield, Zap, Settings2, Globe2 } from 'lucide-react';
import { sendAiMessage, type AiModel, type AiProvider } from '../lib/aiClient';
import { useApp } from '../context/AppContext';
import { tr } from '../lib/i18n';

type Msg={role:'user'|'assistant';text:string};
const qloModels:{id:AiModel;label:string;sub:string}[]=[
  {id:'qlo-flash',label:'QLO 1.2 Flash',sub:'Fast everyday assistant'},
  {id:'qlo-pro',label:'QLO 1.2 Pro',sub:'Better writing and planning'},
  {id:'qlo-reason',label:'QLO 1.2 Reason',sub:'Deeper thinking mode'},
];

export default function Home(){
  const {lang,user}=useApp();
  const [model,setModel]=useState<AiModel>('qlo-flash');
  const [provider,setProvider]=useState<AiProvider>('auto');
  const [showAdvanced,setShowAdvanced]=useState(false);
  const [messages,setMessages]=useState<Msg[]>([{role:'assistant',text:'Hi, I am QLO 1.2. Ask me to plan, write, study, summarize, brainstorm, or organize your day.'}]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const end=useRef<HTMLDivElement>(null);
  const selected=qloModels.find(m=>m.id===model)!;
  useEffect(()=>end.current?.scrollIntoView({behavior:'smooth'}),[messages,busy]);
  async function submit(e?:React.FormEvent){
    e?.preventDefault();
    if(!input.trim()||busy)return;
    const text=input.trim();
    setInput('');
    setMessages(m=>[...m,{role:'user',text}]);
    setBusy(true);
    try{
      const reply=await sendAiMessage({message:text,model,provider,lang});
      setMessages(m=>[...m,{role:'assistant',text:reply}]);
    }catch(err:any){
      setMessages(m=>[...m,{role:'assistant',text:`QLO 1.2 backend is not connected yet: ${err.message}. Add Gemini/Groq/OpenRouter keys in Vercel Environment Variables and redeploy. If Supabase is configured, log in first.`}]);
    }finally{setBusy(false)}
  }
  return <section className="relative overflow-hidden">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(139,92,246,.20),transparent_28%),linear-gradient(180deg,rgba(255,255,255,.03),transparent_35%)]"/>
    <div className="mx-auto grid min-h-[calc(100vh-74px)] max-w-7xl gap-4 px-3 py-4 sm:px-6 lg:grid-cols-[320px_1fr]">
      <aside className="glass order-2 rounded-3xl p-4 lg:order-1">
        <div className="mb-4 flex items-center gap-3">
          <img src="/qalvero-mark.png" alt="Qalvero AI" className="h-12 w-12 rounded-2xl object-contain shadow-[0_0_34px_rgba(34,211,238,.28)]"/>
          <div>
            <p className="font-bold">Qalvero AI</p>
            <p className="text-xs text-slate-400">Powered by QLO 1.2</p>
          </div>
        </div>
        <button onClick={()=>setMessages([{role:'assistant',text:'New chat started. What should we build, solve, or plan?'}])} className="mb-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950">{tr(lang,'newChat')}</button>
        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs text-slate-400">{tr(lang,'model')}</label>
            <select value={model} onChange={e=>setModel(e.target.value as AiModel)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none">
              {qloModels.map(m=><option className="bg-slate-950" value={m.id} key={m.id}>{m.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-slate-500">{selected.sub}. Gemini is hidden as an internal engine, not a public model name.</p>
          </div>
          <button type="button" onClick={()=>setShowAdvanced(!showAdvanced)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm text-slate-300">
            <span className="flex items-center gap-2"><Settings2 size={16}/> Advanced engine</span><span>{showAdvanced?'−':'+'}</span>
          </button>
          {showAdvanced&&<div>
            <label className="mb-2 block text-xs text-slate-400">Internal provider</label>
            <select value={provider} onChange={e=>setProvider(e.target.value as AiProvider)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none">
              <option className="bg-slate-950" value="auto">Auto fallback</option>
              <option className="bg-slate-950" value="gemini">Gemini engine</option>
              <option className="bg-slate-950" value="groq">Groq engine</option>
              <option className="bg-slate-950" value="openrouter">OpenRouter engine</option>
            </select>
          </div>}
        </div>
        <div className="mt-5 grid gap-3 text-sm text-slate-300">
          <Feature icon={<Zap/>} title="Fast mobile-first assistant"/>
          <Feature icon={<Shield/>} title="API keys stay server-side"/>
          <Feature icon={<Globe2/>} title="Website language is separate"/>
          <Feature icon={<Sparkles/>} title="Plans and usage ready"/>
        </div>
        <Link to={user?'/pricing':'/signup'} className="mt-5 block rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-center font-semibold text-cyan-200">{tr(lang,'upgrade')}</Link>
      </aside>
      <div className="order-1 flex min-h-[82vh] flex-col rounded-[2rem] border border-white/10 bg-[#0b1020]/80 shadow-glow light:bg-white lg:order-2">
        <div className="border-b border-white/10 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <img src="/qalvero-mark.png" alt="QLO 1.2" className="h-12 w-12 rounded-2xl object-contain shadow-[0_0_34px_rgba(139,92,246,.28)]"/>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold sm:text-3xl">{tr(lang,'welcome')}</h1>
              <p className="text-sm text-slate-400">{selected.label} • {tr(lang,'sub')}</p>
            </div>
          </div>
        </div>
        <div className="scrollbar flex-1 space-y-4 overflow-y-auto p-3 sm:p-6">
          {messages.map((m,i)=><div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}><div className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${m.role==='user'?'bg-gradient-to-br from-cyan-500 to-violet-500 text-white':'glass text-slate-100 light:text-slate-900'}`}>{m.text}</div></div>)}
          {busy&&<div className="glass inline-flex rounded-3xl px-4 py-3 text-sm text-slate-300">{selected.label} is thinking...</div>}
          <div ref={end}/>
        </div>
        <form onSubmit={submit} className="border-t border-white/10 p-3 sm:p-5">
          <div className="flex gap-2 rounded-[1.7rem] border border-white/10 bg-white/5 p-2 shadow-2xl">
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder={tr(lang,'placeholder')} className="min-w-0 flex-1 bg-transparent px-3 outline-none"/>
            <button disabled={busy} className="rounded-2xl bg-white px-4 py-3 font-semibold text-slate-950 disabled:opacity-60"><Send size={18}/></button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">QLO 1.2 can make mistakes. Review important answers before using them.</p>
        </form>
      </div>
    </div>
  </section>
}
function Feature({icon,title}:{icon:React.ReactNode;title:string}){return <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 text-slate-300 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-cyan-300">{icon}<span>{title}</span></div>}
