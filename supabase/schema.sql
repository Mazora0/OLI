-- Qalvero QLO 1.2 production-ready Supabase schema
-- Run this once in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

create table if not exists public.qv_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  country text default 'EG',
  currency text default 'EGP',
  plan text default 'Free' check (plan in ('Free','Standard','Premium')),
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.qv_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  plan text default 'Free' check (plan in ('Free','Standard','Premium')),
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
  messages_limit integer default 120,
  reset_date timestamptz default now() + interval '1 day',
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
  reset_date timestamptz default now() + interval '1 day',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, tier)
);

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

create table if not exists public.qv_invoice_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  plan text not null check (plan in ('Standard','Premium')),
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
  values (new.id, 0, 120)
  on conflict (user_id) do nothing;

  insert into public.qv_model_usage (user_id, tier, messages_used, messages_limit)
  values
    (new.id, 'flash', 0, 120),
    (new.id, 'pro', 0, 3)
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
  plan text check (plan in ('Standard','Premium','Free')),
  country text,
  checkout_session_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
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
