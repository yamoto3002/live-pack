import { authenticatedUser, json, preflight, serviceClient, text } from '../_shared/http.ts';
import { emailShell, escapeHtml, sendEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const actor = await authenticatedUser(req);
  if (!actor) return json(req, { error: 'ログインが必要です。' }, 401);
  try {
    const client = serviceClient();
    const body = await req.json();
    const notificationId = text(body.notification_id, 100);
    const { data: notification } = await client.from('notifications').select('*').eq('id', notificationId).maybeSingle();
    if (!notification) return json(req, { error: '通知が見つかりません。' }, 404);
    let allowed = notification.user_id === actor.id;
    if (!allowed && notification.related_entity_type === 'share_access_request') {
      const { data: request } = await client.from('share_access_requests')
        .select('live_id').eq('id', notification.related_entity_id).maybeSingle();
      if (request) {
        const { data: live } = await client.from('lives').select('band_id').eq('id', request.live_id).maybeSingle();
        const { data: member } = live ? await client.from('band_members').select('permission')
          .eq('band_id', live.band_id).eq('user_id', actor.id)
          .in('permission', ['owner', 'admin']).maybeSingle() : { data: null };
        allowed = Boolean(member);
      }
    }
    if (!allowed) return json(req, { error: '通知メールを送る権限がありません。' }, 403);
    const { data: target } = await client.auth.admin.getUserById(notification.user_id);
    if (!target.user?.email) return json(req, { configured: true, status: 'skipped' });
    const appUrl = Deno.env.get('APP_URL') || 'https://setprint.vercel.app';
    const result = await sendEmail({
      to: target.user.email,
      subject: `SETPRINT：${notification.title}`,
      html: emailShell(notification.title, `<p>${escapeHtml(notification.body || 'SETPRINTに新しい通知があります。')}</p>`, 'SETPRINTで確認', appUrl),
      idempotencyKey: `notification:${notification.id}`,
      userId: notification.user_id,
      emailType: notification.type,
      relatedEntityId: notification.related_entity_id,
    });
    return json(req, result);
  } catch (error) {
    console.error('[send-notification-email]', error);
    return json(req, { error: '通知メールを送信できませんでした。' }, 500);
  }
});
