begin;

-- UUID generation is explicit so the migration behaves consistently on local
-- and hosted Supabase projects.
create extension if not exists pgcrypto with schema extensions;

-- Security-definer helpers live outside the Data API's exposed schemas.
create schema if not exists live_pack_private;
revoke all on schema live_pack_private from public;
revoke all on schema live_pack_private from anon;
grant usage on schema live_pack_private to authenticated;
grant usage on schema live_pack_private to supabase_auth_admin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank
    check (display_name is null or btrim(display_name) <> '')
);

create table public.bands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bands_name_not_blank check (btrim(name) <> '')
);

create table public.band_members (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  role_name text,
  category text,
  permission text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint band_members_band_user_unique unique (band_id, user_id),
  constraint band_members_permission_valid
    check (permission in ('owner', 'admin', 'editor', 'member', 'viewer')),
  constraint band_members_display_name_not_blank
    check (display_name is null or btrim(display_name) <> ''),
  constraint band_members_role_name_not_blank
    check (role_name is null or btrim(role_name) <> ''),
  constraint band_members_category_not_blank
    check (category is null or btrim(category) <> '')
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands (id) on delete cascade,
  title text not null,
  release_type text,
  color text,
  sort_order integer not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint releases_id_band_unique unique (id, band_id),
  constraint releases_title_not_blank check (btrim(title) <> ''),
  constraint releases_release_type_not_blank
    check (release_type is null or btrim(release_type) <> ''),
  constraint releases_sort_order_nonnegative check (sort_order >= 0)
);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands (id) on delete cascade,
  release_id uuid,
  title text not null,
  color text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint songs_id_band_unique unique (id, band_id),
  constraint songs_title_not_blank check (btrim(title) <> ''),
  constraint songs_release_band_fkey
    foreign key (release_id, band_id)
    references public.releases (id, band_id)
    on delete set null (release_id)
);

create table public.song_versions (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  name text not null,
  duration_sec integer,
  musical_key text,
  bpm numeric(7, 2),
  has_click boolean not null default false,
  has_sync boolean not null default false,
  default_start_type text,
  is_default boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint song_versions_id_song_unique unique (id, song_id),
  constraint song_versions_name_not_blank check (btrim(name) <> ''),
  constraint song_versions_duration_nonnegative
    check (duration_sec is null or duration_sec >= 0),
  constraint song_versions_bpm_positive check (bpm is null or bpm > 0),
  constraint song_versions_musical_key_not_blank
    check (musical_key is null or btrim(musical_key) <> ''),
  constraint song_versions_start_type_not_blank
    check (default_start_type is null or btrim(default_start_type) <> '')
);

create table public.lives (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands (id) on delete cascade,
  title text not null,
  live_date date,
  venue text,
  time_limit_sec integer,
  status text not null default 'draft',
  memo text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lives_id_band_unique unique (id, band_id),
  constraint lives_title_not_blank check (btrim(title) <> ''),
  constraint lives_venue_not_blank check (venue is null or btrim(venue) <> ''),
  constraint lives_time_limit_nonnegative
    check (time_limit_sec is null or time_limit_sec >= 0),
  constraint lives_status_not_blank check (btrim(status) <> '')
);

create table public.song_links (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands (id) on delete cascade,
  song_id uuid,
  song_version_id uuid,
  live_id uuid,
  link_type text,
  label text,
  url text not null,
  is_recommended boolean not null default false,
  recorded_at date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint song_links_song_band_fkey
    foreign key (song_id, band_id)
    references public.songs (id, band_id)
    on delete cascade,
  constraint song_links_version_song_fkey
    foreign key (song_version_id, song_id)
    references public.song_versions (id, song_id)
    on delete cascade,
  constraint song_links_live_band_fkey
    foreign key (live_id, band_id)
    references public.lives (id, band_id)
    on delete cascade,
  constraint song_links_target_required
    check (num_nonnulls(song_id, live_id) = 1),
  constraint song_links_version_requires_song
    check (song_version_id is null or song_id is not null),
  constraint song_links_url_not_blank check (btrim(url) <> ''),
  constraint song_links_link_type_not_blank
    check (link_type is null or btrim(link_type) <> ''),
  constraint song_links_label_not_blank
    check (label is null or btrim(label) <> '')
);

