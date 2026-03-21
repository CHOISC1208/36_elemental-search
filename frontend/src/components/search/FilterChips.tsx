'use client'
import { SearchParams } from '@/types/school'

interface FilterChipsProps {
  params: SearchParams
  onRemove: (key: keyof SearchParams) => void
}

export function FilterChips({ params, onRemove }: FilterChipsProps) {
  const chips: { label: string; key: keyof SearchParams }[] = []
  if (params.school_type) chips.push({ label: params.school_type, key: 'school_type' })
  if (params.has_lunch) chips.push({ label: '給食あり', key: 'has_lunch' })
  if (params.has_uniform) chips.push({ label: '制服あり', key: 'has_uniform' })

  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {chips.map(({ label, key }) => (
        <button
          key={key}
          onClick={() => onRemove(key)}
          className="flex items-center gap-1 text-xs bg-brand-light text-brand border border-brand-border rounded-full px-3 py-1"
        >
          {label}
          <span className="ml-1">×</span>
        </button>
      ))}
    </div>
  )
}
