# SETPRINT データベース設計 v1（互換資料）

## 1. この設計の範囲

この文書は、SETPRINTの初期 Supabase スキーマと Row Level Security
（RLS）の設計を説明する。対象 migration は次のファイルである。

- `supabase/migrations/20260727143520_initial_live_pack_schema.sql`

今回用意するのは、テーブル、制約、索引、DB 関数、trigger、RLS、
Data API 用権限までである。migration はまだローカル DB にもリモート
Supabase にも適用していない。既存の React UI、Mock Auth、
`localStorage` 保存処理も変更していない。

## 2. テーブル一覧と目的

| テーブル | 目的 |
| --- | --- |
| `profiles` | `auth.users` と 1 対 1 で対応するアプリ用プロフィール |
| `bands` | アーティスト、バンド、ソロプロジェクトなどのデータ所有単位 |
| `band_members` | ユーザーとバンドの多対多所属、担当名、権限 |
| `releases` | Album、EP、Single などのリリース単位 |
| `songs` | バンドが管理する曲そのもの |
| `song_versions` | 通常版、短縮版、同期あり版など、曲の再利用可能な版 |
| `lives` | 公演、リハーサル、本番などのライブ単位 |
| `song_links` | 曲、曲バージョン、ライブに紐づく外部 URL |
| `setlist_entries` | ライブに採用した曲と、その時点の演奏設定スナップショット |
| `setlist_cues` | MC、SE、転換、衣装替えなど、曲として数えない曲間イベント |
| `notes` | ライブ、曲、セトリ項目に対する公開範囲付きメモ |
| `share_links` | 将来の共有ページ発行・停止・期限・対象範囲の管理情報 |

全テーブルの主キーには UUID を使う。`profiles.id` だけは
`auth.users.id` をそのまま主キーとして使い、その他は
`gen_random_uuid()` で生成する。主要テーブルには
`created_at default now()` と、trigger で自動更新される `updated_at`
を置く。

## 3. テーブル間の関係

中心となる関係は次のとおり。

```text
auth.users ──1:1── profiles
profiles ──1:N── bands (owner)
profiles ──N:M── bands (band_members)
bands ──1:N── releases ──1:N── songs ──1:N── song_versions
bands ──1:N── lives ──1:N── setlist_entries
lives ──1:N── setlist_cues
lives ──1:N── notes
lives ──1:N── share_links
songs / song_versions / lives ──1:N── song_links
```

`band_id`、`live_id`、`song_id` などの外部キーには検索・JOIN・削除連鎖を
考慮した索引を作る。複合外部キーや検証 trigger により、別バンドの曲を
誤って他バンドのライブへ関連付けることも防ぐ。

## 4. Song / SongVersion / SetlistEntry の違い

### Song

曲の同一性を表す。タイトル、所属リリース、曲全体のメモなどを持つ。
曲名だけでも登録でき、`release_id` は任意である。

### SongVersion

複数ライブで再利用する標準的な演奏パターンを表す。演奏時間、キー、
BPM、クリック、同期、開始方法などを持つ。1 曲に複数作成できる。

`is_default = true` の行に対する部分 UNIQUE INDEX により、1 曲につき
デフォルトバージョンを最大 1 件に制限する。

### SetlistEntry

特定ライブへ曲を配置した結果を表す。`song_id` と `song_version_id` は
元データへの参照だが、タイトル、バージョン名、演奏時間、キー、BPM、
クリック、同期、開始・終了方法を別途スナップショットとして保存する。

この分離により、曲ライブラリの通常版を変更しても、過去ライブの記録や
今回だけの変更が書き換わらない。

## 5. ライブ固有値を setlist_entries に保存する理由

同じ曲でも、ライブによって次のような違いがある。

- 時間制限に合わせた短縮
- キー変更
- 同期・クリックの有無
- SE から始める、暗転で終わるなどの進行
- 当日だけのメモ

これらを `song_versions` に書き戻すと、別ライブでも使う標準設定まで
変わる。ライブ固有値は `setlist_entries` に保存し、必要な場合だけ後から
新しい `song_versions` として昇格させる。

## 6. 過去ライブをスナップショットで残す理由

曲名変更、バージョン削除、曲ライブラリ整理が発生しても、過去ライブの
資料は当時の内容で表示できる必要がある。このため、
`setlist_entries.title_snapshot` は必須で、元の曲やバージョンが削除された
場合は外部キーだけを `NULL` にし、スナップショットを残す。

## 7. setlist_cues を曲から分離する理由

MC、SE、転換、衣装替え、暗転、休憩は時間を使うが、演奏曲数には含めない。
曲と同じテーブルに入れると、曲数集計、楽曲メタデータ、進行イベントが
混在する。そのため `setlist_cues` へ分離する。

`after_entry_id` が `NULL` の場合は最初の曲より前、値がある場合はその曲の
後を表す。`sort_order` は同じ位置に複数 cue がある場合の順序にも使う。

## 8. band_members の permission 設計

`permission` は認可に使うため、次の固定値だけを許可する。

