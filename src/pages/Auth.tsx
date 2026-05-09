import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Globe2, Lock, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { hasSupabase, supabase } from '../lib/supabase';
import { countries, type Country } from '../lib/pricing';
import { useApp } from '../context/AppContext';

type AuthMode = 'login' | 'signup' | 'forgot';

const copy = {
  ar: {
    brand: 'Qalvero AI',
    hello: 'أهلاً بيك نورت',
    loginTitle: 'تسجيل الدخول',
    signupTitle: 'إنشاء حساب',
    forgotTitle: 'استرجاع كلمة المرور',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    fullName: 'الاسم الكامل',
    country: 'الدولة',
    forgot: 'نسيت كلمة المرور؟',
    login: 'تسجيل الدخول',
    signup: 'سجل الآن',
    create: 'إنشاء الحساب',
    reset: 'إرسال رابط الاسترجاع',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'لديك حساب؟',
    agree: 'أوافق على الشروط والخصوصية وسياسة الاستخدام.',
    needAgree: 'لازم توافق على الشروط والخصوصية الأول.',
    authMissing: 'Supabase Auth مش متفعل. ضيف مفاتيح Supabase في Vercel الأول.',
    resetSent: 'تم إرسال رابط استرجاع كلمة المرور على البريد.',
    created: 'تم إنشاء الحساب. لو تأكيد البريد متفعل، افتح الإيميل وبعدها سجّل دخول.',
    backLogin: 'رجوع لتسجيل الدخول',
    enterEmail: 'اكتب بريدك الإلكتروني',
    enterPassword: 'اكتب كلمة المرور',
    enterName: 'اكتب اسمك'
  },
  en: {
    brand: 'Qalvero AI',
    hello: 'Welcome back to',
    loginTitle: 'Sign in',
    signupTitle: 'Create account',
    forgotTitle: 'Reset password',
    email: 'Email',
    password: 'Password',
    fullName: 'Full name',
    country: 'Country',
    forgot: 'Forgot password?',
    login: 'Sign in',
    signup: 'Sign up now',
    create: 'Create account',
    reset: 'Send reset link',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    agree: 'I agree to the terms, privacy policy, and usage policy.',
    needAgree: 'You need to agree to the terms first.',
    authMissing: 'Supabase Auth is not configured. Add Supabase keys in Vercel first.',
    resetSent: 'Password reset link sent to your email.',
    created: 'Account created. If email confirmation is enabled, check your inbox then sign in.',
    backLogin: 'Back to sign in',
    enterEmail: 'Enter your email',
    enterPassword: 'Enter your password',
    enterName: 'Enter your name'
  }
};

function useAuthCopy() {
  const { lang } = useApp();
  return lang === 'ar' ? copy.ar : copy.en;
}

function AuthField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 px-1 text-sm font-black text-slate-200">{label}</div>
      <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 shadow-inner shadow-black/20 transition focus-within:border-[var(--accent-1)] focus-within:shadow-[0_0_0_4px_var(--accent-glow)]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-[var(--accent-1)]">{icon}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </label>
  );
}

function AuthShell({ mode, children, message }: { mode: AuthMode; children: ReactNode; message?: string }) {
  const c = useAuthCopy();
  const title = mode === 'login' ? c.loginTitle : mode === 'signup' ? c.signupTitle : c.forgotTitle;
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(59,130,246,.18),transparent_25%),radial-gradient(circle_at_85%_45%,rgba(244,63,94,.16),transparent_27%),radial-gradient(circle_at_60%_100%,rgba(249,115,22,.13),transparent_32%)]" />
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-10 flex flex-col items-center gap-3 text-center">
          <img src="/favicon.svg" alt="Qalvero AI" className="h-20 w-20 rounded-[1.8rem] object-contain drop-shadow-[0_0_22px_var(--accent-glow)]" />
          <div className="text-3xl font-black tracking-tight">Qalvero AI</div>
        </Link>

        <h1 className="mb-7 text-center text-4xl font-black leading-tight md:text-5xl">
          {c.hello} <span className="grad">QLO</span>
        </h1>

        <section className="auth-card rounded-[2rem] p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-black">{title}</div>
              <div className="mt-1 text-sm text-slate-400">{c.brand} · QLO 1.2</div>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 text-[var(--accent-1)]"><Sparkles size={20} /></div>
          </div>
          {children}
          {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">{message}</div>}
        </section>
      </div>
    </main>
  );
}

