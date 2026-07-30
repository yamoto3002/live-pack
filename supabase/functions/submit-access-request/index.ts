import { authenticatedUser, json, preflight, serviceClient, text } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: '申請にはログインが必要です。' }, 401);
  try {
    const client = serviceClient();
    const body = await req.json();
    const token = text(body.token, 200);
    const requestType = body.request_type === 'information' ? 'information' : 'edit';
    const { data: link } = await client.from('share_links').select('id, live_id, enabled, paused_at, expires_at, allow_edit_requests, allow_information_requests').eq('token', token).maybeSingle();
    const allowed = link && link.enabled && !link.paused_at
      && (!link.expires_at || new Date(link.expires_at) > new Date())
      && (requestType === 'edit' ? link.allow_edit_requests : link.allow_information_requests);
    if (!allowed) return json(req, { error: 'この共有リンクでは申請を受け付けていません。' }, 403);

    const { data: accessRequest, error } = await client.from('share_access_requests').insert({
      live_id: link.live_id, share_link_id: link.id, requester_id: user.id,
      request_type: requestType, message: text(body.message, 1000) || null,
      requested_sections: Array.isArray(body.requested_sections)
        ? body.requested_sections.map((value: unknown) => text(value, 80)).filter(Boolean).slice(0, 20)
        : [],
    }).select('*').single();
    if (error) throw error;

    const { data: live } = await client.from('lives').select('band_id, title').eq('id', link.live_id).single();
    const { data: owners } = await client.from('band_members').select('user_id').eq('band_id', live.band_id).in('permission', ['owner', 'admin']);
    if (owners?.length) {
      await client.from('notifications').insert(owners.map((owner) => ({
        user_id: owner.user_id,
        type: requestType === 'edit' ? 'edit_request' : 'information_request',
        title: requestType === 'edit' ? '編集申請が届きました' : '情報開示申請が届きました',
        body: `${live.title}への申請を確認してください。`,
        related_entity_type: 'share_access_request',
        related_entity_id: accessRequest.id,
      })));
    }
    return json(req, { request: accessRequest });
  } catch (error) {
    console.error('[submit-access-request]', error);
    return json(req, { error: '申請を送信できませんでした。重複申請がないかご確認ください。' }, 400);
  }
});
