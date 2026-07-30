import { supabase } from '../lib/supabase';
import { assertSafeSharePayload } from '../utils/shareSanitizer';

function functionError(error, fallback) {
  if (!error) return null;
  const serverMessage = error.context?.body?.error;
  return new Error(serverMessage || fallback);
}

export async function listShareLinks(liveId) {
  const { data, error } = await supabase.functions.invoke('manage-share-link', {
    body: { action: 'list', live_id: liveId },
  });
  if (error) throw functionError(error, '共有リンクを読み込めませんでした。');
  return data.links || [];
}

export async function createShareLink(values) {
  const { data, error } = await supabase.functions.invoke('manage-share-link', {
    body: { action: 'create', ...values },
  });
  if (error) throw functionError(error, '共有リンクを作成できませんでした。');
  return data;
}

export async function updateShareLink(values) {
  const { data, error } = await supabase.functions.invoke('manage-share-link', {
    body: { action: 'update', ...values },
  });
  if (error) throw functionError(error, '共有リンクを更新できませんでした。');
  return data;
}

export async function resolveShareLink(token, passcode = '') {
  const { data, error } = await supabase.functions.invoke('resolve-share-link', {
    body: { token, passcode },
  });
  if (error) {
    const status = error.context?.status;
    if (status === 401) return { status: 'passcode_required' };
    if (status === 410) return { status: 'expired' };
    throw functionError(error, '共有リンクを確認できませんでした。');
  }
  return assertSafeSharePayload(data);
}

export async function submitAccessRequest(values) {
  const { data, error } = await supabase.functions.invoke('submit-access-request', { body: values });
  if (error) throw functionError(error, '申請を送信できませんでした。');
  return data.request;
}

export async function sendInvitation(values) {
  const { data, error } = await supabase.functions.invoke('send-invitation-email', { body: values });
  if (error) throw functionError(error, '招待メールを送信できませんでした。');
  return data;
}
