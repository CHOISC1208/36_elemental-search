'use client'
import { useMemo, useState } from 'react'
import { useRankingData } from '@/hooks/useRankingData'
import { useRankingStore } from '@/store/rankingStore'
import { WeightSlider } from '@/components/ranking/WeightSlider'
import { RankingCard } from '@/components/ranking/RankingCard'
import { CompareBar } from '@/components/compare/CompareBar'
import { SchoolSidePeek } from '@/components/school/SchoolSidePeek'
import { usePrefectures, usePrefCities } from '@/hooks/usePrefCities'
import { calcScore, WEIGHT_LABELS, PRESETS, PresetKey } from '@/types/ranking'
import { SchoolType } from '@/types/school'
import { MainTabBar } from '@/components/nav/MainTabBar'

const PRESET_LABELS: Record<PresetKey, string> = {
  balanced: 'バランス型',
  academic: '学習重視',
  safety:   '安全重視',
}

export default function RankingPage() {
  const { weights, preset, setWeight, resetWeights, applyPreset } = useRankingStore()

  const [prefSlug, setPrefSlug] = useState('')
  const [prefName, setPrefName] = useState('')
  const [city, setCity] = useState('')
  const [schoolType, setSchoolType] = useState<SchoolType | ''>('')
  const [minReviews, setMinReviews] = useState(3)
  const [showSliders, setShowSliders] = useState(true)
  const [displayCount, setDisplayCount] = useState(20)
  const [sidePeekId, setSidePeekId] = useState<string | null>(null)

  const prefectures = usePrefectures()
  const cities = usePrefCities(prefSlug)

  const { schools, loading } = useRankingData({
    prefecture_name: prefName || undefined,
    city: city || undefined,
    school_type: schoolType || undefined,
    min_reviews: minReviews,
  })

  const ranked = useMemo(() => {
    return [...schools]
      .map((s) => ({ ...s, score: calcScore(s, weights) }))
      .sort((a, b) => b.score - a.score)
  }, [schools, weights])

  return (
    <div className="space-y-4">
      <MainTabBar />
      <div>
        <h1 className="text-xl font-bold text-gray-900">カテゴリ別ランキング</h1>
        <p className="text-sm text-gray-500 mt-1">評価カテゴリのウェイトを調整して独自のランキングを作成</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* 設定パネル */}
        <div className="lg:w-64 shrink-0 space-y-4">
          {/* プリセット */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 mb-2">プリセット</p>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`text-sm px-3 py-2 rounded-lg border text-left transition-colors ${
                    preset === key
                      ? 'bg-brand text-white border-brand'
                      : 'border-gray-200 text-gray-700 hover:border-brand hover:text-brand'
                  }`}
                >
                  {PRESET_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* ウェイトスライダー */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-500">ウェイト調整</p>
              <button
                onClick={() => setShowSliders((v) => !v)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {showSliders ? '折りたたむ' : '展開'}
              </button>
            </div>
            {showSliders && (
              <div className="space-y-4">
                {(Object.keys(WEIGHT_LABELS) as (keyof typeof WEIGHT_LABELS)[]).map((key) => (
                  <WeightSlider
                    key={key}
                    label={WEIGHT_LABELS[key]}
                    value={weights[key]}
                    onChange={(v) => setWeight(key, v)}
                  />
                ))}
                <button
                  onClick={resetWeights}
                  className="text-xs text-gray-500 hover:text-gray-700 w-full text-center pt-1"
                >
                  リセット
                </button>
              </div>
            )}
          </div>

          {/* 絞り込み */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-medium text-gray-500 mb-1">絞り込み</p>
            <select
              value={prefSlug}
              onChange={(e) => {
                const slug = e.target.value
                const pref = prefectures.find((p) => p.slug === slug)
                const name = pref ? pref.name.replace(/[都道府県]$/, '') : ''
                setPrefSlug(slug)
                setPrefName(name)
                setCity('')
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">都道府県（全て）</option>
              {prefectures.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>

            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={!prefSlug}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">市区町村（全て）</option>
              {cities.map((c) => (
                <option key={c.city_code} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={schoolType}
              onChange={(e) => setSchoolType(e.target.value as SchoolType | '')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">全ての種別</option>
              <option value="公立">公立</option>
              <option value="私立">私立</option>
              <option value="国立">国立</option>
            </select>

            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600 whitespace-nowrap">最低口コミ数</label>
              <input
                type="number"
                min={1}
                max={50}
                value={minReviews}
                onChange={(e) => setMinReviews(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>

        {/* ランキング結果 */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-24" />
              ))}
            </div>
          ) : ranked.length === 0 ? (
            <p className="text-center text-gray-400 py-12">条件に合う学校が見つかりませんでした</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">{ranked.length}校中 上位{Math.min(displayCount, ranked.length)}校</p>
              <div className="space-y-3">
                {ranked.slice(0, displayCount).map((school, i) => (
                  <RankingCard
                    key={school.school_id}
                    rank={i + 1}
                    school={school}
                    weights={weights}
                    isSelected={sidePeekId === school.school_id}
                    onSchoolClick={(id) => setSidePeekId(id === sidePeekId ? null : id)}
                  />
                ))}
              </div>
              {displayCount < ranked.length && (
                <button
                  onClick={() => setDisplayCount((n) => n + 20)}
                  className="w-full mt-4 py-3 text-sm text-brand border border-brand rounded-lg hover:bg-brand-light transition-colors"
                >
                  さらに表示（残り {ranked.length - displayCount}校）
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <CompareBar />
      <SchoolSidePeek schoolId={sidePeekId} onClose={() => setSidePeekId(null)} />
    </div>
  )
}
