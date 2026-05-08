-- Qalvero LLC / QLO 1.2 Supabase schema
-- Run this once in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

-- Public user profile linked to Supabase Auth
create table if not exists public.qv_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  country text not null default 'EG',
  currency text not null default 'EGP',
  plan text not null default 'Free' check (plan in ('Free','Standard','Premium')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Active plan/subscription state. PayPal/Stripe/Lemon Squeezy webhooks can update this later.
create table if not exists public.qv_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'Free' check (plan in ('Free','Standard','Premium')),
  status text not null default 'active' check (status in ('active','trialing','past_due','cancelled','expired','pending')),
  billing_cycle text not null default 'monthly',
  country text not null default 'EG',
  currency text not null default 'EGP',
  amount numeric not null default 0,
  provider text default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Monthly AI usage counter
create table if not exists public.qv_ai_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null default date_trunc('month', now())::date,
  messages_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

-- Upgrade requests for PayPal invoice/manual billing flow
create table if not exists public.qv_payment_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  plan text not null check (plan in ('Standard','Premium')),
  country text not null default 'EG',
  currency text not null default 'EGP',
  amount_text text,
  provider text not null default 'paypal_invoice',
  status text not null default 'pending' check (status in ('pending','sent','paid','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.qv_currency_for_country(p_country text)
returns text as $$
begin
  return case p_country
    when 'EG' then 'EGP'
    when 'US' then 'USD'
    when 'SA' then 'SAR'
    when 'AE' then 'AED'
    when 'EU' then 'EUR'
    when 'GB' then 'GBP'
    when 'TR' then 'TRY'
    when 'JP' then 'JPY'
    else 'USD'
  end;
end;
$$ language plpgsql stable;

-- Creates profile, free subscription, and current usage row after signup.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_country text := coalesce(new.raw_user_meta_data ->> 'country', 'EG');
  v_currency text := public.qv_currency_for_country(coalesce(new.raw_user_meta_data ->> 'country', 'EG'));
begin
  insert into public.qv_profiles (id, email, country, currency, plan)
  values (new.id, new.email, v_country, v_currency, 'Free')
  on conflict (id) do nothing;

  insert into public.qv_subscriptions (user_id, plan, status, country, currency, amount, provider)
  values (new.id, 'Free', 'active', v_country, v_currency, 0, 'free')
  on conflict do nothing;

  insert into public.qv_ai_usage (user_id, period_start, messages_used)
  values (new.id, date_trunc('month', now())::date, 0)
  on conflict (user_id, period_start) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Atomic usage increment used by Vercel API
create or replace function public.qv_increment_ai_usage(p_user_id uuid, p_period_start date)
returns void as $$
begin
  insert into public.qv_ai_usage (user_id, period_start, messages_used)
  values (p_user_id, p_period_start, 1)
  on conflict (user_id, period_start)
  do update set messages_used = public.qv_ai_usage.messages_used + 1, updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

alter table public.qv_profiles enable row level security;
alter table public.qv_subscriptions enable row level security;
alter table public.qv_ai_usage enable row level security;
alter table public.qv_payment_requests enable row level security;

drop policy if exists "Users can view own profile" on public.qv_profiles;
create policy "Users can view own profile" on public.qv_profiles
for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.qv_profiles;
create policy "Users can update own profile" on public.qv_profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can view own subscriptions" on public.qv_subscriptions;
create policy "Users can view own subscriptions" on public.qv_subscriptions
for select using (auth.uid() = user_id);

drop policy if exists "Users can view own AI usage" on public.qv_ai_usage;
create policy "Users can view own AI usage" on public.qv_ai_usage
for select using (auth.uid() = user_id);

drop policy if exists "Users can view own payment requests" on public.qv_payment_requests;
create policy "Users can view own payment requests" on public.qv_payment_requests
for select using (auth.uid() = user_id);

drop policy if exists "Users can create own payment requests" on public.qv_payment_requests;
create policy "Users can create own payment requests" on public.qv_payment_requests
for insert with check (auth.uid() = user_id);

-- Optional helper view for quick dashboard checks
create or replace view public.qv_account_summary as
select
  p.id,
  p.email,
  p.country,
  p.currency,
  coalesce(s.plan, 'Free') as plan,
  coalesce(u.messages_used, 0) as messages_used,
  coalesce(u.period_start, date_trunc('month', now())::date) as usage_period_start
from public.qv_profiles p
left join lateral (
  select plan from public.qv_subscriptions
  where user_id = p.id and status = 'active'
  order by created_at desc limit 1
) s on true
left join public.qv_ai_usage u on u.user_id = p.id and u.period_start = date_trunc('month', now())::date;
