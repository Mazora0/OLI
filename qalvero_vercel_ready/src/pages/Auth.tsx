import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { countries, type Country } from '../data/pricing';
import { supabase, supabaseReady } from '../lib/supabase';
import Logo from '../components/Logo';

export function Login(){
  const {login}=useApp();const nav=useNavigate();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [msg,setMsg]=useState('');
  async function onSubmit(e:FormEvent){e.preventDefault();const err=await login(email,password);if(err)setMsg(err);else nav('/dashboard')}
  return <AuthBox title="Login to Qalvero"><form onSubmit={onSubmit} className="space-y-3"><Input label="Email" value={email} set={setEmail}/><Input label="Password" type="password" value={password} set={setPassword}/>{msg&&<p className="text-sm text-red-300">{msg}</p>}<button className="w-full rounded-2xl bg-white py-3 font-bold text-slate-950">Login</button><Link className="block text-center text-sm text-cyan-300" to="/forgot-password">Forgot password?</Link></form></AuthBox>
}

export function Signup(){
  const {signup}=useApp();const nav=useNavigate();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [country,setCountry]=useState<Country>('EG');const [msg,setMsg]=useState('');
  async function onSubmit(e:FormEvent){e.preventDefault();const err=await signup(email,password,country);if(err)setMsg(err);else nav('/dashboard')}
  return <AuthBox title="Create your Qalvero account"><form onSubmit={onSubmit} className="space-y-3"><Input label="Email" value={email} set={setEmail}/><Input label="Password" type="password" value={password} set={setPassword}/><label className="block text-sm text-slate-300">Country<select value={country} onChange={e=>setCountry(e.target.value as Country)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3">{countries.map(([c,n])=><option className="bg-slate-950" value={c} key={c}>{n}</option>)}</select></label>{msg&&<p className="text-sm text-red-300">{msg}</p>}<button className="w-full rounded-2xl bg-white py-3 font-bold text-slate-950">Create account</button></form></AuthBox>
}

export function ForgotPassword(){
  const [email,setEmail]=useState('');const [msg,setMsg]=useState('');
  async function onSubmit(e:FormEvent){
    e.preventDefault();
    if(!supabaseReady||!supabase){setMsg('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');return;}
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/login`});
    setMsg(error?.message||'Password reset email sent if this account exists.');
  }
  return <AuthBox title="Reset password"><form onSubmit={onSubmit} className="space-y-3"><Input label="Email" value={email} set={setEmail}/>{msg&&<p className="text-sm text-cyan-200">{msg}</p>}<button className="w-full rounded-2xl bg-white py-3 font-bold text-slate-950">Send reset link</button><Link to="/login" className="block text-center text-sm text-cyan-300">Back to login</Link></form></AuthBox>
}

function AuthBox({title,children}:{title:string;children:React.ReactNode}){return <div className="grid min-h-[calc(100vh-160px)] place-items-center px-4 py-10"><div className="glass w-full max-w-md rounded-3xl p-6"><div className="mb-6"><Logo/><h1 className="mt-6 text-2xl font-bold">{title}</h1><p className="text-sm text-slate-400">Real Supabase Auth is used when Vercel environment keys are added.</p></div>{children}</div></div>}
function Input({label,type='text',value,set}:{label:string;type?:string;value:string;set:(v:string)=>void}){return <label className="block text-sm text-slate-300">{label}<input required type={type} value={value} onChange={e=>set(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none"/></label>}
