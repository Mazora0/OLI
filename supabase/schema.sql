-- Qalvero QLO 1.2 production-ready Supabase schema
-- Run this once in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

create table if not exists public.qv_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  country text default 'EG',
  currency text default 'EGP',
  plan text default 'Free' check (plan in ('Free','Standard','Premium','Max')),
  avatar_url text,
  avatar_id text default 'neo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.qv_profiles add column if not exists avatar_id text default 'neo';

create table if not exists public.qv_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  plan text default 'Free' check (plan in ('Free','Standard','Premium','Max')),
  status text default 'active' check (status in ('active','pending','past_due','cancelled','expired')),
  billing_cycle text default 'monthly',
  provider text default 'manual_paypal_invoice',
  provider_reference text,
  country text default 'EG',
  currency text default 'EGP',
  amount numeric default 0,
  starts_at timestamptz default now(),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.qv_ai_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique references auth.users(id) on delete cascade,
  messages_used integer default 0,
  messages_limit integer default 30,
  reset_date timestamptz default now() + interval '6 hours',
  last_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Separate model-tier usage. Flash has high limits; Pro/Reason/Code are intentionally limited.
create table if not exists public.qv_model_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  tier text not null check (tier in ('flash','pro')),
  messages_used integer default 0,
  messages_limit integer default 0,
  reset_date timestamptz default now() + interval '6 hours',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tier)
);

-- Credit reset policy:
-- normal chat/model credits reset every 6 hours;
-- QLO Agent remains daily and is tracked separately in the chat UI/local usage key.
alter table public.qv_ai_usage alter column reset_date set default now() + interval '6 hours';
alter table public.qv_model_usage alter column reset_date set default now() + interval '6 hours';

-- Compact memory only. Keep this small to reduce storage and privacy risk.
create table if not exists public.qv_user_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  compact_memory jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists public.qv_chat_threads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text default 'New chat',
  model text default 'QLO Auto',
  mode text default 'Auto',
  storage_policy text default 'cloud-compact',
  expires_at timestamptz default now() + interval '10 days',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.qv_chat_messages (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid references public.qv_chat_threads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('user','assistant','system')),
  content text not null,
  model text,
  created_at timestamptz default now()
);

alter table public.qv_chat_threads add column if not exists storage_policy text default 'cloud-compact';
alter table public.qv_chat_threads add column if not exists expires_at timestamptz default now() + interval '10 days';
create index if not exists qv_chat_threads_user_updated_idx on public.qv_chat_threads(user_id, updated_at desc);
create index if not exists qv_chat_threads_expires_idx on public.qv_chat_threads(expires_at);
create index if not exists qv_chat_messages_user_created_idx on public.qv_chat_messages(user_id, created_at desc);

create or replace function public.qv_cleanup_expired_chat_history()
returns void as $$
begin
  delete from public.qv_chat_messages
  where created_at < now() - interval '10 days';

  delete from public.qv_chat_threads
  where coalesce(expires_at, updated_at + interval '10 days') < now();

  delete from public.qv_ai_response_cache
  where expires_at < now();
end;
$$ language plpgsql security definer;

comment on function public.qv_cleanup_expired_chat_history() is 'Deletes cloud chat history older than 10 days. Call from scheduled job or server API cleanup.';

