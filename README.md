# 36_elemental-search

小学校情報（minkou.jp）をスクレイピングして Supabase に格納するプロジェクト。

## ディレクトリ構成

```
36_elemental-search/
├── .env                              # Supabase接続情報（gitignore済み）
├── db/
│   └── create_tables.sql             # Supabaseテーブル定義SQL
├── data/raw/                         # スクレイピング結果JSON（gitignore済み）
└── scrapers/
    └── minkou/
        ├── scraper.py                # minkou.jp スクレイパー本体
        ├── fetch_locations.py        # 都道府県・市区町村 → DB
        ├── run.py                    # 名前指定でスクレイプ → DB
        └── load_to_supabase.py       # 既存JSONファイル → DB
```

---

## セットアップ

### 1. 仮想環境の有効化

```bash
source .venv/bin/activate
```

### 2. .env の設定

`.env` ファイルに Supabase の接続情報を記入する。
Supabase ダッシュボード > Settings > API から取得。

```
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role キーを使う
SUPABASE_ANON_KEY=eyJ...
```

### 3. Supabase にテーブルを作成

Supabase ダッシュボード > **SQL Editor** で `db/create_tables.sql` の内容を実行する。

作成されるテーブル（スキーマ: `36_elemental-search`）:
- `prefectures` — 都道府県マスタ
- `cities` — 市区町村マスタ
- `schools` — 学校マスタ
- `school_reviews` — 口コミ

> **補足**: カスタムスキーマを使うため、Supabase > Settings > API > **Exposed schemas** に `36_elemental-search` を追加すること。

---

## 使い方

### Step 1: 都道府県・市区町村マスタを取得してDBに格納

初回のみ実行。minkou.jp をスクレイピングして `prefectures` / `cities` テーブルを埋める。

```bash
# 全都道府県（約47回アクセス、数分かかる）
python scrapers/minkou/fetch_locations.py

# 特定都道府県のみ
python scrapers/minkou/fetch_locations.py --pref tokyo
```

### Step 2: 学校・口コミをスクレイピングしてDBに格納

都道府県を指定すると、DBから市区町村一覧を取得して選択UIが起動する（Step 1 完了後）。

```bash
# 東京都の市区町村一覧を表示して選択
python scrapers/minkou/run.py --pref 東京都

# スラッグでも可
python scrapers/minkou/run.py --pref tokyo

# 取得済みの市区町村も選択肢に表示（再取得したいとき）
python scrapers/minkou/run.py --pref 東京都 --force

# アクセス間隔を変更（デフォルト: 1.5秒）
python scrapers/minkou/run.py --pref 東京都 --delay 2.0
```

起動するとチェックボックスUIが表示される：

```
市区町村を選択（スペースで選択、Enterで実行）:
  [ ] 千代田区  [未取得]
  [✓] 新宿区    [取得済 2026-03-20]
  [ ] 渋谷区    [未取得]
  ...
```

取得済みの市区町村は次回起動時にスキップされるため、複数回に分けて実行できる。

### 既存JSONファイルをDBに投入する場合

```bash
# 単一ファイル
python scrapers/minkou/load_to_supabase.py data/raw/shinjuku.json

# data/raw/ 以下を全部まとめて
python scrapers/minkou/load_to_supabase.py --all
```

---

## Supabase 確認クエリ

```sql
-- 学校件数
SELECT COUNT(*) FROM "36_elemental-search".schools;

-- 口コミ件数
SELECT COUNT(*) FROM "36_elemental-search".school_reviews;

-- 評価上位校
SELECT school_name, prefecture, city, rating_avg, review_count
FROM "36_elemental-search".schools
ORDER BY rating_avg DESC NULLS LAST
LIMIT 10;
```
