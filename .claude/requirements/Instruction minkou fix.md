# minkou.py スクレイピングデータ → Supabase 格納

## 前提
- Supabaseプロジェクトは作成済みとする
- 接続情報は `.env` ファイルで管理する
- スクレイパー（scripts/minkou.py）は修正済みとする
- Python仮想環境: `venv/`

---

## タスク1: 必要ライブラリの追加

```bash
source venv/bin/activate
pip install supabase python-dotenv
```

---

## タスク2: .env ファイルの作成

プロジェクトルート（`21_elemental-search/`）に `.env` を作成。
**値は空欄のままにしておくこと。ユーザーが自分で埋める。**

```
# Supabase接続情報
# Supabaseダッシュボード > Settings > API から取得
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

また `.gitignore` も作成または追記して `.env` を除外する：

```
venv/
.env
data/raw/
__pycache__/
*.pyc
```

---

## タスク3: Supabase にテーブルを作成するSQLファイル

`scripts/create_tables.sql` を以下の内容で作成する。
このSQLはSupabaseダッシュボードの「SQL Editor」で実行する用。

```sql
-- ================================================
-- minkou.jp 小学校データ テーブル定義
-- Supabase SQL Editor で実行してください
-- ================================================

-- 学校マスタ
CREATE TABLE IF NOT EXISTS schools (
    school_id        TEXT PRIMARY KEY,
    school_name      TEXT,
    furigana         TEXT,
    prefecture       TEXT,
    city             TEXT,
    address          TEXT,
    nearest_station  TEXT,
    school_type      TEXT,          -- '公立' | '私立' | '国立'
    uniform          TEXT,
    lunch            TEXT,
    events           TEXT,
    tuition          TEXT,
    selection        TEXT,
    selection_method TEXT,
    rating_avg       NUMERIC(4,2),
    review_count     INTEGER DEFAULT 0,
    scraped_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 口コミ
CREATE TABLE IF NOT EXISTS school_reviews (
    id               BIGSERIAL PRIMARY KEY,
    school_id        TEXT REFERENCES schools(school_id) ON DELETE CASCADE,
    review_url       TEXT UNIQUE,   -- 重複INSERT防止
    poster_type      TEXT,          -- '保護者' | '生徒' | '卒業生'
    enrollment_year  INTEGER,
    post_date        TEXT,
    title            TEXT,
    rating_overall   NUMERIC(3,1),
    rating_policy    NUMERIC(3,1),
    rating_class     NUMERIC(3,1),
    rating_teacher   NUMERIC(3,1),
    rating_facility  NUMERIC(3,1),
    rating_access    NUMERIC(3,1),
    rating_pta       NUMERIC(3,1),
    rating_events    NUMERIC(3,1),
    text_overall     TEXT,
    text_policy      TEXT,
    text_class       TEXT,
    text_facility    TEXT,
    text_access      TEXT,
    text_pta         TEXT,
    text_events      TEXT,
    text_commute     TEXT,
    scraped_at       TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス（不動産スコアリングで都道府県・市区町村検索が多いため）
CREATE INDEX IF NOT EXISTS idx_schools_prefecture ON schools(prefecture);
CREATE INDEX IF NOT EXISTS idx_schools_city       ON schools(city);
CREATE INDEX IF NOT EXISTS idx_schools_type       ON schools(school_type);
CREATE INDEX IF NOT EXISTS idx_reviews_school_id  ON school_reviews(school_id);
```

---

## タスク4: JSONデータをSupabaseに投入するスクリプト

`scripts/load_to_supabase.py` を以下の仕様で作成する。

### 機能要件
- `data/raw/` 以下の `.json` ファイルを引数で指定して読み込む
- schools テーブルに UPSERT（school_id が重複したら更新）
- school_reviews テーブルに UPSERT（review_url が重複したら SKIP）
- 数値型フィールドは None / "-" / "" を適切に NULL に変換する
- 進捗をターミナルに表示する

### 使い方（完成後）
```bash
# 単一ファイル
python scripts/load_to_supabase.py data/raw/shinjuku_fixed.json

# data/raw/ 以下を全部まとめて
python scripts/load_to_supabase.py --all
```

### スクリプト本体

```python
"""
minkou スクレイピングデータを Supabase に投入する
使い方:
    python scripts/load_to_supabase.py data/raw/shinjuku_fixed.json
    python scripts/load_to_supabase.py --all
"""

import json
import sys
import os
import glob
import argparse
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


def get_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(".env に SUPABASE_URL と SUPABASE_SERVICE_KEY を設定してください")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def clean_numeric(value, digits=2):
    """"-" や "" や None を None に変換し、数値文字列はfloatに変換"""
    if value is None or str(value).strip() in ("", "-", "なし", "N/A"):
        return None
    try:
        return round(float(str(value).strip()), digits)
    except ValueError:
        return None


def clean_int(value):
    if value is None or str(value).strip() in ("", "-"):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def load_json(filepath: str) -> dict:
    with open(filepath, encoding="utf-8") as f:
        return json.load(f)


def upsert_schools(client: Client, schools: list) -> int:
    rows = []
    for s in schools:
        rows.append({
            "school_id":        s.get("school_id"),
            "school_name":      s.get("school_name"),
            "furigana":         s.get("furigana"),
            "prefecture":       s.get("prefecture"),
            "city":             s.get("city"),
            "address":          s.get("address"),
            "nearest_station":  s.get("nearest_station"),
            "school_type":      s.get("school_type"),
            "uniform":          s.get("uniform"),
            "lunch":            s.get("lunch"),
            "events":           s.get("events"),
            "tuition":          s.get("tuition"),
            "selection":        s.get("selection"),
            "selection_method": s.get("selection_method"),
            "rating_avg":       clean_numeric(s.get("rating_avg")),
            "review_count":     clean_int(s.get("review_count")),
        })

    # Supabaseのupsertはon_conflictでキーを指定する
    resp = (
        client.table("schools")
        .upsert(rows, on_conflict="school_id")
        .execute()
    )
    return len(rows)


def upsert_reviews(client: Client, reviews: list) -> int:
    if not reviews:
        return 0

    rows = []
    for r in reviews:
        review_url = r.get("review_url", "")
        if not review_url:
            continue  # URLなしはスキップ

        rows.append({
            "school_id":       r.get("school_id"),
            "review_url":      review_url,
            "poster_type":     r.get("poster_type"),
            "enrollment_year": clean_int(r.get("enrollment_year")),
            "post_date":       r.get("post_date"),
            "title":           r.get("title"),
            "rating_overall":  clean_numeric(r.get("rating_overall"), 1),
            "rating_policy":   clean_numeric(r.get("rating_policy"), 1),
            "rating_class":    clean_numeric(r.get("rating_class"), 1),
            "rating_teacher":  clean_numeric(r.get("rating_teacher"), 1),
            "rating_facility": clean_numeric(r.get("rating_facility"), 1),
            "rating_access":   clean_numeric(r.get("rating_access"), 1),
            "rating_pta":      clean_numeric(r.get("rating_pta"), 1),
            "rating_events":   clean_numeric(r.get("rating_events"), 1),
            "text_overall":    r.get("text_overall"),
            "text_policy":     r.get("text_policy"),
            "text_class":      r.get("text_class"),
            "text_facility":   r.get("text_facility"),
            "text_access":     r.get("text_access"),
            "text_pta":        r.get("text_pta"),
            "text_events":     r.get("text_events"),
            "text_commute":    r.get("text_commute"),
        })

    if not rows:
        return 0

    # review_urlが重複したら何もしない（ignoreDuplicates）
    resp = (
        client.table("school_reviews")
        .upsert(rows, on_conflict="review_url", ignore_duplicates=True)
        .execute()
    )
    return len(rows)


def process_file(filepath: str, client: Client):
    print(f"\n📂 {filepath}")
    data = load_json(filepath)

    schools = data.get("schools", [])
    reviews = data.get("reviews", [])

    print(f"  schools: {len(schools)}件 → Supabase upsert中...")
    n_schools = upsert_schools(client, schools)
    print(f"  ✓ {n_schools}件完了")

    print(f"  reviews: {len(reviews)}件 → Supabase upsert中...")
    n_reviews = upsert_reviews(client, reviews)
    print(f"  ✓ {n_reviews}件完了")


def main():
    parser = argparse.ArgumentParser(description="minkou JSONをSupabaseに投入")
    parser.add_argument("file", nargs="?", help="JSONファイルパス")
    parser.add_argument("--all", action="store_true",
                        help="data/raw/ 以下の全JSONを処理")
    args = parser.parse_args()

    client = get_client()

    if args.all:
        files = sorted(glob.glob("data/raw/*.json"))
        if not files:
            print("data/raw/ にJSONファイルが見つかりません")
            sys.exit(1)
        for f in files:
            process_file(f, client)
    elif args.file:
        process_file(args.file, client)
    else:
        parser.print_help()
        sys.exit(1)

    print("\n✅ 全処理完了")


if __name__ == "__main__":
    main()
```

---

## タスク5: 動作確認手順

### 5-1. Supabase側の準備
1. Supabaseダッシュボードにログイン
2. 「SQL Editor」を開く
3. `scripts/create_tables.sql` の内容を貼り付けて実行
4. 「Table Editor」で `schools` と `school_reviews` テーブルが作成されたことを確認

### 5-2. .env に接続情報を設定
```
# Supabaseダッシュボード > Settings > API
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...（service_role キーを使う。anon keyは権限不足の場合あり）
```

### 5-3. 投入テスト
```bash
source venv/bin/activate
python scripts/load_to_supabase.py data/raw/shinjuku_fixed.json
```

### 5-4. 確認クエリ（Supabase SQL Editorで実行）
```sql
-- 学校件数
SELECT COUNT(*) FROM schools;

-- 口コミ件数
SELECT COUNT(*) FROM school_reviews;

-- サンプル確認
SELECT school_name, prefecture, city, rating_avg, review_count
FROM schools
ORDER BY rating_avg DESC NULLS LAST
LIMIT 10;

-- 口コミと学校を結合
SELECT s.school_name, s.city, r.poster_type, r.rating_overall, r.text_overall
FROM school_reviews r
JOIN schools s ON s.school_id = r.school_id
LIMIT 5;
```

---

## 完成後のファイル構成

```
21_elemental-search/
├── .env                          # ← 新規（gitignore済み）
├── .gitignore                    # ← 新規
├── README.md
├── data/
│   ├── raw/
│   │   ├── shinjuku.json
│   │   └── shinjuku_fixed.json
│   └── city_codes/
│       └── all_city_codes.csv
├── scripts/
│   ├── minkou.py
│   ├── fetch_city_codes.py
│   ├── load_to_supabase.py       # ← 新規
│   └── create_tables.sql         # ← 新規
└── venv/
```