import { authenticatedUser, json, preflight, serviceClient, text } from '../_shared/http.ts';
import { hashPasscode, randomToken } from '../_shared/crypto.ts';

const SAFE_FIELDS = [
  'label', 'recipient_name', 'preset', 'view_fields', 'allow_edit_requests',
  'allow_information_requests', 'allow_chat', 'allow_print', 'allow_pdf',
  'allow_jpeg', 'login_required', 'expires_at', 'enabled', 'paused_at', 'invite_message',
];

async function canManage(client: ReturnType<typeof serviceClient>, userId: string, liveId: string) {
  const { data: live } = await client.from('lives').select('band_id').eq('id', liveId).maybeSingle();
  if (!live) return false;
  const { data: membership } = await client.from('band_members').select('permission')
    .eq('band_id', live.band_id).eq('user_id', userId)
    .in('permission', ['owner', 'admin', 'editor']).maybeSingle();
  return Boolean(membership);
}

function safeLink(link: Record<string, unknown>) {
  const { passcode_hash: _hidden, ...safe } = link;
  return { ...safe, passcode_configured: Boolean(_hidden) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: 'ログインが必要です。' }, 401);
  try {
    const client = serviceClient();
    const body = await req.json();
    const action = body.action || 'list';
    const liveId = text(body.live_id, 100);
    if (!liveId || !await canManage(client, user.id, liveId)) {
      return json(req, { error: '共有リンクを管理する権限がありません。' }, 403);
    }

    if (action === 'list') {
      const { data, error } = await client.from('share_links').select('*').eq('live_id', liveId).order('created_at', { ascending: false });
      if (error) throw error;
      return json(req, { links: (data || []).map(safeLink) });
    }

    if (action === 'create') {
      const passcode = text(body.passcode, 120);
      const input = Object.fromEntries(SAFE_FIELDS.map((key) => [key, body[key]]).filter(([, value]) => value !== undefined));
      const { data, error } = await client.from('share_links').insert({
        ...input,
        live_id: liveId,
        token: randomToken(),
        scope: body.preset || 'performer',
        created_by: user.id,
        passcode_hash: await hashPasscode(passcode),
      }).select('*').single();
      if (error) throw error;
      const { error: conversationError } = await client.from('share_conversations').insert({
        live_id: liveId, share_link_id: data.id,
      });
      if (conversationError) console.info('[manage-share-link] conversation pending', conversationError.message);
      return json(req, { link: safeLink(data), passcode });
    }

    const linkId = text(body.id, 100);
    const { data: link } = await client.from('share_links').select('id, live_id').eq('id', linkId).eq('live_id', liveId).maybeSingle();
    if (!link) return json(req, { error: '共有リンクが見つかりません。' }, 404);

    if (action === 'update') {
      const input = Object.fromEntries(SAFE_FIELDS.map((key) => [key, body[key]]).filter(([, value]) => value !== undefined));
      if (body.passcode !== undefined) input.passcode_hash = await hashPasscode(text(body.passcode, 120));
      const { data, error } = await client.from('share_links').update(input).eq('id', linkId).select('*').single();
      if (error) throw error;
      return json(req, { link: safeLink(data), passcode: body.passcode });
    }

    return json(req, { error: '対応していない操作です。' }, 400);
  } catch (error) {
    console.error('[manage-share-link]', error);
    return json(req, { error: '共有リンクの保存に失敗しました。' }, 500);
  }
});
