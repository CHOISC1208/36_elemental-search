'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { SchoolType } from '@/types/school'
import { SchoolSearchQuery } from '@/hooks/useSchoolSearch'

// ── 定数 ──────────────────────────────────────────────────────────
const KANTO_PREFS = [
  { label: '東京都',   value: '東京',   slug: 'tokyo'    },
  { label: '神奈川県', value: '神奈川', slug: 'kanagawa' },
  { label: '埼玉県',   value: '埼玉',   slug: 'saitama'  },
  { label: '千葉県',   value: '千葉',   slug: 'chiba'    },
  { label: '茨城県',   value: '茨城',   slug: 'ibaraki'  },
  { label: '栃木県',   value: '栃木',   slug: 'tochigi'  },
  { label: '群馬県',   value: '群馬',   slug: 'gunma'    },
]

const SCHOOL_TYPES: SchoolType[] = ['公立', '私立', '国立']
const RADIUS_OPTIONS = [1, 3, 5, 10] as const
type RadiusKm = (typeof RADIUS_OPTIONS)[number]

interface CityItem { city_code: string; name: string }
interface LatLng    { lat: number; lng: number }

// ── ToggleChip ────────────────────────────────────────────────────
function ToggleChip({
  active, onClick, children, grow = false,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; grow?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs py-1.5 rounded-lg border transition-colors ${grow ? 'flex-1' : 'px-3'} ${
        active
          ? 'bg-brand text-white border-brand'
          : 'border-gray-300 text-gray-600 hover:border-brand hover:text-brand'
      }`}
    >
      {children}
    </button>
  )
}

// ── Props ─────────────────────────────────────────────────────────
interface SchoolSearchFormProps {
  onSearch: (query: SchoolSearchQuery) => void
}

// ── Component ─────────────────────────────────────────────────────
export function SchoolSearchForm({ onSearch }: SchoolSearchFormProps) {
  // ① 学校名
  const [schoolName, setSchoolName] = useState('')

  // 種別（①直下に統合）
  const [schoolTypes, setSchoolTypes] = useState<SchoolType[]>([])

  // ② 都道府県
  const [prefectures, setPrefectures] = useState<string[]>([])

  // ② 市区町村
  const [cityQuery, setCityQuery]           = useState('')
  const [citySuggestions, setCitySuggestions] = useState<CityItem[]>([])
  const [selectedCity, setSelectedCity]     = useState<CityItem | null>(null)
  const [showCityDD, setShowCityDD]         = useState(false)
  const cityRef = useRef<HTMLDivElement>(null)

  // ③ 郵便番号
  const [postalCode, setPostalCode]     = useState('')
  const [postalLoading, setPostalLoading] = useState(false)
  const [postalError, setPostalError]   = useState<string | null>(null)
  const [postalLabel, setPostalLabel]   = useState<string | null>(null)

  // ③ 距離
  const [radiusKm, setRadiusKm]   = useState<RadiusKm | null>(null)
  const [center, setCenter]       = useState<LatLng | null>(null) // geocoded center

  // 半径検索がアクティブかどうか
  const isRadiusMode = center !== null && radiusKm !== null

  // ── 市区町村 autocomplete ──────────────────────────────────────
  useEffect(() => {
    if (!cityQuery || selectedCity) { setCitySuggestions([]); setShowCityDD(false); return }
    const t = setTimeout(async () => {
      const slugs = prefectures
        .map(p => KANTO_PREFS.find(kp => kp.value === p)?.slug)
        .filter((s): s is string => Boolean(s))

      let q = supabase.schema(SCHEMA).from('cities')
        .select('city_code, name')
        .ilike('name', `%${cityQuery}%`)
        .limit(8)
      if (slugs.length > 0) q = q.in('prefecture_slug', slugs)

      const { data } = await q
      const items = (data ?? []) as CityItem[]
      setCitySuggestions(items)
      setShowCityDD(items.length > 0)
    }, 180)
    return () => clearTimeout(t)
  }, [cityQuery, prefectures, selectedCity])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setShowCityDD(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── ハンドラ ──────────────────────────────────────────────────

  const togglePref = (value: string) => {
    setPrefectures(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value])
    setSelectedCity(null)
    setCityQuery('')
    // ②操作時は半径検索をクリア
    setCenter(null)
    setRadiusKm(null)
    setPostalLabel(null)
  }

  const toggleType = (t: SchoolType) =>
    setSchoolTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const handleCitySelect = (city: CityItem) => {
    setSelectedCity(city)
    setCityQuery(city.name)
    setShowCityDD(false)
    setCitySuggestions([])
    // 市区町村選択時も半径検索をクリア
    setCenter(null)
    setRadiusKm(null)
    setPostalLabel(null)
  }

  const handleCityInput = (v: string) => {
    setCityQuery(v)
    setSelectedCity(null)
  }

  const handlePostalInput = (raw: string) => {
    const d = raw.replace(/[^0-9]/g, '').slice(0, 7)
    setPostalCode(d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d)
    setPostalError(null)
    // 入力変更時は確定済みラベルをリセット
    setPostalLabel(null)
    setCenter(null)
  }

  const handleRadiusSelect = (km: RadiusKm) => {
    setRadiusKm(prev => prev === km ? null : km) // トグル
  }

  /** 国土地理院 API で住所文字列 → 緯度経度に変換 */
  const geocodeByAddress = async (address: string): Promise<LatLng | null> => {
    try {
      const res = await fetch(
        `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`
      )
      const data = await res.json()
      if (!data?.length) return null
      const [lng, lat] = data[0].geometry.coordinates
      return { lat, lng }
    } catch {
      return null
    }
  }

  /** 郵便番号 → 緯度経度 + 住所ラベルを返す */
  const geocodePostal = async (): Promise<{ latlng: LatLng; label: string; prefValue: string | null; cityName: string } | null> => {
    const digits = postalCode.replace(/[^0-9]/g, '')
    if (digits.length !== 7) { setPostalError('7桁で入力してください'); return null }
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`)
    const data = await res.json()
    if (data.status !== 200 || !data.results?.length) { setPostalError('郵便番号が見つかりませんでした'); return null }
    const r = data.results[0]
    const label = `${r.address1}${r.address2}${r.address3}`
    const rawPref   = (r.address1 as string).replace(/[都道府県]$/, '')
    const kantoPref = KANTO_PREFS.find(kp => kp.value === rawPref)

    // zipcloud が座標を持たない場合は国土地理院 API にフォールバック
    let lat = parseFloat(r.latitude)
    let lng = parseFloat(r.longitude)
    if (isNaN(lat) || isNaN(lng)) {
      const fallback = await geocodeByAddress(label)
      if (!fallback) { setPostalError('この郵便番号の座標が取得できませんでした'); return null }
      lat = fallback.lat
      lng = fallback.lng
    }

    return {
      latlng:    { lat, lng },
      label,
      prefValue: kantoPref?.value ?? null,
      cityName:  r.address2 as string,
    }
  }

  /** [補完] クリック: 都道府県・市区町村を自動入力 */
  const handleFill = async () => {
    setPostalLoading(true)
    setPostalError(null)
    try {
      const result = await geocodePostal()
      if (!result) return
      setPostalLabel(result.label)
      // 都道府県補完
      if (result.prefValue && !prefectures.includes(result.prefValue)) {
        setPrefectures(prev => [...prev, result.prefValue!])
      }
      // 市区町村補完
      const slugs = result.prefValue
        ? [KANTO_PREFS.find(kp => kp.value === result.prefValue)?.slug].filter(Boolean) as string[]
        : []
      let cq = supabase.schema(SCHEMA).from('cities')
        .select('city_code, name')
        .ilike('name', `${result.cityName}%`)
        .limit(1)
      if (slugs.length > 0) cq = cq.in('prefecture_slug', slugs)
      const { data: cd } = await cq
      if (cd?.length) {
        const city = (cd as CityItem[])[0]
        setSelectedCity(city)
        setCityQuery(city.name)
      } else {
        setCityQuery(result.cityName)
      }
    } catch {
      setPostalError('位置情報の取得に失敗しました')
    } finally {
      setPostalLoading(false)
    }
  }

  /** [検索] クリック（半径モード）: ジオコードして即検索 */
  const handleRadiusSearch = async () => {
    setPostalLoading(true)
    setPostalError(null)
    try {
      const result = await geocodePostal()
      if (!result) return
      setPostalLabel(result.label)
      setCenter(result.latlng)
      // ②の選択をクリア
      setPrefectures([])
      setSelectedCity(null)
      setCityQuery('')
      // 即座に検索実行
      onSearch({
        school_name: schoolName,
        prefectures:  [],
        city_name:    null,
        school_types: schoolTypes,
        center_lat:   result.latlng.lat,
        center_lng:   result.latlng.lng,
        radius_km:    radiusKm!,
      })
    } catch {
      setPostalError('位置情報の取得に失敗しました')
    } finally {
      setPostalLoading(false)
    }
  }

  const handleSearch = () => {
    if (isRadiusMode) {
      onSearch({
        school_name:  schoolName,
        prefectures:  [],
        city_name:    null,
        school_types: schoolTypes,
        center_lat:   center!.lat,
        center_lng:   center!.lng,
        radius_km:    radiusKm,
      })
    } else {
      onSearch({
        school_name:  schoolName,
        prefectures,
        city_name:    selectedCity?.name ?? null,
        school_types: schoolTypes,
        center_lat:   null,
        center_lng:   null,
        radius_km:    null,
      })
    }
  }

  const handleReset = () => {
    setSchoolName('')
    setSchoolTypes([])
    setPrefectures([])
    setCityQuery('')
    setSelectedCity(null)
    setPostalCode('')
    setPostalError(null)
    setPostalLabel(null)
    setRadiusKm(null)
    setCenter(null)
  }

  const postalReady = postalCode.replace(/[^0-9]/g, '').length === 7

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ① 学校名検索（全幅） */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="学校名・よみがなで検索..."
            value={schoolName}
            onChange={e => setSchoolName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            onClick={handleSearch}
            className="bg-brand text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-orange-500 transition-colors whitespace-nowrap"
          >
            検索
          </button>
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2.5 border border-gray-300 rounded-lg whitespace-nowrap"
          >
            リセット
          </button>
        </div>

        {/* 種別（①直下・共通） */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium shrink-0">種別</span>
          <div className="flex gap-1.5">
            {SCHOOL_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  schoolTypes.includes(t)
                    ? 'bg-brand text-white border-brand'
                    : 'border-gray-300 text-gray-600 hover:border-brand hover:text-brand'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ②③ 2カラム */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">

        {/* ② 左パネル: 都道府県 / 市区町村 */}
        <div className={`bg-white rounded-xl border p-4 flex flex-col gap-4 transition-opacity ${
          isRadiusMode ? 'border-gray-200 opacity-40 pointer-events-none' : 'border-gray-200'
        }`}>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">都道府県</p>
            <div className="flex flex-wrap gap-1.5">
              {KANTO_PREFS.map(pref => (
                <button
                  key={pref.value}
                  type="button"
                  onClick={() => togglePref(pref.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    prefectures.includes(pref.value)
                      ? 'bg-brand text-white border-brand'
                      : 'border-gray-300 text-gray-600 hover:border-brand hover:text-brand'
                  }`}
                >
                  {pref.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={cityRef} className="relative">
            <p className="text-xs font-semibold text-gray-500 mb-2">市区町村</p>
            <div className="relative">
              <input
                type="text"
                placeholder="市区町村名を入力..."
                value={cityQuery}
                onChange={e => handleCityInput(e.target.value)}
                onFocus={() => citySuggestions.length > 0 && setShowCityDD(true)}
                className={`w-full border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-brand ${
                  selectedCity ? 'border-brand bg-orange-50' : 'border-gray-300'
                }`}
              />
              {selectedCity && (
                <button
                  type="button"
                  onClick={() => { setSelectedCity(null); setCityQuery('') }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                >✕</button>
              )}
              {showCityDD && citySuggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {citySuggestions.map(city => (
                    <button
                      key={city.city_code}
                      type="button"
                      onMouseDown={() => handleCitySelect(city)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 hover:text-brand border-b border-gray-100 last:border-0"
                    >
                      {city.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedCity && (
              <p className="text-xs text-brand mt-1">✓ {selectedCity.name} を選択中</p>
            )}
          </div>

          {isRadiusMode && (
            <p className="text-xs text-gray-400 text-center mt-auto">
              半径検索中は無効（右パネルの解除ボタンで戻す）
            </p>
          )}
        </div>

        {/* ③ 右パネル: 郵便番号 + 距離 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-4">
          {/* 郵便番号 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">郵便番号</p>
            <div className="flex gap-2">
              <div className={`flex-1 flex items-center border rounded-lg px-3 py-2 focus-within:ring-1 focus-within:ring-brand ${
                postalLabel ? 'border-brand bg-orange-50' : 'border-gray-300'
              }`}>
                <span className="text-gray-400 text-sm mr-1.5 shrink-0">〒</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="123-4567"
                  value={postalCode}
                  onChange={e => handlePostalInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key !== 'Enter' || !postalReady) return
                    radiusKm ? handleRadiusSearch() : handleFill()
                  }}
                  className="flex-1 text-sm focus:outline-none bg-transparent min-w-0"
                  maxLength={8}
                />
              </div>
              {/* 距離未選択→補完、距離選択→検索 */}
              <button
                onClick={radiusKm ? handleRadiusSearch : handleFill}
                disabled={postalLoading || !postalReady}
                className={`text-sm px-4 py-2 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap ${
                  radiusKm
                    ? 'bg-brand text-white hover:bg-orange-500'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {postalLoading ? '...' : radiusKm ? '検索' : '補完'}
              </button>
            </div>
            {postalError && <p className="text-xs text-red-500 mt-1.5">{postalError}</p>}
            {postalLabel && (
              <p className="text-xs text-brand mt-1.5">
                📍 {postalLabel}
                {isRadiusMode && ` から ${radiusKm}km 以内で検索中`}
              </p>
            )}
          </div>

          {/* 距離 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">
              半径距離
              <span className="ml-1 font-normal text-gray-400">（選択すると距離で検索）</span>
            </p>
            <div className="flex gap-1.5">
              {RADIUS_OPTIONS.map(km => (
                <button
                  key={km}
                  type="button"
                  onClick={() => handleRadiusSelect(km)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    radiusKm === km
                      ? 'bg-brand text-white border-brand font-medium'
                      : 'border-gray-300 text-gray-600 hover:border-brand hover:text-brand'
                  }`}
                >
                  {km}km
                </button>
              ))}
            </div>
          </div>

          {/* 半径検索中のクリアボタン */}
          {isRadiusMode && (
            <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 flex items-center justify-between">
              <p className="text-xs text-brand font-medium">
                半径 {radiusKm}km 以内で検索中
              </p>
              <button
                type="button"
                onClick={() => { setCenter(null); setRadiusKm(null); setPostalLabel(null) }}
                className="text-xs text-gray-500 hover:text-gray-700 ml-2 underline"
              >
                解除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
