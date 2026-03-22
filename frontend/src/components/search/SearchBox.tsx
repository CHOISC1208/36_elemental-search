'use client'
import { useState } from 'react'
import { SearchParams, SchoolType } from '@/types/school'
import { usePrefectures, usePrefCities } from '@/hooks/usePrefCities'
import { SchoolNameAutocomplete } from '@/components/search/SchoolNameAutocomplete'

const DEFAULT_PARAMS: SearchParams = {
  prefecture_slug: '',
  prefecture_name: '',
  city_code: '',
  school_name: '',
  school_type: '',
  has_lunch: false,
  has_uniform: false,
  sort: 'rating',
}

interface SearchBoxProps {
  onSearch: (params: SearchParams) => void
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS)
  const prefectures = usePrefectures()
  const cities = usePrefCities(params.prefecture_slug)

  const set = (patch: Partial<SearchParams>) => setParams((p) => ({ ...p, ...patch }))

  const handleSchoolSelect = (school: { school_id: string; school_name: string }) => {
    const next = { ...params, school_name: school.school_name }
    setParams(next)
    onSearch(next)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* 学校名で直接探す */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">学校名・よみがなで直接探す</p>
        <SchoolNameAutocomplete
          value={params.school_name}
          onChange={(v) => set({ school_name: v })}
          onSelect={handleSchoolSelect}
        />
      </div>

      {/* エリア・条件で絞り込む */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">エリア・条件で絞り込む</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <select
            value={params.prefecture_slug}
            onChange={(e) => {
              const slug = e.target.value
              const pref = prefectures.find((p) => p.slug === slug)
              const name = pref ? pref.name.replace(/[都道府県]$/, '') : ''
              set({ prefecture_slug: slug, prefecture_name: name, city_code: '' })
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">都道府県を選択</option>
            {prefectures.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>

          <select
            value={params.city_code}
            onChange={(e) => set({ city_code: e.target.value })}
            disabled={!params.prefecture_slug}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">市区町村を選択</option>
            {cities.map((c) => (
              <option key={c.city_code} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={params.school_type}
            onChange={(e) => set({ school_type: e.target.value as SchoolType | '' })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">すべての種別</option>
            <option value="公立">公立</option>
            <option value="私立">私立</option>
            <option value="国立">国立</option>
          </select>

          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="checkbox" checked={params.has_lunch} onChange={(e) => set({ has_lunch: e.target.checked })} />
            給食あり
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="checkbox" checked={params.has_uniform} onChange={(e) => set({ has_uniform: e.target.checked })} />
            制服あり
          </label>
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { setParams(DEFAULT_PARAMS); onSearch(DEFAULT_PARAMS) }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
        >
          リセット
        </button>
        <button
          onClick={() => onSearch(params)}
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm hover:bg-orange-500 transition-colors"
        >
          検索
        </button>
      </div>
    </div>
  )
}
