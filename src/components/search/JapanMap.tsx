'use client'
import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps'
import { Prefecture } from '@/types/school'

const GEO_URL = '/japan.topojson'

// 各都道府県の重心座標（経度, 緯度）とラベル文字列
const PREF_LABELS: Record<string, { coords: [number, number]; label: string }> = {
  hokkaido:  { coords: [142.8, 43.5], label: '北海道' },
  aomori:    { coords: [140.7, 40.6], label: '青森' },
  iwate:     { coords: [141.1, 39.6], label: '岩手' },
  miyagi:    { coords: [140.9, 38.3], label: '宮城' },
  akita:     { coords: [140.1, 39.7], label: '秋田' },
  yamagata:  { coords: [140.3, 38.4], label: '山形' },
  fukushima: { coords: [140.2, 37.2], label: '福島' },
  ibaraki:   { coords: [140.3, 36.4], label: '茨城' },
  tochigi:   { coords: [139.9, 36.6], label: '栃木' },
  gunma:     { coords: [139.1, 36.5], label: '群馬' },
  saitama:   { coords: [139.4, 36.0], label: '埼玉' },
  chiba:     { coords: [140.1, 35.5], label: '千葉' },
  tokyo:     { coords: [139.3, 35.7], label: '東京' },
  kanagawa:  { coords: [139.5, 35.4], label: '神奈川' },
  niigata:   { coords: [138.9, 37.5], label: '新潟' },
  toyama:    { coords: [137.2, 36.7], label: '富山' },
  ishikawa:  { coords: [136.6, 36.6], label: '石川' },
  fukui:     { coords: [136.2, 36.0], label: '福井' },
  yamanashi: { coords: [138.6, 35.7], label: '山梨' },
  nagano:    { coords: [138.2, 36.2], label: '長野' },
  gifu:      { coords: [137.1, 35.8], label: '岐阜' },
  shizuoka:  { coords: [138.4, 35.0], label: '静岡' },
  aichi:     { coords: [137.1, 35.0], label: '愛知' },
  mie:       { coords: [136.5, 34.3], label: '三重' },
  shiga:     { coords: [136.1, 35.2], label: '滋賀' },
  kyoto:     { coords: [135.6, 35.2], label: '京都' },
  osaka:     { coords: [135.5, 34.7], label: '大阪' },
  hyogo:     { coords: [134.9, 34.9], label: '兵庫' },
  nara:      { coords: [135.9, 34.3], label: '奈良' },
  wakayama:  { coords: [135.6, 33.9], label: '和歌山' },
  tottori:   { coords: [133.6, 35.4], label: '鳥取' },
  shimane:   { coords: [132.5, 35.4], label: '島根' },
  okayama:   { coords: [133.9, 34.7], label: '岡山' },
  hiroshima: { coords: [132.5, 34.5], label: '広島' },
  yamaguchi: { coords: [131.5, 34.2], label: '山口' },
  tokushima: { coords: [134.2, 33.8], label: '徳島' },
  kagawa:    { coords: [134.0, 34.3], label: '香川' },
  ehime:     { coords: [133.0, 33.8], label: '愛媛' },
  kochi:     { coords: [133.5, 33.5], label: '高知' },
  fukuoka:   { coords: [130.7, 33.6], label: '福岡' },
  saga:      { coords: [130.2, 33.3], label: '佐賀' },
  nagasaki:  { coords: [129.7, 33.0], label: '長崎' },
  kumamoto:  { coords: [130.7, 32.8], label: '熊本' },
  oita:      { coords: [131.6, 33.2], label: '大分' },
  miyazaki:  { coords: [131.4, 32.0], label: '宮崎' },
  kagoshima: { coords: [130.5, 31.5], label: '鹿児島' },
  okinawa:   { coords: [127.7, 26.3], label: '沖縄' },
}

interface RegionPreset {
  label: string
  center: [number, number]
  zoom: number
}