export function Login() {
  const c = useAuthCopy();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function go(e?: FormEvent) {
    e?.preventDefault();
    setMsg('');
    if (!hasSupabase || !supabase) return setMsg(c.authMissing);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return setMsg(error.message);
    nav('/');
  }

  return (
    <AuthShell mode="login" message={msg}>
      <form className="grid gap-4" onSubmit={go}>
        <AuthField icon={<Mail size={20} />} label={c.email}>
          <input className="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-slate-500" dir="auto" type="email" required placeholder={c.enterEmail} value={email} onChange={(e) => setEmail(e.target.value)} />
        </AuthField>
        <AuthField icon={<Lock size={20} />} label={c.password}>
          <div className="flex items-center gap-2">
            <input className="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-slate-500" dir="auto" type={showPassword ? 'text' : 'password'} required placeholder={c.enterPassword} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="text-slate-400 hover:text-white" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </AuthField>
        <Link className="text-end text-sm font-bold text-[var(--accent-1)]" to="/forgot-password">{c.forgot}</Link>
        <button className="btn btn-primary mt-2 h-14 w-full text-lg" disabled={loading}>{loading ? '...' : c.login}</button>
      </form>
      <div className="mt-7 text-center text-sm text-slate-300">
        {c.noAccount} <Link className="font-black text-[var(--accent-1)]" to="/signup">{c.signup}</Link>
      </div>
    </AuthShell>
  );
}

export function Signup() {
  const c = useAuthCopy();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState<Country>('EG');
  const [accepted, setAccepted] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function go(e?: FormEvent) {
    e?.preventDefault();
    setMsg('');
    if (!accepted) return setMsg(c.needAgree);
    if (!hasSupabase || !supabase) return setMsg(c.authMissing);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { country, full_name: fullName.trim(), avatar_id: 'neo' } }
    });
    setLoading(false);
    if (error) return setMsg(error.message);
    if (data.session) nav('/');
    else setMsg(c.created);
  }

  return (
    <AuthShell mode="signup" message={msg}>
      <form className="grid gap-4" onSubmit={go}>
        <AuthField icon={<UserRound size={20} />} label={c.fullName}>
          <input className="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-slate-500" dir="auto" required placeholder={c.enterName} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </AuthField>
        <AuthField icon={<Mail size={20} />} label={c.email}>
          <input className="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-slate-500" dir="auto" type="email" required placeholder={c.enterEmail} value={email} onChange={(e) => setEmail(e.target.value)} />
        </AuthField>
        <AuthField icon={<Lock size={20} />} label={c.password}>
          <div className="flex items-center gap-2">
            <input className="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-slate-500" dir="auto" type={showPassword ? 'text' : 'password'} minLength={6} required placeholder={c.enterPassword} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="text-slate-400 hover:text-white" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password visibility">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </AuthField>
        <AuthField icon={<Globe2 size={20} />} label={c.country}>
          <select className="w-full border-0 bg-transparent py-2 text-lg outline-none" value={country} onChange={(e) => setCountry(e.target.value as Country)}>
            {countries.map((item) => <option key={item[0]} value={item[0]}>{item[1]}</option>)}
          </select>
        </AuthField>
        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-300">
          <input className="mt-1" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span><ShieldCheck className="me-1 inline h-4 w-4 text-[var(--accent-1)]" /> {c.agree} <Link className="font-bold text-[var(--accent-1)]" to="/legal">Legal</Link></span>
        </label>
        <button className="btn btn-primary mt-2 h-14 w-full text-lg" disabled={loading}>{loading ? '...' : c.create}</button>
      </form>
      <div className="mt-7 text-center text-sm text-slate-300">
        {c.haveAccount} <Link className="font-black text-[var(--accent-1)]" to="/login">{c.login}</Link>
      </div>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const c = useAuthCopy();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function go(e?: FormEvent) {
    e?.preventDefault();
    setMsg('');
    if (!hasSupabase || !supabase) return setMsg(c.authMissing);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/settings` });
    setLoading(false);
    setMsg(error ? error.message : c.resetSent);
  }

  return (
    <AuthShell mode="forgot" message={msg}>
      <form className="grid gap-4" onSubmit={go}>
        <AuthField icon={<Mail size={20} />} label={c.email}>
          <input className="w-full border-0 bg-transparent py-2 text-lg outline-none placeholder:text-slate-500" dir="auto" type="email" required placeholder={c.enterEmail} value={email} onChange={(e) => setEmail(e.target.value)} />
        </AuthField>
        <button className="btn btn-primary mt-2 h-14 w-full text-lg" disabled={loading}>{loading ? '...' : c.reset}</button>
      </form>
      <div className="mt-7 text-center text-sm text-slate-300">
        <Link className="inline-flex items-center gap-2 font-black text-[var(--accent-1)]" to="/login"><ArrowRight size={16} /> {c.backLogin}</Link>
      </div>
    </AuthShell>
  );
}
