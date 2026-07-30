# SETPRINT

SETPRINTは、バンドやアーティストが曲を蓄積し、ライブごとのセットリストを組み、出演者・スタッフ・会場へ必要な情報だけを安全に渡すWebアプリです。中心にあるのはライブ管理全般ではなく、セットリストの作成、編集、共有、印刷です。

## 主な機能

- メール／パスワード認証、Google OAuth、パスワード再設定
- Supabaseを正とするバンド、曲、バージョン、ライブ、セットリスト、キュー、メモ管理
- 固定36色、タグ、検索、BPM・Key・尺フィルター
- 曲ライブラリからの追加、ドラッグ追加・並べ替え、キーボード代替、Undo／Redo
- 相手別プリセット、カスタム項目、期限、停止、パスコードを持つ共有リンク
- 編集・情報開示申請、一時／永続権限、通知・会話用DB基盤
- A4テンプレート、PDF、JPEG、印刷、Stage View
- 無料1 ownerバンドのDB制限とStripe課金基盤
- Resendによるウェルカム・招待・通知メール基盤

## 技術構成

- React / Vite
- Supabase Auth / Postgres / RLS / Edge Functions
- dnd-kit
- jsPDF / html-to-image
- Vitest / Playwright / ESLint
- Vercel

## ローカル開発

Node.js 20.19以上（または22.12以上）を使用してください。

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

`.env.local`へSupabaseの公開URLとpublishable keyを設定します。`service_role`、Google Client Secret、Resend／Stripe Secretをフロントへ置かないでください。

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=SETPRINT
VITE_PRO_PRICE_LABEL=
```

検証コマンド：

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Supabase

既存migrationは変更せず、`supabase/migrations`の追加migrationでv2を構成します。

```bash
npx supabase link --project-ref <project-ref>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

本番DBに対する`db reset`は行わないでください。`live_pack_private` schemaは既存関数・RLSとの互換性を守るため内部名として維持しています。画面や共有レスポンスには露出しません。

Edge Functions：

```bash
npx supabase functions deploy resolve-share-link --no-verify-jwt
npx supabase functions deploy manage-share-link
npx supabase functions deploy submit-access-request
npx supabase functions deploy decide-access-request
npx supabase functions deploy send-welcome-email
npx supabase functions deploy send-invitation-email
npx supabase functions deploy send-notification-email
npx supabase functions deploy create-checkout-session
npx supabase functions deploy create-customer-portal
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

## 外部サービス

- Google OAuth: Client ID／SecretはSupabase DashboardのGoogle Providerへだけ設定します。詳細は[docs/auth-google-setup.md](docs/auth-google-setup.md)。
- Resend: SecretはSupabase Edge Function secretsへ設定します。未設定時は送信を安全にskipし、画面操作は失敗させません。詳細は[docs/email-resend-setup.md](docs/email-resend-setup.md)。
- Stripe: Secret、Price ID、Webhook Secretが揃うまで決済APIを呼ばず「準備中」を返します。金額はコードへ固定していません。詳細は[docs/billing-stripe-setup.md](docs/billing-stripe-setup.md)。
- Vercel: フロントの公開変数だけを設定します。詳細は[docs/manual-production-setup.md](docs/manual-production-setup.md)。

## 共有とprivateメモ

共有URLはブラウザーからテーブルを直接読むのではなく、`resolve-share-link`でtoken、期限、停止、ログイン、パスコードを検証してから、許可フィールドだけを再構成します。passcode hash、個人メモ、ホストメール、課金情報、他ライブの情報は返しません。パスコードはsalt付きSHA-256で保存し、平文は作成直後に一度だけ返します。

## 料金制限

無料ユーザーがownerとして作成できるバンドは1件です。他人のバンドへの参加は数えません。2件目は`account_entitlements.owned_band_limit`をDB triggerで確認するため、UIだけを回避して作成することはできません。Stripe未設定時も1件目と既存データは利用できます。

## データ互換

旧`live-pack-*` localStorageキーは起動時に一度だけ`setprint-*`へ複製し、移行フラグを保存します。旧キーはバックアップとして残します。既存Supabaseテーブル、project ref、`live_pack_private` schemaは破壊的な改名をしていません。

設計の全体像は[docs/architecture-v2.md](docs/architecture-v2.md)、セキュリティ境界は[docs/security-model.md](docs/security-model.md)を参照してください。