| permission | 想定権限 |
| --- | --- |
| `owner` | バンド削除を含む全操作。各バンド 1 人 |
| `admin` | メンバー管理とデータ編集。owner 変更・owner 削除は不可 |
| `editor` | 曲、ライブ、セトリ、cue、外部リンク、共有リンクの編集 |
| `member` | 閲覧と、自分の private メモの作成・編集 |
| `viewer` | 閲覧のみ |

楽器・担当は認可とは分離し、`role_name` と `category` に自由入力する。
ギターやドラムに固定せず、フルート、MPC、DJ、同期担当、三味線、
スタッフなども表現できる。

現行 v1 は 1 所属につき代表 `role_name` が 1 つである。複数担当を厳密に
管理する段階では、`band_member_roles` のような子テーブルを追加する。

バンド作成後の trigger が owner の `band_members` 行を自動作成する。
owner 行の削除・降格や、owner 以外への `owner` 権限付与は検証 trigger が
拒否する。v1 では `bands.owner_id` を変更不可とし、owner 移譲は未実装とする。

## 9. notes の visibility 設計

| visibility | SELECT できる利用者 |
| --- | --- |
| `private` | 同じバンドに所属する author 本人だけ |
| `role` | `target_member_id` が自分、または `target_role_name` と担当名が一致 |
| `host` | owner / admin |
| `members` | バンド所属者 |
| `staff` | v1 ではバンド所属者。将来スタッフ分類を分離予定 |
| `public` | v1 ではバンド所属者のみ。匿名公開は未実装 |

owner や admin であっても、他人の `private` メモは SELECT できない。
メモの作成・更新・削除は author 本人に限定する。owner / admin / editor は
任意 visibility の自分のメモを作成でき、member は private のみ作成できる。
viewer はメモを作成できない。

本文は `btrim(body) <> ''` で空文字を拒否する。`role` メモには対象メンバー
または対象担当名のどちらかを必須とする。

## 10. RLS の基本方針

`public` に作る 12 テーブルすべてで RLS を有効にする。`anon` には
アプリテーブルの権限もポリシーも与えない。

認証済みユーザーの所属・権限判定は、Data API 非公開の
`live_pack_private` スキーマに置いた SECURITY DEFINER 関数で行う。
`band_members` のポリシーから `band_members` 自身を直接参照しないため、
RLS の無限再帰を避けられる。

SECURITY DEFINER 関数はすべて `search_path = ''` とし、テーブルを完全修飾
して参照する。スキーマの `USAGE` と、RLS が必要とする関数の `EXECUTE`
だけを `authenticated` に与える。trigger 専用関数は API ロールから直接
実行できない。

### 閲覧

- `profiles` は本人の行だけ
- その他は、対象バンドの `band_members` に自分が存在する行だけ
- `notes` は所属確認に加えて visibility 条件を満たす行だけ
- `share_links` は owner / admin / editor だけ

### 更新

- owner / admin / editor が曲・ライブ関連データを編集
- band_members 管理は owner / admin
- バンド削除は owner だけ
- メモは author 本人だけ。member は private メモだけ
- UPDATE はすべて可能な限り `USING` と `WITH CHECK` を分けて定義

## 11. private メモが他人に見えない仕組み

`notes_select_visible` ポリシーは、非公開 helper
`can_view_note(...)` の結果だけを許可する。`visibility = 'private'` の場合は、
対象ライブのバンドに所属しており、かつ `author_id = auth.uid()` のときだけ
真になる。

管理者向けの例外ポリシーや anon ポリシーは作らないため、複数ポリシーの
OR 条件で private メモが漏れる経路も作らない。

## 12. 別バンドのデータが見えない仕組み

各テーブルの SELECT ポリシーは、直接の `band_id`、または `live_id` /
`song_id` から求めた `band_id` を使って所属確認する。所属判定 helper は
`band_members.band_id` と `band_members.user_id = auth.uid()` の組を調べる。

さらに、複合外部キーと検証 trigger により次を拒否する。

- 別バンドの release を song に設定
- 別バンドの song を setlist entry に設定
- 別ライブの setlist entry を cue / note に設定
- 別バンドの song / target member を note に設定
- 別バンドの target member を share link に設定
- 対象のない孤立 song link

## 13. share_links を匿名ユーザーへ直接公開しない理由

`share_links` には token、公開範囲、期限、対象メンバーだけでなく、
`passcode_hash` が含まれる。テーブルを anon へ直接公開すると、
token 列挙、期限判定の回避、パスコードハッシュ取得などの攻撃面が増える。

そのため次の二層で保護する。

1. anon にテーブル権限と RLS ポリシーを与えない
2. authenticated にも `passcode_hash` の列 SELECT / INSERT / UPDATE 権限を
   与えない

管理画面の owner / admin / editor は、パスコードハッシュ以外の共有設定を
管理できる。パスコード付きリンクの作成・変更は将来のサーバー API を通す。

## 14. パスコード認証を将来サーバー処理にする理由

ブラウザが `passcode_hash` を取得して照合すると、ハッシュが利用者へ渡り、
オフライン総当たりの対象になる。また、RLS は行の可否を判断する仕組みで、
「入力された平文を安全にハッシュ照合し、試行回数を制限し、必要な列だけを
返す」用途には向かない。

