import { authenticatedUser, json, preflight, serviceClient } from '../_shared/http.ts';

async function stripeRequest(path: string, values: Record<string, string>) {
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) return null;
  const body = new URLSearchParams(values);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Stripe request failed');
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req);
  const user = await authenticatedUser(req);
  if (!user?.email) return json(req, { error: 'ログインが必要です。' }, 401);
  const priceId = Deno.env.get('STRIPE_PRICE_ID');
  const appUrl = Deno.env.get('APP_URL');
  if (!Deno.env.get('STRIPE_SECRET_KEY') || !priceId || !appUrl) {
    return json(req, { configured: false, message: '料金プランは準備中です。' }, 503);
  }
  try {
    const client = serviceClient();
    const { data: billing } = await client.from('billing_customers').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    let customerId = billing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripeRequest('customers', {
        email: user.email, 'metadata[user_id]': user.id, 'metadata[product]': 'SETPRINT',
      });
      customerId = customer.id;
      await client.from('billing_customers').upsert({ user_id: user.id, stripe_customer_id: customerId });
    }
    const session = await stripeRequest('checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      'metadata[user_id]': user.id,
      allow_promotion_codes: 'true',
    });
    return json(req, { configured: true, url: session.url });
  } catch (error) {
    console.error('[create-checkout-session]', error);
    return json(req, { error: '決済画面を準備できませんでした。' }, 500);
  }
});
