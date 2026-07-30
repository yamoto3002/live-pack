# SETPRINT v2 アーキテクチャ

## 境界

- `pages`: ホーム、設定、通知、認証のルート画面
- `features`: 曲、セットリスト、共有、印刷、Stage View
- `components`: ブランド、Shell、入力、状態表示
- `services`: Supabase Data API／Edge Functions／exportの境界
- `hooks`: 認証後のバンド選択、読込、楽観更新、保存queue
- `utils`: 時間、Key、共有sanitizer
- `supabase/migrations`: additiveなDB変更
- `supabase/functions`: Secretを必要とする処理と匿名共有resolver

主要データはSupabaseが正です。localStorageは選択中バンド、旧データ移行、通信失敗時のクライアント状態に限定します。

## 画面

管理画面は左ナビとセットリスト中心の作業空間、共有画面は管理ナビを持たない独立資料、印刷は白いA4、Stage Viewは高コントラストの暗色表示です。route lazy loadingにより、共有・印刷・Stage View・exportライブラリは初期chunkから分離します。

## 互換名

既存DBの`live_pack_private`、既存サービス／mapperの一部ファイル名は本番データとmigration履歴を壊さないため内部互換名として残します。ユーザー向け表示、README、meta、メール、印刷、localStorage新キーはSETPRINTへ統一します。
