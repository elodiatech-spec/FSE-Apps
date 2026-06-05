import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, X, AlertTriangle, CreditCard, FileX2, Clock, CheckCircle2, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { daysBetween } from '@/lib/utils'

interface NotifItem {
  id: string
  type: 'filec' | 'cpe' | 'attente'
  titre: string
  detail: string
  severite: 'critique' | 'elevee' | 'normale'
  href: string
}

const SEVERITE_STYLE = {
  critique: { dot: 'bg-red-500', icon: 'text-red-500', bg: 'hover:bg-red-50' },
  elevee: { dot: 'bg-amber-500', icon: 'text-amber-500', bg: 'hover:bg-amber-50' },
  normale: { dot: 'bg-[#00C4CC]', icon: 'text-[#00C4CC]', bg: 'hover:bg-slate-50' },
}

export function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotifItem[]>([])
  const navigate = useNavigate()

  const fetchNotifs = useCallback(async () => {
    const items: NotifItem[] = []

    // 1. Rejets en escalade médecin (File C)
    const { data: filec } = await supabase
      .from('rejets_fse')
      .select('id, id_fse, montant_fse, medecins(nom_cabinet)')
      .eq('statut', 'escalade_medecin')

    if (filec && filec.length > 0) {
      // Grouper par médecin
      const parCabinet: Record<string, number> = {}
      for (const r of filec) {
        const cab = (r.medecins as { nom_cabinet?: string })?.nom_cabinet || 'Inconnu'
        parCabinet[cab] = (parCabinet[cab] || 0) + 1
      }
      for (const [cabinet, count] of Object.entries(parCabinet)) {
        items.push({
          id: `filec-${cabinet}`,
          type: 'filec',
          titre: `${count} rejet(s) en attente médecin`,
          detail: cabinet,
          severite: 'critique',
          href: '/rejets',
        })
      }
    }

    // 2. Cartes CPE expirant sous 90 jours
    const { data: medecins } = await supabase
      .from('medecins')
      .select('id, nom_cabinet, date_expiration_cpe')
      .eq('actif', true)

    if (medecins) {
      for (const m of medecins) {
        if (!m.date_expiration_cpe) continue
        const jours = daysBetween(m.date_expiration_cpe)
        if (jours < 90) {
          items.push({
            id: `cpe-${m.id}`,
            type: 'cpe',
            titre: jours < 0 ? 'Carte CPE expirée' : `CPE expire dans ${jours}j`,
            detail: m.nom_cabinet,
            severite: jours < 30 ? 'critique' : 'elevee',
            href: '/medecins',
          })
        }
      }
    }

    // 3. Rejets en attente de traitement (File B non assignés)
    const { count } = await supabase
      .from('rejets_fse')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'en_attente')
      .eq('voie_traitement', 'agent')

    if (count && count > 0) {
      items.push({
        id: 'attente-agent',
        type: 'attente',
        titre: `${count} rejet(s) à traiter`,
        detail: 'File B — intervention agent',
        severite: 'normale',
        href: '/rejets',
      })
    }

    // Trier par sévérité
    const ordre = { critique: 0, elevee: 1, normale: 2 }
    items.sort((a, b) => ordre[a.severite] - ordre[b.severite])
    setNotifs(items)
  }, [])

  useEffect(() => {
    fetchNotifs()
    // Rafraîchir toutes les 60s
    const interval = setInterval(fetchNotifs, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifs])

  const total = notifs.length
  const critiques = notifs.filter(n => n.severite === 'critique').length

  function handleClick(item: NotifItem) {
    setOpen(false)
    navigate(item.href)
  }

  return (
    <div className="px-3 py-2 relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
      >
        <Bell className="w-5 h-5" />
        <span className="text-sm font-medium">Notifications</span>
        {total > 0 && (
          <span className={`ml-auto text-white text-xs font-bold px-1.5 py-0.5 rounded-full ${
            critiques > 0 ? 'bg-red-500' : 'bg-[#00C4CC]'
          }`}>
            {total}
          </span>
        )}
      </button>

      {/* Panneau déroulant */}
      {open && (
        <>
          {/* Overlay pour fermer */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-[420px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-semibold text-slate-900">Notifications</span>
                {critiques > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                    {critiques} urgent{critiques > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Liste */}
            <div className="overflow-y-auto flex-1">
              {notifs.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-600">Tout est à jour</p>
                  <p className="text-xs text-slate-400 mt-0.5">Aucune action en attente</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifs.map(item => {
                    const style = SEVERITE_STYLE[item.severite]
                    const Icon = item.type === 'filec' ? AlertTriangle
                      : item.type === 'cpe' ? CreditCard
                      : FileX2
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleClick(item)}
                        className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${style.bg}`}
                      >
                        <div className="relative flex-shrink-0">
                          <Icon className={`w-4 h-4 ${style.icon}`} />
                          <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${style.dot}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.titre}</p>
                          <p className="text-xs text-slate-500 truncate">{item.detail}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400 text-center">
                  Mise à jour automatique toutes les 60s
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
