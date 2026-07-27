import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listBandsForUser(userId) {
  const memberships = assertSupabaseResult(
    await supabase
      .from('band_members')
      .select('id, band_id, display_name, role_name, category, permission')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    'バンド一覧の取得',
  );

  if (!memberships.length) return [];

  const bands = assertSupabaseResult(
    await supabase
      .from('bands')
      .select('id, name, owner_id, created_at, updated_at')
      .in('id', memberships.map((membership) => membership.band_id))
      .order('created_at', { ascending: true }),
    'バンド一覧の取得',
  );

  const membershipByBand = new Map(
    memberships.map((membership) => [membership.band_id, membership]),
  );

  return bands.map((band) => ({
    ...band,
    membership: membershipByBand.get(band.id),
  }));
}

export async function createBand({ name, userId, displayName, roleName }) {
  const bandId = crypto.randomUUID();

  // The owner membership is created by an AFTER INSERT trigger. Do not request
  // the band through INSERT ... RETURNING: its SELECT policy is evaluated before
  // that trigger has made the new membership visible.
  assertSupabaseResult(
    await supabase
      .from('bands')
      .insert({ id: bandId, name: name.trim(), owner_id: userId }),
    'バンドの作成',
  );

  assertSupabaseResult(
    await supabase
      .from('band_members')
      .update({
        display_name: displayName.trim() || null,
        role_name: roleName.trim() || null,
      })
      .eq('band_id', bandId)
      .eq('user_id', userId)
      .select('id'),
    'バンドの担当情報の保存',
  );

  return assertSupabaseResult(
    await supabase
      .from('bands')
      .select('id, name, owner_id, created_at, updated_at')
      .eq('id', bandId)
      .single(),
    '作成したバンドの取得',
  );
}

export async function listBandMembers(bandId) {
  return assertSupabaseResult(
    await supabase
      .from('band_members')
      .select('id, band_id, user_id, display_name, role_name, category, permission')
      .eq('band_id', bandId)
      .order('created_at', { ascending: true }),
    'メンバー一覧の取得',
  );
}
