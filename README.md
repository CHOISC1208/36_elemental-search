# 36_elemental-search

minkou.jp と gaccom.jp の小学校情報をスクレイピングして Supabase に格納し、両サイトのデータを名寄せするプロジェクト。

## ディレクトリ構成

```
36_elemental-search/
├── .env                              # Supabase接続情報（gitignore済み）
├── db/
│   └── create_tables.sql             # Supabaseテーブル定義SQL（全テーブル）
├── scripts/
│   └── match_schools.py              # minkou × gaccom 名寄せスクリプト
└── scrapers/
    ├── minkou/
    │   ├── scraper.py                # minkou.jp スクレイパー本体
    │   ├── fetch_locations.py        # 都道府県・市区町村 → DB
    │   ├── run.py                    # 都道府県指定でスクレイプ → DB
    │   └── load_to_supabase.py       # 既存JSONファイル → DB
    └── gaccom/
        ├── scraper.py                # gaccom.jp スクレイパー本体
        └── run.py                    # 都道府県指定でスクレイプ → DB
```

---

## セットアップ

### 1. 仮想環境の有効化・依存インストール

```bash
source .venv/bin/activate
uv sync
```

### 2. .env の設定

Supabase ダッシュボード > Settings > API から取得して `.env` に記入する。

```
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role キーを使う
```

### 3. Supabase にテーブルを作成

Supabase ダッシュボード > **SQL Editor** で `db/create_tables.sql` の内容を実行する。

作成されるテーブル（スキーマ: `36_elemental-search`）:

| テーブル | 内容 |
|---|---|
| `prefectures` | 都道府県マスタ |
| `cities` | 市区町村マスタ |
| `schools` | minkou.jp 学校マスタ |
| `school_reviews` | minkou.jp 口コミ |
| `gaccom_schools` | gaccom.jp 学校マスタ |
| `school_links` | 名寄せ結果（minkou × gaccom） |

> **補足**: カスタムスキーマを使うため、Supabase > Settings > API > **Exposed schemas** に `36_elemental-search` を追加すること。

---

## データ収集

### minkou.jp

#### Step 1: 都道府県・市区町村マスタを取得

初回のみ実行。`prefectures` / `cities` テーブルを埋める。

```bash
python scrapers/minkou/fetch_locations.py           # 全都道府県
python scrapers/minkou/fetch_locations.py --pref tokyo  # 特定都道府県のみ
```

#### Step 2: 学校・口コミをスクレイピング

```bash
python scrapers/minkou/run.py --pref 東京都          # 市区町村選択UIが起動
python scrapers/minkou/run.py --pref 東京都 --force  # 取得済みも再取得
python scrapers/minkou/run.py --pref 東京都 --delay 2.0 --workers 2
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

#### 既存JSONファイルをDBに投入する場合

```bash
python scrapers/minkou/load_to_supabase.py data/raw/shinjuku.json
python scrapers/minkou/load_to_supabase.py --all   # data/raw/ 以下を全部
```

---

### gaccom.jp

```bash
python scrapers/gaccom/run.py --pref 東京都         # 都道府県名
python scrapers/gaccom/run.py --pref 13             # pref_cd（JISコード）
python scrapers/gaccom/run.py --pref 関東            # 関東7都県まとめて
python scrapers/gaccom/run.py --pref 13 --limit 5   # 5校だけ試す
python scrapers/gaccom/run.py --list-prefs           # pref_cd 一覧表示
```

---

## GitHub Actions

| ワークフロー | 内容 |
|---|---|
| `fetch-locations.yml` | 市区町村マスタ取得 |
| `scrape-kanto.yml` | minkou.jp 関東スクレイピング |
| `scrape-pref.yml` | minkou.jp 都道府県指定スクレイピング |
| `scrape-gaccom.yml` | gaccom.jp 関東スクレイピング |

いずれも GitHub > Actions タブから手動実行（`workflow_dispatch`）。

---

## 名寄せ（match_schools.py）

`schools`（minkou）と `gaccom_schools`（gaccom）を住所＋学校名の類似度で突き合わせ、結果を `school_links` テーブルに格納する。

### 実行方法

```bash
# まず dry-run でスコア分布を確認
python scripts/match_schools.py --pref 関東 --dry-run

# 問題なければ本番実行
python scripts/match_schools.py --pref 関東

# 全件
python scripts/match_schools.py
```

### オプション

| オプション | 内容 |
|---|---|
| `--pref` | 都道府県名（例: `東京都` / `関東`）。省略時は全件 |
| `--dry-run` | DBに書き込まず上位20件をコンソールに表示 |

### スコアリング

住所類似度 × 0.7 + 学校名類似度 × 0.3 で総合スコアを算出。

| スコア | 処理 |
|---|---|
| 0.85 以上 | `school_links` に INSERT（高信頼） |
| 0.60〜0.84 | `school_links` に INSERT ＋ `review_candidates.csv` に出力（要目視確認） |
| 0.60 未満 | スキップ |

### 出力ファイル

- `review_candidates.csv` — スコア 0.60〜0.84 の要確認ペア一覧

目視確認後、問題ないペアは Supabase で `verified = TRUE` に更新する：

```sql
UPDATE "36_elemental-search".school_links
SET verified = TRUE
WHERE school_id = 'xxx' AND gaccom_id = 'yyy';
```

---

## 確認クエリ

```sql
-- 学校件数
SELECT COUNT(*) FROM "36_elemental-search".schools;
SELECT COUNT(*) FROM "36_elemental-search".gaccom_schools;

-- 名寄せ結果の信頼度分布
SELECT
    CASE
        WHEN match_score >= 0.85 THEN '高信頼（自動確定）'
        WHEN match_score >= 0.60 THEN '要確認'
    END AS tier,
    COUNT(*) AS cnt
FROM "36_elemental-search".school_links
GROUP BY 1;

-- 両サイトのデータを結合して確認
SELECT
    s.school_name   AS minkou_name,
    g.school_name   AS gaccom_name,
    s.address       AS minkou_addr,
    g.address       AS gaccom_addr,
    sl.match_score
FROM "36_elemental-search".school_links sl
JOIN "36_elemental-search".schools s        ON sl.school_id = s.school_id
JOIN "36_elemental-search".gaccom_schools g ON sl.gaccom_id = g.gaccom_id
ORDER BY sl.match_score DESC
LIMIT 20;
```
