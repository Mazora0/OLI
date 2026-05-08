import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import type { Lang } from '../lib/i18n';import type { Country } from '../data/pricing';
import { supabase,supabaseReady } from '../lib/supabase';
type User={email:string;plan:'Free'|'Standard'|'Premium';country:Country}|null;
type Ctx={lang:Lang;setLang:(l:Lang)=>void;theme:'dark'|'light';toggleTheme:()=>void;country:Country;setCountry:(c:Country)=>void;user:User;loading:boolean;login:(email:string,password:string)=>Promise<string|null>;signup:(email:string,password:string,country:Country)=>Promise<string|null>;logout:()=>Promise<void>;refresh:()=>Promise<void>};
const AppCtx=createContext<Ctx>(null as any);
export function AppProvider({children}:{children:React.ReactNode}){const [lang,setLangState]=useState<Lang>((localStorage.getItem('qv_lang') as Lang)||'en');const [theme,setTheme]=useState<'dark'|'light'>((localStorage.getItem('qv_theme') as any)||'dark');const [country,setCountryState]=useState<Country>((localStorage.getItem('qv_country') as Country)||'EG');const [user,setUser]=useState<User>(null);const [loading,setLoading]=useState(true);
 const setLang=(l:Lang)=>{setLangState(l);localStorage.setItem('qv_lang',l);document.documentElement.dir=l==='ar'?'rtl':'ltr'};
 const setCountry=(c:Country)=>{setCountryState(c);localStorage.setItem('qv_country',c)};
 const toggleTheme=()=>setTheme(v=>{const n=v==='dark'?'light':'dark';localStorage.setItem('qv_theme',n);return n});
 async function loadProfile(email?:string){if(!supabaseReady||!supabase){const e=localStorage.getItem('qv_demo_email');setUser(e?{email:e,plan:(localStorage.getItem('qv_demo_plan') as any)||'Free',country:country}:null);setLoading(false);return}
  const {data:{user:authUser}}=await supabase.auth.getUser(); if(!authUser){setUser(null);setLoading(false);return}
  const {data}=await supabase.from('qv_profiles').select('email,country').eq('id',authUser.id).maybeSingle();
  const {data:sub}=await supabase.from('qv_subscriptions').select('plan,status').eq('user_id',authUser.id).eq('status','active').maybeSingle();
  const profileCountry=(data?.country as Country)||country;
  setCountryState(profileCountry); localStorage.setItem('qv_country', profileCountry);
  setUser({email:authUser.email||data?.email||email,plan:(sub?.plan as any)||'Free',country:profileCountry});setLoading(false)}
 useEffect(()=>{document.documentElement.className=theme;document.documentElement.dir=lang==='ar'?'rtl':'ltr'},[theme,lang]);
 useEffect(()=>{loadProfile(); if(!supabaseReady||!supabase)return; const {data:{subscription}}=supabase.auth.onAuthStateChange(()=>loadProfile());return()=>subscription.unsubscribe()},[]);
 const login=async(email:string,password:string)=>{setLoading(true); if(supabaseReady&&supabase){const {error}=await supabase.auth.signInWithPassword({email,password});setLoading(false);return error?.message||null}localStorage.setItem('qv_demo_email',email);await loadProfile(email);return null};
 const signup=async(email:string,password:string,c:Country)=>{setLoading(true);setCountry(c); if(supabaseReady&&supabase){const {error}=await supabase.auth.signUp({email,password,options:{data:{country:c}}});setLoading(false);return error?.message||null}localStorage.setItem('qv_demo_email',email);localStorage.setItem('qv_country',c);await loadProfile(email);return null};
 const logout=async()=>{if(supabaseReady&&supabase)await supabase.auth.signOut();localStorage.removeItem('qv_demo_email');setUser(null)};
 const value=useMemo(()=>({lang,setLang,theme,toggleTheme,country,setCountry,user,loading,login,signup,logout,refresh:loadProfile}),[lang,theme,country,user,loading]); return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>}
export const useApp=()=>useContext(AppCtx);
