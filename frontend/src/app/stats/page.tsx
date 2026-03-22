'use client'
import { useState } from 'react'
import { usePrefectureDistribution, useCityDistribution } from '@/hooks/useSchoolDistribution'
import { PrefectureBarChart } from '@/components/stats/PrefectureBarChart'
import { CityBarChart } from '@/components/stats/CityBarChart'
import { DistributionTable } from '@/components/stats/DistributionTable'
import { usePrefectures } from '@/hooks/usePrefCities'

export default function StatsPage() {
  const [selectedPref, setSelectedPref] = useState<string | null>(null)
  const [selectedPrefSlug, setSelectedPrefSlug] = useState<string>('')

  const { data: prefData, loading: prefLoading } = usePrefectureDistribution()
  const { data: cityData, loading: cityLoading } = useCityDistribution(selectedPref)
  const prefectures = usePrefectures()

  const total = prefData.reduce((sum, p) => sum + p.total, 0)
  const totalPublic = prefData.reduce((sum, p) => sum + p.public, 0)
  const totalPrivate = prefData.reduce((sum, p) => sum + p.private, 0)
  const totalNational = prefData.reduce((sum, p) => sum + p.national, 0)

  const handlePrefClick = (pref: string) => {
    setSelectedPref(pref)
    const found = prefectures.find((p) => p.name.replace(/[都道府県]$/, '') === pref)
    setSelectedPrefSlug(found?.slug ?? '')
    // 市区町村セクションへスクロール
    document.getElementById('city-section')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handlePrefSelect = (slug: string) => {
    const pref = prefectures.find((p) => p.slug === slug)
    if (!pref) { setSelectedPref(null); setSelectedPrefSlug(''); return }
    setSelectedPrefSlug(slug)
    setSelectedPref(pref.name.replace(/[都道府県]$/, ''))
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">学校分布</h1>
        <p className="text-sm text-gray-500 mt-1">全国の学校数を都道府県・市区町村別に確認できます</p>
      </div>

      {/* 全国サマリー */}
      {!prefLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '総学校数', value: total, color: 'text-gray-900' },
            { label: '公立', value: totalPublic, color: 'text-blue-600' },
            { label: '私立', value: totalPrivate, color: 'text-orange-500' },
            { label: '国立', value: totalNational, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value.toLocaleString()}<span className="text-sm font-normal text-gray-500 ml-1">校</span></p>
            </div>
          ))}
        </div>
      )}

      {/* 都道府県別グラフ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-bold text-gray-800 mb-4">都道府県別学校数（クリックで市区町村に絞り込み）</h2>
        {prefLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">読み込み中...</div>
        ) : (
          <PrefectureBarChart data={prefData} onPrefClick={handlePrefClick} selectedPref={selectedPref} />
        )}
      </div>

      {/* 都道府県別テーブル */}
      {!prefLoading && prefData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-4">都道府県別一覧</h2>
          <DistributionTable data={prefData} />
        </div>
      )}

      {/* 市区町村別 */}
      <div id="city-section" className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-gray-800">市区町村別学校数</h2>
          <select
            value={selectedPrefSlug}
            onChange={(e) => handlePrefSelect(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm ml-auto"
          >
            <option value="">都道府県を選択</option>
            {prefectures.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>

        {!selectedPref && (
          <p className="text-sm text-gray-400 py-4 text-center">上のグラフまたはセレクタで都道府県を選択してください</p>
        )}
        {selectedPref && cityLoading && (
          <div className="h-32 flex items-center justify-center text-gray-400 text-sm">読み込み中...</div>
        )}
        {selectedPref && !cityLoading && cityData.length > 0 && (
          <>
            <CityBarChart data={cityData} />
            <DistributionTable data={cityData} prefSlug={selectedPrefSlug} />
          </>
        )}
      </div>
    </div>
  )
}
