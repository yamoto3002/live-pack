import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listNotes(liveIds) {
  if (!liveIds.length) return [];
  return assertSupabaseResult(
    await supabase
      .from('notes')
      .select('id, live_id, setlist_entry_id, song_id, author_id, target_member_id, target_role_name, visibility, body')
      .in('live_id', liveIds)
      .order('created_at', { ascending: true }),
    'メモの取得',
  );
}

export async function upsertNotes(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('notes').upsert(rows, { onConflict: 'id' }),
    'メモの保存',
  );
}

export async function deleteNotes(ids) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('notes').delete().in('id', ids),
    'メモの削除',
  );
}
