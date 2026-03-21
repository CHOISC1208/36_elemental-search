# GitHub Actions ワークフロー 使い方

## ワークフロー一覧

| ファイル | 名前 | 用途 |
|---|---|---|
| `fetch-locations.yml` | 1) 市区町村取得 | 都道府県・市区町村マスタをDBに登録 |
| `scrape-kanto.yml` | 2) 関東取得 | 関東7都県を一括取得（minkou のみ） |
| `scrape-pref.yml` | 3) 都道府県指定取得 | **通常はこれを使う**（minkou + gaccom） |

---

## 基本的な使い方

### 新しい都道府県を追加するとき

1. **`1) 市区町村取得`** を実行してマスタを登録
   - `pref`: 都道府県スラッグ（例: `osaka`）

2. **`3) 都道府県指定取得`** を実行してスクレイプ
   - `pref_minkou`: 都道府県名またはスラッグ（例: `大阪府` / `osaka`）
   - `pref_gaccom`: 都道府県コード（例: `27`）
   - その他はデフォルト値でOK

---

## 3) 都道府県指定取得（scrape-pref.yml）

通常の取得・再取得に使うメインのワークフロー。

### 入力パラメータ

| パラメータ | 説明 | 例 |
|---|---|---|
| `pref_minkou` | minkou用の都道府県（名前またはスラッグ） | `東京都` / `tokyo` |
| `pref_gaccom` | gaccom用の都道府県コード（数値） | `13` |
| `delay` | アクセス間隔（秒）。デフォルト `2.0` | `2.0` |
| `workers` | 並列ワーカー数。デフォルト `2` | `2` |
| `force` | `true` にすると minkou の取得済み市区町村も再取得 | `false` |

### 都道府県コード対応表（gaccom用）

| 都道府県 | コード | スラッグ（minkou用） |
|---|---|---|
| 茨城県 | 8 | ibaraki |
| 栃木県 | 9 | tochigi |
| 群馬県 | 10 | gunma |
| 埼玉県 | 11 | saitama |
| 千葉県 | 12 | chiba |
| 東京都 | 13 | tokyo |
| 神奈川県 | 14 | kanagawa |
| 大阪府 | 27 | osaka |
| 京都府 | 26 | kyoto |
| 兵庫県 | 28 | hyogo |

### 動作の違い（minkou vs gaccom）

| | minkou | gaccom |
|---|---|---|
| スキップ機能 | あり（取得済み市区町村は `scraped_at` でスキップ） | なし（毎回全件取得） |
| 再取得 | `force=true` で強制再取得 | 常に上書き（upsert） |
| 対象テーブル | `schools`, `school_reviews` | `gaccom_schools` |

---

## 2) 関東取得（scrape-kanto.yml）

関東7都県（茨城〜神奈川）を matrix で並列実行する。minkou のみ。
関東の初回一括取得用。通常は `scrape-pref.yml` を使うこと。

---

## 1) 市区町村取得（fetch-locations.yml）

minkou の `prefectures` / `cities` テーブルにマスタデータを登録する。
スクレイプ前に必ず一度実行すること。

| パラメータ | 説明 |
|---|---|
| `pref` | 都道府県スラッグ（省略時は全都道府県） |