create table public.setlist_entries (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  song_id uuid references public.songs (id) on delete set null,
  song_version_id uuid,
  sort_order numeric(12, 4) not null default 0,
  title_snapshot text not null,
  version_name_snapshot text,
  duration_sec integer,
  musical_key text,
  bpm numeric(7, 2),
  has_click boolean not null default false,
  has_sync boolean not null default false,
  start_type text,
  end_type text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint setlist_entries_id_live_unique unique (id, live_id),
  constraint setlist_entries_version_song_fkey
    foreign key (song_version_id, song_id)
    references public.song_versions (id, song_id)
    on delete set null (song_version_id),
  constraint setlist_entries_version_requires_song
    check (song_version_id is null or song_id is not null),
  constraint setlist_entries_sort_order_nonnegative check (sort_order >= 0),
  constraint setlist_entries_title_not_blank check (btrim(title_snapshot) <> ''),
  constraint setlist_entries_version_name_not_blank
    check (
      version_name_snapshot is null
      or btrim(version_name_snapshot) <> ''
    ),
  constraint setlist_entries_duration_nonnegative
    check (duration_sec is null or duration_sec >= 0),
  constraint setlist_entries_bpm_positive check (bpm is null or bpm > 0),
  constraint setlist_entries_musical_key_not_blank
    check (musical_key is null or btrim(musical_key) <> ''),
  constraint setlist_entries_start_type_not_blank
    check (start_type is null or btrim(start_type) <> ''),
  constraint setlist_entries_end_type_not_blank
    check (end_type is null or btrim(end_type) <> '')
);

create table public.setlist_cues (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  after_entry_id uuid,
  sort_order numeric(12, 4) not null default 0,
  cue_type text not null default 'other',
  title text,
  duration_sec integer,
  transition_type text,
  trigger_person text,
  operator_name text,
  playback text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint setlist_cues_entry_live_fkey
    foreign key (after_entry_id, live_id)
    references public.setlist_entries (id, live_id)
    on delete cascade,
  constraint setlist_cues_sort_order_nonnegative check (sort_order >= 0),
  constraint setlist_cues_type_valid
    check (
      cue_type in (
        'mc',
        'se',
        'changeover',
        'costume_change',
        'blackout',
        'break',
        'other'
      )
    ),
  constraint setlist_cues_title_not_blank
    check (title is null or btrim(title) <> ''),
  constraint setlist_cues_duration_nonnegative
    check (duration_sec is null or duration_sec >= 0),
  constraint setlist_cues_transition_type_not_blank
    check (transition_type is null or btrim(transition_type) <> ''),
  constraint setlist_cues_trigger_person_not_blank
    check (trigger_person is null or btrim(trigger_person) <> ''),
  constraint setlist_cues_operator_name_not_blank
    check (operator_name is null or btrim(operator_name) <> ''),
  constraint setlist_cues_playback_not_blank
    check (playback is null or btrim(playback) <> '')
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  setlist_entry_id uuid,
  song_id uuid references public.songs (id) on delete set null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  target_member_id uuid references public.band_members (id) on delete cascade,
  target_role_name text,
  visibility text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_entry_live_fkey
    foreign key (setlist_entry_id, live_id)
    references public.setlist_entries (id, live_id)
    on delete cascade,
  constraint notes_visibility_valid
    check (
      visibility in ('public', 'host', 'members', 'role', 'private', 'staff')
    ),
  constraint notes_role_target_required
    check (
      visibility <> 'role'
      or target_member_id is not null
      or nullif(btrim(target_role_name), '') is not null
    ),
  constraint notes_target_role_not_blank
    check (target_role_name is null or btrim(target_role_name) <> ''),
  constraint notes_body_not_blank check (btrim(body) <> '')
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.lives (id) on delete cascade,
  token text not null,
  label text,
  scope text,
  target_member_id uuid references public.band_members (id) on delete set null,
  target_role_name text,
  passcode_hash text,
  enabled boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint share_links_token_unique unique (token),
  constraint share_links_token_not_blank check (btrim(token) <> ''),
  constraint share_links_label_not_blank
    check (label is null or btrim(label) <> ''),
  constraint share_links_scope_not_blank
    check (scope is null or btrim(scope) <> ''),
  constraint share_links_target_role_not_blank
    check (target_role_name is null or btrim(target_role_name) <> ''),
  constraint share_links_passcode_hash_not_blank
    check (passcode_hash is null or btrim(passcode_hash) <> '')
);

