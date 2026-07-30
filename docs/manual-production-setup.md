# 本番手動設定

## Supabase

1. migration dry-runとlistを確認してからpushする。
2. Edge Functionsをdeployする。
3. Site URLとredirect allow listへ新旧本番URLを登録する。
4. Google Providerを設定する。
5. Resend／Stripe／APP_URL secretsを必要な範囲で設定する。
6. RLSで別band、private note、期限切れgrant、anon direct accessをテストする。

## Vercel

次の公開変数だけをProduction／Previewへ設定します。

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_APP_URL
VITE_APP_NAME=SETPRINT
VITE_PRO_PRICE_LABEL
```

SPA fallbackが有効な状態で`/auth/callback`、`/reset-password`、`/share/:token`を直接開けることを確認します。SecretはVercelの`VITE_`変数へ入れません。

## 公開前チェック

- 既存ユーザーのメールログインとnatsudaidaiデータ
- Google callbackと元URL復帰
- 1件目／2件目ownerバンド
- 共有の匿名、passcode、期限、停止、privateメモ非表示
- A4／PDF／JPEG／Stage View
- 390×844と1440px
- direct URL、console、404、ネットワーク失敗

外部Secretが不足している機能は安全な未接続表示のまま公開し、設定完了後に個別確認します。
