-- Qalvero billing bridge migration.
-- Run this after supabase/schema.sql.

alter table public.qv_payments add column if not exists external_subscription_id text;
alter table public.qv_payments add column if not exists external_plan_id text;
alter table public.qv_payments add column if not exists external_payer_id text;

drop index if exists qv_payments_external_subscription_unique;
create unique index if not exists qv_payments_external_subscription_unique
  on public.qv_payments(external_subscription_id);

alter table public.qv_subscriptions add column if not exists provider_subscription_id text;
alter table public.qv_subscriptions add column if not exists provider_plan_id text;

create unique index if not exists qv_subscriptions_user_unique
  on public.qv_subscriptions(user_id);
