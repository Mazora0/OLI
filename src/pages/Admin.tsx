import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, Database, RefreshCw, Shield, Sparkles, Trash2, Users, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAccessToken } from '../lib/supabase';

type PreflightData = {
  ok?: boolean;
  summary?: { blockers: number; warnings: number; passed: number };
  checks?: Array<{ id: string; label: string; status: 'ok' | 'warn' | 'fail'; message: string }>;
  error?: string;
};

type AdminData = {
  ok?: boolean;
  error?: string;
  status?: Record<string, boolean>;
  users?: { recentProfiles?: number; byPlan?: Record<string, number>; byCountry?: Record<string, number> };
  usage?: {
    todayEvents?: number;
    weekEvents?: number;
    chargedToday?: number;
    cachedToday?: number;
    optimizedToday?: number;
    promptTokensToday?: number;
    responseTokensToday?: number;
    byKindToday?: Record<string, number>;
    byModelToday?: Record<string, number>;
    byRouteToday?: Record<string, number>;
    latest?: Array<Record<string, any>>;
  };
  errors?: { count?: number; latest?: Array<Record<string, any>> };
  training?: { weekExamples?: number; byLanguage?: Record<string, number>; byTask?: Record<string, number> };
  limits?: Record<string, any>;
  rateLimits?: Array<Record<string, any>>;
};

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string | number; hint?: string }) {
  return (
    <div className="card rounded-[1.6rem] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-[var(--accent-1)]">{icon}</div>
        <div className="text-right rtl:text-left">
          <div className="text-2xl font-black">{value}</div>
          <div className="text-xs soft-text">{label}</div>
        </div>
      </div>
      {hint && <div className="mt-3 text-xs soft-text">{hint}</div>}
    </div>
  );
}

