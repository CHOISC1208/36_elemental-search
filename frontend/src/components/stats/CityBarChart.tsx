'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CityDistribution } from '@/types/distribution'

interface CityBarChartProps {
  data: CityDistribution[]
}

export function CityBarChart({ data }: CityBarChartProps) {
  const top30 = data.slice(0, 30)

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, top30.length * 26)}>
      <BarChart
        layout="vertical"
        data={top30}
        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
      >
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="city" width={90} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [String(v) + '校']} />
        <Legend />
        <Bar dataKey="public" name="公立" stackId="a" fill="#3B82F6" />
        <Bar dataKey="private" name="私立" stackId="a" fill="#F97316" />
        <Bar dataKey="national" name="国立" stackId="a" fill="#22C55E" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
