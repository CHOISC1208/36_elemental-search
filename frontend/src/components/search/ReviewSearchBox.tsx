'use client'
import { useState } from 'react'
import { ReviewSearchParams } from '@/hooks/useReviewSearch'
import { usePrefectures, usePrefCities } from '@/hooks/usePrefCities'

interface ReviewSearchBoxProps {
  onSearch: (params: ReviewSearchParams) => void
}

const POSTER_TYPES = [
  { value: '', label: 'すべて' },
  { value: '保護者', label: '保護者' },
  { value: '生徒', label: '生徒' },
  { value: '卒業生', label: '卒業生' },
] as const

export function ReviewSearchBox({ onSearch }: ReviewSearchBoxProps) {
  const [keyword, setKeyword] = useState('')
  const [posterType, setPosterType] = useState<'保護者' | '生徒' | '卒業生' | ''>('')
  const [prefSlug, setPrefSlug] = useState('')
  const [prefName, setPrefName] = useState('')
  const [cityCode, setCityCode] = useState('')

  const prefectures = usePrefectures()
  const cities = usePrefCities(prefSlug)

  const handleSearch = () => {
    onSearch({
      keyword,
      prefecture_name: prefName || undefined,
      city_code: cityCode || undefined,
      poster_type: posterType || undefined,
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* キーワード入力 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">口コミのキーワードで探す</p>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="「給食がおいしい」「先生が親切」など"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
        />
      </div>

      {/* 投稿者タイプ */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">投稿者</p>
        <div className="flex gap-2">
          {POSTER_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPosterType(value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                posterType === value
                  ? 'bg-brand text-white border-brand'
                  : 'border-gray-300 text-gray-600 hover:border-brand hover:text-brand'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* エリア絞り込み */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={prefSlug}
          onChange={(e) => {
            const slug = e.target.value
            const pref = prefectures.find((p) => p.slug === slug)
            const name = pref ? pref.name.replace(/[都道府県]$/, '') : ''
            setPrefSlug(slug)
            setPrefName(name)
            setCityCode('')
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">都道府県（任意）</option>
          {prefectures.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>

        <select
          value={cityCode}
          onChange={(e) => setCityCode(e.target.value)}
          disabled={!prefSlug}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">市区町村（任意）</option>
          {cities.map((c) => (
            <option key={c.city_code} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* 検索ボタン */}
      <div className="flex justify-end">
        <button
          onClick={handleSearch}
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm hover:bg-orange-500 transition-colors"
        >
          口コミを検索
        </button>
      </div>
    </div>
  )
}
