export type AiModel='qlo-flash'|'qlo-pro'|'qlo-reason';
export type AiProvider='auto'|'gemini'|'groq'|'openrouter';
import { supabase } from './supabase';
export async function sendAiMessage(input:{message:string;model:AiModel;provider:AiProvider;lang:string}){
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(session?.access_token) headers.Authorization=`Bearer ${session.access_token}`;
  const r=await fetch('/api/qalvero-ai',{method:'POST',headers,body:JSON.stringify(input)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||'AI backend is not ready. Add API keys in Vercel Environment Variables and redeploy.');
  return data.reply as string
}
