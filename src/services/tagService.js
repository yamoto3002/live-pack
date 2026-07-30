import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listTags(bandId) {
  return assertSupabaseResult(
    await supabase.from('tags').select('id, band_id, name, color_token, sort_order')
      .eq('band_id', bandId).order('sort_order').order('name'),
    'タグ一覧の取得',
  );
}

export async function listSongTags(songIds) {
  if (!songIds.length) return [];
  return assertSupabaseResult(
    await supabase.from('song_tags').select('song_id, tag_id, created_at').in('song_id', songIds),
    '曲タグの取得',
  );
}

export async function upsertTags(rows) {
  if (!rows.length) return [];
  return assertSupabaseResult(
    await supabase.from('tags').upsert(rows, { onConflict: 'id' }).select('id'),
    'タグの保存',
  );
}

export async function deleteTags(ids) {
  if (!ids.length) return;
  assertSupabaseResult(await supabase.from('tags').delete().in('id', ids), 'タグの削除');
}

export async function replaceSongTags(songId, tagIds) {
  assertSupabaseResult(await supabase.from('song_tags').delete().eq('song_id', songId), '曲タグの更新');
  if (!tagIds.length) return;
  assertSupabaseResult(
    await supabase.from('song_tags').insert(tagIds.map((tagId) => ({ song_id: songId, tag_id: tagId }))),
    '曲タグの更新',
  );
}
