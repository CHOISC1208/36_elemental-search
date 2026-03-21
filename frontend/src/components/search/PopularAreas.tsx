'use client'
import { SearchParams } from '@/types/school'

const POPULAR_AREAS = [
  { label: '東京都', prefecture_slug: 'tokyo' },
  { label: '神奈川県', prefecture_slug: 'kanagawa' },
  { label: '埼玉県', prefecture_slug: 'saitama' },
  { label: '千葉県', prefecture_slug: 'chiba' },
  { label: '大阪府', prefecture_slug: 'osaka' },
]

interface PopularAreasProps {
  onSelect: (params: Partial<SearchParams>) => void
}

export function PopularAreas({ onSelect }: PopularAreasProps) {
  return (
    <div className="mt-4">
      <p className="text-sm text-gray-500 mb-2">よく検索されるエリア</p>
      <div className="flex flex-wrap gap-2">
        {POPULAR_AREAS.map((area) => (
          <button
            key={area.prefecture_slug}
            onClick={() => onSelect({ prefecture_slug: area.prefecture_slug })}
            className="text-sm px-3 py-1 border border-gray-200 rounded-full hover:border-brand hover:text-brand transition-colors"
          >
            {area.label}
          </button>
        ))}
      </div>
    </div>
  )
}
