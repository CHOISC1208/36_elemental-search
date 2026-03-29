'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type MainTab = 'school' | 'review' | 'stats' | 'ranking'

interface MainTabBarProps {
  /** "/" ページ内でのアクティブタブ。他ページでは pathname から自動判定 */
  activeTab?: MainTab
  /** "/" ページ内でのモード切替コールバック */
  onModeChange?: (mode: 'school' | 'review') => void
}

export function MainTabBar({ activeTab, onModeChange }: MainTabBarProps) {
  const pathname = usePathname()

  const active: MainTab =
    activeTab ??
    (pathname === '/stats' ? 'stats' : pathname === '/ranking' ? 'ranking' : 'school')

  const cls = (tab: MainTab) =>
    `flex-1 py-2 text-sm font-medium rounded-md transition-colors text-center ${
      active === tab
        ? 'bg-white text-gray-900 shadow-sm'
        : 'text-gray-500 hover:text-gray-700'
    }`

  const isHome = pathname === '/'

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {/* 学校で探す */}
      {isHome ? (
        <button onClick={() => onModeChange?.('school')} className={cls('school')}>
          学校で探す
        </button>
      ) : (
        <Link href="/" className={cls('school')}>学校で探す</Link>
      )}

      {/* 口コミで探す */}
      {isHome ? (
        <button onClick={() => onModeChange?.('review')} className={cls('review')}>
          口コミで探す
        </button>
      ) : (
        <Link href="/" className={cls('review')}>口コミで探す</Link>
      )}

      {/* 学校分布 */}
      <Link href="/stats" className={cls('stats')}>
        学校分布
      </Link>

      {/* ランキング */}
      <Link href="/ranking" className={cls('ranking')}>
        ランキング
      </Link>
    </div>
  )
}
