import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Users, Star } from 'lucide-react'
import { supabase, RejetFSE, Agent } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { KpiCard } from '@/components/shared/KpiCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingPage } from '@/components/ui/spinner'
import { formatCurrency, formatDate, getInitiales } from '@/lib/utils'

interface AgentStats {
  agent: Agent
  nbRejets: number
  nbResolus: number
  montantRecupere: number
}

export function DashboardManageuse() {
  const [agentStats, setAgentStats] = useState<AgentStats[]>([])
  const [commission, setCommission] = useState({
    remunerationPropre: 0,
    commissionEquipe: 0,
    total: 0,
    montantPersonnel: 0,
    montantEquipe: 0,
  })
  const [filesGlobal, setFilesGlobal] = useState({ A: 0, B: 0, C: 0 })
  const [loading, setLoading] = useState(true)
  const { agent: manageuse } = useAuth()

  const historiqueData = [
    { mois: 'Jan', propre: 420, equipe: 180 },
    { mois: 'Fév', propre: 380, equipe: 210 },
    { mois: 'Mar', propre: 510, equipe: 195 },
    { mois: 'Avr', propre: 470, equipe: 230 },
    { mois: 'Mai', propre: 560, equipe: 215 },
    { mois: 'Jun', propre: 490, equipe: 245 },
  ]

  useEffect(() => {
    fetchAll()
  }, [manageuse])

  async function fetchAll() {
    if (!manageuse) return
    setLoading(true)

    const [agentsRes, rejetsRes] = await Promise.all([
      supabase.from('agents').select('*').eq('role', 'agent').eq('actif', true),
      supabase.from('rejets_fse').select('*').in('statut', ['résolu', 'retransmis']),
    ])

    const agents = agentsRes.data || []
    const rejets = rejetsRes.data || []

    // Rejets de la manageuse elle-même
    const rejetsMng = rejets.filter(r => r.agent_id === manageuse.id)
    const montantMng = rejetsMng.reduce((s, r) => s + (r.montant_recupere || 0), 0)

    // Rejets des agents (HORS manageuse)
    const rejetsAgents = rejets.filter(r => r.agent_id !== manageuse.id)
    const montantAgents = rejetsAgents.reduce((s, r) => s + (r.montant_recupere || 0), 0)

    // Commission formula:
    // remuneration_propre = montant_facture_manageuse × 50%
    // commission_equipe = montant_facture_agents (HORS manageuse) × 5%
    const remPropre = montantMng * 0.5
    const commEquipe = montantAgents * 0.05

    setCommission({
      remunerationPropre: remPropre,
      commissionEquipe: commEquipe,
      total: remPropre + commEquipe,
      montantPersonnel: montantMng,
      montantEquipe: montantAgents,
    })

    // Agent stats
    const stats: AgentStats[] = agents.map(ag => {
      const agRejets = rejets.filter(r => r.agent_id === ag.id)
      return {
        agent: ag,
        nbRejets: agRejets.length,
        nbResolus: agRejets.filter(r => r.statut === 'résolu').length,
        montantRecupere: agRejets.reduce((s, r) => s + (r.montant_recupere || 0), 0),
      }
    })
    setAgentStats(stats)

    // File counts
    const { data: allRejets } = await supabase
      .from('rejets_fse')
      .select('voie_traitement, statut, famille_rejet, fichier_valide')
      .in('statut', ['en_attente', 'en_cours'])

    const all = allRejets || []
    setFilesGlobal({
      A: all.filter(r => r.voie_traitement === 'auto' && !r.fichier_valide && r.famille_rejet !== 'cotation').length,
      B: all.filter(r => r.voie_traitement === 'agent' || (!r.voie_traitement && r.famille_rejet !== 'cotation') || r.famille_rejet === 'cotation').length,
      C: all.filter(r => r.voie_traitement === 'medecin' || r.statut === 'escalade_medecin').length,
    })

    setLoading(false)
  }

  if (loading) return (
    <AppLayout title="Mon tableau de bord">
      <LoadingPage />
    </AppLayout>
  )

  return (
    <AppLayout
      title="Tableau de bord"
      subtitle={`${manageuse?.prenom} ${manageuse?.nom} — Manageuse`}
    >
      {/* Commission card */}
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: '#0D1B2A' }}>
        <div className="flex items-center gap-2 mb-5">
          <Star className="w-5 h-5 text-[#00C4CC]" />
          <h2 className="text-white font-semibold text-base">Mes commissions — Juin 2026</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-white/60 text-xs mb-1">Rémunération propre</p>
            <p className="text-white text-xl font-bold">{formatCurrency(commission.remunerationPropre)}</p>
            <p className="text-white/40 text-xs mt-1">
              {formatCurrency(commission.montantPersonnel)} × 50%
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-white/60 text-xs mb-1">Commission équipe</p>
            <p className="text-white text-xl font-bold">{formatCurrency(commission.commissionEquipe)}</p>
            <p className="text-white/40 text-xs mt-1">
              {formatCurrency(commission.montantEquipe)} × 5%
            </p>
          </div>
          <div className="rounded-xl p-4 border border-[#00C4CC]/30" style={{ backgroundColor: 'rgba(0,196,204,0.1)' }}>
            <p className="text-[#00C4CC]/80 text-xs mb-1">Total estimé</p>
            <p className="text-[#00C4CC] text-2xl font-bold">{formatCurrency(commission.total)}</p>
            <p className="text-white/40 text-xs mt-1">Avant validation</p>
          </div>
        </div>
        <div className="p-3 bg-white/5 rounded-xl text-xs text-white/50">
          ⚠️ La commission équipe est calculée sur les montants récupérés par les agents uniquement
          (vos propres rejets sont exclus du calcul des 5%).
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          title="File A — Validation auto"
          value={filesGlobal.A}
          subtitle="Rejets à valider"
          icon={<TrendingUp className="w-5 h-5" />}
          variant="teal"
        />
        <KpiCard
          title="File B — Intervention"
          value={filesGlobal.B}
          subtitle="Rejets en traitement"
          icon={<Users className="w-5 h-5" />}
        />
        <KpiCard
          title="File C — Escalade"
          value={filesGlobal.C}
          subtitle="En attente médecin"
          icon={<Users className="w-5 h-5" />}
          variant="dark"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Équipe */}
        <Card>
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Performance de l'équipe</CardTitle>
              <Badge variant="default">{agentStats.length} agents</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {agentStats.map(({ agent, nbRejets, nbResolus, montantRecupere }) => (
                <div key={agent.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: '#0D1B2A' }}>
                    {getInitiales(agent.nom, agent.prenom)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{agent.prenom} {agent.nom}</p>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: '#00C4CC',
                          width: `${nbRejets > 0 ? (nbResolus / nbRejets) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-slate-900">{nbRejets} rejets</p>
                    <p className="text-xs text-emerald-600">{formatCurrency(montantRecupere)}</p>
                  </div>
                </div>
              ))}
              {agentStats.length === 0 && (
                <div className="px-6 py-8 text-center text-slate-500 text-sm">
                  Aucun agent dans l'équipe
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Historique commissions */}
        <Card>
          <CardHeader className="p-6 pb-4">
            <CardTitle>Historique commissions — 6 mois</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={historiqueData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={v => `${v}€`} />
                <Tooltip formatter={(v) => [`${v}€`]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="propre" name="Propre (50%)" fill="#0D1B2A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="equipe" name="Équipe (5%)" fill="#00C4CC" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
