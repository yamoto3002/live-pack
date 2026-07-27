begin;

-- A setlist entry keeps its snapshots when the source song is deleted. Clear
-- both nullable references in one statement before the two FK actions run;
-- otherwise song_id can become null first and violate
-- setlist_entries_version_requires_song while song_version_id is still set.
create or replace function live_pack_private.preserve_setlist_song_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.setlist_entries
  set
    song_version_id = null,
    song_id = null
  where song_id = old.id;

  return old;
end;
$$;

revoke execute on function live_pack_private.preserve_setlist_song_snapshot()
from public, anon, authenticated;

create trigger songs_preserve_setlist_snapshots
before delete on public.songs
for each row
execute function live_pack_private.preserve_setlist_song_snapshot();

commit;
