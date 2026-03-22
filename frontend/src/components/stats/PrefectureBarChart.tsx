'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PrefectureDistribution } from '@/types/distribution'

interface PrefectureBarChartProps {
  data: PrefectureDistribution[]
  onPrefClick: (pref: string) => void
  selectedPref: string | null
}

export function PrefectureBarChart({ data, onPrefClick, selectedPref }: PrefectureBarChartProps) {
  const top20 = data.slice(0, 20)

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, top20.length * 28)}>
      <BarChart
        layout="vertical"
        data={top20}
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        onClick={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pref = (e as any)?.activePayload?.[0]?.payload?.prefecture
          if (pref) onPrefClick(pref)
        }}
        style={{ cursor: 'pointer' }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="prefecture"
          width={70}
          tick={({ x, y, payload }) => (
            <text
              x={x}
              y={y}
              dy={4}
              textAnchor="end"
              fontSize={11}
              fill={payload.value === selectedPref ? '#E07B3F' : '#374151'}
              fontWeight={payload.value === selectedPref ? 700 : 400}
            >
              {payload.value}
            </text>
          )}
        />
        <Tooltip formatter={(v) => [String(v) + '校']} />
        <Legend />
        <Bar dataKey="public" name="公立" stackId="a" fill="#3B82F6" />
        <Bar dataKey="private" name="私立" stackId="a" fill="#F97316" />
        <Bar dataKey="national" name="国立" stackId="a" fill="#22C55E" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