function KeyList({ data }: { data?: Record<string, number | boolean> }) {
  const items = Object.entries(data || {}).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (!items.length) return <div className="soft-text text-sm">No data yet.</div>;
  return (
    <div className="space-y-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[.035] px-3 py-2 text-sm">
          <span className="font-bold">{k}</span>
          <span className={typeof v === 'boolean' ? (v ? 'text-emerald-400' : 'text-red-300') : 'soft-text'}>{typeof v === 'boolean' ? (v ? 'ready' : 'missing') : v}</span>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { lang, profile } = useApp();
  const ar = lang === 'ar';
  const [data, setData] = useState<AdminData>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [preflight, setPreflight] = useState<PreflightData>({});

  const totalTokens = useMemo(() => Number(data.usage?.promptTokensToday || 0) + Number(data.usage?.responseTokensToday || 0), [data]);


  async function loadPreflight() {
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/qlo-preflight', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await r.json();
      setPreflight(json);
    } catch {
      setPreflight({ error: ar ? 'فشل فحص التجهيز.' : 'Preflight check failed.' });
    }
  }

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/qlo-admin', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await r.json();
      setData(json);
      void loadPreflight();
      if (!r.ok) setMessage(json.error || 'Admin API failed.');
    } catch {
      setMessage(ar ? 'فشل الاتصال بلوحة الإدارة.' : 'Failed to load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }

  async function cleanup() {
    setLoading(true);
    setMessage('');
    try {
      const token = await getAccessToken();
      const r = await fetch('/api/qlo-admin?action=cleanup', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const json = await r.json();
      setMessage(r.ok ? (ar ? 'تم تنظيف اللوجات والكاش القديم.' : 'Old logs and cache cleaned.') : (json.error || 'Cleanup failed.'));
      await load();
    } catch {
      setMessage(ar ? 'فشل التنظيف.' : 'Cleanup failed.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); void loadPreflight(); }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="hero-card rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black soft-text"><Shield size={14} /> Qalvero Admin</div>
            <h1 className="text-3xl font-black md:text-5xl">{ar ? 'لوحة مراقبة Qalvero' : 'Qalvero Operations Dashboard'}</h1>
            <p className="mt-3 max-w-2xl soft-text">{ar ? 'مراقبة استخدام الكريدت، الأخطاء، حالة الأدوات، التدريب، وحدود الحماية من مكان واحد.' : 'Monitor credits, errors, provider status, training data, and protection limits from one place.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={load} className="btn btn-soft" disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {ar ? 'تحديث' : 'Refresh'}</button>
            <button onClick={cleanup} className="btn btn-primary" disabled={loading}><Trash2 size={16} /> {ar ? 'تنظيف القديم' : 'Cleanup old'}</button>
          </div>
        </div>
        {message && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm soft-text">{message}</div>}
        {profile?.email && <div className="mt-3 text-xs soft-text">{ar ? 'الحساب الحالي:' : 'Current account:'} {profile.email}</div>}
      </section>


      <section className="card rounded-[2rem] p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black"><Shield size={20} /> {ar ? 'فحص ما قبل التشغيل' : 'Production preflight'}</h2>
            <p className="mt-1 text-sm soft-text">{ar ? 'فحص سريع للمفاتيح، Supabase، الجداول، البحث، Google Cloud، MCP، وحدود الحماية.' : 'Quickly checks keys, Supabase, schema tables, search, Google Cloud, MCP, and limits.'}</p>
          </div>
          <button onClick={loadPreflight} className="btn btn-soft" disabled={loading}><RefreshCw size={16} /> {ar ? 'افحص' : 'Run check'}</button>
        </div>
        {preflight.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{preflight.error}</div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-300">OK: {preflight.summary?.passed || 0}</span>
              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-yellow-200">Warnings: {preflight.summary?.warnings || 0}</span>
              <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-red-200">Blockers: {preflight.summary?.blockers || 0}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {(preflight.checks || []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <b>{item.label}</b>
                    <span className={item.status === 'ok' ? 'text-emerald-300' : item.status === 'warn' ? 'text-yellow-200' : 'text-red-200'}>{item.status}</span>
                  </div>
                  <p className="mt-1 soft-text">{item.message}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Activity size={20} />} label={ar ? 'أحداث اليوم' : 'Events today'} value={data.usage?.todayEvents || 0} />
        <StatCard icon={<Zap size={20} />} label={ar ? 'Tokens تقديري اليوم' : 'Est. tokens today'} value={totalTokens} />
        <StatCard icon={<Sparkles size={20} />} label={ar ? 'ردود محسنة/كاش' : 'Optimized/cached'} value={`${data.usage?.optimizedToday || 0}/${data.usage?.cachedToday || 0}`} />
        <StatCard icon={<AlertTriangle size={20} />} label={ar ? 'أخطاء حديثة' : 'Recent errors'} value={data.errors?.count || 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card rounded-[2rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><CheckCircle2 size={20} /> {ar ? 'حالة الخدمات' : 'Service status'}</h2>
          <KeyList data={data.status} />
        </div>
        <div className="card rounded-[2rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><BarChart3 size={20} /> {ar ? 'الاستخدام حسب النوع' : 'Usage by kind'}</h2>
          <KeyList data={data.usage?.byKindToday} />
        </div>
        <div className="card rounded-[2rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Database size={20} /> {ar ? 'تدريب QLO 1' : 'QLO 1 training'}</h2>
          <StatCard icon={<Database size={18} />} label={ar ? 'أمثلة آخر 7 أيام' : 'Examples last 7 days'} value={data.training?.weekExamples || 0} />
          <div className="mt-3"><KeyList data={data.training?.byLanguage} /></div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card rounded-[2rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Users size={20} /> {ar ? 'المستخدمين والخطط' : 'Users and plans'}</h2>
          <KeyList data={data.users?.byPlan} />
        </div>
        <div className="card rounded-[2rem] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Clock3 size={20} /> {ar ? 'الحدود الحالية' : 'Current limits'}</h2>
          <KeyList data={data.limits as any} />
        </div>
      </div>

      <div className="card rounded-[2rem] p-5">
        <h2 className="mb-4 text-xl font-black">{ar ? 'آخر الاستخدامات' : 'Latest usage'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="soft-text"><tr><th className="py-2 text-start">Kind</th><th className="py-2 text-start">Model</th><th className="py-2 text-start">Route</th><th className="py-2 text-start">Tokens</th><th className="py-2 text-start">Mode</th></tr></thead>
            <tbody>
              {(data.usage?.latest || []).map((row, idx) => (
                <tr key={idx} className="border-t border-white/10"><td className="py-2">{row.kind}</td><td>{row.model || '-'}</td><td>{row.route || '-'}</td><td>{row.tokens || 0}</td><td>{row.cached ? 'cache' : row.optimized ? 'optimized' : row.charged ? 'charged' : 'free'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card rounded-[2rem] p-5">
        <h2 className="mb-4 text-xl font-black">{ar ? 'آخر الأخطاء' : 'Latest errors'}</h2>
        <div className="space-y-2">
          {(data.errors?.latest || []).length ? data.errors?.latest?.map((e, idx) => (
            <div key={idx} className="rounded-2xl border border-white/10 bg-white/[.035] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><b>{e.scope}</b><span className="soft-text">{e.created_at}</span></div>
              <div className="mt-1 soft-text">{e.code} · {e.severity}</div>
              <div className="mt-1">{e.message}</div>
            </div>
          )) : <div className="soft-text text-sm">{ar ? 'مفيش أخطاء حديثة.' : 'No recent errors.'}</div>}
        </div>
      </div>
    </div>
  );
}
