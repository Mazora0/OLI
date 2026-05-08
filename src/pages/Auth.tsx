import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hasSupabase, supabase } from '../lib/supabase';
import { countries, type Country } from '../lib/pricing';
import { Logo } from '../components/Logo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const nav = useNavigate();
  async function go() {
    setMsg('');
    if (hasSupabase && supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMsg(error.message);
    } else localStorage.setItem('qv_demo_email', email || 'demo@qalvero.com');
    nav('/dashboard');
  }
  return <AuthShell title="Login to Qalvero"><input className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><input className="field" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="btn btn-primary" onClick={go}>Login</button><Link className="text-center text-sm text-cyan-200" to="/forgot-password">Forgot password?</Link><p className="text-center text-sm opacity-60">{hasSupabase ? 'Supabase Auth enabled.' : 'Demo mode until Supabase keys are added.'}</p>{msg && <p className="rounded-2xl bg-red-400/10 p-3 text-sm text-red-200">{msg}</p>}</AuthShell>;
}

export function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState<Country>('EG');
  const [accepted, setAccepted] = useState(false);
  const [msg, setMsg] = useState('');
  const nav = useNavigate();
  async function go() {
    setMsg('');
    if (!accepted) return setMsg('لازم توافق على الشروط والخصوصية الأول. آه، القانون بيحب يعمل ظهور مفاجئ.');
    localStorage.setItem('qv_country', country);
    if (hasSupabase && supabase) {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { country, full_name: fullName } } });
      if (error) return setMsg(error.message);
      setMsg('Account created. Check your email if confirmation is enabled, then login.');
    } else {
      localStorage.setItem('qv_demo_email', email || 'demo@qalvero.com');
      nav('/dashboard');
    }
  }
  return <AuthShell title="Create your Qalvero account"><input className="field" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} /><input className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><input className="field" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} /><select className="field" value={country} onChange={(e) => setCountry(e.target.value as Country)}>{countries.map((c) => <option key={c[0]} value={c[0]}>{c[1]}</option>)}</select><label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>I agree to the <Link className="text-cyan-200" to="/legal">Terms, Privacy Policy, Refund Policy, Content Policy, and Data Usage Policy</Link>.</span></label><button className="btn btn-primary" onClick={go}>Create account</button>{msg && <p className="rounded-2xl bg-cyan-400/10 p-3 text-sm text-cyan-100">{msg}</p>}<p className="text-center text-sm opacity-60">Already have an account? <Link className="text-cyan-200" to="/login">Login</Link></p></AuthShell>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  async function go() {
    if (!hasSupabase || !supabase) return setMsg('Add Supabase keys first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/settings` });
    setMsg(error ? error.message : 'Password reset email sent.');
  }
  return <AuthShell title="Reset password"><input className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><button className="btn btn-primary" onClick={go}>Send reset link</button>{msg && <p className="rounded-2xl bg-white/10 p-3 text-sm">{msg}</p>}</AuthShell>;
}

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="grid min-h-[80vh] place-items-center"><div className="glass w-full max-w-md rounded-[2rem] p-6"><div className="mb-4 flex justify-center"><Logo /></div><h1 className="mb-5 text-center text-3xl font-black">{title}</h1><div className="grid gap-3">{children}</div></div></div>;
}
