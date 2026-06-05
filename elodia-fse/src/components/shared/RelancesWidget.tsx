import { useEffect, useState, useCallback } from 'react'
import { AlertTriangle, Clock, Mail, CheckCircle2, RefreshCw } from 'lucide-react'
import { supabase, RejetFSE, Medecin } from '@/lib/supabase'
import { sendEmailEscaladeMedecin } from '@/lib/emailService'
import { useToast } from '@/components/ui/toast'
import { formatCurrency } from '@/lib/utils'

interface RelanceInfo {
  medecin: Medecin
  rejets: RejetFSE[]
  joursDepuis: number
  nbRelances: number
  prochaine: string
  urgence: 'normale' | 'elevee' | 'critique'
}

function joursDepuis(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function RelancesWidget() {
  const [relances, setRelances] = useState<RelanceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchRelances = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rejets_fse')
      .select('*, medecins(*)')
      .eq('statut', 'escalade_medecin')
      .order('updated_at', { ascending: true })

    const rejets = (data || []) as (RejetFSE & { medecins: Medecin })[]

    // Grouper par médecin
    const grouped: Record<string, { medecin: Medecin; rejets: RejetFSE[] }> = {}
    for (const r of rejets) {
      if (!r.medecins) continue
      if (!grouped[r.medecin_id]) grouped[r.medecin_id] = { medecin: r.medecins, rejets: [] }
      grouped[r.medecin_id].rejets.push(r)
    }

    const result: RelanceInfo[] = Object.values(grouped).map(({ medecin, rejets }) => {
      // Date la plus ancienne du groupe
      const oldest = rejets.reduce((o, r) => {
        const d = new Date((r as RejetFSE & { statut_change_at?: string }).statut_change_at || r.updated_at)
        return d < new Date((o as RejetFSE & { statut_change_at?: string }).statut_change_at || o.updated_at) ? r : o
      })
      const jours = joursDepuis((oldest as RejetFSE & { statut_change_at?: string }).statut_change_at || oldest.updated_at)
      const nbRel = Math.max(...rejets.map(r => (r as RejetFSE & { nb_relances?: number }).nb_relances || 0))

      let prochaine = ''
      let urgence: RelanceInfo['urgence'] = 'normale'

      if (jours < 3) {
        prochaine = `J+${3 - jours}`
      } else if (jours < 7 && nbRel <= 1) {
        prochaine = `J+${7 - jours}`
        urgence = 'elevee'
      } else if (jours >= 7 && nbRel <= 2) {
        prochaine = 'Maintenant'
        urgence = 'elevee'
      } else if (jours >= 14) {
        prochaine = 'CRITIQUE'
        urgence = 'critique'
      } else {
        prochaine = `J+${14 - jours}`
      }

      return { medecin, rejets, joursDepuis: jours, nbRelances: nbRel, prochaine, urgence }
    })

    setRelances(result.sort((a, b) => b.joursDepuis - a.joursDepuis))
    setLoading(false)
  }, [])

  useEffect(() => { fetchRelances() }, [fetchRelances])

  async function sendRelance(info: RelanceInfo) {
    if (!info.medecin.email) { toast('Email médecin non renseigné', 'error'); return }
    setSending(info.medecin.id)
    const ok = await sendEmailEscaladeMedecin(info.medecin, info.rejets)

    if (ok) {
      // Incrémenter nb_relances
      await supabase
        .from('rejets_fse')
        .update({ nb_relances: info.nbRelances + 1, derniere_relance_at: new Date().toISOString() } as Record<string, unknown>)
        .in('id', info.rejets.map(r => r.id))
      toast(`Relance envoyée à ${info.medecin.email}`, 'success')
      fetchRelances()
    } else {
      toast('Erreur envoi — vérifiez VITE_RESEND_API_KEY', 'error')
    }
    setSending(null)
  }

  const critiques = relances.filter(r => r.urgence === 'critique').length
  const elevees = relances.filter(r => r.urgence === 'elevee').length

  if (loading) return null
  if (relances.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Relances File C</h3>
        </div>
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="w-5 h-5" />
          <p className="text-sm font-medium">Aucune escalade en attente</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900">Relances File C</h3>
          {critiques > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {critiques} critique{critiques > 1 ? 's' : ''}
            </span>
          )}
          {elevees > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {elevees} à relancer
            </span>
          )}
        </div>
        <button
          onClick={fetchRelances}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y divide-slate-50">
        {relances.map(info => {
          const montantTotal = info.rejets.reduce((s, r) => s + r.montant_fse, 0)
          const borderColor = info.urgence === 'critique'
            ? 'border-l-red-500'
            : info.urgence === 'elevee'
              ? 'border-l-amber-400'
              : 'border-l-slate-200'

          return (
            <div key={info.medecin.id} className={`flex items-center gap-4 px-5 py-3.5 border-l-4 ${borderColor}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{info.medecin.nom_cabinet}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    info.urgence === 'critique'
                      ? 'bg-red-100 text-red-700'
                      : info.urgence === 'elevee'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {info.prochaine}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                  <span>{info.rejets.length} rejet{info.rejets.length > 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span className="font-medium text-slate-700">{formatCurrency(montantTotal)}</span>
                  <span>•</span>
                  <span>{info.joursDepuis}j d'attente</span>
                  <span>•</span>
                  <span>{info.nbRelances} relance{info.nbRelances > 1 ? 's' : ''} envoyée{info.nbRelances > 1 ? 's' : ''}</span>
                </div>
              </div>

              {info.medecin.email ? (
                <button
                  onClick={() => sendRelance(info)}
                  disabled={sending === info.medecin.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                    info.urgence === 'critique'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-[#00C4CC]/10 text-[#00C4CC] hover:bg-[#00C4CC]/20'
                  }`}
                >
                  {sending === info.medecin.id
                    ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Envoi...</>
                    : <><Mail className="w-3.5 h-3.5" /> Relancer</>
                  }
                </button>
              ) : (
                <span className="text-xs text-slate-400 flex-shrink-0">Pas d'email</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-400">
          Relances automatiques : J+3 / J+7 / J+14 —{' '}
          <code className="font-mono bg-slate-200 px-1 rounded">node connectors/relances.mjs</code>
        </p>
      </div>
    </div>
  )
}
