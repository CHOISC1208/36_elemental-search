import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '小学校検索',
  description: '全国の小学校を検索・比較できるサービス',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-brand">🏫 小学校検索</a>
            <nav className="flex items-center gap-4">
              <a href="/stats" className="text-sm text-gray-500 hover:text-brand transition-colors">📊 学校分布</a>
              <a href="/ranking" className="text-sm text-gray-500 hover:text-brand transition-colors">🏆 ランキング</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6 pb-24">
          {children}
        </main>
      </body>
    </html>
  )
}
