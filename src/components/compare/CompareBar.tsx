'use client'
import Link from 'next/link'
import { useCompareStore } from '@/store/compareStore'

export function CompareBar() {
  const { schools, remove, clear } = useCompareStore()

  if (schools.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-4 py-3 z-50">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <div className="flex-1 flex flex-wrap gap-2">
          {schools.map((s) => (
            <span
              key={s.school_id}
              className="flex items-center gap-1 text-sm bg-brand-light text-brand border border-brand-border rounded-full px-3 py-1"
            >
              {s.school_name}
              <button onClick={() => remove(s.school_id)} className="ml-1 hover:text-red-500">×</button>
            </span>
          ))}
          {schools.length < 3 && (
            <span className="text-sm text-gray-400 self-center">（最大3校）</span>
          )}
        </div>
        <button onClick={clear} className="text-sm text-gray-500 hover:text-gray-700">クリア</button>
        <Link
          href="/compare"
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm hover:bg-orange-500 transition-colors"
        >
          比較する ({schools.length})
        </Link>
      </div>
    </div>
  )
}
