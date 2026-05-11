-- Qalvero external subscription providers SQL
-- Run this in Supabase SQL Editor after the base schema.

alter table public.qv_payments add column if not exists external_subscription_id text;
alter table public.qv_payments add column if not exists external_plan_id text;
alter table public.qv_payments add column if not exists external_payer_id text;

create unique index if not exists qv_payments_external_subscription_unique
  on public.qv_payments(external_subscription_id)
  where external_subscription_id is not null;

alter table public.qv_subscriptions add column if not exists provider_subscription_id text;
alter table public.qv_subscriptions add column if not exists provider_plan_id text;

create table if not exists public.qv_provider_events (
  id uuid primary key default uuid_generate_v4(),
  event_id text unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  provider_subscription_id text,
  provider_plan_id text,
  plan text check (plan in ('Standard','Premium')),
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.qv_provider_events enable row level security;

drop policy if exists "provider events select own" on public.qv_provider_events;
create policy "provider events select own"
  on public.qv_provider_events
  for select
  using (auth.uid() = user_id);
