import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function getOwnedBandCapacity() {
  const rows = assertSupabaseResult(await supabase.rpc('get_owned_band_capacity'), '料金プランの確認');
  return rows?.[0] || { plan: 'free', owned_count: 0, owned_band_limit: 1, can_create: true };
}

export async function createCheckoutSession() {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: {} });
  if (error && !data) throw error;
  return data || { configured: false, message: '料金プランは準備中です。' };
}

export async function openBillingPortal() {
  const { data, error } = await supabase.functions.invoke('create-customer-portal', { body: {} });
  if (error && !data) throw error;
  return data || { configured: false, message: '料金プランは準備中です。' };
}
