'use client'
import { useState } from 'react'
import { SearchParams, SchoolType } from '@/types/school'
import { DEFAULT_SEARCH_PARAMS } from '@/components/search/SearchBox'

const RADIUS_OPTIONS = [1, 3, 5, 10] as const
type RadiusKm = (typeof RADIUS_OPTIONS)[number]

async function fetchLatLng(
  postalCode: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  const digits = postalCode.replace(/[^0-9]/g, '')
  if (digits.length !== 7) return null
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`)
    const data = await res.json()
    if (data.status !== 200 || !data.results?.length) return null
    const r = data.results[0]
    return {
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
      label: `${r.address1}${r.address2}${r.address3}`,
    }
  } catch {
    return null
  }
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

interface RadiusSearchPanelProps {
  onSearch: (params: SearchParams) => void
}

export function RadiusSearchPanel({ onSearch }: RadiusSearchPanelProps) {
  const [postalCode, setPostalCode] = useState('')
  const [selectedRadius, setSelectedRadius] = useState<RadiusKm>(3)
  const [schoolType, setSchoolType] = useState<SchoolType | ''>('')
  const [hasReviews, setHasReviews] = useState(false)
  const [hasLunch, setHasLunch] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [activeRadius, setActiveRadius] = useState<number | null>(null)

  const isReady = postalCode.replace(/[^0-9]/g, '').length === 7

  const buildParams = (
    lat: number,
    lng: number,
    km: number,
    code: string
  ): SearchParams => ({
    ...DEFAULT_SEARCH_PARAMS,
    postal_code: code,
    center_lat: lat,
    center_lng: lng,
    radius_km: km,
    school_type: schoolType,
    has_reviews: hasReviews,
    has_lunch: hasLunch,
  })

  const handlePostalInput = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '').slice(0, 7)
    const formatted = digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits
    setPostalCode(formatted)
    if (error) setError(null)
  }

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    const result = await fetchLatLng(postalCode)
    setLoading(false)
    if (!result) {
      setError('郵便番号が見つかりませんでした')
      return
    }
    setCenter({ lat: result.lat, lng: result.lng })
    setLocationLabel(result.label)
    setActiveRadius(selectedRadius)
    onSearch(buildParams(result.lat, result.lng, selectedRadius, postalCode))
  }

  const handleRadiusChange = (km: RadiusKm) => {
    setSelectedRadius(km)
    if (center) {
      setActiveRadius(km)
      onSearch(buildParams(center.lat, center.lng, km, postalCode))
    }
  }

  const handleReset = () => {
    setPostalCode('')
    setSelectedRadius(3)
    setSchoolType('')
    setHasReviews(false)
    setHasLunch(false)
    setError(null)
    setLocationLabel(null)
    setCenter(null)
    setActiveRadius(null)
    onSearch(DEFAULT_SEARCH_PARAMS)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* 郵便番号入力 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">郵便番号を入力</p>
        <div className="flex gap-2">
          <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 flex-1 focus-within:ring-1 focus-within:ring-brand">
            <span className="text-gray-400 text-sm mr-1.5">〒</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123-4567"
              value={postalCode}
              onChange={(e) => handlePostalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && isReady && handleSearch()}
              className="flex-1 text-sm focus:outline-none min-w-0"
              maxLength={8}
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      {/* 半径 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">検索範囲（半径）</p>
        <div className="flex gap-2">
          {RADIUS_OPTIONS.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => handleRadiusChange(km)}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                selectedRadius === km
                  ? 'bg-brand text-white border-brand font-medium'
                  : 'border-gray-300 text-gray-600 hover:border-brand hover:text-brand'
              }`}
            >
              {km}km
            </button>
          ))}
        </div>
      </div>

      {/* 種別フィルター */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">種別・条件</p>
        <div className="flex flex-wrap gap-2">
          {(['公立', '私立', '国立'] as SchoolType[]).map((t) => (
            <ToggleChip
              key={t}
              active={schoolType === t}
              onClick={() => setSchoolType(schoolType === t ? '' : t)}
            >
              {t}
            </ToggleChip>
          ))}
          <ToggleChip active={hasLunch} onClick={() => setHasLunch(!hasLunch)}>
            給食あり
          </ToggleChip>
          <ToggleChip active={hasReviews} onClick={() => setHasReviews(!hasReviews)}>
            口コミあり
          </ToggleChip>
        </div>
      </div>

      {/* 現在の検索状態 */}
      {activeRadius !== null && locationLabel && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
          <p className="text-xs text-brand font-medium">
            📍 {locationLabel} から {activeRadius}km 以内で検索中
          </p>
        </div>
      )}

      {/* ボタン */}
      <div className="flex justify-end gap-2">
        {(postalCode || activeRadius !== null) && (
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
          >
            リセット
          </button>
        )}
        <button
          onClick={handleSearch}
          disabled={loading || !isReady}
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '検索中…' : '検索'}
        </button>
      </div>
    </div>
  )
}
