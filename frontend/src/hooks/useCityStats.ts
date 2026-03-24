'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'

export interface CityStats {
  [cityName: string]: { count: number; avgRating: number | null }
}

export function useCityStats(prefectureName: string): CityStats {
  const [stats, setStats] = useState<CityStats>({})

  useEffect(() => {
    if (!prefectureName) { setStats({}); return }

    supabase
      .schema(SCHEMA)
      .from('schools')
      .select('city, rating_avg')
      .eq('prefecture', prefectureName)
      .then(({ data }) => {
        const byCity: Record<string, { count: number; ratingSum: number; ratingCount: number }> = {}
        data?.forEach((s: { city: string; rating_avg: number | null }) => {
          if (!s.city) return
          if (!byCity[s.city]) byCity[s.city] = { count: 0, ratingSum: 0, ratingCount: 0 }
          byCity[s.city].count++
          if (s.rating_avg != null) {
            byCity[s.city].ratingSum += s.rating_avg
            byCity[s.city].ratingCount++
          }
        })
        const result: CityStats = {}
        Object.entries(byCity).forEach(([city, d]) => {
          result[city] = {
            count: d.count,
            avgRating: d.ratingCount > 0 ? Math.round((d.ratingSum / d.ratingCount) * 10) / 10 : null,
          }
        })
        setStats(result)
      })
  }, [prefectureName])

  return stats
}
