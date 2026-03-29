'use client'
import { SearchParams } from '@/types/school'

const POPULAR_AREAS = [
  { label: '東京都', prefecture_slug: 'tokyo', prefecture_name: '東京' },
  { label: '神奈川県', prefecture_slug: 'kanagawa', prefecture_name: '神奈川' },
  { label: '埼玉県', prefecture_slug: 'saitama', prefecture_name: '埼玉' },
  { label: '千葉県', prefecture_slug: 'chiba', prefecture_name: '千葉' },
  { label: '大阪府', prefecture_slug: 'osaka', prefecture_name: '大阪' },
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
            onClick={() => onSelect({ prefecture_slug: area.prefecture_slug, prefecture_name: area.prefecture_name })}
            className="text-sm px-3 py-1 border border-gray-200 rounded-full hover:border-brand hover:text-brand transition-colors"
          >
            {area.label}
          </button>
        ))}
      </div>
    </div>
  )
}
