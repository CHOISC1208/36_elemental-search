'use client'
import { SearchParams } from '@/types/school'

interface FilterChipsProps {
  params: SearchParams
  onRemove: (key: keyof SearchParams, value?: string) => void
}

export function FilterChips({ params, onRemove }: FilterChipsProps) {
  const chips: { label: string; key: keyof SearchParams; value?: string }[] = []

  if (params.school_type)     chips.push({ label: params.school_type, key: 'school_type' })
  if (params.has_lunch)       chips.push({ label: '給食あり', key: 'has_lunch' })
  if (params.has_uniform)     chips.push({ label: '制服あり', key: 'has_uniform' })
  if (params.has_reviews)     chips.push({ label: '口コミあり', key: 'has_reviews' })
  if (params.has_gaccom)      chips.push({ label: '詳細データあり', key: 'has_gaccom' })
  if (params.nearest_station) chips.push({ label: `🚉 ${params.nearest_station}`, key: 'nearest_station' })
  for (const city of params.cities) {
    chips.push({ label: city, key: 'cities', value: city })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {chips.map(({ label, key, value }) => (
        <button
          key={`${key}-${value ?? label}`}
          onClick={() => onRemove(key, value)}
          className="flex items-center gap-1 text-xs bg-brand-light text-brand border border-brand-border rounded-full px-3 py-1"
        >
          {label}
          <span className="ml-1">×</span>
        </button>
      ))}
    </div>
  )
}
