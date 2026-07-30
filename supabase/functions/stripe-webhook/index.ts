import { json, serviceClient } from '../_shared/http.ts';

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function verifySignature(payload: string, header: string, secret: string) {
  const fields = Object.fromEntries(header.split(',').map((part) => part.split('=', 2)));
  const timestamp = Number(fields.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  if (signature.length !== String(fields.v1 || '').length) return false;
  let mismatch = 0;
  for (let index = 0; index < signature.length; index += 1) mismatch |= signature.charCodeAt(index) ^ fields.v1.charCodeAt(index);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('stripe-signature') || '';
  const payload = await req.text();
  if (!secret || !await verifySignature(payload, signature, secret)) {
    return json(req, { error: 'Invalid signature' }, 400);
  }
  try {
    const event = JSON.parse(payload);
    const object = event.data?.object || {};
    const client = serviceClient();
    if (event.type.startsWith('customer.subscription.')) {
      const { data: billing } = await client.from('billing_customers').select('user_id').eq('stripe_customer_id', object.customer).maybeSingle();
      if (billing?.user_id) {
        const active = ['active', 'trialing'].includes(object.status);
        await client.from('subscriptions').upsert({
          user_id: billing.user_id,
          stripe_subscription_id: object.id,
          stripe_price_id: object.items?.data?.[0]?.price?.id || null,
          status: object.status === 'canceled' ? 'cancelled' : object.status,
          current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: Boolean(object.cancel_at_period_end),
        }, { onConflict: 'stripe_subscription_id' });
        await client.from('account_entitlements').upsert({
          user_id: billing.user_id,
          plan: active ? 'pro' : 'free',
          owned_band_limit: active ? 100 : 1,
          active: true,
          source: 'stripe',
          expires_at: active && object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null,
        });
      }
    }
    return json(req, { received: true });
  } catch (error) {
    console.error('[stripe-webhook]', error);
    return json(req, { error: 'Webhook handling failed' }, 500);
  }
});
