# セキュリティモデル

- publicテーブルはRLSを有効化し、band membershipまたは本人IDでtenant境界を作る。
- anonへテーブルの直接権限を与えない。匿名共有はservice roleを持つEdge resolverだけを経由する。
- service role、Resend／Stripe SecretはEdge Functionsだけで使用する。
- `SECURITY DEFINER`は`search_path=''`を固定し、必要な関数だけへEXECUTEを付与する。
- ownerバンド上限はDB trigger、課金状態はentitlementで判定する。
- passcodeはsalt付きdigestのみDBへ保存し、平文は作成直後だけ返す。
- access request／grant／notification／personal noteは本人またはlive管理者に限定する。
- 共有レスポンスはdenylistだけに頼らず、許可フィールドのallowlistで構築する。

`live_pack_private`は既存migrationとの互換性のため名称を維持する非公開schemaです。ブラウザーのData API schemaには公開しません。
