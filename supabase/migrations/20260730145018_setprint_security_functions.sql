begin;

create or replace function live_pack_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_name text;
begin
  provider_name := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  if provider_name not in ('email', 'google', 'github') then
    provider_name := 'unknown';
  end if;

  begin
    insert into public.profiles (
      id,
      display_name,
      avatar_url,
      first_login_at,
      last_login_at,
      preferred_auth_provider
    )
    values (
      new.id,
      nullif(
        btrim(
          coalesce(
            new.raw_user_meta_data ->> 'display_name',
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'name',
            split_part(coalesce(new.email, ''), '@', 1)
          )
        ),
        ''
      ),
      nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), ''),
      now(),
      now(),
      provider_name
    )
    on conflict (id) do update
    set
      display_name = coalesce(public.profiles.display_name, excluded.display_name),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
      last_login_at = excluded.last_login_at,
      preferred_auth_provider = excluded.preferred_auth_provider;

    update public.email_preferences
    set marketing_enabled = coalesce(
      (new.raw_user_meta_data ->> 'marketing_enabled')::boolean,
      marketing_enabled
    )
    where user_id = new.id;
  exception
    when others then
      raise warning
        'SETPRINT profile auto-creation failed for user % (SQLSTATE %)',
        new.id,
        sqlstate;
  end;

  return new;
end;
$$;

create or replace function live_pack_private.expire_live_access_grants()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.live_access_grants
  set active = false, updated_at = now()
  where active
    and expires_at is not null
    and expires_at <= now();
  get diagnostics affected = row_count;

  update public.share_access_requests
  set status = 'expired', updated_at = now()
  where status = 'approved'
    and id in (
      select source_request_id
      from public.live_access_grants
      where not active and expires_at <= now()
    );

  return affected;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid())
    and read_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.get_owned_band_capacity()
returns table (
  plan text,
  owned_count bigint,
  owned_band_limit integer,
  can_create boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(e.plan, 'free') as plan,
    count(b.id) as owned_count,
    coalesce(e.owned_band_limit, 1) as owned_band_limit,
    count(b.id) < coalesce(e.owned_band_limit, 1) as can_create
  from public.profiles p
  left join public.account_entitlements e on e.user_id = p.id and e.active
  left join public.bands b on b.owner_id = p.id
  where p.id = (select auth.uid())
  group by e.plan, e.owned_band_limit;
$$;

revoke execute on function live_pack_private.expire_live_access_grants()
from public, anon, authenticated;
grant execute on function live_pack_private.expire_live_access_grants()
to postgres, service_role;

revoke execute on function public.mark_all_notifications_read()
from public, anon;
grant execute on function public.mark_all_notifications_read()
to authenticated;

revoke execute on function public.get_owned_band_capacity()
from public, anon;
grant execute on function public.get_owned_band_capacity()
to authenticated;

commit;
