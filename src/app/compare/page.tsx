'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCompareStore } from '@/store/compareStore'
import { CompareTable } from '@/components/compare/CompareTable'
import { CompareSummary } from '@/components/compare/CompareSummary'
import { SchoolReview } from '@/types/school'
import { supabase, SCHEMA } from '@/lib/supabase'

export default function ComparePage() {
  const { schools, clear } = useCompareStore()
  const [reviewsMap, setReviewsMap] = useState<Record<string, SchoolReview[]>>({})

  useEffect(() => {
    if (schools.length === 0) return
    const ids = schools.map((s) => s.school_id)
    supabase
      .schema(SCHEMA)
      .from('school_reviews')
      .select('id, school_id, poster_type, enrollment_year, post_date, title, rating_overall, rating_policy, rating_class, rating_teacher, rating_facility, rating_access, rating_pta, rating_events, text_overall')
      .in('school_id', ids)
      .then(({ data }) => {
        const map: Record<string, SchoolReview[]> = {}
        for (const r of data ?? []) {
          if (!map[r.school_id]) map[r.school_id] = []
          map[r.school_id].push(r)
        }
        setReviewsMap(map)
      })
  }, [schools])

  if (schools.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">比較する学校が選択されていません</p>
        <Link href="/" className="text-brand hover:underline">← 学校を選択する</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm text-brand hover:underline">← 検索に戻る</Link>
        <button onClick={clear} className="text-sm text-gray-500 hover:text-gray-700">比較をクリア</button>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-4">学校の比較</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <CompareTable schools={schools} reviewsMap={reviewsMap} />
      </div>

      <CompareSummary schools={schools} />
    </div>
  )
}
