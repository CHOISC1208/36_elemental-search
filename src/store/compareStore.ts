import { create } from 'zustand'
import { School } from '@/types/school'

interface CompareStore {
  schools: School[]
  add: (school: School) => void
  remove: (schoolId: string) => void
  clear: () => void
  canAdd: boolean
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  schools: [],
  add: (school) => {
    if (get().schools.length >= 3) return
    set((s) => ({ schools: [...s.schools, school] }))
  },
  remove: (schoolId) =>
    set((s) => ({ schools: s.schools.filter((sc) => sc.school_id !== schoolId) })),
  clear: () => set({ schools: [] }),
  get canAdd() {
    return get().schools.length < 3
  },
}))
