import { supabase } from '../lib/supabase';
import { assertSupabaseResult } from './dataError';

export async function listNotifications() {
  return assertSupabaseResult(
    await supabase.from('notifications').select('id, type, title, body, related_entity_type, related_entity_id, read_at, created_at')
      .order('created_at', { ascending: false }).limit(50),
    '通知の取得',
  );
}

export async function markNotificationRead(id) {
  return assertSupabaseResult(
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select('id'),
    '通知の更新',
  );
}

export async function markAllNotificationsRead() {
  return assertSupabaseResult(await supabase.rpc('mark_all_notifications_read'), '通知の更新');
}

export async function listAccessRequests(ids) {
  if (!ids.length) return [];
  return assertSupabaseResult(
    await supabase.from('share_access_requests')
      .select('id, request_type, message, requested_sections, status, created_at')
      .in('id', ids),
    '申請内容の取得',
  );
}

export async function decideAccessRequest({
  requestId, decision, permission, expiresAt,
}) {
  const { data, error } = await supabase.functions.invoke('decide-access-request', {
    body: {
      request_id: requestId,
      decision,
      permission,
      expires_at: expiresAt,
    },
  });
  if (error) throw new Error(data?.error || '申請結果を保存できませんでした。');
  return data;
}