const REGION_PRESETS: RegionPreset[] = [
  { label: '全国',       center: [137,   35.4], zoom: 1   },
  { label: '北海道',     center: [142.9, 43.5], zoom: 4   },
  { label: '東北',       center: [140.5, 38.8], zoom: 2.8 },
  { label: '関東',       center: [139.5, 35.9], zoom: 5   },
  { label: '中部',       center: [137.5, 36.0], zoom: 3.5 },
  { label: '近畿',       center: [135.5, 34.8], zoom: 5   },
  { label: '中国・四国', center: [133.0, 34.2], zoom: 3.5 },
  { label: '九州',       center: [130.5, 33.2], zoom: 3.5 },
]

interface JapanMapProps {
  prefectures: Prefecture[]
  selectedSlug: string
  onSelect: (slug: string, nameWithSuffix: string) => void
}

export function JapanMap({ prefectures, selectedSlug, onSelect }: JapanMapProps) {
  const slugByName = Object.fromEntries(prefectures.map((p) => [p.name, p.slug]))
  const [hoveredName, setHoveredName] = useState('')
  const [center, setCenter] = useState<[number, number]>([137, 35.4])
  const [zoom, setZoom] = useState(1)

  const selectedName = prefectures.find((p) => p.slug === selectedSlug)?.name ?? ''
  const displayName = hoveredName || selectedName

  // ズーム中も常に一定の見た目サイズを保つ（SVG座標系ではzoomに反比例させる）
  const labelFontSize = 28 / zoom

  return (
    <div className="space-y-2">
      {/* 地域プリセット */}
      <div className="flex flex-wrap gap-1">
        {REGION_PRESETS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => { setCenter(r.center); setZoom(r.zoom) }}
            className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:border-brand hover:text-brand transition-colors"
          >
            {r.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setCenter([137, 35.4]); setZoom(1) }}
          className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-700 transition-colors"
        >
          ↺ リセット
        </button>
      </div>

      {/* 都道府県名表示 */}
      <div className="h-5 flex items-center">
        {displayName ? (
          <span className={`text-sm font-medium ${hoveredName ? 'text-gray-600' : 'text-brand'}`}>
            {displayName}
            {!hoveredName && selectedSlug && ' を選択中'}
          </span>
        ) : (
          <span className="text-xs text-gray-400">地図をクリックして都道府県を選択</span>
        )}
      </div>

      {/* 地図本体 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-sky-50">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 1050 }}
          style={{ width: '100%', height: 'auto' }}
        >
          <ZoomableGroup
            center={center}
            zoom={zoom}
            maxZoom={8192}
            onMove={({ zoom: z }) => setZoom(z)}
            onMoveEnd={({ coordinates, zoom: z }) => { setCenter(coordinates); setZoom(z) }}
          >
            {/* 都道府県ポリゴン */}
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const namJa = geo.properties.nam_ja as string
                  const slug = slugByName[namJa] ?? ''
                  const isSelected = slug !== '' && slug === selectedSlug

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setHoveredName(namJa)}
                      onMouseLeave={() => setHoveredName('')}
                      onClick={() => { if (slug) onSelect(slug, namJa) }}
                      style={{
                        default: {
                          fill: isSelected ? '#f97316' : '#d1d5db',
                          stroke: '#fff',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        hover: {
                          fill: isSelected ? '#ea580c' : '#9ca3af',
                          stroke: '#fff',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        pressed: {
                          fill: '#ea580c',
                          stroke: '#fff',
                          strokeWidth: 0.5,
                          outline: 'none',
                        },
                      }}
                    />
                  )
                })
              }
            </Geographies>

            {/* 都道府県名ラベル */}
            {prefectures.map((p) => {
              const labelData = PREF_LABELS[p.slug]
              if (!labelData) return null
              const isSelected = p.slug === selectedSlug
              return (
                <Marker key={p.slug} coordinates={labelData.coords}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={labelFontSize}
                    fill={isSelected ? '#fff' : '#374151'}
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {labelData.label}
                  </text>
                </Marker>
              )
            })}
          </ZoomableGroup>
        </ComposableMap>
      </div>
    </div>
  )
}
