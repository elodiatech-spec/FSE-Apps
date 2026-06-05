import { useEffect, useState, useCallback } from 'react'
import { Calculator, Receipt, Mail, Check, Send } from 'lucide-react'
import { supabase, Facturation, Medecin, RejetFSE } from '@/lib/supabase'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingPage } from '@/components/ui/spinner'
import { formatCurrency, formatPeriode, calculerZenFSE, calculerLibertyFSE, calculerPassRecup } from '@/lib/utils'
import { sendEmailReleve } from '@/lib/emailService'
import { useToast } from '@/components/ui/toast'
import { ExportButton } from '@/components/shared/ExportButton'
import { exportFacturationExcel, exportFacturationCsv } from '@/lib/exportData'

export function FacturationPage() {
  const [factures, setFactures] = useState<Facturation[]>([])
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  // Simulator state
  const [simOffre, setSimOffre] = useState<'zen_fse' | 'liberty_fse' | 'pass_recup'>('zen_fse')
  const [simNbRejets, setSimNbRejets] = useState(40)
  const [simMontant, setSimMontant] = useState(5000)
  const [simTranche, setSimTranche] = useState(15000)

  async function handleSendReleve(facture: Facturation) {
    const med = medecins.find(m => m.id === facture.medecin_id)
    if (!med) { toast('Medecin introuvable', 'error'); return }
    if (!med.email) { toast('Email du medecin non renseigne', 'error'); return }

    setSendingEmail(facture.id)
    const { data: rejets } = await supabase
      .from('rejets_fse').select('*')
      .eq('medecin_id', facture.medecin_id)
      .gte('created_at', facture.periode + '-01')
      .lt('created_at', facture.periode + '-32')

    const ok = await sendEmailReleve(med, facture, (rejets as RejetFSE[]) || [])
    setSendingEmail(null)
    if (ok) {
      setSentEmails(prev => new Set([...prev, facture.id]))
      toast('Releve envoye a ' + med.email, 'success')
    } else {
      toast('Erreur envoi — verifiez VITE_RESEND_API_KEY dans .env', 'error')
    }
  }

  async function handleSendAll() {
    const currentPeriode = new Date().toISOString().slice(0, 7)
    const factureMois = factures.filter(f => f.periode === currentPeriode)
    let ok = 0
    for (const f of factureMois) {
      const med = medecins.find(m => m.id === f.medecin_id)
      if (!med?.email) continue
      const { data: rejets } = await supabase.from('rejets_fse').select('*').eq('medecin_id', f.medecin_id)
      const sent = await sendEmailReleve(med, f, (rejets as RejetFSE[]) || [])
      if (sent) { ok++; setSentEmails(prev => new Set([...prev, f.id])) }
    }
    toast(`${ok}/${factureMois.length} releves envoyes`, ok > 0 ? 'success' : 'error')
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [facRes, medRes] = await Promise.all([
      supabase.from('facturation').select('*, medecins(nom_cabinet, offre)').order('periode', { ascending: false }),
      supabase.from('medecins').select('*').eq('actif', true),
    ])
    setFactures(facRes.data || [])
    setMedecins(medRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const simResult = (() => {
    if (simOffre === 'zen_fse') return calculerZenFSE(simNbRejets)
    if (simOffre === 'liberty_fse') return calculerLibertyFSE(simMontant)
    return calculerPassRecup(simMontant, simTranche)
  })()

  const totalCA = factures.reduce((s, f) => s + f.total_facture, 0)
  const totalPaye = factures.filter(f => f.statut_paiement === 'payé').reduce((s, f) => s + f.total_facture, 0)
  const totalAttente = factures.filter(f => f.statut_paiement === 'en_attente').reduce((s, f) => s + f.total_facture, 0)

  return (
    <AppLayout
      title="Facturation"
      subtitle="Gestion des factures et calculs des offres"
      actions={
        <div className="flex items-center gap-2">
          <ExportButton
            disabled={factures.length === 0}
            onExcel={() => exportFacturationExcel(factures, medecins)}
            onCsv={() => exportFacturationCsv(factures, medecins)}
          />
          <Button variant="default" onClick={handleSendAll}>
            <Send className="w-4 h-4" />
            Envoyer releves du mois
          </Button>
        </div>
      }
    >
      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0D1B2A] rounded-2xl p-5 text-white">
          <p className="text-white/60 text-sm">CA total</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalCA)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <p className="text-slate-500 text-sm">Encaissé</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPaye)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-5">
          <p className="text-slate-500 text-sm">En attente</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalAttente)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Simulator */}
        <Card className="lg:col-span-1">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#00C4CC]" />
              <CardTitle>Simulateur de facturation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Offre selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Offre</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                {(['zen_fse', 'liberty_fse', 'pass_recup'] as const).map(o => (
                  <button
                    key={o}
                    onClick={() => setSimOffre(o)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                      simOffre === o ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {o === 'zen_fse' ? 'ZEN' : o === 'liberty_fse' ? 'LIBERTY' : "PASS RÉCUP'"}
                  </button>
                ))}
              </div>
            </div>

            {simOffre === 'zen_fse' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Nombre de rejets</span>
                  <span className="font-semibold text-slate-900">{simNbRejets}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={simNbRejets}
                  onChange={e => setSimNbRejets(parseInt(e.target.value))}
                  className="w-full accent-[#00C4CC]"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>0</span>
                  <span>100</span>
                  <span>200</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                  <p>Base : 99€ (40 rejets inclus)</p>
                  {simNbRejets > 40 && (
                    <p className="mt-0.5 text-[#00C4CC] font-medium">
                      + {Math.ceil((simNbRejets - 40) / 40)} tranche(s) × 40€
                    </p>
                  )}
                </div>
              </div>
            )}

            {(simOffre === 'liberty_fse' || simOffre === 'pass_recup') && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Montant récupéré</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(simMontant)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50000}
                  step={500}
                  value={simMontant}
                  onChange={e => setSimMontant(parseInt(e.target.value))}
                  className="w-full accent-[#00C4CC]"
                />
              </div>
            )}

            {simOffre === 'pass_recup' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tranche estimée</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(simTranche)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50000}
                  step={1000}
                  value={simTranche}
                  onChange={e => setSimTranche(parseInt(e.target.value))}
                  className="w-full accent-[#00C4CC]"
                />
                <p className="text-xs text-slate-500">
                  Taux applicable : {simTranche < 20000 ? '10%' : '12%'}
                </p>
              </div>
            )}

            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: '#0D1B2A' }}>
              <p className="text-white/60 text-xs mb-1">Montant calculé</p>
              <p className="text-[#00C4CC] text-3xl font-bold">{formatCurrency(simResult)}</p>
              {simOffre === 'liberty_fse' && (
                <p className="text-white/40 text-xs mt-1">12% du montant récupéré</p>
              )}
              {simOffre === 'pass_recup' && (
                <p className="text-white/40 text-xs mt-1">{simTranche < 20000 ? '10%' : '12%'} du montant récupéré</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Billing table */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#00C4CC]" />
                <CardTitle>Factures</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? <div className="p-6"><LoadingPage /></div> : (
              factures.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Receipt className="w-10 h-10 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Aucune facture</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Période</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Cabinet</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Rejets</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Récupéré</th>
                        <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Total</th>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {factures.map(f => {
                        const med = f.medecins as { nom_cabinet?: string; offre?: string } | undefined
                        return (
                          <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-6 py-3">
                              <p className="text-sm font-semibold text-slate-900">{formatPeriode(f.periode)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-800 truncate max-w-[140px]">{med?.nom_cabinet || '—'}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-slate-700">{f.nb_rejets_traites}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-emerald-600">{formatCurrency(f.montant_recupere)}</p>
                            </td>
                            <td className="px-6 py-3 text-right">
                              <p className="text-sm font-bold text-slate-900">{formatCurrency(f.total_facture)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                f.statut_paiement === 'payé' ? 'bg-emerald-100 text-emerald-700' :
                                f.statut_paiement === 'en_retard' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {f.statut_paiement === 'payé' ? 'Payé' : f.statut_paiement === 'en_retard' ? 'En retard' : 'En attente'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleSendReleve(f)}
                                disabled={sendingEmail === f.id}
                                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
                                  sentEmails.has(f.id)
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-[#00C4CC]/10 hover:text-[#00C4CC]'
                                }`}
                              >
                                {sentEmails.has(f.id)
                                  ? <><Check className="w-3 h-3" /> Envoye</>
                                  : sendingEmail === f.id
                                    ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Envoi...</>
                                    : <><Mail className="w-3 h-3" /> Envoyer</>
                                }
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Offres detail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'ZEN FSE',
            color: 'bg-blue-50 border-blue-200',
            titleColor: 'text-blue-800',
            lines: [
              '99€/mois (40 rejets inclus)',
              '+40€ par tranche de 40 rejets',
              'Ex: 81-120 rejets → 179€',
              'Abonnement mensuel fixe',
            ]
          },
          {
            title: 'LIBERTY FSE',
            color: 'bg-violet-50 border-violet-200',
            titleColor: 'text-violet-800',
            lines: [
              'Frais dossier : 50€ (unique)',
              'Commission : 12% récupéré',
              'Déclenché sur fichier validé',
              'Sans engagement',
            ]
          },
          {
            title: "PASS RÉCUP'",
            color: 'bg-amber-50 border-amber-200',
            titleColor: 'text-amber-800',
            lines: [
              'Frais dossier : 99€ (unique)',
              '< 20 000€ estimé → 10%',
              '≥ 20 000€ estimé → 12%',
              'Audit initial obligatoire',
            ]
          }
        ].map(({ title, color, titleColor, lines }) => (
          <div key={title} className={`rounded-xl border p-4 ${color}`}>
            <p className={`text-sm font-bold mb-3 ${titleColor}`}>{title}</p>
            <ul className="space-y-1.5">
              {lines.map((l, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                  <span className="text-[#00C4CC] mt-0.5">•</span>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}
