import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Edit2 } from 'lucide-react'
import { supabase, Medecin, RejetFSE, Facturation } from '@/lib/supabase'
import { Drawer } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatutBadge, FamilleBadge, LogicielBadge, OffreBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate, daysBetween } from '@/lib/utils'
import { LoadingPage } from '@/components/ui/spinner'

interface Props {
  medecin: Medecin
  onClose: () => void
  onUpdate: () => void
}

type Tab = 'general' | 'rejets' | 'facturation' | 'cpe'

export function MedecinFiche({ medecin, onClose, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>('general')
  const [rejets, setRejets] = useState<RejetFSE[]>([])
  const [factures, setFactures] = useState<Facturation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tab === 'rejets') fetchRejets()
    if (tab === 'facturation') fetchFactures()
  }, [tab])

  async function fetchRejets() {
    setLoading(true)
    const { data } = await supabase.from('rejets_fse').select('*').eq('medecin_id', medecin.id).order('date_rejet', { ascending: false }).limit(20)
    setRejets(data || [])
    setLoading(false)
  }

  async function fetchFactures() {
    setLoading(true)
    const { data } = await supabase.from('facturation').select('*').eq('medecin_id', medecin.id).order('periode', { ascending: false })
    setFactures(data || [])
    setLoading(false)
  }

  const cpe = (() => {
    if (!medecin.date_expiration_cpe) return { color: 'text-slate-400', label: 'En attente', urgent: false }
    const days = daysBetween(medecin.date_expiration_cpe)
    if (days < 0) return { color: 'text-red-600', label: 'Expirée', urgent: true }
    if (days < 90) return { color: 'text-amber-600', label: `Expire dans ${days} jours`, urgent: true }
    return { color: 'text-emerald-600', label: `Valide jusqu'au ${formatDate(medecin.date_expiration_cpe)}`, urgent: false }
  })()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'Général' },
    { key: 'rejets', label: 'Rejets' },
    { key: 'facturation', label: 'Facturation' },
    { key: 'cpe', label: 'CPE/eCPE' },
  ]

  return (
    <Drawer open onClose={onClose} title={medecin.nom_cabinet} width="560px">
      {/* Tabs */}
      <div className="flex border-b border-slate-100 px-6 sticky top-[72px] bg-white z-10">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'text-[#00C4CC] border-[#00C4CC]'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'general' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Code ElodiaTech</p>
                <p className="text-sm font-mono font-semibold text-slate-900">{medecin.code_elodiatech}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Médecin</p>
                <p className="text-sm font-medium text-slate-900">{medecin.nom_medecin}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Logiciel</p>
                <LogicielBadge logiciel={medecin.logiciel} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Offre</p>
                <OffreBadge offre={medecin.offre} />
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Date souscription</p>
                <p className="text-sm text-slate-900">{formatDate(medecin.date_souscription)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Statut</p>
                <span className={`text-sm font-semibold ${medecin.actif ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {medecin.actif ? '● Actif' : '○ Inactif'}
                </span>
              </div>
            </div>

            {medecin.email && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Email</p>
                <p className="text-sm text-slate-900">{medecin.email}</p>
              </div>
            )}

            {medecin.adresse_mssante && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Adresse MSSanté</p>
                <p className="text-sm font-mono text-slate-900">{medecin.adresse_mssante}</p>
              </div>
            )}

            {medecin.offre === 'zen_fse' && medecin.quota_zen != null && (
              <div className="p-3 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-600 font-medium">Quota ZEN FSE</p>
                <p className="text-sm text-blue-900 mt-0.5">{medecin.quota_zen} rejets / mois</p>
              </div>
            )}
          </div>
        )}

        {tab === 'rejets' && (
          loading ? <LoadingPage /> : (
            <div className="space-y-2">
              {rejets.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Aucun rejet pour ce médecin</p>
              ) : rejets.map(r => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-mono font-semibold text-slate-900">{r.id_fse}</p>
                      <p className="text-xs text-slate-500">{r.code_erreur} — {formatDate(r.date_rejet)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(r.montant_fse)}</p>
                      {r.montant_recupere != null && (
                        <p className="text-xs text-emerald-600">↳ {formatCurrency(r.montant_recupere)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <FamilleBadge famille={r.famille_rejet} />
                    <StatutBadge statut={r.statut} />
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'facturation' && (
          loading ? <LoadingPage /> : (
            <div className="space-y-2">
              {factures.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">Aucune facture</p>
              ) : factures.map(f => (
                <div key={f.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-900">{f.periode}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      f.statut_paiement === 'payé' ? 'bg-emerald-100 text-emerald-700' :
                      f.statut_paiement === 'en_retard' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {f.statut_paiement === 'payé' ? 'Payé' : f.statut_paiement === 'en_retard' ? 'En retard' : 'En attente'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Rejets traités : </span>
                      <span className="font-medium text-slate-700">{f.nb_rejets_traites}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Montant récupéré : </span>
                      <span className="font-medium text-emerald-700">{formatCurrency(f.montant_recupere)}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs text-slate-500">Total facture</span>
                    <span className="text-base font-bold text-slate-900">{formatCurrency(f.total_facture)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'cpe' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border ${cpe.urgent ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-2">
                {cpe.urgent
                  ? <AlertTriangle className="w-5 h-5 text-amber-500" />
                  : <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                }
                <div>
                  <p className="text-sm font-semibold text-slate-900">Statut CPE/eCPE</p>
                  <p className={`text-sm ${cpe.color}`}>{cpe.label}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Date d'expiration</p>
                <p className="text-sm font-medium text-slate-900">
                  {medecin.date_expiration_cpe ? formatDate(medecin.date_expiration_cpe) : 'Non renseignée'}
                </p>
              </div>
              {medecin.statut_cpe && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Statut</p>
                  <span className={`text-sm font-medium capitalize ${
                    medecin.statut_cpe === 'actif' ? 'text-emerald-600' :
                    medecin.statut_cpe === 'expirant' ? 'text-amber-600' :
                    medecin.statut_cpe === 'expiré' ? 'text-red-600' :
                    'text-slate-500'
                  }`}>
                    {medecin.statut_cpe.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <p className="font-semibold mb-1">Renouvellement CPE</p>
              <p>Délai de traitement ANS : 4 à 8 semaines.</p>
              <p className="mt-1">Contacter le médecin 90 jours avant expiration.</p>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
