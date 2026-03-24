'use client'
import { useState } from 'react'
import { SearchParams, SchoolType } from '@/types/school'
import { usePrefectures, usePrefCities } from '@/hooks/usePrefCities'
import { SchoolNameAutocomplete } from '@/components/search/SchoolNameAutocomplete'
import { JapanMap } from '@/components/search/JapanMap'
import { CityCheckList } from '@/components/search/CityCheckList'
import { useCityStats } from '@/hooks/useCityStats'

export const DEFAULT_SEARCH_PARAMS: SearchParams = {
  prefecture_slug: '',
  prefecture_name: '',
  cities: [],
  school_name: '',
  school_type: '',
  has_lunch: false,
  has_uniform: false,
  nearest_station: '',
  has_reviews: false,
  has_gaccom: false,
  sort: 'rating',
}

interface SearchBoxProps {
  onSearch: (params: SearchParams) => void
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'bg-brand text-white border-brand'
          : 'border-gray-300 text-gray-600 hover:border-brand hover:text-brand'
      }`}
    >
      {children}
    </button>
  )
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [params, setParams] = useState<SearchParams>(DEFAULT_SEARCH_PARAMS)
  const prefectures = usePrefectures()
  const cities = usePrefCities(params.prefecture_slug)
  const cityStats = useCityStats(params.prefecture_name)

  const set = (patch: Partial<SearchParams>) => setParams((p) => ({ ...p, ...patch }))

  const handleMapSelect = (slug: string, nameWithSuffix: string) => {
    if (slug === params.prefecture_slug) {
      set({ prefecture_slug: '', prefecture_name: '', cities: [] })
    } else {
      const name = nameWithSuffix.replace(/[都道府県]$/, '')
      set({ prefecture_slug: slug, prefecture_name: name, cities: [] })
    }
  }

  const handleSchoolSelect = (school: { school_id: string; school_name: string }) => {
    const next = { ...params, school_name: school.school_name }
    setParams(next)
    onSearch(next)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* 学校名検索 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">学校名・よみがなで直接探す</p>
        <SchoolNameAutocomplete
          value={params.school_name}
          onChange={(v) => set({ school_name: v })}
          onSelect={handleSchoolSelect}
        />
      </div>

      {/* 地図で都道府県を選択 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-500">都道府県を地図から選択</p>
          {params.prefecture_slug && (
            <button
              type="button"
              onClick={() => set({ prefecture_slug: '', prefecture_name: '', cities: [] })}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              選択解除
            </button>
          )}
        </div>
        <JapanMap
          prefectures={prefectures}
          selectedSlug={params.prefecture_slug}
          onSelect={handleMapSelect}
        />
      </div>

      {/* 市区町村チェックリスト */}
      {params.prefecture_slug && (
        <CityCheckList
          cities={cities}
          selected={params.cities}
          cityStats={cityStats}
          onChange={(selected) => set({ cities: selected })}
        />
      )}

      {/* 最寄り駅 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">最寄り駅で絞る</p>
        <input
          type="text"
          placeholder="例: 水戸駅、渋谷"
          value={params.nearest_station}
          onChange={(e) => set({ nearest_station: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {/* 種別フィルター */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">種別・条件</p>
        <div className="flex flex-wrap gap-2">
          {(['公立', '私立', '国立'] as SchoolType[]).map((t) => (
            <ToggleChip
              key={t}
              active={params.school_type === t}
              onClick={() => set({ school_type: params.school_type === t ? '' : t })}
            >
              {t}
            </ToggleChip>
          ))}
          <ToggleChip active={params.has_lunch} onClick={() => set({ has_lunch: !params.has_lunch })}>
            給食あり
          </ToggleChip>
          <ToggleChip active={params.has_uniform} onClick={() => set({ has_uniform: !params.has_uniform })}>
            制服あり
          </ToggleChip>
        </div>
      </div>

      {/* データソースフィルター */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">データ</p>
        <div className="flex flex-wrap gap-2">
          <ToggleChip active={params.has_reviews} onClick={() => set({ has_reviews: !params.has_reviews })}>
            口コミあり
          </ToggleChip>
          <ToggleChip active={params.has_gaccom} onClick={() => set({ has_gaccom: !params.has_gaccom })}>
            詳細データあり
          </ToggleChip>
        </div>
      </div>

      {/* ソート */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">並び順</p>
        <div className="flex gap-2">
          <ToggleChip active={params.sort === 'rating'} onClick={() => set({ sort: 'rating' })}>
            評価が高い順
          </ToggleChip>
          <ToggleChip active={params.sort === 'reviews'} onClick={() => set({ sort: 'reviews' })}>
            口コミが多い順
          </ToggleChip>
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { setParams(DEFAULT_SEARCH_PARAMS); onSearch(DEFAULT_SEARCH_PARAMS) }}
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
