import { authenticatedUser, json, preflight, serviceClient, text } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: 'ログインが必要です。' }, 401);
  try {
    const client = serviceClient();
    const body = await req.json();
    const requestId = text(body.request_id, 100);
    const decision = body.decision === 'approved' ? 'approved' : 'rejected';
    const { data: accessRequest } = await client.from('share_access_requests').select('*').eq('id', requestId).eq('status', 'pending').maybeSingle();
    if (!accessRequest) return json(req, { error: '未処理の申請が見つかりません。' }, 404);

    const { data: live } = await client.from('lives').select('band_id, title').eq('id', accessRequest.live_id).single();
    const { data: membership } = await client.from('band_members').select('permission').eq('band_id', live.band_id).eq('user_id', user.id).in('permission', ['owner', 'admin']).maybeSingle();
    if (!membership) return json(req, { error: '申請を処理する権限がありません。' }, 403);

    let expiresAt: string | null = null;
    let permission = 'viewer';
    if (decision === 'approved' && accessRequest.request_type === 'edit') {
      permission = body.permission === 'permanent_editor' ? 'permanent_editor' : 'temporary_editor';
      if (permission === 'temporary_editor') {
        const requested = body.expires_at ? new Date(body.expires_at) : new Date(Date.now() + 3 * 60 * 60 * 1000);
        if (Number.isNaN(requested.valueOf()) || requested <= new Date()) return json(req, { error: '有効な編集期限を指定してください。' }, 400);
        expiresAt = requested.toISOString();
      }
      await client.from('live_access_grants').update({ active: false }).eq('live_id', accessRequest.live_id).eq('user_id', accessRequest.requester_id).eq('active', true);
      const { error: grantError } = await client.from('live_access_grants').insert({
        live_id: accessRequest.live_id, user_id: accessRequest.requester_id,
        permission, granted_by: user.id, source_request_id: requestId,
        expires_at: expiresAt, active: true,
      });
      if (grantError) throw grantError;
    }

    const { data: decided, error } = await client.from('share_access_requests').update({
      status: decision, decided_by: user.id, decided_at: new Date().toISOString(),
    }).eq('id', requestId).select('*').single();
    if (error) throw error;
    await client.from('notifications').insert({
      user_id: accessRequest.requester_id,
      type: decision === 'approved' ? 'access_approved' : 'access_rejected',
      title: decision === 'approved' ? '申請が許可されました' : '申請結果のお知らせ',
      body: `${live.title}への${accessRequest.request_type === 'edit' ? '編集' : '情報開示'}申請が${decision === 'approved' ? '許可' : '拒否'}されました。`,
      related_entity_type: 'share_access_request',
      related_entity_id: requestId,
    });
    return json(req, { request: decided, grant: decision === 'approved' ? { permission, expires_at: expiresAt } : null });
  } catch (error) {
    console.error('[decide-access-request]', error);
    return json(req, { error: '申請結果を保存できませんでした。' }, 500);
  }
});