-- Foreign-key and access-path indexes. PostgreSQL does not create these for FKs.
create index bands_owner_id_idx on public.bands (owner_id);
create index band_members_user_id_idx on public.band_members (user_id);
create index releases_band_sort_idx on public.releases (band_id, sort_order);
create index songs_band_id_idx on public.songs (band_id);
create index songs_release_id_idx on public.songs (release_id)
where release_id is not null;
create index song_versions_song_id_idx on public.song_versions (song_id);
create unique index song_versions_one_default_per_song_idx
on public.song_versions (song_id)
where is_default;
create index lives_band_date_idx on public.lives (band_id, live_date);
create index lives_created_by_idx on public.lives (created_by);
create index song_links_band_id_idx on public.song_links (band_id);
create index song_links_song_id_idx on public.song_links (song_id)
where song_id is not null;
create index song_links_song_version_id_idx on public.song_links (song_version_id)
where song_version_id is not null;
create index song_links_live_id_idx on public.song_links (live_id)
where live_id is not null;
create index setlist_entries_live_sort_idx
on public.setlist_entries (live_id, sort_order);
create index setlist_entries_song_id_idx on public.setlist_entries (song_id)
where song_id is not null;
create index setlist_entries_song_version_id_idx
on public.setlist_entries (song_version_id)
where song_version_id is not null;
create index setlist_cues_live_sort_idx
on public.setlist_cues (live_id, sort_order);
create index setlist_cues_after_entry_id_idx
on public.setlist_cues (after_entry_id)
where after_entry_id is not null;
create index notes_live_visibility_idx on public.notes (live_id, visibility);
create index notes_setlist_entry_id_idx on public.notes (setlist_entry_id)
where setlist_entry_id is not null;
create index notes_song_id_idx on public.notes (song_id)
where song_id is not null;
create index notes_author_id_idx on public.notes (author_id);
create index notes_target_member_id_idx on public.notes (target_member_id)
where target_member_id is not null;
create index share_links_live_id_idx on public.share_links (live_id);
create index share_links_target_member_id_idx on public.share_links (target_member_id)
where target_member_id is not null;
create index share_links_created_by_idx on public.share_links (created_by);
create index share_links_enabled_expires_idx
on public.share_links (expires_at)
where enabled;

create or replace function live_pack_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function live_pack_private.prevent_column_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  column_name text;
begin
  foreach column_name in array tg_argv loop
    if (to_jsonb(new) -> column_name)
      is distinct from (to_jsonb(old) -> column_name) then
      raise exception 'Column %.% cannot be changed after creation',
        tg_table_name,
        column_name
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

create or replace function live_pack_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.profiles (id, display_name)
    values (
      new.id,
      nullif(
        btrim(
          coalesce(
            new.raw_user_meta_data ->> 'display_name',
            new.raw_user_meta_data ->> 'name',
            ''
          )
        ),
        ''
      )
    )
    on conflict (id) do nothing;
  exception
    when others then
      -- A profile can be reconciled later; do not reject an otherwise valid
      -- Auth signup because application-profile creation failed.
      raise warning
        'Live Pack profile auto-creation failed for user % (SQLSTATE %)',
        new.id,
        sqlstate;
  end;

  return new;
