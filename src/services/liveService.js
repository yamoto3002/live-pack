import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listLives(bandId) {
  return assertSupabaseResult(
    await supabase
      .from('lives')
      .select('id, band_id, title, live_date, venue, time_limit_sec, status, memo, created_by')
      .eq('band_id', bandId)
      .order('live_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    'ライブ一覧の取得',
  );
}

export async function upsertLives(rows) {
  if (!rows.length) return;
  assertSupabaseResult(
    await supabase.from('lives').upsert(rows, {
      onConflict: 'id',
      ignoreDuplicates: true,
    }),
    'ライブ情報の保存',
  );
  for (const row of rows) {
    assertSupabaseResult(
      await supabase
        .from('lives')
        .update({
          title: row.title,
          live_date: row.live_date,
          venue: row.venue,
          time_limit_sec: row.time_limit_sec,
          status: row.status,
          memo: row.memo,
        })
        .eq('id', row.id)
        .eq('band_id', row.band_id),
      'ライブ情報の保存',
    );
  }
}

export async function deleteLives(ids, bandId) {
  if (!ids.length) return;
  assertSupabaseResult(
    await supabase.from('lives').delete().eq('band_id', bandId).in('id', ids),
    'ライブの削除',
  );
}
