import { serviceClient } from './http.ts';

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  userId?: string | null;
  emailType: string;
  relatedEntityId?: string | null;
};

export async function sendEmail(input: EmailInput) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('SETPRINT_FROM_EMAIL');
  const replyTo = Deno.env.get('SETPRINT_REPLY_TO_EMAIL');
  if (!apiKey || !from) return { configured: false, status: 'skipped' };

  const client = serviceClient();
  const { data: existing } = await client
    .from('email_deliveries')
    .select('id, status, resend_message_id')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (existing?.status === 'sent') {
    return { configured: true, status: 'sent', duplicate: true, id: existing.resend_message_id };
  }

  const { data: delivery, error: insertError } = await client
    .from('email_deliveries')
    .upsert({
      user_id: input.userId || null,
      recipient_email: input.to,
      email_type: input.emailType,
      related_entity_id: input.relatedEntityId || null,
      idempotency_key: input.idempotencyKey,
      status: 'pending',
    }, { onConflict: 'idempotency_key' })
    .select('id')
    .single();
  if (insertError) throw insertError;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      from: `SETPRINT <${from}>`,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: replyTo || undefined,
    }),
  });
  const result = await response.json();
  await client.from('email_deliveries').update({
    status: response.ok ? 'sent' : 'failed',
    resend_message_id: response.ok ? result.id : null,
    error_message: response.ok ? null : String(result.message || 'Resend request failed').slice(0, 1000),
    sent_at: response.ok ? new Date().toISOString() : null,
  }).eq('id', delivery.id);
  if (!response.ok) throw new Error('Email delivery failed');
  return { configured: true, status: 'sent', id: result.id };
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function emailShell(title: string, body: string, actionLabel: string, actionUrl: string) {
  const safeTitle = escapeHtml(title);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  return `<!doctype html><html lang="ja"><body style="margin:0;background:#f2f1ec;color:#191b18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:600px;background:#fff;border:1px solid #d8d8d1">
  <tr><td style="background:#101210;padding:22px 28px;color:#f5f5f0;font-weight:800;letter-spacing:.08em">SETPRINT <span style="color:#d7ff54">／</span></td></tr>
  <tr><td style="padding:38px 28px"><h1 style="font-size:25px;margin:0 0 18px">${safeTitle}</h1>
  <div style="font-size:15px;line-height:1.8;color:#4b5049">${body}</div>
  <p style="margin:30px 0 0"><a href="${safeActionUrl}" style="display:inline-block;background:#d7ff54;color:#151a0f;text-decoration:none;font-weight:800;padding:13px 20px">${safeActionLabel}</a></p>
  </td></tr><tr><td style="padding:18px 28px;border-top:1px solid #e1e1dc;color:#858a82;font-size:12px">SETPRINT — Setlist workspace</td></tr>
  </table></td></tr></table></body></html>`;
}
