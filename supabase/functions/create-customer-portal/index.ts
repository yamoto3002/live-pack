import { authenticatedUser, json, preflight, serviceClient } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const user = await authenticatedUser(req);
  if (!user) return json(req, { error: 'ログインが必要です。' }, 401);
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  const appUrl = Deno.env.get('APP_URL');
  if (!secret || !appUrl) return json(req, { configured: false, message: '料金プランは準備中です。' }, 503);
  try {
    const client = serviceClient();
    const { data: billing } = await client.from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    if (!billing?.stripe_customer_id) return json(req, { error: '有効な請求アカウントがありません。' }, 404);
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customer: billing.stripe_customer_id, return_url: `${appUrl}/settings` }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || 'Stripe request failed');
    return json(req, { configured: true, url: result.url });
  } catch (error) {
    console.error('[create-customer-portal]', error);
    return json(req, { error: '請求ポータルを開けませんでした。' }, 500);
  }
});
