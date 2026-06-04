import { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BadgeDollarSign, TrendingUp, Users, Award } from 'lucide-react'
import { supabase, CommissionManageuse, Agent } from '@/lib/supabase'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingPage } from '@/components/ui/spinner'
import { formatCurrency, formatPeriode, getInitiales } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

export function CommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionManageuse[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const { agent: currentAgent } = useAuth()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [comRes, agRes] = await Promise.all([
      supabase.from('commissions_manageuse').select('*, agents(nom,prenom,role)').order('periode', { ascending: false }),
      supabase.from('agents').select('*').eq('actif', true),
    ])
    setCommissions(comRes.data || [])
    setAgents(agRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const last = commissions[0]

  const chartData = commissions.slice(0, 6).reverse().map(c => {
    const remPropre = c.montant_facture_manageuse * 0.5
    const commEquipe = c.montant_facture_agents * 0.05
    return {
      mois: c.periode.slice(0, 7),
      propre: Math.round(remPropre),
      equipe: Math.round(commEquipe),
      total: Math.round(remPropre + commEquipe),
    }
  })

  return (
    <AppLayout
      title="Commissions"
      subtitle="Détail des rémunérations de la manageuse"
    >
      {loading ? <LoadingPage /> : (
        <>
          {/* Main commission card */}
          <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#0D1B2A' }}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#00C4CC]/20">
                <Award className="w-5 h-5 text-[#00C4CC]" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Commission mensuelle</h2>
                {last && <p className="text-white/50 text-sm">{formatPeriode(last.periode)}</p>}
              </div>
              {last && (
                <span className={`ml-auto text-xs font-medium px-3 py-1.5 rounded-full ${
                  last.statut_paiement === 'payé' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {last.statut_paiement === 'payé' ? '✓ Payé' : '⏳ En attente'}
                </span>
              )}
            </div>

            {last ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div className="bg-white/8 border border-white/10 rounded-xl p-4">
                    <p className="text-white/50 text-xs mb-2">Rémunération propre</p>
                    <p className="text-white text-xl font-bold">{formatCurrency(last.montant_facture_manageuse * 0.5)}</p>
                    <p className="text-white/30 text-xs mt-1">{formatCurrency(last.montant_facture_manageuse)} récupéré × 50%</p>
                    <p className="text-white/20 text-xs mt-0.5">{last.nb_rejets_manageuse} rejets traités</p>
                  </div>

                  <div className="bg-white/8 border border-white/10 rounded-xl p-4">
                    <p className="text-white/50 text-xs mb-2">Commission équipe</p>
                    <p className="text-white text-xl font-bold">{formatCurrency(last.montant_facture_agents * 0.05)}</p>
                    <p className="text-white/30 text-xs mt-1">{formatCurrency(last.montant_facture_agents)} équipe × 5%</p>
                    <p className="text-white/20 text-xs mt-0.5">Hors rejets manageuse</p>
                  </div>

                  <div className="border border-[#00C4CC]/30 rounded-xl p-4" style={{ backgroundColor: 'rgba(0,196,204,0.08)' }}>
                    <p className="text-[#00C4CC]/70 text-xs mb-2">TOTAL</p>
                    <p className="text-[#00C4CC] text-2xl font-bold">
                      {formatCurrency(last.montant_facture_manageuse * 0.5 + last.montant_facture_agents * 0.05)}
                    </p>
                    <p className="text-white/30 text-xs mt-1">Propre + Équipe</p>
                  </div>
                </div>

                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white/40">
                  <span className="text-[#00C4CC]/70 font-semibold">Formule : </span>
                  (Montant manageuse × 50%) + (Montant agents excl. manageuse × 5%)
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-white/40">
                <p>Aucune commission enregistrée</p>
              </div>
            )}
          </div>

          {/* Chart + History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader className="p-6 pb-4">
                <CardTitle>Évolution — 6 derniers mois</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                    Pas encore de données
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}€`} />
                      <Tooltip formatter={(v) => [`${v}€`]} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="propre" name="Propre (50%)" fill="#0D1B2A" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="equipe" name="Équipe (5%)" fill="#00C4CC" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-6 pb-4">
                <CardTitle>Historique des commissions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {commissions.slice(0, 6).map(c => {
                    const total = c.montant_facture_manageuse * 0.5 + c.montant_facture_agents * 0.05
                    return (
                      <div key={c.id} className="flex items-center justify-between px-6 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatPeriode(c.periode)}</p>
                          <p className="text-xs text-slate-500">{c.nb_rejets_manageuse} rejets personnels</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">{formatCurrency(total)}</p>
                          <span className={`text-xs font-medium ${
                            c.statut_paiement === 'payé' ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {c.statut_paiement === 'payé' ? '✓ Payé' : '⏳ En attente'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  {commissions.length === 0 && (
                    <div className="px-6 py-10 text-center text-sm text-slate-500">
                      Aucun historique disponible
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team agents */}
          {currentAgent?.role !== 'agent' && (
            <Card>
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#00C4CC]" />
                  <CardTitle>Équipe ({agents.filter(a => a.role === 'agent').length} agents)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {agents.filter(a => a.role === 'agent').map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-6 py-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: '#0D1B2A' }}>
                        {getInitiales(a.nom, a.prenom)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{a.prenom} {a.nom}</p>
                        <p className="text-xs text-slate-500">{a.email}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium">
                        {a.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  ))}
                  {agents.filter(a => a.role === 'agent').length === 0 && (
                    <div className="px-6 py-10 text-center text-sm text-slate-500">
                      Aucun agent dans l'équipe
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </AppLayout>
  )
}
