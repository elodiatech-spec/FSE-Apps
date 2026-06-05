import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { supabase, RejetFSE } from '@/lib/supabase'
import { Agent } from '@/lib/supabase'
import { Drawer } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/ui/spinner'
import { StatutBadge, FamilleBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate, getInitiales } from '@/lib/utils'

interface AgentAvecStats extends Agent {
  nbRejets: number
  nbResolus: number
  montantRecupere: number
  tauxResolution: number
}

interface Props {
  agent: AgentAvecStats
  onClose: () => void
}

const COLORS_FAMILLE = ['#00C4CC', '#F59E0B', '#0D1B2A', '#EF4444', '#8B5CF6']
const COLORS_STATUT = { resolu: '#10B981', retransmis: '#00C4CC', en_cours: '#F59E0B', en_attente: '#94a3b8', escalade_medecin: '#EF4444' }

export function AgentStats({ agent, onClose }: Props) {
  const [rejets, setRejets] = useState<RejetFSE[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('rejets_fse')
      .select('*')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRejets(data || [])
        setLoading(false)
      })
  }, [agent.id])

  // Données graphique par famille
  const parFamille = ['droits_adri', 'cotation', 'parametrage', 'caisse', 'amc_dre'].map(f => ({
    name: f.replace(/_/g, ' '),
    value: rejets.filter(r => r.famille_rejet === f).length
  })).filter(f => f.value > 0)

  // Données par mois (6 derniers)
  const parMois: Record<string, { mois: string; traites: number; resolus: number }> = {}
  rejets.forEach(r => {
    const mois = r.created_at?.slice(0, 7) || ''
    if (!parMois[mois]) parMois[mois] = { mois, traites: 0, resolus: 0 }
    parMois[mois].traites++
    if (r.statut === 'résolu' || r.statut === 'retransmis') parMois[mois].resolus++
  })
  const chartMois = Object.values(parMois)
    .sort((a, b) => a.mois.localeCompare(b.mois))
    .slice(-6)
    .map(m => ({ ...m, mois: m.mois.slice(5) }))

  const roleLabels = { gerant: 'Gérant', manageuse: 'Manageuse', agent: 'Agent' }

  return (
    <Drawer open onClose={onClose} title={`Stats — ${agent.prenom} ${agent.nom}`} width="560px">
      <div className="p-6 space-y-6">
        {/* Header agent */}
        <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: '#0D1B2A' }}>
          <div className="w-12 h-12 rounded-xl bg-[#00C4CC] flex items-center justify-center text-white font-bold text-base flex-shrink-0">
            {getInitiales(agent.nom, agent.prenom)}
          </div>
          <div>
            <p className="text-white font-semibold">{agent.prenom} {agent.nom}</p>
            <p className="text-white/50 text-xs">{agent.email}</p>
            <p className="text-[#00C4CC] text-xs font-medium mt-0.5">{roleLabels[agent.role]}</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
            <p className="text-2xl font-bold text-slate-900">{agent.nbRejets}</p>
            <p className="text-xs text-slate-500 mt-0.5">Rejets traités</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
            <p className="text-2xl font-bold text-emerald-700">{agent.tauxResolution}%</p>
            <p className="text-xs text-emerald-600 mt-0.5">Taux résolution</p>
          </div>
          <div className="rounded-xl p-3 text-center border border-[#00C4CC]/20" style={{ backgroundColor: 'rgba(0,196,204,0.05)' }}>
            <p className="text-lg font-bold text-[#00C4CC]">{formatCurrency(agent.montantRecupere)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Récupéré</p>
          </div>
        </div>

        {loading ? <LoadingPage /> : (
          <>
            {/* Graphique mensuel */}
            {chartMois.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-3">Activité mensuelle</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartMois} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip />
                    <Bar dataKey="traites" name="Traités" fill="#0D1B2A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resolus" name="Résolus" fill="#00C4CC" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Répartition par famille */}
            {parFamille.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-3">Répartition par famille</p>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={parFamille}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}
                      labelLine={false}
                    >
                      {parFamille.map((_, i) => (
                        <Cell key={i} fill={COLORS_FAMILLE[i % COLORS_FAMILLE.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Derniers rejets */}
            <div>
              <p className="text-sm font-semibold text-slate-900 mb-3">
                Derniers rejets traités
              </p>
              <div className="space-y-2">
                {rejets.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-semibold text-slate-800">{r.id_fse}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.date_rejet)}</p>
                    </div>
                    <FamilleBadge famille={r.famille_rejet} />
                    <StatutBadge statut={r.statut} />
                    <p className="text-sm font-semibold text-slate-800 flex-shrink-0">
                      {formatCurrency(r.montant_fse)}
                    </p>
                  </div>
                ))}
                {rejets.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    Aucun rejet traité pour le moment
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
