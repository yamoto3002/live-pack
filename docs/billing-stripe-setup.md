# Stripe課金基盤

Supabase Edge Function secretsへ次を設定します。

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID
APP_URL
```

Stripe Dashboardでsubscription用Priceを作成し、webhookを`stripe-webhook`へ向けます。少なくともcheckout完了、subscription作成／更新／削除を購読します。

金額は未決定のためコードへ固定していません。Secret不足時はcheckout／portal関数が`configured: false`を返します。無料枠はownerバンド1件で、他バンドへのmembershipは数えません。最終判定は`account_entitlements`を参照するDB triggerです。
