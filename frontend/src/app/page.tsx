'use client'
import { useState } from 'react'
import { SearchParams } from '@/types/school'
import { SearchBox } from '@/components/search/SearchBox'
import { FilterChips } from '@/components/search/FilterChips'
import { PopularAreas } from '@/components/search/PopularAreas'
import { SchoolCard } from '@/components/school/SchoolCard'
import { CompareBar } from '@/components/compare/CompareBar'
import { useSchools } from '@/hooks/useSchools'
import { useCompareStore } from '@/store/compareStore'
import { School } from '@/types/school'

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

export default function HomePage() {
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS)
  const [searched, setSearched] = useState(false)
  const { schools, loading } = useSchools(searched ? params : { ...DEFAULT_PARAMS, prefecture_slug: 'NONE' })
  const { schools: compareList, add, remove, canAdd } = useCompareStore()

  const handleSearch = (p: SearchParams) => {
    setParams(p)
    setSearched(true)
  }

  const handleRemoveFilter = (key: keyof SearchParams) => {
    const next = { ...params, [key]: key === 'has_lunch' || key === 'has_uniform' ? false : '' }
    setParams(next)
    if (searched) setSearched(true)
  }

  const handleToggleCompare = (school: School) => {
    if (compareList.some((s) => s.school_id === school.school_id)) {
      remove(school.school_id)
    } else {
      add(school)
    }
  }

  return (
    <div>
      <SearchBox onSearch={handleSearch} />
      <FilterChips params={params} onRemove={handleRemoveFilter} />
      {!searched && (
        <PopularAreas onSelect={(p) => handleSearch({ ...DEFAULT_PARAMS, ...p })} />
      )}

      {searched && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">
              {loading ? '検索中...' : `${schools.length}件`}
            </p>
            <select
              value={params.sort}
              onChange={(e) => handleSearch({ ...params, sort: e.target.value as SearchParams['sort'] })}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1"
            >
              <option value="rating">評価が高い順</option>
              <option value="reviews">口コミが多い順</option>
            </select>
          </div>

          <div className="space-y-3">
            {schools.map((school) => (
              <SchoolCard
                key={school.school_id}
                school={school}
                isInCompare={compareList.some((s) => s.school_id === school.school_id)}
                onToggleCompare={handleToggleCompare}
                canAdd={canAdd}
              />
            ))}
            {!loading && schools.length === 0 && (
              <p className="text-center text-gray-400 py-8">該当する学校が見つかりませんでした</p>
            )}
          </div>
        </div>
      )}

      <CompareBar />
    </div>
  )
}
