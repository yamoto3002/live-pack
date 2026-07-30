begin;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists first_login_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists preferred_auth_provider text;

alter table public.profiles
  add constraint profiles_avatar_url_not_blank
    check (avatar_url is null or btrim(avatar_url) <> ''),
  add constraint profiles_auth_provider_valid
    check (
      preferred_auth_provider is null
      or preferred_auth_provider in ('email', 'google', 'github', 'unknown')
    );

create table public.email_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  transactional_enabled boolean not null default true,
  product_updates_enabled boolean not null default false,
  marketing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  recipient_email text,
  email_type text not null,
  related_entity_id uuid,
  idempotency_key text not null,
  status text not null default 'pending',
  resend_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_deliveries_key_unique unique (idempotency_key),
  constraint email_deliveries_type_not_blank check (btrim(email_type) <> ''),
  constraint email_deliveries_status_valid
    check (status in ('pending', 'sent', 'skipped', 'failed'))
);

create index email_deliveries_user_created_idx
  on public.email_deliveries (user_id, created_at desc);

create table public.billing_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customer_not_blank
    check (stripe_customer_id is null or btrim(stripe_customer_id) <> '')
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_valid
    check (status in ('incomplete', 'trialing', 'active', 'past_due', 'cancelled', 'unpaid', 'paused'))
);

create index subscriptions_user_status_idx on public.subscriptions (user_id, status);

create table public.account_entitlements (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'free',
  owned_band_limit integer not null default 1,
  active boolean not null default true,
  source text not null default 'default',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_entitlements_plan_valid check (plan in ('free', 'pro')),
  constraint account_entitlements_limit_positive check (owned_band_limit >= 1),
  constraint account_entitlements_source_not_blank check (btrim(source) <> '')
);

insert into public.account_entitlements (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

insert into public.email_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands (id) on delete cascade,
  name text not null,
  color_token text not null default 'graphite',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_name_not_blank check (btrim(name) <> ''),
  constraint tags_band_name_unique unique (band_id, name)
);

create index tags_band_sort_idx on public.tags (band_id, sort_order, name);

create table public.song_tags (
  song_id uuid not null references public.songs (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (song_id, tag_id)
);

create index song_tags_tag_id_idx on public.song_tags (tag_id, song_id);

alter table public.releases add column if not exists color_token text;
alter table public.songs add column if not exists color_token text;

update public.releases
set color_token = coalesce(color_token, 'graphite')
where color_token is null;

update public.songs
set color_token = coalesce(color_token, 'graphite')
where color_token is null;

create or replace function live_pack_private.seed_setprint_user_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.account_entitlements (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger profiles_seed_setprint_defaults
after insert on public.profiles
for each row execute function live_pack_private.seed_setprint_user_defaults();

create or replace function live_pack_private.enforce_owned_band_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_limit integer;
  current_count integer;
begin
  if (select auth.uid()) is distinct from new.owner_id then
    raise exception 'The signed-in user must be the band owner'
      using errcode = '42501';
  end if;

  select owned_band_limit
  into allowed_limit
  from public.account_entitlements
  where user_id = new.owner_id
    and active
    and (expires_at is null or expires_at > now());

  allowed_limit := coalesce(allowed_limit, 1);

  select count(*)
  into current_count
  from public.bands
  where owner_id = new.owner_id;

  if current_count >= allowed_limit then
    raise exception 'Owned band limit reached'
      using errcode = 'P0001',
        hint = 'Upgrade entitlement before creating another owned band.';
  end if;

  return new;
end;
$$;

create trigger bands_enforce_owned_limit
before insert on public.bands
for each row execute function live_pack_private.enforce_owned_band_limit();

create trigger email_preferences_set_updated_at
before update on public.email_preferences
for each row execute function live_pack_private.set_updated_at();
create trigger email_deliveries_set_updated_at
before update on public.email_deliveries
for each row execute function live_pack_private.set_updated_at();
create trigger billing_customers_set_updated_at
before update on public.billing_customers
for each row execute function live_pack_private.set_updated_at();
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function live_pack_private.set_updated_at();
create trigger account_entitlements_set_updated_at
before update on public.account_entitlements
for each row execute function live_pack_private.set_updated_at();
create trigger tags_set_updated_at
before update on public.tags
for each row execute function live_pack_private.set_updated_at();

alter table public.email_preferences enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.account_entitlements enable row level security;
alter table public.tags enable row level security;
alter table public.song_tags enable row level security;

revoke all on table
  public.email_preferences,
  public.email_deliveries,
  public.billing_customers,
  public.subscriptions,
  public.account_entitlements,
  public.tags,
  public.song_tags
from public, anon, authenticated;

grant select, update on public.email_preferences to authenticated;
grant select on public.account_entitlements, public.subscriptions to authenticated;
grant select, insert, update, delete on public.tags, public.song_tags to authenticated;

grant update (
  display_name,
  avatar_url,
  onboarding_completed_at,
  first_login_at,
  last_login_at,
  preferred_auth_provider
) on public.profiles to authenticated;

create policy email_preferences_self
on public.email_preferences
for select to authenticated
using ((select auth.uid()) = user_id);

create policy email_preferences_update_self
on public.email_preferences
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy entitlements_select_self
on public.account_entitlements
for select to authenticated
using ((select auth.uid()) = user_id);

create policy subscriptions_select_self
on public.subscriptions
for select to authenticated
using ((select auth.uid()) = user_id);

create policy tags_select_member
on public.tags
for select to authenticated
using (live_pack_private.is_band_member(band_id));

create policy tags_write_editor
on public.tags
for all to authenticated
using (live_pack_private.has_band_permission(band_id, array['owner', 'admin', 'editor']))
with check (live_pack_private.has_band_permission(band_id, array['owner', 'admin', 'editor']));

create policy song_tags_select_member
on public.song_tags
for select to authenticated
using (
  live_pack_private.is_band_member(
    live_pack_private.band_id_for_song(song_id)
  )
);

create policy song_tags_write_editor
on public.song_tags
for all to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_song(song_id),
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_song(song_id),
    array['owner', 'admin', 'editor']
  )
);

revoke execute on function live_pack_private.seed_setprint_user_defaults()
from public, anon, authenticated;
revoke execute on function live_pack_private.enforce_owned_band_limit()
from public, anon, authenticated;

commit;
