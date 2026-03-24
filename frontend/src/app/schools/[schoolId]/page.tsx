'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSchoolDetail } from '@/hooks/useSchoolDetail'
import { SchoolHero } from '@/components/school/SchoolHero'
import { RatingRadar } from '@/components/school/RatingRadar'
import { SchoolSpecs } from '@/components/school/SchoolSpecs'
import { SchoolMap } from '@/components/school/SchoolMap'
import { ReviewList } from '@/components/school/ReviewList'
import { ScoreBar } from '@/components/ui/ScoreBar'

type Tab = 'rating' | 'info' | 'jhs'

export default function SchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>()
  const { school, reviews, loading } = useSchoolDetail(schoolId)
  const [tab, setTab] = useState<Tab>('rating')

  if (loading) {
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  }
  if (!school) {
    return <div className="text-center py-12 text-gray-400">学校が見つかりませんでした</div>
  }

  const avgRating = (key: 'rating_policy' | 'rating_class' | 'rating_teacher' | 'rating_facility' | 'rating_access' | 'rating_pta' | 'rating_events') => {
    const vals = reviews.map((r) => r[key]).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const ratings = {
    policy: avgRating('rating_policy'),
    class: avgRating('rating_class'),
    teacher: avgRating('rating_teacher'),
    facility: avgRating('rating_facility'),
    access: avgRating('rating_access'),
    pta: avgRating('rating_pta'),
    events: avgRating('rating_events'),
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rating', label: '評価・口コミ' },
    { key: 'info', label: '学校情報' },
    { key: 'jhs', label: '進学先' },
  ]

  return (
    <div className="-mx-4 -mt-6">
      <div className="px-4 pt-4 pb-2">
        <Link href="/" className="text-sm text-brand hover:underline">← 検索に戻る</Link>
      </div>

      <SchoolHero school={school} />

      <div className="px-4 mt-4">
        {/* タブ */}
        <div className="flex border-b border-gray-200 mb-4">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'rating' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <RatingRadar ratings={ratings} />
              <div className="flex-1 space-y-2">
                {(Object.entries(ratings) as [string, number | null][]).map(([key, val]) => {
                  const labels: Record<string, string> = { policy: '方針', class: '授業', teacher: '先生', facility: '施設', access: 'アクセス', pta: 'PTA', events: '行事' }
                  return <ScoreBar key={key} label={labels[key]} score={val} />
                })}
              </div>
            </div>
            <ReviewList reviews={reviews} />
          </div>
        )}

        {tab === 'info' && (
          <>
            <SchoolSpecs school={school} />
            <SchoolMap schoolName={school.school_name} address={school.address} />
          </>
        )}

        {tab === 'jhs' && (
          <div className="py-4">
            {school.linked_jhs ? (
              <div>
                <p className="text-sm text-gray-500 mb-2">通学区域が共通している公立中学校</p>
                <div className="flex flex-wrap gap-2">
                  {school.linked_jhs.split('、').map((jhs) => (
                    <span key={jhs} className="text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1">{jhs}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">進学先情報はありません</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
