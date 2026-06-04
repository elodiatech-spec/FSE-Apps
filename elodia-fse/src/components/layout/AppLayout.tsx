import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ marginLeft: '280px' }}>
        {(title || actions) && (
          <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                {title && <h1 className="text-xl font-bold text-slate-900">{title}</h1>}
                {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
          </header>
        )}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
