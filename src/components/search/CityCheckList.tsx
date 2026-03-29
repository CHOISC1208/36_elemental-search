'use client'
import { useState } from 'react'
import { City } from '@/types/school'
import { CityStats } from '@/hooks/useCityStats'

interface CityCheckListProps {
  cities: City[]
  selected: string[]
  cityStats: CityStats
  onChange: (selected: string[]) => void
}

export function CityCheckList({ cities, selected, cityStats, onChange }: CityCheckListProps) {
  const [search, setSearch] = useState('')

  if (cities.length === 0) return null

  const filtered = (() => {
    if (!search) return cities
    try {
      const pattern = search.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      const re = new RegExp(pattern, 'i')
      return cities.filter((c) => re.test(c.name))
    } catch {
      return cities.filter((c) => c.name.includes(search))
    }
  })()

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.includes(c.name))

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name])
  }

  const toggleAll = () => {
    if (allSelected) {
      const filteredNames = new Set(filtered.map((c) => c.name))
      onChange(selected.filter((n) => !filteredNames.has(n)))
    } else {
      const next = new Set(selected)
      filtered.forEach((c) => next.add(c.name))
      onChange([...next])
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500">市区町村（複数選択可）</p>
        <button type="button" onClick={toggleAll} className="text-xs text-brand hover:underline">
          {allSelected ? '全解除' : '全選択'}
        </button>
      </div>

      <input
        type="text"
        placeholder="例: 水戸市 または 水*市"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-brand"
      />

      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">該当する市区町村がありません</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 max-h-52 overflow-y-auto pr-1">
          {filtered.map((city) => {
            const stat = cityStats[city.name]
            return (
              <label
                key={city.city_code}
                className="flex items-center gap-1.5 text-sm cursor-pointer select-none py-0.5"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(city.name)}
                  onChange={() => toggle(city.name)}
                  className="accent-brand shrink-0"
                />
                <span className="flex-1 min-w-0">
                  <span className="truncate text-gray-700 block leading-tight">{city.name}</span>
                  {stat && (
                    <span className="text-xs text-gray-400 leading-tight">
                      {stat.count}校
                      {stat.avgRating != null && ` / ★${stat.avgRating}`}
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {selected.length > 0 && (
        <p className="text-xs text-brand mt-1.5">{selected.length}市区町村 選択中</p>
      )}
    </div>
  )
}
