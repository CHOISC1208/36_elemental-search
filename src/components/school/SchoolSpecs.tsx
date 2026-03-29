import { School } from '@/types/school'

interface SchoolSpecsProps {
  school: School
}

const SPEC_ROWS: { label: string; key: keyof School }[] = [
  { label: '種別', key: 'school_type' },
  { label: '所在地', key: 'address' },
  { label: '最寄駅', key: 'nearest_station' },
  { label: '児童数', key: 'student_count' },
  { label: '教職員数', key: 'teacher_count' },
  { label: '給食', key: 'lunch' },
  { label: '制服', key: 'uniform' },
  { label: '行事', key: 'events' },
  { label: '学費', key: 'tuition' },
  { label: '受験', key: 'selection' },
  { label: '受験内容', key: 'selection_method' },
  { label: '進学先中学', key: 'linked_jhs' },
]

export function SchoolSpecs({ school }: SchoolSpecsProps) {
  return (
    <div className="divide-y divide-gray-100">
      {SPEC_ROWS.map(({ label, key }) => {
        const val = school[key]
        if (!val) return null
        return (
          <div key={key} className="flex py-3 text-sm">
            <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
            <dd className="text-gray-800">{String(val)}</dd>
          </div>
        )
      })}
    </div>
  )
}
