# 学校名寄せスクリプト 設計書

## 概要

`minkou.jp` 由来の `schools` テーブルと `gaccom.jp` 由来の `gaccom_schools` テーブルを、
住所＋学校名の類似度スコアで突き合わせ、結果を `school_links` テーブルに格納する。

---

## 1. テーブル定義（追加）

Supabase SQL Editor で実行すること。

```sql
CREATE TABLE IF NOT EXISTS "36_elemental-search".school_links (
    school_id    TEXT REFERENCES "36_elemental-search".schools(school_id)          ON DELETE CASCADE,
    gaccom_id    TEXT REFERENCES "36_elemental-search".gaccom_schools(gaccom_id)   ON DELETE CASCADE,
    match_score  NUMERIC(4,3),   -- 0.000 〜 1.000
    addr_score   NUMERIC(4,3),   -- 住所類似度（デバッグ用）
    name_score   NUMERIC(4,3),   -- 学校名類似度（デバッグ用）
    verified     BOOLEAN DEFAULT FALSE,  -- 目視確認済みフラグ
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_id, gaccom_id)
);

CREATE INDEX IF NOT EXISTS idx_school_links_score ON "36_elemental-search".school_links(match_score);
```

---

## 2. Pythonスクリプト仕様

### ファイル構成

```
scripts/
└── match_schools.py   # メインスクリプト（このファイルのみ作成）
```

### 依存ライブラリ

```
pip install psycopg2-binary python-dotenv jaconv rapidfuzz
```

| ライブラリ | 用途 |
|---|---|
| `psycopg2` | PostgreSQL接続 |
| `python-dotenv` | .envから接続情報読み込み |
| `jaconv` | 全角→半角変換 |
| `rapidfuzz` | fuzzy文字列マッチング |

### 環境変数（.env）

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## 3. 住所正規化ロジック

`normalize_address(text: str) -> str` 関数として実装する。

### 処理ステップ（順番通りに適用）

1. **Noneガード**：NoneまたはNaNなら空文字を返す
2. **全角→半角**：`jaconv.z2h(text, kana=False, digit=True, ascii=True)`
3. **都道府県の除去**：先頭の `東京都|大阪府|京都府|.+[都道府県]` を除去
4. **市区町村の除去**：`.+[市区町村郡]` を除去（学校の`city`カラムに既に入っているため）
5. **表記ゆれの統一**：
   ```python
   replacements = [
       (r'丁目?', '丁目'),
       (r'番地?', '番'),
       (r'号$', ''),
       (r'[ーｰ－‐−]', '-'),
       (r'\s+', ''),
       (r'（.*?）', ''),  # 括弧書き除去
       (r'\(.*?\)', ''),
   ]
   ```
6. **数字の全角→半角**（jaconvで対応済みのため念のため確認）

---

## 4. 学校名正規化ロジック

`normalize_school_name(text: str) -> str` 関数として実装する。

### 処理ステップ

1. **Noneガード**：NoneまたはNaNなら空文字を返す
2. **全角→半角**：数字・アルファベットのみ
3. **設置者プレフィックスの除去**：
   ```python
   prefixes = [
       r'^.{2,6}[都道府県].{1,6}[市区町村]立',  # 東京都新宿区立
       r'^.{1,6}[市区町村郡]立',                 # 新宿区立
       r'^[国私公]立',                            # 国立・私立・公立
   ]
   ```
4. **サフィックスの除去**：`第?\d*小学校$` → `小学校` を除去して核心部だけ残す
5. **スペース除去**

---

## 5. マッチングスコア計算

`calc_match_score(s: Row, g: Row) -> dict` 関数として実装する。

```python
from rapidfuzz import fuzz

def calc_match_score(s, g):
    # 住所スコア（token_sort_ratio：語順ゆれに強い）
    addr_score = fuzz.token_sort_ratio(
        normalize_address(s['address']),
        normalize_address(g['address'])
    ) / 100.0

    # 学校名スコア（ratio：完全一致寄り）
    name_score = fuzz.ratio(
        normalize_school_name(s['school_name']),
        normalize_school_name(g['school_name'])
    ) / 100.0

    # 加重平均（住所重視）
    total = addr_score * 0.7 + name_score * 0.3

    return {
        'addr_score': round(addr_score, 3),
        'name_score': round(name_score, 3),
        'match_score': round(total, 3),
    }
```

---

## 6. マッチング判定閾値

| スコア | 処理 |
|---|---|
| **0.85以上** | `school_links` に INSERT、`verified = FALSE` |
| **0.60〜0.84** | `school_links` に INSERT、`verified = FALSE`、別途レビュー用CSVにも出力 |
| **0.60未満** | 非マッチとして無視（ログのみ） |

---

## 7. メイン処理フロー

```
1. .envからDATABASE_URL読み込み
2. schoolsテーブルを全件取得（school_id, school_name, address, prefecture, city）
3. gaccom_schoolsテーブルを全件取得（gaccom_id, school_name, address, pref_name）
4. 都道府県でグルーピングして絞り込み（全件総当たりを防ぐ）
   - schools.prefecture == gaccom_schools.pref_name の組み合わせのみ比較
5. 同一都道府県内で総当たりスコア計算
6. スコア >= 0.60 のペアを school_links に UPSERT
   - ON CONFLICT (school_id, gaccom_id) DO UPDATE SET match_score = EXCLUDED.match_score
7. 0.60〜0.84 のペアを review_candidates.csv に出力
8. 完了ログ出力（総ペア数、INSERTした件数、要レビュー件数）
```

---

## 8. 出力ファイル

| ファイル | 内容 |
|---|---|
| `review_candidates.csv` | スコア0.60〜0.84の要目視確認ペア一覧 |

### review_candidates.csv のカラム

```
school_id, school_name_minkou, address_minkou,
gaccom_id, school_name_gaccom, address_gaccom,
addr_score, name_score, match_score
```

---

## 9. 実行方法

```bash
cd scripts/
python match_schools.py

# 進捗確認
# → コンソールに都道府県ごとの進捗と最終サマリーが出力される
```

---

## 10. 実行後の確認クエリ

```sql
-- マッチ件数確認
SELECT
    CASE
        WHEN match_score >= 0.85 THEN '高信頼（自動確定）'
        WHEN match_score >= 0.60 THEN '要確認'
    END AS tier,
    COUNT(*) AS cnt
FROM "36_elemental-search".school_links
GROUP BY 1;

-- 結合して両サイトのデータを確認
SELECT
    s.school_name   AS minkou_name,
    g.school_name   AS gaccom_name,
    s.address       AS minkou_addr,
    g.address       AS gaccom_addr,
    sl.match_score
FROM "36_elemental-search".school_links sl
JOIN "36_elemental-search".schools s       ON sl.school_id = s.school_id
JOIN "36_elemental-search".gaccom_schools g ON sl.gaccom_id = g.gaccom_id
WHERE sl.match_score BETWEEN 0.60 AND 0.84
ORDER BY sl.match_score DESC
LIMIT 20;
```

---

## 注意事項

- 同一都道府県内でも校名・住所が両方空のレコードはスキップすること
- `review_candidates.csv` を目視確認後、問題ないペアは `verified = TRUE` に手動更新する
- 初回実行後にスコア分布を確認し、閾値の調整が必要な場合はコメントアウトで記録を残すこと