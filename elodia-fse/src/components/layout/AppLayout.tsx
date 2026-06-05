import { ReactNode, useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto lg:ml-[280px]">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg flex-shrink-0"
                aria-label="Ouvrir le menu"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                {title && <h1 className="text-lg lg:text-xl font-bold text-slate-900 truncate">{title}</h1>}
                {subtitle && <p className="text-xs lg:text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">{actions}</div>}
          </div>
        </header>
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
