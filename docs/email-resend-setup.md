# Resendメール設定

Supabase Edge Function secretsへ次を設定します。

```text
RESEND_API_KEY
SETPRINT_FROM_EMAIL
SETPRINT_REPLY_TO_EMAIL
APP_URL
```

`SETPRINT_FROM_EMAIL`はResendで認証済みの送信ドメインを使用してください。実在しない本番アドレスを設定しません。未設定時、関数は`configured: false`を返して安全にskipします。

`email_deliveries.idempotency_key`とResendのIdempotency-Keyを併用し、welcome等の二重送信を防ぎます。広告・新機能メールは`marketing_enabled=true`だけが対象で、初期値はfalseです。共有招待や申請結果などのトランザクション通知とは分離します。
