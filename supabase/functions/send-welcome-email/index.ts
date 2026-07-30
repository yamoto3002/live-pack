import { authenticatedUser, json, preflight, serviceClient } from '../_shared/http.ts';
import { emailShell, escapeHtml, sendEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const user = await authenticatedUser(req);
  if (!user?.email) return json(req, { error: 'ログインが必要です。' }, 401);
  try {
    const client = serviceClient();
    const { data: profile } = await client.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    const appUrl = Deno.env.get('APP_URL') || 'https://setprint.vercel.app';
    const body = `<p>${escapeHtml(profile?.display_name || 'ユーザー')}さん、SETPRINTへの登録が完了しました。</p>
      <p>まずは活動するバンドを作り、曲を登録してください。曲順を組んだら、演奏者・スタッフ・会場へ必要な情報だけを共有できます。</p>
      <ol><li>バンドを作る</li><li>曲を登録する</li><li>セットリストを作る</li><li>共有リンクを発行する</li></ol>`;
    const result = await sendEmail({
      to: user.email,
      subject: 'SETPRINTへようこそ',
      html: emailShell('最初のセットリストを作りましょう', body, 'SETPRINTを開く', appUrl),
      idempotencyKey: `welcome:${user.id}`,
      userId: user.id,
      emailType: 'welcome',
    });
    return json(req, result);
  } catch (error) {
    console.error('[send-welcome-email]', error);
    return json(req, { error: 'メールを送信できませんでした。' }, 500);
  }
});
