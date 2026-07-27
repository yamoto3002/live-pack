begin;

-- A note author must be able to read the note they just created even when the
-- role-targeted audience does not include the author.
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
    and (
      $2 = (select auth.uid())
      or case $3
        when 'private' then false
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
      end
    );
$$;

-- Switching the default version requires two writes. Keeping them inside one
-- invoker-rights function makes the change atomic while preserving table RLS.
create or replace function public.set_default_song_version(
  target_song_id uuid,
  target_version_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.song_versions
    where id = target_version_id
      and song_id = target_song_id
  ) then
    raise exception 'The selected version does not belong to the song'
      using errcode = '23514';
  end if;

  update public.song_versions
  set is_default = false
  where song_id = target_song_id
    and is_default;

  update public.song_versions
  set is_default = true
  where id = target_version_id
    and song_id = target_song_id;
end;
$$;

revoke all on function public.set_default_song_version(uuid, uuid)
from public, anon;
grant execute on function public.set_default_song_version(uuid, uuid)
to authenticated;

commit;