end;
$$;

create or replace function live_pack_private.create_band_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.band_members (
    band_id,
    user_id,
    display_name,
    permission
  )
  select
    new.id,
    new.owner_id,
    profiles.display_name,
    'owner'
  from public.profiles
  where profiles.id = new.owner_id;

  return new;
end;
$$;

create or replace function live_pack_private.validate_band_member_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_owner_id uuid;
begin
  if tg_op = 'DELETE' then
    select bands.owner_id
    into expected_owner_id
    from public.bands
    where bands.id = old.band_id;

    if old.user_id = expected_owner_id then
      raise exception 'The band owner membership cannot be deleted'
        using errcode = '23514';
    end if;

    return old;
  end if;

  select bands.owner_id
  into expected_owner_id
  from public.bands
  where bands.id = new.band_id;

  if new.permission = 'owner' and new.user_id <> expected_owner_id then
    raise exception 'Only bands.owner_id may have owner permission'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and old.user_id = expected_owner_id
    and new.permission <> 'owner' then
    raise exception 'The band owner membership cannot be demoted'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function live_pack_private.validate_setlist_entry_relations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  live_band_id uuid;
  song_band_id uuid;
begin
  select lives.band_id
  into live_band_id
  from public.lives
  where lives.id = new.live_id;

  if new.song_id is not null then
    select songs.band_id
    into song_band_id
    from public.songs
    where songs.id = new.song_id;

    if song_band_id is distinct from live_band_id then
      raise exception 'A setlist entry song must belong to the live band'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function live_pack_private.validate_note_relations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  live_band_id uuid;
  referenced_band_id uuid;
  referenced_live_id uuid;
begin
  select lives.band_id
  into live_band_id
  from public.lives
  where lives.id = new.live_id;

  if new.setlist_entry_id is not null then
    select setlist_entries.live_id
    into referenced_live_id
    from public.setlist_entries
    where setlist_entries.id = new.setlist_entry_id;

    if referenced_live_id is distinct from new.live_id then
      raise exception 'A note entry target must belong to the same live'
        using errcode = '23514';
    end if;
  end if;

  if new.song_id is not null then
    select songs.band_id
    into referenced_band_id
    from public.songs
    where songs.id = new.song_id;

    if referenced_band_id is distinct from live_band_id then
      raise exception 'A note song must belong to the live band'
        using errcode = '23514';
    end if;
  end if;

  if new.target_member_id is not null then
    select band_members.band_id
    into referenced_band_id
    from public.band_members
    where band_members.id = new.target_member_id;

    if referenced_band_id is distinct from live_band_id then
      raise exception 'A note target member must belong to the live band'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function live_pack_private.validate_share_link_relations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  live_band_id uuid;
  member_band_id uuid;
