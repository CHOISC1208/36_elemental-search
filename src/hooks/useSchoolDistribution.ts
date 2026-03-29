'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { PrefectureDistribution, CityDistribution } from '@/types/distribution'

type RpcRow = { prefecture?: string; city?: string; school_type: string; count: number }

function aggregateRows(rows: RpcRow[], key: 'prefecture' | 'city'): (PrefectureDistribution | CityDistribution)[] {
  const map = new Map<string, { public: number; private: number; national: number }>()
  for (const row of rows) {
    const name = row[key] ?? ''
    if (!map.has(name)) map.set(name, { public: 0, private: 0, national: 0 })
    const entry = map.get(name)!
    const count = Number(row.count)
    if (row.school_type === '公立') entry.public += count
    else if (row.school_type === '私立') entry.private += count
    else if (row.school_type === '国立') entry.national += count
  }
  return Array.from(map.entries()).map(([name, counts]) => ({
    [key]: name,
    ...counts,
    total: counts.public + counts.private + counts.national,
  })) as (PrefectureDistribution | CityDistribution)[]
}

export function usePrefectureDistribution() {
  const [data, setData] = useState<PrefectureDistribution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .schema(SCHEMA)
      .rpc('get_school_count_by_prefecture')
      .then(({ data: rows }) => {
        const aggregated = aggregateRows(rows ?? [], 'prefecture') as PrefectureDistribution[]
        aggregated.sort((a, b) => b.total - a.total)
        setData(aggregated)
        setLoading(false)
      })
  }, [])

  return { data, loading }
}

export function useCityDistribution(prefName: string | null) {
  const [data, setData] = useState<CityDistribution[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!prefName) { setData([]); return }
    setLoading(true)
    supabase
      .schema(SCHEMA)
      .rpc('get_school_count_by_city', { pref_name: prefName })
      .then(({ data: rows }) => {
        const aggregated = aggregateRows(rows ?? [], 'city') as CityDistribution[]
        setData(aggregated)
        setLoading(false)
      })
  }, [prefName])

  return { data, loading }
}
