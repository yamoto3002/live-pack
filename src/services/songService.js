import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listSongs(bandId) {
  return assertSupabaseResult(
    await supabase
      .from('songs')
      .select('id, band_id, release_id, title, color, memo')
      .eq('band_id', bandId)
      .order('created_at', { ascending: true }),
    '曲一覧の取得',
  );
}

export async function listSongVersions(songIds) {
  if (!songIds.length) return [];
  return assertSupabaseResult(
    await supabase
      .from('song_versions')
      .select('id, song_id, name, duration_sec, musical_key, bpm, has_click, has_sync, default_start_type, is_default, memo')
      .in('song_id', songIds)
      .order('created_at', { ascending: true }),
    '曲バージョンの取得',
  );
}

export async function listSongLinks(bandId) {
  return assertSupabaseResult(
    await supabase
      .from('song_links')
      .select('id, band_id, song_id, song_version_id, live_id, link_type, label, url, is_recommended, recorded_at, memo')
      .eq('band_id', bandId)
      .order('created_at', { ascending: true }),
    '音源・譜面リンクの取得',
  );
}

export async function upsertSongs(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('songs').upsert(rows, { onConflict: 'id' }),
    '曲の保存',
  );
}

export async function deleteSongs(ids, bandId) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('songs').delete().eq('band_id', bandId).in('id', ids),
    '曲の削除',
  );
}

export async function upsertSongVersions(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('song_versions').upsert(rows, { onConflict: 'id' }),
    '曲バージョンの保存',
  );
}

export async function deleteSongVersions(ids) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('song_versions').delete().in('id', ids),
    '曲バージョンの削除',
  );
}

export async function upsertSongLinks(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('song_links').upsert(rows, { onConflict: 'id' }),
    '音源・譜面リンクの保存',
  );
}

export async function deleteSongLinks(ids, bandId) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('song_links').delete().eq('band_id', bandId).in('id', ids),
    '音源・譜面リンクの削除',
  );
}

export async function setDefaultSongVersion(songId, versionId) {
  assertSupabaseResult(
    await supabase.rpc('set_default_song_version', {
      target_song_id: songId,
      target_version_id: versionId,
    }),
    '基本バージョンの変更',
  );
}
