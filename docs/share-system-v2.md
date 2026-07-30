# 共有システム v2

管理者は共有先ごとにプリセット、表示項目、編集／開示申請、チャット、印刷／PDF／JPEG、ログイン、期限、停止、パスコードを設定します。

公開ページは`resolve-share-link`だけを利用します。resolverはtoken単位で対象liveを固定し、次を検証します。

- enabled／paused／expires
- login_required
- salt付きpasscode hash
- IP hash単位の簡易rate limit
- access log

返却payloadは許可フィールドから明示的に再構成します。`private`／`host`メモ、passcode hash、メール、課金、別liveのデータを返しません。フルビューでもprivateメモは含みません。

編集・情報開示申請はログイン必須です。ホストは`decide-access-request`で拒否、一時許可、永続許可を選べます。grantは有効期限を持ち、期限切れはDB helperでアクセス不可になります。
