-- Life Lately cloud foundation.
-- The Osyra project is deliberately not referenced by any object or credential here.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Life Lately profile data owned by one authenticated user.';

create table public.app_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  schema_version integer not null check (schema_version > 0),
  revision bigint not null default 1 check (revision > 0),
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.app_states is 'Latest validated Life Lately state for each authenticated user.';

create table public.entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null check (product_code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  provider text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_code)
);

comment on table public.entitlements is 'Read-only subscription status for the app; writes are reserved for a future trusted payment backend.';

create table private.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);

create table private.payment_events (
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null,
  primary key (provider, provider_event_id)
);

alter table public.profiles enable row level security;
alter table public.app_states enable row level security;
alter table public.entitlements enable row level security;
alter table public.profiles force row level security;
alter table public.app_states force row level security;
alter table public.entitlements force row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.app_states from public, anon, authenticated;
revoke all on table public.entitlements from public, anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.app_states to authenticated;
grant select on table public.entitlements to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "app_states_select_own"
on public.app_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "app_states_insert_own"
on public.app_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "app_states_update_own"
on public.app_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "entitlements_select_own"
on public.entitlements
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.save_app_state(
  expected_revision bigint,
  new_state jsonb,
  new_schema_version integer,
  new_client_updated_at timestamptz default now()
)
returns public.app_states
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  saved public.app_states;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if jsonb_typeof(new_state) <> 'object' then
    raise exception 'state must be a JSON object' using errcode = '22023';
  end if;
  if new_schema_version <= 0 then
    raise exception 'schema version must be positive' using errcode = '22023';
  end if;

  if expected_revision = 0 then
    insert into public.app_states (
      user_id,
      state,
      schema_version,
      revision,
      client_updated_at
    ) values (
      current_user_id,
      new_state,
      new_schema_version,
      1,
      new_client_updated_at
    )
    on conflict (user_id) do nothing
    returning * into saved;
  else
    update public.app_states
    set state = new_state,
        schema_version = new_schema_version,
        revision = revision + 1,
        client_updated_at = new_client_updated_at,
        updated_at = now()
    where user_id = current_user_id
      and revision = expected_revision
    returning * into saved;
  end if;

  if saved.user_id is null then
    raise exception 'state revision conflict' using errcode = '40001';
  end if;

  return saved;
end;
$$;

revoke all on function public.save_app_state(bigint, jsonb, integer, timestamptz) from public, anon;
grant execute on function public.save_app_state(bigint, jsonb, integer, timestamptz) to authenticated;

revoke all on all tables in schema private from public, anon, authenticated;
