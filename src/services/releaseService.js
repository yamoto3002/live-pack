import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listReleases(bandId) {
  return assertSupabaseResult(
    await supabase
      .from('releases')
      .select('id, band_id, title, release_type, color, color_token, sort_order, memo')
      .eq('band_id', bandId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    'リリース一覧の取得',
  );
}

export async function upsertReleases(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('releases').upsert(rows, { onConflict: 'id' }),
    'リリースの保存',
  );
}

export async function deleteReleases(ids, bandId) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('releases').delete().eq('band_id', bandId).in('id', ids),
    'リリースの削除',
  );
}