-- Smart Chat Optimizer cache. Optional and server-managed only.
-- Saves credits by reusing safe repeated normal-chat answers for a short time.
create table if not exists public.qv_ai_response_cache (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  cache_key text unique not null,
  prompt_hash text not null,
  model text,
  tier text,
  task text,
  language text,
  reply text not null,
  hit_count integer default 0,
  expires_at timestamptz default now() + interval '24 hours',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists qv_ai_response_cache_expires_idx on public.qv_ai_response_cache(expires_at);
create index if not exists qv_ai_response_cache_user_idx on public.qv_ai_response_cache(user_id, updated_at desc);

create or replace function public.qv_cleanup_smart_chat_cache()
returns void as $$
begin
  delete from public.qv_ai_response_cache where expires_at < now();
end;
$$ language plpgsql security definer;


create table if not exists public.qv_invoice_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  plan text not null check (plan in ('Standard','Premium','Max')),
  country text default 'EG',
  currency text default 'EGP',
  amount numeric default 0,
  note text,
  status text default 'pending' check (status in ('pending','sent','paid','cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.qv_currency_for_country(country_code text)
returns text as $$
begin
  return case country_code
    when 'EG' then 'EGP'
    when 'SA' then 'SAR'
    when 'AE' then 'AED'
    when 'GB' then 'GBP'
    when 'EU' then 'EUR'
    when 'TR' then 'TRY'
    when 'JP' then 'JPY'
    else 'USD'
  end;
end;
$$ language plpgsql stable;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_country text := coalesce(new.raw_user_meta_data->>'country', 'EG');
  user_name text := coalesce(new.raw_user_meta_data->>'full_name', '');
begin
  insert into public.qv_profiles (id, email, full_name, country, currency, plan)
  values (new.id, new.email, user_name, user_country, public.qv_currency_for_country(user_country), 'Free')
  on conflict (id) do nothing;

  insert into public.qv_subscriptions (user_id, plan, amount, country, currency)
  values (new.id, 'Free', 0, user_country, public.qv_currency_for_country(user_country))
  on conflict do nothing;

  insert into public.qv_ai_usage (user_id, messages_used, messages_limit)
  values (new.id, 0, 30)
  on conflict (user_id) do nothing;

  insert into public.qv_model_usage (user_id, tier, messages_used, messages_limit)
  values
    (new.id, 'flash', 0, 30),
    (new.id, 'pro', 0, 4)
  on conflict (user_id, tier) do nothing;

  insert into public.qv_user_memory (user_id, compact_memory)
  values (new.id, jsonb_build_object('language', 'auto', 'notes', jsonb_build_array()))
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.qv_profiles enable row level security;
alter table public.qv_subscriptions enable row level security;
alter table public.qv_ai_usage enable row level security;
alter table public.qv_user_memory enable row level security;
alter table public.qv_model_usage enable row level security;
alter table public.qv_chat_threads enable row level security;
alter table public.qv_chat_messages enable row level security;
alter table public.qv_invoice_requests enable row level security;
alter table public.qv_ai_response_cache enable row level security;

drop policy if exists "profiles select own" on public.qv_profiles;
create policy "profiles select own" on public.qv_profiles for select using (auth.uid() = id);
drop policy if exists "profiles update own" on public.qv_profiles;
create policy "profiles update own" on public.qv_profiles for update using (auth.uid() = id);

drop policy if exists "subs select own" on public.qv_subscriptions;
create policy "subs select own" on public.qv_subscriptions for select using (auth.uid() = user_id);

drop policy if exists "usage select own" on public.qv_ai_usage;
create policy "usage select own" on public.qv_ai_usage for select using (auth.uid() = user_id);


drop policy if exists "model usage select own" on public.qv_model_usage;
create policy "model usage select own" on public.qv_model_usage for select using (auth.uid() = user_id);

drop policy if exists "memory select own" on public.qv_user_memory;
create policy "memory select own" on public.qv_user_memory for select using (auth.uid() = user_id);
drop policy if exists "memory update own" on public.qv_user_memory;
create policy "memory update own" on public.qv_user_memory for update using (auth.uid() = user_id);

drop policy if exists "threads own" on public.qv_chat_threads;
create policy "threads own" on public.qv_chat_threads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "messages own" on public.qv_chat_messages;
create policy "messages own" on public.qv_chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "invoice insert own" on public.qv_invoice_requests;
create policy "invoice insert own" on public.qv_invoice_requests for insert with check (auth.uid() = user_id or user_id is null);
drop policy if exists "invoice select own" on public.qv_invoice_requests;
create policy "invoice select own" on public.qv_invoice_requests for select using (auth.uid() = user_id);

-- Security, abuse-control, and Stripe activation layer
-- This section is safe to run after the base schema.

create unique index if not exists qv_subscriptions_user_unique on public.qv_subscriptions(user_id);

create table if not exists public.qv_user_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text default 'clear' check (status in ('clear','warned','restricted','banned')),
  reason text,
  violation_count integer default 0,
  restricted_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.qv_safety_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  ip_hash text,
  category text not null,
  severity text not null check (severity in ('low','medium','high','none')),
  sample text,
  reviewed boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.qv_ip_rate_limits (
  id uuid primary key default uuid_generate_v4(),
  ip_hash text not null,
  scope text not null,
  day date not null default current_date,
  count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(ip_hash, scope, day)
);

create table if not exists public.qv_payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  provider text default 'stripe',
  status text default 'created',
  plan text check (plan in ('Standard','Premium','Max','Free')),
  country text,
  checkout_session_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Generic subscription identifier used for non‑Stripe providers such as PayPal.
  subscription_id text,
  amount numeric,
  currency text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.qv_user_restrictions enable row level security;
alter table public.qv_safety_events enable row level security;
alter table public.qv_ip_rate_limits enable row level security;
alter table public.qv_payments enable row level security;

drop policy if exists "restrictions select own" on public.qv_user_restrictions;
create policy "restrictions select own" on public.qv_user_restrictions for select using (auth.uid() = user_id);

drop policy if exists "payments select own" on public.qv_payments;
create policy "payments select own" on public.qv_payments for select using (auth.uid() = user_id);

-- Safety events and IP limits are intentionally service-role only.
-- Users should not insert/update these directly from the browser.

-- QLO 1 training dataset examples.
-- This is not model training inside Vercel. It stores clean prompt/response pairs for later export/fine-tuning/RAG.
create table if not exists public.qlo_training_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  prompt text not null,
  response text not null,
  language_tag text not null check (language_tag in ('ar_eg','ar_fusha','en','mixed_ar_eg_en','mixed_ar_fusha_en')),
  task text default 'general',
  route text default 'chat',
  model text default 'QLO',
  sources jsonb default '[]'::jsonb,
  token_estimate integer default 0,
  byte_size integer default 0,
  quality_rating integer,
  created_at timestamptz default now()
);

create index if not exists qlo_training_examples_user_created_idx on public.qlo_training_examples (user_id, created_at desc);
create index if not exists qlo_training_examples_language_idx on public.qlo_training_examples (language_tag);

alter table public.qlo_training_examples enable row level security;

drop policy if exists "training select own" on public.qlo_training_examples;
create policy "training select own" on public.qlo_training_examples for select using (auth.uid() = user_id);

drop policy if exists "training insert own" on public.qlo_training_examples;
create policy "training insert own" on public.qlo_training_examples for insert with check (auth.uid() = user_id);

drop policy if exists "training delete own" on public.qlo_training_examples;
create policy "training delete own" on public.qlo_training_examples for delete using (auth.uid() = user_id);

-- Qalvero operations layer: telemetry, error logs, and rate limits.
-- Service-role only by default. Users never write these directly from the browser.
create table if not exists public.qv_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  ip_hash text,
  kind text not null check (kind in ('chat','agent','search','mcp','tool','apk','training')),
  route text,
  model text,
  provider text,
  plan text default 'Free',
  charged boolean default false,
  cached boolean default false,
  optimized boolean default false,
  prompt_chars integer default 0,
  response_chars integer default 0,
  prompt_tokens integer default 0,
  response_tokens integer default 0,
  cost_units numeric default 0,
  status text default 'ok',
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists qv_usage_events_created_idx on public.qv_usage_events(created_at desc);
create index if not exists qv_usage_events_user_idx on public.qv_usage_events(user_id, created_at desc);
create index if not exists qv_usage_events_kind_idx on public.qv_usage_events(kind, created_at desc);

create table if not exists public.qv_error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  ip_hash text,
  scope text not null,
  code text default 'error',
  message text,
  severity text default 'medium' check (severity in ('low','medium','high')),
  sample text,
  meta jsonb default '{}'::jsonb,
  resolved boolean default false,
  created_at timestamptz default now()
);
create index if not exists qv_error_logs_created_idx on public.qv_error_logs(created_at desc);
create index if not exists qv_error_logs_scope_idx on public.qv_error_logs(scope, created_at desc);

create table if not exists public.qv_api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null,
  user_id uuid references auth.users(id) on delete cascade,
  ip_hash text,
  scope text not null,
  window_key text not null,
  count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(subject_hash, scope, window_key)
);
create index if not exists qv_api_rate_limits_scope_idx on public.qv_api_rate_limits(scope, created_at desc);

create table if not exists public.qv_agent_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text default 'agent',
  status text default 'pending' check (status in ('pending','running','completed','failed','cancelled')),
  title text,
  input_summary text,
  output_url text,
  logs text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists qv_agent_jobs_user_created_idx on public.qv_agent_jobs(user_id, created_at desc);
create index if not exists qv_agent_jobs_status_idx on public.qv_agent_jobs(status, created_at desc);

alter table public.qv_usage_events enable row level security;
alter table public.qv_error_logs enable row level security;
alter table public.qv_api_rate_limits enable row level security;
alter table public.qv_agent_jobs enable row level security;

drop policy if exists "agent jobs select own" on public.qv_agent_jobs;
create policy "agent jobs select own" on public.qv_agent_jobs for select using (auth.uid() = user_id);

-- Usage, errors, and rate limits are read through /api/qlo-admin for configured admins only.