begin
  if new.target_member_id is null then
    return new;
  end if;

  select lives.band_id
  into live_band_id
  from public.lives
  where lives.id = new.live_id;

  select band_members.band_id
  into member_band_id
  from public.band_members
  where band_members.id = new.target_member_id;

  if member_band_id is distinct from live_band_id then
    raise exception 'A share-link target member must belong to the live band'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function live_pack_private.is_band_member(target_band_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and $1 is not null
    and exists (
      select 1
      from public.band_members
      where band_members.band_id = $1
        and band_members.user_id = (select auth.uid())
    );
$$;

create or replace function live_pack_private.has_band_permission(
  target_band_id uuid,
  allowed_permissions text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and $1 is not null
    and exists (
      select 1
      from public.band_members
      where band_members.band_id = $1
        and band_members.user_id = (select auth.uid())
        and band_members.permission = any ($2)
    );
$$;

create or replace function live_pack_private.band_id_for_song(
  target_song_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select songs.band_id
  from public.songs
  where songs.id = $1;
$$;

create or replace function live_pack_private.band_id_for_live(
  target_live_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select lives.band_id
  from public.lives
  where lives.id = $1;
$$;

create or replace function live_pack_private.can_view_note(
  target_live_id uuid,
  note_author_id uuid,
  note_visibility text,
  note_target_member_id uuid,
  note_target_role_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with current_membership as (
    select band_members.id, band_members.permission, band_members.role_name
    from public.band_members
    join public.lives on lives.band_id = band_members.band_id
    where lives.id = $1
      and band_members.user_id = (select auth.uid())
  )
  select
    (select auth.uid()) is not null
    and exists (select 1 from current_membership)
    and case $3
      when 'private' then $2 = (select auth.uid())
      when 'host' then exists (
        select 1
        from current_membership
        where permission in ('owner', 'admin')
      )
      when 'role' then exists (
        select 1
        from current_membership
        where id = $4
          or (
            nullif(btrim($5), '') is not null
            and role_name = $5
          )
      )
      when 'public' then true
      when 'members' then true
      when 'staff' then true
      else false
    end;
$$;

create or replace function live_pack_private.can_write_note(
  target_live_id uuid,
  note_author_id uuid,
  note_visibility text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and $2 = (select auth.uid())
    and exists (
      select 1
      from public.band_members
      join public.lives on lives.band_id = band_members.band_id
      where lives.id = $1
        and band_members.user_id = (select auth.uid())
        and (
          band_members.permission in ('owner', 'admin', 'editor')
          or (
            band_members.permission = 'member'
            and $3 = 'private'
          )
        )
    );
$$;

-- Trigger-only functions are not directly callable by API roles.
revoke execute on all functions in schema live_pack_private
from public, anon, authenticated;

grant execute on function live_pack_private.handle_new_user()
to supabase_auth_admin;

grant execute on function live_pack_private.is_band_member(uuid)
to authenticated;
grant execute on function live_pack_private.has_band_permission(uuid, text[])
to authenticated;
grant execute on function live_pack_private.band_id_for_song(uuid)
to authenticated;
grant execute on function live_pack_private.band_id_for_live(uuid)
to authenticated;
grant execute on function live_pack_private.can_view_note(
  uuid,
  uuid,
  text,
  uuid,
  text
) to authenticated;
grant execute on function live_pack_private.can_write_note(uuid, uuid, text)
to authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function live_pack_private.set_updated_at();

create trigger bands_set_updated_at
before update on public.bands
for each row execute function live_pack_private.set_updated_at();
create trigger bands_immutable_columns
before update on public.bands
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'owner_id',
  'created_at'
);
create trigger bands_create_owner_membership
after insert on public.bands
for each row
execute function live_pack_private.create_band_owner_membership();

create trigger band_members_set_updated_at
before update on public.band_members
for each row execute function live_pack_private.set_updated_at();
create trigger band_members_immutable_columns
before update on public.band_members
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'band_id',
  'user_id',
  'created_at'
);
create trigger band_members_validate_owner
before insert or update or delete on public.band_members
for each row
execute function live_pack_private.validate_band_member_owner();

create trigger releases_set_updated_at
before update on public.releases
for each row execute function live_pack_private.set_updated_at();
create trigger releases_immutable_columns
before update on public.releases
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'band_id',
  'created_at'
);

create trigger songs_set_updated_at
before update on public.songs
for each row execute function live_pack_private.set_updated_at();
create trigger songs_immutable_columns
before update on public.songs
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'band_id',
  'created_at'
);

create trigger song_versions_set_updated_at
before update on public.song_versions
for each row execute function live_pack_private.set_updated_at();
create trigger song_versions_immutable_columns
before update on public.song_versions
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'song_id',
  'created_at'
);

create trigger lives_set_updated_at
before update on public.lives
for each row execute function live_pack_private.set_updated_at();
create trigger lives_immutable_columns
before update on public.lives
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'band_id',
  'created_at'
);

create trigger song_links_set_updated_at
before update on public.song_links
for each row execute function live_pack_private.set_updated_at();
create trigger song_links_immutable_columns
before update on public.song_links
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'band_id',
  'created_at'
);

