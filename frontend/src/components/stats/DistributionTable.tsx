import Link from 'next/link'
import { PrefectureDistribution, CityDistribution } from '@/types/distribution'

type Row = PrefectureDistribution | CityDistribution

function isPrefRow(row: Row): row is PrefectureDistribution {
  return 'prefecture' in row
}

interface DistributionTableProps {
  data: Row[]
  prefSlug?: string
}

export function DistributionTable({ data, prefSlug }: DistributionTableProps) {
  if (data.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
            <th className="pb-2 pr-4">エリア</th>
            <th className="pb-2 pr-3 text-right">公立</th>
            <th className="pb-2 pr-3 text-right">私立</th>
            <th className="pb-2 pr-3 text-right">国立</th>
            <th className="pb-2 pr-3 text-right font-bold">合計</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const name = isPrefRow(row) ? row.prefecture : row.city
            const href = isPrefRow(row)
              ? `/?prefecture_name=${encodeURIComponent(row.prefecture)}`
              : `/?prefecture_slug=${prefSlug}&city_name=${encodeURIComponent((row as CityDistribution).city)}`
            return (
              <tr key={name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 pr-4 font-medium text-gray-800">{name}</td>
                <td className="py-2 pr-3 text-right text-blue-600">{row.public || '-'}</td>
                <td className="py-2 pr-3 text-right text-orange-500">{row.private || '-'}</td>
                <td className="py-2 pr-3 text-right text-green-600">{row.national || '-'}</td>
                <td className="py-2 pr-3 text-right font-bold text-gray-900">{row.total}</td>
                <td className="py-2">
                  <Link href={href} className="text-xs text-brand hover:underline whitespace-nowrap">
                    学校を見る →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
