import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: { value: number; label?: string }
  variant?: 'default' | 'teal' | 'dark'
  className?: string
}

export function KpiCard({ title, value, subtitle, icon, trend, variant = 'default', className }: KpiCardProps) {
  const bgStyles = {
    default: 'bg-white border border-slate-200/60',
    teal: 'bg-gradient-to-br from-[#00C4CC] to-[#009FA6] text-white border-0',
    dark: 'bg-[#0D1B2A] text-white border-0',
  }

  const textStyles = {
    default: { title: 'text-slate-500', value: 'text-slate-900', sub: 'text-slate-400' },
    teal: { title: 'text-white/80', value: 'text-white', sub: 'text-white/60' },
    dark: { title: 'text-white/60', value: 'text-white', sub: 'text-white/40' },
  }

  const t = textStyles[variant]

  return (
    <div className={cn('rounded-2xl p-6 shadow-sm', bgStyles[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={cn('text-sm font-medium', t.title)}>{title}</p>
          <p className={cn('text-2xl font-bold mt-1.5 tracking-tight', t.value)}>{value}</p>
          {subtitle && <p className={cn('text-xs mt-1', t.sub)}>{subtitle}</p>}
          {trend && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trend.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              <span>{trend.value >= 0 ? '+' : ''}{trend.value}%</span>
              {trend.label && <span className={t.sub}>{trend.label}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl',
            variant === 'default' ? 'bg-[#00C4CC]/10 text-[#00C4CC]' : 'bg-white/20 text-white'
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
