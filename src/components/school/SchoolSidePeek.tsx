'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSchoolDetail } from '@/hooks/useSchoolDetail'
import { SchoolHero } from '@/components/school/SchoolHero'
import { RatingRadar } from '@/components/school/RatingRadar'
import { SchoolSpecs } from '@/components/school/SchoolSpecs'
import { SchoolMap } from '@/components/school/SchoolMap'
import { ReviewList } from '@/components/school/ReviewList'
import { ScoreBar } from '@/components/ui/ScoreBar'

interface SchoolSidePeekProps {
  schoolId: string | null
  onClose: () => void
}

type Tab = 'rating' | 'info' | 'jhs'

export function SchoolSidePeek({ schoolId, onClose }: SchoolSidePeekProps) {
  const [tab, setTab] = useState<Tab>('rating')
  const { school, reviews, loading } = useSchoolDetail(schoolId ?? '')

  // schoolId が変わったらタブをリセット
  useEffect(() => { setTab('rating') }, [schoolId])

  // Escape キーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isOpen = schoolId !== null

  const avgRating = (key: 'rating_policy' | 'rating_class' | 'rating_teacher' | 'rating_facility' | 'rating_access' | 'rating_pta' | 'rating_events') => {
    const vals = reviews.map((r) => r[key]).filter((v): v is number => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const ratings = {
    policy:   avgRating('rating_policy'),
    class:    avgRating('rating_class'),
    teacher:  avgRating('rating_teacher'),
    facility: avgRating('rating_facility'),
    access:   avgRating('rating_access'),
    pta:      avgRating('rating_pta'),
    events:   avgRating('rating_events'),
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rating', label: '評価・口コミ' },
    { key: 'info',   label: '学校情報' },
    { key: 'jhs',    label: '進学先' },
  ]

  return (
    <>
      {/* バックドロップ */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* サイドパネル */}
      <div
        className={`fixed top-0 right-0 h-full w-[520px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* パネルヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0"
              title="閉じる (Esc)"
            >
              ×
            </button>
            {school && (
              <Link
                href={`/schools/${school.school_id}`}
                className="text-sm text-brand hover:underline truncate"
                onClick={onClose}
              >
                フルページで開く →
              </Link>
            )}
          </div>
        </div>

        {/* パネルコンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {!schoolId || loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">読み込み中...</div>
          ) : !school ? (
            <div className="flex items-center justify-center h-40 text-gray-400">学校が見つかりませんでした</div>
          ) : (
            <>
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
                  <div className="space-y-6 pb-8">
                    <div className="flex flex-col gap-4">
                      <RatingRadar ratings={ratings} />
                      <div className="space-y-2">
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
                  <div className="pb-8">
                    <SchoolSpecs school={school} />
                    <SchoolMap schoolName={school.school_name} address={school.address} />
                  </div>
                )}

                {tab === 'jhs' && (
                  <div className="py-4 pb-8">
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
