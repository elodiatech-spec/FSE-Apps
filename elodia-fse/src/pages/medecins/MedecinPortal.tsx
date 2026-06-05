import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileX2, CheckCircle2, AlertTriangle, Clock,
  Download, FileText, Receipt, Phone, Mail,
  TrendingUp, Euro, RefreshCw
} from 'lucide-react'
import { supabase, Medecin, RejetFSE, Facturation } from '@/lib/supabase'
import { StatutBadge, FamilleBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { formatCurrency, formatDate, formatPeriode, daysBetween } from '@/lib/utils'
import { generateReleve, generateFacture } from '@/lib/pdfGenerator'

export function MedecinPortal() {
  const { id } = useParams<{ id: string }>()
  const [medecin, setMedecin] = useState<Medecin | null>(null)
  const [rejets, setRejets] = useState<RejetFSE[]>([])
  const [factures, setFactures] = useState<Facturation[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<'suivi' | 'action' | 'documents'>('suivi')
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null)

  useEffect(() => {
    if (id) fetchAll(id)
  }, [id])

  async function fetchAll(medecinId: string) {
    setLoading(true)
    const { data: med } = await supabase
      .from('medecins')
      .select('*')
      .eq('id', medecinId)
      .single()

    if (!med) { setNotFound(true); setLoading(false); return }
    setMedecin(med)

    const [rejetsRes, facturesRes] = await Promise.all([
      supabase.from('rejets_fse').select('*').eq('medecin_id', medecinId).order('date_rejet', { ascending: false }).limit(50),
      supabase.from('facturation').select('*').eq('medecin_id', medecinId).order('periode', { ascending: false }).limit(12),
    ])

    setRejets(rejetsRes.data || [])
    setFactures(facturesRes.data || [])
    setLoading(false)
  }

  async function handleDownloadReleve(periode: string) {
    if (!medecin) return
    setGeneratingPdf('releve-' + periode)
    const rejetsFiltered = rejets.filter(r => r.created_at?.startsWith(periode.slice(0, 7)))
    await generateReleve(medecin, rejetsFiltered, periode)
    setGeneratingPdf(null)
  }

  async function handleDownloadFacture(facture: Facturation) {
    if (!medecin) return
    setGeneratingPdf('facture-' + facture.id)
    await generateFacture(medecin, facture)
    setGeneratingPdf(null)
  }

  const rejetsEnAttente = rejets.filter(r => r.voie_traitement === 'medecin' || r.statut === 'escalade_medecin')
  const rejetsResolus = rejets.filter(r => r.statut === 'résolu' || r.statut === 'retransmis')
  const montantTotal = rejets.reduce((s, r) => s + r.montant_fse, 0)
  const montantRecupere = rejets.reduce((s, r) => s + (r.montant_recupere || 0), 0)

  const currentPeriode = new Date().toISOString().slice(0, 7)
  const rejetsActuel = rejets.filter(r => r.created_at?.startsWith(currentPeriode))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f1f5f9' }}>
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-slate-500 text-sm">Chargement de votre espace...</p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f1f5f9' }}>
        <div className="text-center">
          <FileX2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-700">Lien invalide</h1>
          <p className="text-slate-500 mt-2">Ce lien n'est pas valide ou a expire.</p>
          <p className="text-slate-400 text-sm mt-1">Contactez ElodiaTech pour obtenir un nouveau lien.</p>
        </div>
      </div>
    )
  }

  const cpeJours = medecin?.date_expiration_cpe ? daysBetween(medecin.date_expiration_cpe) : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0D1B2A' }} className="px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png"
              alt="ElodiaTech"
              className="h-9 object-contain"
            />
            <div className="h-8 w-px bg-white/20" />
            <div>
              <p className="text-white font-semibold text-base">{medecin?.nom_cabinet}</p>
              <p className="text-white/50 text-xs">{medecin?.nom_medecin}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-xs">
              Mise a jour le {new Date().toLocaleDateString('fr-FR')}
            </span>
            <button
              onClick={() => id && fetchAll(id)}
              className="p-2 text-white/40 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Alerte File C */}
        {rejetsEnAttente.length > 0 && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {rejetsEnAttente.length} action(s) requise(s) de votre part
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Des rejets necessitent votre intervention directe. Consultez l'onglet "Actions requises".
              </p>
            </div>
            <button
              onClick={() => setTab('action')}
              className="ml-auto text-xs font-semibold text-red-700 underline flex-shrink-0"
            >
              Voir
            </button>
          </div>
        )}

        {/* Alerte CPE */}
        {cpeJours !== null && cpeJours < 90 && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {cpeJours < 0 ? 'Votre carte CPE/eCPE est expiree' : `Votre carte CPE/eCPE expire dans ${cpeJours} jours`}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Contactez ElodiaTech pour le renouvellement (delai ANS : 4 a 8 semaines).
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Rejets traites', value: String(rejets.length), icon: <FileX2 className="w-4 h-4" />, color: 'text-slate-700' },
            { label: 'Resolus', value: String(rejetsResolus.length), icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600' },
            { label: 'Montant FSE', value: formatCurrency(montantTotal), icon: <Euro className="w-4 h-4" />, color: 'text-slate-700' },
            { label: 'Recupere', value: formatCurrency(montantRecupere), icon: <TrendingUp className="w-4 h-4" />, color: 'text-[#00C4CC]' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                {k.icon}
                <span className="text-xs">{k.label}</span>
              </div>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-5">
          {[
            { key: 'suivi' as const, label: 'Suivi des rejets', count: rejetsActuel.length },
            { key: 'action' as const, label: 'Actions requises', count: rejetsEnAttente.length, alert: rejetsEnAttente.length > 0 },
            { key: 'documents' as const, label: 'Releves et factures', count: factures.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'text-[#00C4CC] border-[#00C4CC]' : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  t.alert ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Suivi */}
        {tab === 'suivi' && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            {rejets.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-3" />
                <p className="text-slate-500 font-medium">Aucun rejet en cours</p>
                <p className="text-slate-400 text-sm mt-1">Votre facturation est a jour</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">FSE</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Date</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Motif</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Montant</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rejets.slice(0, 20).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="text-xs font-mono font-semibold text-slate-800">{r.id_fse}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{formatDate(r.date_rejet)}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-700 max-w-[200px] truncate">{r.libelle_erreur}</p>
                          <FamilleBadge famille={r.famille_rejet} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800">{formatCurrency(r.montant_fse)}</p>
                          {r.montant_recupere != null && (
                            <p className="text-xs text-emerald-600">Recupere : {formatCurrency(r.montant_recupere)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatutBadge statut={r.statut} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Actions requises */}
        {tab === 'action' && (
          <div className="space-y-3">
            {rejetsEnAttente.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucune action requise</p>
                <p className="text-slate-400 text-sm mt-1">ElodiaTech gere tout pour vous</p>
              </div>
            ) : rejetsEnAttente.map(r => (
              <div key={r.id} className="bg-white rounded-xl border-l-4 border-l-red-400 border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-mono font-bold text-slate-900">{r.id_fse}</p>
                      <FamilleBadge famille={r.famille_rejet} />
                    </div>
                    <p className="text-sm text-slate-700 mb-1">{r.libelle_erreur}</p>
                    <p className="text-xs text-slate-500">Rejet du {formatDate(r.date_rejet)}</p>

                    {r.ticket_correction && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-xs font-semibold text-blue-800 mb-1">Action a effectuer :</p>
                        <p className="text-xs text-blue-700">
                          {(r.ticket_correction as { diagnostic?: string }).diagnostic}
                        </p>
                        {(r.ticket_correction as { procedure?: string[] }).procedure && (
                          <ol className="mt-2 space-y-1">
                            {(r.ticket_correction as { procedure: string[] }).procedure.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-blue-600">
                                <span className="font-bold">{i + 1}.</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-slate-900">{formatCurrency(r.montant_fse)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">a regulariser</p>
                  </div>
                </div>
              </div>
            ))}

            {rejetsEnAttente.length > 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <p className="text-sm text-slate-600">
                  Pour toute question, contactez ElodiaTech :
                </p>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <a href="mailto:contact@elodiatech.com" className="flex items-center gap-1.5 text-sm text-[#00C4CC] hover:underline font-medium">
                    <Mail className="w-4 h-4" />
                    contact@elodiatech.com
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Documents */}
        {tab === 'documents' && (
          <div className="space-y-3">
            {factures.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Aucun document disponible</p>
                <p className="text-slate-400 text-sm mt-1">Les releves et factures apparaitront ici chaque mois</p>
              </div>
            ) : factures.map(f => {
              const periodeLabel = formatPeriode(f.periode)
              const idReleve = 'releve-' + f.periode
              const idFacture = 'facture-' + f.id
              return (
                <div key={f.id} className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{periodeLabel}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                        <span>{f.nb_rejets_traites} rejets traites</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-emerald-600 font-medium">{formatCurrency(f.montant_recupere)} recupere</span>
                        <span className="text-slate-300">|</span>
                        <span className="font-bold text-slate-800">Facture : {formatCurrency(f.total_facture)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      f.statut_paiement === 'payé' ? 'bg-emerald-100 text-emerald-700' :
                      f.statut_paiement === 'en_retard' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {f.statut_paiement === 'payé' ? 'Paye' : f.statut_paiement === 'en_retard' ? 'En retard' : 'En attente'}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={generatingPdf === idReleve}
                      onClick={() => handleDownloadReleve(f.periode)}
                      className="flex-1"
                    >
                      <FileText className="w-4 h-4" />
                      Releve de traitement
                    </Button>
                    <Button
                      size="sm"
                      variant="teal"
                      loading={generatingPdf === idFacture}
                      onClick={() => handleDownloadFacture(f)}
                      className="flex-1"
                    >
                      <Receipt className="w-4 h-4" />
                      Facture PDF
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Espace confidentiel ElodiaTech FSE — {medecin?.nom_cabinet}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Pour toute question : contact@elodiatech.com
          </p>
        </div>
      </div>
    </div>
  )
}
