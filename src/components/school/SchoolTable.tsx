'use client'
import { useRef, useState } from 'react'
import { School } from '@/types/school'
import { Badge } from '@/components/ui/Badge'

type ColKey = 'name' | 'location' | 'type' | 'station' | 'rating' | 'reviews' | 'distance' | 'compare'

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  name:     260,
  location: 150,
  type:      68,
  station:  140,
  rating:    68,
  reviews:   68,
  distance:  72,
  compare:   80,
}

const COL_HEADERS_BASE: { key: ColKey; label: string; align: 'left' | 'right' | 'center' }[] = [
  { key: 'name',     label: '学校名',  align: 'left'   },
  { key: 'location', label: '所在地',  align: 'left'   },
  { key: 'type',     label: '種別',    align: 'left'   },
  { key: 'station',  label: '最寄駅',  align: 'left'   },
  { key: 'rating',   label: '評価',    align: 'right'  },
  { key: 'reviews',  label: '口コミ',  align: 'right'  },
  { key: 'distance', label: '距離',    align: 'right'  },
  { key: 'compare',  label: '',        align: 'center' },
]

interface SchoolTableProps {
  schools: School[]
  selectedSchoolId: string | null
  onRowClick: (school: School) => void
  compareList: School[]
  onToggleCompare: (school: School) => void
  canAdd: boolean
  showDistance?: boolean
}

export function SchoolTable({
  schools,
  selectedSchoolId,
  onRowClick,
  compareList,
  onToggleCompare,
  canAdd,
  showDistance = false,
}: SchoolTableProps) {
  const [widths, setWidths] = useState<Record<ColKey, number>>(DEFAULT_WIDTHS)
  const COL_HEADERS = showDistance
    ? COL_HEADERS_BASE
    : COL_HEADERS_BASE.filter(c => c.key !== 'distance')
  const resizing = useRef<{ col: ColKey; startX: number; startWidth: number } | null>(null)

  const handleResizeStart = (col: ColKey, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startWidth = widths[col]
    resizing.current = { col, startX: e.clientX, startWidth }

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const diff = ev.clientX - resizing.current.startX
      const next = Math.max(48, resizing.current.startWidth + diff)
      setWidths((prev) => ({ ...prev, [resizing.current!.col]: next }))
    }
    const onUp = () => {
      resizing.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  if (schools.length === 0) return null

  const totalWidth = Object.values(widths).reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-xl border border-gray-200 overflow-auto">
      <table className="text-sm border-collapse" style={{ width: totalWidth, minWidth: '100%' }}>
        <colgroup>
          {COL_HEADERS.map(({ key }) => (
            <col key={key} style={{ width: widths[key] }} />
          ))}
        </colgroup>

        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {COL_HEADERS.map(({ key, label, align }) => (
              <th
                key={key}
                className={`relative px-3 py-2.5 font-medium text-gray-600 select-none text-${align}`}
                style={{ width: widths[key] }}
              >
                {label}
                {/* リサイズハンドル */}
                <div
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize group flex items-center justify-center"
                  onMouseDown={(e) => handleResizeStart(key, e)}
                >
                  <div className="w-px h-4 bg-gray-300 group-hover:bg-brand transition-colors" />
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {schools.map((school) => {
            const isInCompare = compareList.some((s) => s.school_id === school.school_id)
            const isSelected = school.school_id === selectedSchoolId

            return (
              <tr
                key={school.school_id}
                onClick={() => onRowClick(school)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-orange-50 hover:bg-orange-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* 学校名 */}
                <td className="px-3 py-2.5" style={{ width: widths.name }}>
                  <span
                    className={`font-medium block truncate ${isSelected ? 'text-brand' : 'text-gray-900'}`}
                    title={school.school_name}
                  >
                    {school.school_name}
                  </span>
                  {school.student_count != null && (
                    <span className="text-xs text-gray-400">{school.student_count}人</span>
                  )}
                </td>

                {/* 所在地 */}
                <td className="px-3 py-2.5 text-gray-600" style={{ width: widths.location }}>
                  <span className="block truncate" title={`${school.prefecture} ${school.city}`}>
                    {school.prefecture} {school.city}
                  </span>
                </td>

                {/* 種別 */}
                <td className="px-3 py-2.5" style={{ width: widths.type }}>
                  <Badge type={school.school_type} />
                </td>

                {/* 最寄駅 */}
                <td className="px-3 py-2.5 text-gray-500" style={{ width: widths.station }}>
                  <span className="block truncate" title={school.nearest_station ?? ''}>
                    {school.nearest_station ?? '—'}
                  </span>
                </td>

                {/* 評価 */}
                <td className="px-3 py-2.5 text-right" style={{ width: widths.rating }}>
                  {school.rating_avg != null ? (
                    <span className="font-medium text-brand">{Number(school.rating_avg).toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* 口コミ */}
                <td className="px-3 py-2.5 text-right text-gray-500" style={{ width: widths.reviews }}>
                  {school.review_count}
                </td>

                {/* 距離（半径検索時のみ） */}
                {showDistance && (
                  <td className="px-3 py-2.5 text-right text-gray-500" style={{ width: widths.distance }}>
                    {school.distance_km != null
                      ? <span className="text-xs font-medium text-brand">{school.distance_km.toFixed(1)}km</span>
                      : <span className="text-gray-300">—</span>
                    }
                  </td>
                )}

                {/* 比較ボタン */}
                <td
                  className="px-3 py-2.5 text-center"
                  style={{ width: widths.compare }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onToggleCompare(school)}
                    disabled={!isInCompare && !canAdd}
                    className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-colors ${
                      isInCompare
                        ? 'bg-brand text-white border-brand'
                        : canAdd
                        ? 'border-brand text-brand hover:bg-brand-light'
                        : 'border-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isInCompare ? '✓' : '+比較'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
