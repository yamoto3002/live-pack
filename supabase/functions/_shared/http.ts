import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const configuredOrigins = [
  Deno.env.get('APP_URL'),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://setprint.vercel.app',
  'https://live-pack.vercel.app',
].filter(Boolean) as string[];

export function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const isLocalDevelopment = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  return {
    'Access-Control-Allow-Origin': configuredOrigins.includes(origin) || isLocalDevelopment
      ? origin
      : configuredOrigins[0] || '',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function preflight(req: Request) {
  return new Response('ok', { headers: corsHeaders(req) });
}

export function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase server environment is unavailable');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function authenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = serviceClient();
  const { data, error } = await client.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export function publicError(req: Request, status = 404) {
  return json(req, { error: '共有情報を確認できませんでした。URLまたは入力内容をご確認ください。' }, status);
}

export function text(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}
