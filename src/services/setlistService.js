import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listSetlistEntries(liveIds) {
  if (!liveIds.length) return [];
  return assertSupabaseResult(
    await supabase
      .from('setlist_entries')
      .select('id, live_id, song_id, song_version_id, sort_order, title_snapshot, version_name_snapshot, duration_sec, musical_key, bpm, has_click, has_sync, start_type, end_type, memo')
      .in('live_id', liveIds)
      .order('sort_order', { ascending: true }),
    'セトリ曲順の取得',
  );
}

export async function listSetlistCues(liveIds) {
  if (!liveIds.length) return [];
  return assertSupabaseResult(
    await supabase
      .from('setlist_cues')
      .select('id, live_id, after_entry_id, sort_order, cue_type, title, duration_sec, transition_type, trigger_person, operator_name, playback, memo')
      .in('live_id', liveIds)
      .order('sort_order', { ascending: true }),
    '曲間情報の取得',
  );
}

export async function upsertSetlistEntries(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('setlist_entries').upsert(rows, { onConflict: 'id' }),
    'セトリ曲順の保存',
  );
}

export async function deleteSetlistEntries(ids) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('setlist_entries').delete().in('id', ids),
    'セトリ曲順の削除',
  );
}

export async function upsertSetlistCues(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('setlist_cues').upsert(rows, { onConflict: 'id' }),
    '曲間情報の保存',
  );
}

export async function deleteSetlistCues(ids) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('setlist_cues').delete().in('id', ids),
    '曲間情報の削除',
  );
}
