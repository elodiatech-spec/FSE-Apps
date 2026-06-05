import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FileX2, UserRound, Receipt, BadgeDollarSign,
  LogOut, ChevronRight, Upload, Plug, Users
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getInitiales } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { NotificationsPanel } from './NotificationsPanel'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV_GERANT: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard/gerant', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Ingestion RSP', href: '/ingestion', icon: <Upload className="w-5 h-5" /> },
  { label: 'Connecteurs', href: '/connecteurs', icon: <Plug className="w-5 h-5" /> },
  { label: 'Rejets FSE', href: '/rejets', icon: <FileX2 className="w-5 h-5" /> },
  { label: 'Médecins', href: '/medecins', icon: <UserRound className="w-5 h-5" /> },
  { label: 'Équipe', href: '/agents', icon: <Users className="w-5 h-5" /> },
  { label: 'Facturation', href: '/facturation', icon: <Receipt className="w-5 h-5" /> },
  { label: 'Commissions', href: '/commissions', icon: <BadgeDollarSign className="w-5 h-5" /> },
]

const NAV_MANAGEUSE: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard/manageuse', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Rejets FSE', href: '/rejets', icon: <FileX2 className="w-5 h-5" /> },
  { label: 'Médecins', href: '/medecins', icon: <UserRound className="w-5 h-5" /> },
  { label: 'Mes commissions', href: '/commissions', icon: <BadgeDollarSign className="w-5 h-5" /> },
]

const NAV_AGENT: NavItem[] = [
  { label: 'Tableau de bord', href: '/dashboard/agent', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Rejets FSE', href: '/rejets', icon: <FileX2 className="w-5 h-5" /> },
  { label: 'Médecins', href: '/medecins', icon: <UserRound className="w-5 h-5" /> },
]

export function Sidebar() {
  const location = useLocation()
  const { agent, signOut } = useAuth()

  const navItems = agent?.role === 'gerant'
    ? NAV_GERANT
    : agent?.role === 'manageuse'
      ? NAV_MANAGEUSE
      : NAV_AGENT

  const roleLabels = {
    gerant: 'Gérant',
    manageuse: 'Manageuse',
    agent: 'Agent',
  }

  return (
    <aside className="fixed top-0 left-0 h-full flex flex-col" style={{ width: '280px', backgroundColor: '#0D1B2A', zIndex: 40 }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <img
          src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png"
          alt="ElodiaTech"
          className="h-8 object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
          }}
        />
        <div>
          <p className="text-white font-bold text-sm">ElodiaTech</p>
          <p className="text-[#00C4CC] text-xs">FSE Manager</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="mb-2 px-3">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Navigation</p>
        </div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.href ||
            (item.href !== '/dashboard/gerant' && item.href !== '/dashboard/manageuse' && item.href !== '/dashboard/agent' && location.pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all duration-200 group',
                isActive
                  ? 'bg-[#00C4CC] text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              )}
            >
              <span className={isActive ? 'text-white' : 'text-white/60 group-hover:text-white'}>
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </Link>
          )
        })}
      </nav>

      {/* Notifications */}
      <NotificationsPanel />

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00C4CC] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {agent ? getInitiales(agent.nom, agent.prenom) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {agent ? `${agent.prenom} ${agent.nom}` : 'Chargement...'}
            </p>
            <p className="text-white/40 text-xs">
              {agent ? roleLabels[agent.role] : ''}
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-white/40 hover:text-white transition-colors p-1"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
