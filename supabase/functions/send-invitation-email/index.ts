import { authenticatedUser, json, preflight, serviceClient, text } from '../_shared/http.ts';
import { emailShell, escapeHtml, sendEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: 'ログインが必要です。' }, 401);
  try {
    const client = serviceClient();
    const body = await req.json();
    const shareLinkId = text(body.share_link_id, 100);
    const recipientEmail = text(body.recipient_email, 320);
    const { data: link } = await client.from('share_links').select('id, live_id, token, label, expires_at').eq('id', shareLinkId).maybeSingle();
    if (!link || !recipientEmail.includes('@')) return json(req, { error: '送信先または共有リンクが正しくありません。' }, 400);
    const { data: live } = await client.from('lives').select('band_id, title, live_date, venue').eq('id', link.live_id).single();
    const { data: member } = await client.from('band_members').select('permission').eq('band_id', live.band_id).eq('user_id', user.id).in('permission', ['owner', 'admin', 'editor']).maybeSingle();
    if (!member) return json(req, { error: '招待を送る権限がありません。' }, 403);

    const appUrl = Deno.env.get('APP_URL') || 'https://setprint.vercel.app';
    const shareUrl = `${appUrl}/share/${encodeURIComponent(link.token)}`;
    const invitation = text(body.invitation, 3000) || `${live.title}のセットリストを共有します。`;
    const result = await sendEmail({
      to: recipientEmail,
      subject: `SETPRINT共有：${live.title}`,
      html: emailShell(
        `${live.title}のセットリスト`,
        `<p>${escapeHtml(invitation).replaceAll('\n', '<br>')}</p><p>日付：${escapeHtml(live.live_date || '未定')}<br>会場：${escapeHtml(live.venue || '未定')}</p>`,
        'セットリストを見る',
        shareUrl,
      ),
      idempotencyKey: `invitation:${link.id}:${recipientEmail.toLowerCase()}:${Date.now()}`,
      userId: null,
      emailType: 'invitation',
      relatedEntityId: link.id,
    });
    return json(req, result);
  } catch (error) {
    console.error('[send-invitation-email]', error);
    return json(req, { error: '招待メールを送信できませんでした。' }, 500);
  }
});
