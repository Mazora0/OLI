create table if not exists public.qv_provider_events (
  id uuid primary key default uuid_generate_v4(),
  event_id text unique,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  provider_subscription_id text,
  provider_plan_id text,
  plan text,
  raw jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.qv_provider_events enable row level security;

create index if not exists qv_provider_events_user_created_idx
  on public.qv_provider_events(user_id, created_at desc);
