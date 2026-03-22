# ③　都道府県 / 市区町村別 学校分布 — 実装指示書

> 対象: Claude Code / 実装担当エンジニア  
> 作成日: 2026-03-22  
> 前提: Next.js 15 / Supabase / Recharts or Chart.js（どちらか既存に合わせる）

---

## 概要

ユーザー設定に関係なく、都道府県・市区町村ごとの学校数（公立/私立/国立の内訳付き）を
グラフと表で確認できるページを作成する。

将来的に「このエリアの学校はどれくらいあるか」を把握するための入口になる。

**新規ページ**: `/stats` または `/distribution`

---

## 1. Supabase クエリ

### 1-1. 都道府県別集計

```ts
// hooks/useSchoolDistribution.ts

// 都道府県別・学校種別の学校数
const { data } = await supabase
  .from('schools')
  .select('prefecture, school_type')

// クライアント側で集計（データ量次第でRPC化を検討）
// prefecture ごとに { 公立: N, 私立: N, 国立: N, 合計: N } を集計
```

**注意**: Supabase PostgREST は `GROUP BY` を直接サポートしないため、
以下のいずれかで対応する:

**案A（推奨）: Supabase RPC（DB関数）を作成**

```sql
-- Supabase SQL Editorで実行して関数を登録
CREATE OR REPLACE FUNCTION get_school_count_by_prefecture()
RETURNS TABLE (
  prefecture TEXT,
  school_type TEXT,
  count BIGINT
) AS $$
  SELECT prefecture, school_type, COUNT(*) as count
  FROM schools
  WHERE prefecture IS NOT NULL
  GROUP BY prefecture, school_type
  ORDER BY prefecture, school_type
$$ LANGUAGE sql STABLE;
```

```ts
const { data } = await supabase.rpc('get_school_count_by_prefecture')
```

**案B: 全件取得してクライアント集計（学校数が少ない間は許容）**

```ts
const { data: allSchools } = await supabase
  .from('schools')
  .select('prefecture, school_type, city')

// Map<prefecture, { 公立: N, 私立: N, 国立: N }> を構築
```

### 1-2. 市区町村別集計（都道府県選択後）

```sql
CREATE OR REPLACE FUNCTION get_school_count_by_city(pref_name TEXT)
RETURNS TABLE (
  city TEXT,
  school_type TEXT,
  count BIGINT
) AS $$
  SELECT city, school_type, COUNT(*) as count
  FROM schools
  WHERE prefecture = pref_name
  GROUP BY city, school_type
  ORDER BY count DESC, city
$$ LANGUAGE sql STABLE;
```

---

## 2. データ型定義

```ts
// types/distribution.ts

export interface PrefectureDistribution {
  prefecture: string
  public: number    // 公立
  private: number   // 私立
  national: number  // 国立
  total: number
}

export interface CityDistribution {
  city: string
  public: number
  private: number
  national: number
  total: number
}
```

---

## 3. UI / ページ構成

### ページ: `app/stats/page.tsx`

**レイアウト（縦方向に3セクション）**:

```
┌───────────────────────────────────────────────────┐
│  📊 学校分布マップ                                  │
│  全国の学校数を都道府県・市区町村別に確認できます    │
└───────────────────────────────────────────────────┘

┌─ セクション1: 全国サマリー ──────────────────────────┐
│  総学校数: [N]校  公立: [N]  私立: [N]  国立: [N]   │
└───────────────────────────────────────────────────┘

┌─ セクション2: 都道府県別グラフ ────────────────────────┐
│  [横棒グラフ: 上位20都道府県 / 公立・私立・国立の積み上げ] │
│  [都道府県名をクリック → セクション3に絞り込み]           │
└───────────────────────────────────────────────────┘

┌─ セクション3: 市区町村別 ─────────────────────────────┐
│  [都道府県セレクタ]  ← セクション2クリックで自動セット   │
│  [横棒グラフ: 市区町村ごとの学校数]                     │
│  [下部に表形式でも表示]                                │
└───────────────────────────────────────────────────┘
```

---

## 4. コンポーネント構成

### `components/stats/PrefectureBarChart.tsx`

- Recharts の `BarChart` (horizontal) + `Bar` × 3（公立/私立/国立を積み上げ）
- クリックイベントで都道府県を選択 → `setSelectedPref(prefecture)` を呼ぶ
- カラー: 公立=青系 / 私立=橙系 / 国立=緑系（既存デザインシステムに合わせる）

```tsx
<BarChart layout="vertical" data={prefData} onClick={(e) => onPrefClick(e.activePayload?.[0]?.payload.prefecture)}>
  <XAxis type="number" />
  <YAxis type="category" dataKey="prefecture" width={80} />
  <Tooltip />
  <Legend />
  <Bar dataKey="public" name="公立" stackId="a" fill="#3B82F6" />
  <Bar dataKey="private" name="私立" stackId="a" fill="#F97316" />
  <Bar dataKey="national" name="国立" stackId="a" fill="#22C55E" />
</BarChart>
```

### `components/stats/CityBarChart.tsx`

- 同様の積み上げ横棒グラフ（市区町村版）
- `prefecture` prop を受け取り、選択時にデータを取得

### `components/stats/DistributionTable.tsx`

- 都道府県 or 市区町村の表形式サマリー
- カラム: エリア名 / 公立 / 私立 / 国立 / 合計 / 学校を見る（リンク）
- 「学校を見る」クリック → `/` にクエリパラメータ付きで遷移

```tsx
// 例: 渋谷区の学校一覧へ
<Link href={`/?prefecture_slug=tokyo&city_code=13113`}>学校を見る</Link>
```

---

## 5. ナビゲーションへの追加

`components/` のヘッダー or サイドナビに「分布を見る」リンクを追加:

```tsx
<Link href="/stats">📊 学校分布</Link>
```

---

## 6. Hooks

```ts
// hooks/useSchoolDistribution.ts

export function usePrefectureDistribution() {
  // get_school_count_by_prefecture RPC を呼ぶ
  // PrefectureDistribution[] に整形して返す
}

export function useCityDistribution(prefName: string | null) {
  // prefName が null の場合は skip
  // get_school_count_by_city RPC を呼ぶ
  // CityDistribution[] に整形して返す
}
```

---

## 完了条件

- [ ] `/stats` にアクセスすると全国の都道府県別学校数グラフが表示される
- [ ] 都道府県をクリックすると市区町村別グラフに切り替わる
- [ ] 公立/私立/国立の積み上げグラフで内訳が分かる
- [ ] 表形式でも確認でき、「学校を見る」で検索ページに遷移できる
- [ ] ローディング・エラー状態が適切に表示される
- [ ] RPCが未作成の場合はSQL文がコメントとして残っている（実行待ち）