create trigger setlist_entries_set_updated_at
before update on public.setlist_entries
for each row execute function live_pack_private.set_updated_at();
create trigger setlist_entries_immutable_columns
before update on public.setlist_entries
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'live_id',
  'created_at'
);
create trigger setlist_entries_validate_relations
before insert or update on public.setlist_entries
for each row
execute function live_pack_private.validate_setlist_entry_relations();

create trigger setlist_cues_set_updated_at
before update on public.setlist_cues
for each row execute function live_pack_private.set_updated_at();
create trigger setlist_cues_immutable_columns
before update on public.setlist_cues
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'live_id',
  'created_at'
);

create trigger notes_set_updated_at
before update on public.notes
for each row execute function live_pack_private.set_updated_at();
create trigger notes_immutable_columns
before update on public.notes
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'live_id',
  'author_id',
  'created_at'
);
create trigger notes_validate_relations
before insert or update on public.notes
for each row execute function live_pack_private.validate_note_relations();

create trigger share_links_set_updated_at
before update on public.share_links
for each row execute function live_pack_private.set_updated_at();
create trigger share_links_immutable_columns
before update on public.share_links
for each row
execute function live_pack_private.prevent_column_update(
  'id',
  'live_id',
  'created_at'
);
create trigger share_links_validate_relations
before insert or update on public.share_links
for each row
execute function live_pack_private.validate_share_link_relations();

create trigger on_auth_user_created_live_pack
after insert on auth.users
for each row execute function live_pack_private.handle_new_user();

-- Every application table in the exposed public schema is protected by RLS.
alter table public.profiles enable row level security;
alter table public.bands enable row level security;
alter table public.band_members enable row level security;
alter table public.releases enable row level security;
alter table public.songs enable row level security;
alter table public.song_versions enable row level security;
alter table public.lives enable row level security;
alter table public.song_links enable row level security;
alter table public.setlist_entries enable row level security;
alter table public.setlist_cues enable row level security;
alter table public.notes enable row level security;
alter table public.share_links enable row level security;

-- Explicit grants avoid depending on the platform's changing auto-exposure
-- defaults. Anonymous callers receive no application-table privileges.
revoke all privileges on table
  public.profiles,
  public.bands,
  public.band_members,
  public.releases,
  public.songs,
  public.song_versions,
  public.lives,
  public.song_links,
  public.setlist_entries,
  public.setlist_cues,
  public.notes,
  public.share_links
from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on table
  public.bands,
  public.band_members,
  public.releases,
  public.songs,
  public.song_versions,
  public.song_links,
  public.setlist_entries,
  public.setlist_cues,
  public.notes
to authenticated;

grant select, insert, delete on table public.lives to authenticated;
grant update (
  title,
  live_date,
  venue,
  time_limit_sec,
  status,
  memo
) on public.lives to authenticated;

-- passcode_hash is intentionally excluded from browser-visible privileges.
grant select (
  id,
  live_id,
  token,
  label,
  scope,
  target_member_id,
  target_role_name,
  enabled,
  expires_at,
  created_by,
  created_at,
  updated_at
) on public.share_links to authenticated;
grant insert (
  live_id,
  token,
  label,
  scope,
  target_member_id,
  target_role_name,
  enabled,
  expires_at,
  created_by
) on public.share_links to authenticated;
grant update (
  token,
  label,
  scope,
  target_member_id,
  target_role_name,
  enabled,
  expires_at
) on public.share_links to authenticated;
grant delete on public.share_links to authenticated;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy bands_select_member
on public.bands
for select
to authenticated
using (live_pack_private.is_band_member(id));

create policy bands_insert_owner
on public.bands
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy bands_update_admin
on public.bands
for update
to authenticated
using (
  live_pack_private.has_band_permission(id, array['owner', 'admin'])
)
with check (
  live_pack_private.has_band_permission(id, array['owner', 'admin'])
);

create policy bands_delete_owner
on public.bands
for delete
to authenticated
using (
  live_pack_private.has_band_permission(id, array['owner'])
);

