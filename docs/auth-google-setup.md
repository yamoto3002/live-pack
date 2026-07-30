# Google OAuth設定

1. Google CloudでWeb OAuth Clientを作成する。
2. 承認済みredirect URIへ`https://<project-ref>.supabase.co/auth/v1/callback`を追加する。
3. Supabase Dashboard → Authentication → Providers → GoogleへClient ID／Secretを設定する。
4. Supabase URL Configurationへ次を許可する。

- `http://localhost:5173/auth/callback`
- `https://setprint.vercel.app/auth/callback`
- `https://live-pack.vercel.app/auth/callback`
- 各環境の`/reset-password`

Google SecretはSupabase Provider設定だけに保存し、`VITE_`変数、Git、Vercelフロント変数へ置きません。callbackはPKCE codeをsessionへ交換し、profileの表示名・avatar・provider・最終ログインを更新して元URLへ戻ります。

Supabaseの同一メールidentity linkingは、メールが検証済みである等のプロジェクト設定とProvider条件に従います。Dashboardで自動link設定を確認し、本番前に既存メールユーザーと同じメールのGoogleログインを専用テストユーザーで確認してください。
