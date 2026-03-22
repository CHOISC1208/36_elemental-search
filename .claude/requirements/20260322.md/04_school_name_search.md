# ④　学校名検索 強化 — 実装指示書

> 対象: Claude Code / 実装担当エンジニア  
> 作成日: 2026-03-22  
> 前提: Next.js 15 / Supabase / 既存 `useSchools` hook

---

## 概要

現状の `school_name` 部分一致検索を**使いやすく・速く**する。
UXの改善がメインで、バックエンドロジックの追加は最小限。

---

## 1. 現状の問題点

- SearchBox に学校名入力欄はあるが、他のフィルターと同列でわかりにくい
- 入力のたびにAPIを叩く（デバウンスがない可能性）
- 候補サジェストがない（入力補完なし）
- よみがな（ふりがな）での検索ができない（`furigana` カラムあり）

---

## 2. 改善内容

### 2-1. デバウンス追加

```ts
// hooks/useSchools.ts の呼び出し側で
import { useDebouncedValue } from '@/hooks/useDebouncedValue'  // 新規または既存

const debouncedName = useDebouncedValue(schoolName, 300)  // 300ms

// useSchools({ ..., school_name: debouncedName })
```

```ts
// hooks/useDebouncedValue.ts（存在しない場合は新規作成）
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

### 2-2. よみがな（furigana）検索の追加

`useSchools` の Supabase クエリを修正:

```ts
// 現状（school_name のみ）
if (params.school_name) {
  query = query.ilike('school_name', `%${params.school_name}%`)
}

// 改善後（school_name OR furigana）
if (params.school_name) {
  query = query.or(
    `school_name.ilike.%${params.school_name}%,furigana.ilike.%${params.school_name}%`
  )
}
```

### 2-3. 検索候補サジェスト（オートコンプリート）

**新規コンポーネント**: `components/search/SchoolNameAutocomplete.tsx`

**動作**:
1. ユーザーが2文字以上入力したらサジェストを表示
2. Supabase から上位10件の学校名を取得
3. ドロップダウンリストで表示
4. 選択したら検索実行

```ts
// サジェスト用クエリ（軽量）
const { data: suggestions } = await supabase
  .from('schools')
  .select('school_id, school_name, prefecture, city, school_type')
  .or(`school_name.ilike.%${keyword}%,furigana.ilike.%${keyword}%`)
  .limit(10)
```

**UIイメージ**:

```
┌────────────────────────────────────┐
│ 🔍 学校名で探す...                  │
│ ─────────────────────────────────  │
│ 渋谷小学校       東京都 渋谷区 公立  │
│ 渋谷区立広尾小学校 東京都 渋谷区 公立 │
│ 渋谷区立本町小学校 ...              │
│  ...（最大10件）                    │
└────────────────────────────────────┘
```

**実装詳細**:

```tsx
// components/search/SchoolNameAutocomplete.tsx

export function SchoolNameAutocomplete({ onSelect }: { onSelect: (school: SchoolSuggestion) => void }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const debouncedInput = useDebouncedValue(input, 200)

  // debouncedInput が2文字以上の場合のみフェッチ
  const { data: suggestions } = useSuggestions(debouncedInput.length >= 2 ? debouncedInput : null)

  return (
    <div className="relative">
      <input
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} // クリック猶予
        placeholder="学校名・よみがなで検索..."
        className="..."
      />
      {open && suggestions && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
          {suggestions.map(s => (
            <li
              key={s.school_id}
              onClick={() => { onSelect(s); setOpen(false); setInput(s.school_name) }}
              className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between"
            >
              <span>{s.school_name}</span>
              <span className="text-sm text-gray-400">{s.prefecture} {s.city}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### 2-4. 検索バーの視認性向上

**SearchBox.tsx の修正**:

- 学校名検索を最上部に移動し、他フィルターと分離
- 「学校名で直接探す」セクションを独立させる

```tsx
// Before: 他フィルターと並列
<input placeholder="学校名" .../>
<select /* 都道府県 */ />
<select /* 市区町村 */ />

// After: セクション分離
<section>
  <h3>学校名で直接探す</h3>
  <SchoolNameAutocomplete onSelect={handleSchoolSelect} />
</section>

<section>
  <h3>エリア・条件で絞り込む</h3>
  {/* 都道府県・市区町村・フィルター */}
</section>
```

---

## 3. 検索結果の改善

### 学校名マッチのハイライト

`SchoolCard.tsx` を修正して、検索キーワードにマッチした部分をハイライト:

```tsx
// highlightText 関数は ②口コミ検索 と共通化して utils/highlight.ts に切り出す
import { highlightText } from '@/utils/highlight'

<h3>{highlightText(school.school_name, searchKeyword)}</h3>
```

### 完全一致を上位表示

```ts
// useSchools のクエリ修正
// Supabase の order では完全一致を上に持ってこれないため、
// クライアント側で再ソート

const sorted = useMemo(() => {
  if (!params.school_name) return schools
  return [...schools].sort((a, b) => {
    const aExact = a.school_name === params.school_name ? 0 : 1
    const bExact = b.school_name === params.school_name ? 0 : 1
    return aExact - bExact
  })
}, [schools, params.school_name])
```

---

## 4. 共通ユーティリティの切り出し

口コミ検索（②）と共通で使える関数を `utils/highlight.ts` に作成:

```ts
// utils/highlight.ts

export function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded-sm px-0.5 font-medium">{part}</mark>
      : part
  )
}
```

---

## 完了条件

- [ ] 学校名入力にデバウンス（300ms）が適用されている
- [ ] よみがな（furigana）でも検索できる
- [ ] 2文字以上入力するとサジェストが表示される
- [ ] サジェスト選択で学校詳細ページに遷移できる
- [ ] 検索結果の学校名でキーワードがハイライトされる
- [ ] `utils/highlight.ts` が作成され、口コミ検索側でも再利用できる状態になっている