create policy band_members_select_member
on public.band_members
for select
to authenticated
using (live_pack_private.is_band_member(band_id));

create policy band_members_insert_admin
on public.band_members
for insert
to authenticated
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin']
  )
);

create policy band_members_update_admin
on public.band_members
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin']
  )
)
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin']
  )
);

create policy band_members_delete_admin
on public.band_members
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin']
  )
);

create policy releases_select_member
on public.releases
for select
to authenticated
using (live_pack_private.is_band_member(band_id));

create policy releases_insert_editor
on public.releases
for insert
to authenticated
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy releases_update_editor
on public.releases
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy releases_delete_editor
on public.releases
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy songs_select_member
on public.songs
for select
to authenticated
using (live_pack_private.is_band_member(band_id));

create policy songs_insert_editor
on public.songs
for insert
to authenticated
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy songs_update_editor
on public.songs
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy songs_delete_editor
on public.songs
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy song_versions_select_member
on public.song_versions
for select
to authenticated
using (
  live_pack_private.is_band_member(
    live_pack_private.band_id_for_song(song_id)
  )
);

create policy song_versions_insert_editor
on public.song_versions
for insert
to authenticated
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_song(song_id),
    array['owner', 'admin', 'editor']
  )
);

create policy song_versions_update_editor
on public.song_versions
for update
to authenticated
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

create policy song_versions_delete_editor
on public.song_versions
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_song(song_id),
    array['owner', 'admin', 'editor']
  )
);

create policy lives_select_member
on public.lives
for select
to authenticated
using (live_pack_private.is_band_member(band_id));

create policy lives_insert_editor
on public.lives
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy lives_update_editor
on public.lives
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy lives_delete_editor
on public.lives
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy song_links_select_member
on public.song_links
for select
to authenticated
using (live_pack_private.is_band_member(band_id));

create policy song_links_insert_editor
on public.song_links
for insert
to authenticated
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy song_links_update_editor
on public.song_links
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy song_links_delete_editor
on public.song_links
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    band_id,
    array['owner', 'admin', 'editor']
  )
);

create policy setlist_entries_select_member
on public.setlist_entries
for select
to authenticated
using (
  live_pack_private.is_band_member(
    live_pack_private.band_id_for_live(live_id)
  )
);

create policy setlist_entries_insert_editor
on public.setlist_entries
for insert
to authenticated
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy setlist_entries_update_editor
on public.setlist_entries
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy setlist_entries_delete_editor
on public.setlist_entries
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy setlist_cues_select_member
on public.setlist_cues
for select
to authenticated
using (
  live_pack_private.is_band_member(
    live_pack_private.band_id_for_live(live_id)
  )
);

create policy setlist_cues_insert_editor
on public.setlist_cues
for insert
to authenticated
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy setlist_cues_update_editor
on public.setlist_cues
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy setlist_cues_delete_editor
on public.setlist_cues
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy notes_select_visible
on public.notes
for select
to authenticated
using (
  live_pack_private.can_view_note(
    live_id,
    author_id,
    visibility,
    target_member_id,
    target_role_name
  )
);

create policy notes_insert_author
on public.notes
for insert
to authenticated
with check (
  live_pack_private.can_write_note(live_id, author_id, visibility)
);

create policy notes_update_author
on public.notes
for update
to authenticated
using (
  live_pack_private.can_write_note(live_id, author_id, visibility)
)
with check (
  live_pack_private.can_write_note(live_id, author_id, visibility)
);

create policy notes_delete_author
on public.notes
for delete
to authenticated
using (
  live_pack_private.can_write_note(live_id, author_id, visibility)
);

create policy share_links_select_editor
on public.share_links
for select
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy share_links_insert_editor
on public.share_links
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy share_links_update_editor
on public.share_links
for update
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
)
with check (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

create policy share_links_delete_editor
on public.share_links
for delete
to authenticated
using (
  live_pack_private.has_band_permission(
    live_pack_private.band_id_for_live(live_id),
    array['owner', 'admin', 'editor']
  )
);

commit;