将来は Edge Function または Vercel のサーバー処理で次を行う。

- token、enabled、expires_at の検証
- レート制限
- パスコードのハッシュ照合
- scope に応じた安全なレスポンス整形
- `passcode_hash` をレスポンスへ含めない

ハッシュ方式とサーバー API の実装は今回決定しない。

## 15. DB 関数と trigger

### 共通関数

- `set_updated_at()`：UPDATE 時に `updated_at` を更新
- `prevent_column_update()`：tenant ID、作成者などの不変列を保護
- `is_band_member()`：バンド所属確認
- `has_band_permission()`：owner / admin / editor 等の権限確認
- `band_id_for_song()` / `band_id_for_live()`：子テーブルの tenant 判定

### Auth・owner 連携

- `handle_new_user()`：`auth.users` INSERT 後に profile を作成
- `create_band_owner_membership()`：band INSERT 後に owner 所属行を作成
- `validate_band_member_owner()`：owner 行の削除・降格・偽 owner を拒否

`handle_new_user()` は `ON CONFLICT DO NOTHING` を使う。profile 作成エラーは
警告として記録し、Auth signup 全体を拒否しない設計である。その代わり、
Auth UI を実装する前に「profile が欠けたユーザーを検出・再作成する運用」
を用意する必要がある。

`lives.created_by` と `share_links.created_by` は作成時の RLS で本人を必須に
するが、後から変更する権限は与えない。作成者が退会した場合は外部キーの
`ON DELETE SET NULL` により履歴本体を残す。バンド owner の退会だけは、
owner 移譲が未実装のため引き続き拒否される。

### 関係整合性

- `validate_setlist_entry_relations()`
- `validate_note_relations()`
- `validate_share_link_relations()`

これらは通常の外部キーだけでは表せない「同じバンド」「同じライブ」を
検証する。

## 16. migration の安全性と再実行

migration 全体を明示的な `BEGIN` / `COMMIT` で囲む。途中の SQL が失敗した
場合は全体がロールバックされ、中途半端なテーブル群を残しにくい。

この初期 migration は、Supabase の migration 履歴によって 1 回だけ適用する
前提である。テーブル作成に `IF NOT EXISTS` を付けていないため、同じ SQL を
SQL Editor 等で誤って再実行すると既存オブジェクトでエラーになり、トランザク
ション全体がロールバックされる。重複したポリシーや trigger を黙って作るより、
誤操作を明確に検出する方針である。

`pgcrypto` extension と非公開 schema だけは `IF NOT EXISTS` としている。
extension のバージョンは固定しない。

## 17. 今回まだ実装しないもの

- React UI の Supabase Auth
- メールログイン、OAuth、招待
- `localStorage` から DB への移行
- 初期データ投入と既存データ変換
- 共有ページ取得 API
- パスコードの生成・ハッシュ・照合
- ファイルアップロードと Supabase Storage
- 複数担当用の `band_member_roles`
- owner 移譲
- 匿名・公開ユーザー向け RLS
- Realtime、監査ログ、論理削除

## 18. Supabase へ反映する前の確認事項

1. ローカル Supabase で migration をゼロから適用できること
2. 新規 Auth user 作成と profile 自動作成
3. profile 作成失敗時の警告と profile 再作成運用
4. band 作成時に owner membership が 1 件だけ作られること
5. owner 行を削除・降格できないこと
6. owner / admin / editor / member / viewer ごとの CRUD テスト
7. 別バンドの UUID を指定した SELECT / INSERT / UPDATE が拒否されること
8. private / role / host / members / staff / public メモの閲覧テスト
9. removed member が以前のバンドデータを取得できないこと
10. `share_links.passcode_hash` がブラウザ権限で取得・変更できないこと
11. PostgREST から share_links を扱う際、`select('*')` ではなく許可列を
    明示するクライアント設計
12. Data API の exposed schema と table grants
13. Security Advisor と Performance Advisor の指摘
14. migration の dry-run とバックアップ方針

## 19. 不明点・今後の設計判断

- `staff` visibility は v1 では全メンバー閲覧とした。スタッフ専用の所属分類を
  追加するか決める必要がある。
- `public` メモは匿名公開せず、現時点では所属メンバー向けとして扱う。
- member は private メモのみ作成可能とした。role メモ等も許可するか要確認。
- editor にメンバー管理権限は与えていない。
- band 削除は owner だけに限定した。
- owner 移譲がないため、バンドを所有する Auth user の削除は外部キーで拒否
  される。退会フロー実装前に移譲・削除方針が必要である。
- role_name は現時点で 1 人 1 つ。複数担当のデータモデルは別 migration とする。
- share token の生成元、長さ、エントロピー、ローテーション方法は未決定。
- passcode のハッシュアルゴリズムとレート制限はサーバー実装時に決める。
- live `status` は拡張しやすい非空 text とし、固定 enum にしていない。
- release type、link type、start/end type も将来拡張を優先して text としている。
