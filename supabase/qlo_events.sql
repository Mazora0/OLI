-- Qalvero provider event log migration.
-- Run this after qlo_billing_bridge.sql.

create table if not exists public.qv_provider_events (
  id uuid primary key default uuid_generate_v4(),
  event_id text unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  provider_subscription_id text,
  provider_plan_id text,
  plan text check (plan in ('Standard','Premium','Max')),
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.qv_provider_events enable row level security;

drop policy if exists "provider events select own" on public.qv_provider_events;
create policy "provider events select own"
  on public.qv_provider_events
  for select
  using (auth.uid() = user_id);

create index if not exists qv_provider_events_user_created_idx
  on public.qv_provider_events(user_id, created_at desc);

create index if not exists qv_provider_events_provider_subscription_idx
  on public.qv_provider_events(provider, provider_subscription_id);
