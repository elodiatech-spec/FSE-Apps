import { useEffect, useState, useCallback } from 'react'
import { Plus, UserCheck, UserX, Edit2, BarChart2, Mail, Shield, Users } from 'lucide-react'
import { supabase, Agent } from '@/lib/supabase'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, getInitiales } from '@/lib/utils'
import { AgentForm } from './AgentForm'
import { AgentStats } from './AgentStats'

interface AgentAvecStats extends Agent {
  nbRejets: number
  nbResolus: number
  montantRecupere: number
  tauxResolution: number
}

const ROLE_CONFIG = {
  gerant: { label: 'Gérant', color: 'bg-[#0D1B2A] text-white', icon: <Shield className="w-3.5 h-3.5" /> },
  manageuse: { label: 'Manageuse', color: 'bg-violet-100 text-violet-700', icon: <Users className="w-3.5 h-3.5" /> },
  agent: { label: 'Agent', color: 'bg-slate-100 text-slate-700', icon: <UserCheck className="w-3.5 h-3.5" /> },
}

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentAvecStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAgent, setEditAgent] = useState<Agent | null>(null)
  const [statsAgent, setStatsAgent] = useState<AgentAvecStats | null>(null)
  const { toast } = useToast()

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    const { data: agentsData } = await supabase
      .from('agents').select('*').order('role').order('nom')

    if (!agentsData) { setLoading(false); return }

    // Charger les stats de chaque agent
    const agentsAvecStats: AgentAvecStats[] = await Promise.all(
      agentsData.map(async (ag) => {
        const { data: rejets } = await supabase
          .from('rejets_fse')
          .select('statut, montant_recupere')
          .eq('agent_id', ag.id)

        const nbRejets = rejets?.length || 0
        const nbResolus = rejets?.filter(r => r.statut === 'résolu' || r.statut === 'retransmis').length || 0
        const montantRecupere = rejets?.reduce((s, r) => s + (r.montant_recupere || 0), 0) || 0
        const tauxResolution = nbRejets > 0 ? Math.round((nbResolus / nbRejets) * 100) : 0

        return { ...ag, nbRejets, nbResolus, montantRecupere, tauxResolution }
      })
    )

    setAgents(agentsAvecStats)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAgents() }, [fetchAgents])

  async function toggleActif(agent: Agent) {
    const { error } = await supabase
      .from('agents')
      .update({ actif: !agent.actif })
      .eq('id', agent.id)

    if (error) {
      toast('Erreur lors de la mise à jour', 'error')
    } else {
      toast(agent.actif ? `${agent.prenom} désactivé` : `${agent.prenom} réactivé`, 'success')
      fetchAgents()
    }
  }

  const actifs = agents.filter(a => a.actif)
  const inactifs = agents.filter(a => !a.actif)

  const totalRejets = agents.reduce((s, a) => s + a.nbRejets, 0)
  const totalMontant = agents.reduce((s, a) => s + a.montantRecupere, 0)

  return (
    <AppLayout
      title="Équipe"
      subtitle={`${actifs.length} membre${actifs.length > 1 ? 's' : ''} actif${actifs.length > 1 ? 's' : ''}`}
      actions={
        <Button variant="teal" onClick={() => { setEditAgent(null); setShowForm(true) }}>
          <Plus className="w-4 h-4" />
          Ajouter un agent
        </Button>
      }
    >
      {/* KPIs équipe */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Membres actifs', value: actifs.length, color: 'text-slate-900' },
          { label: 'Gérant', value: agents.filter(a => a.role === 'gerant').length, color: 'text-slate-900' },
          { label: 'Total rejets traités', value: totalRejets, color: 'text-[#00C4CC]' },
          { label: 'Total récupéré', value: formatCurrency(totalMontant), color: 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {loading ? <LoadingPage /> : (
        <>
          {/* Agents actifs */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden mb-4">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Membres actifs</h2>
              <Badge variant="default">{actifs.length}</Badge>
            </div>

            {actifs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">Aucun membre actif</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {actifs.map(ag => (
                  <AgentRow
                    key={ag.id}
                    agent={ag}
                    onEdit={() => { setEditAgent(ag); setShowForm(true) }}
                    onToggle={() => toggleActif(ag)}
                    onStats={() => setStatsAgent(ag)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Agents inactifs */}
          {inactifs.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden opacity-60">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-500">Membres inactifs</h2>
                <Badge variant="default">{inactifs.length}</Badge>
              </div>
              <div className="divide-y divide-slate-50">
                {inactifs.map(ag => (
                  <AgentRow
                    key={ag.id}
                    agent={ag}
                    onEdit={() => { setEditAgent(ag); setShowForm(true) }}
                    onToggle={() => toggleActif(ag)}
                    onStats={() => setStatsAgent(ag)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Formulaire ajout/modif */}
      <Dialog
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editAgent ? 'Modifier le membre' : 'Ajouter un membre'}
        size="md"
      >
        <AgentForm
          agent={editAgent}
          onClose={() => setShowForm(false)}
          onSave={async () => {
            setShowForm(false)
            await fetchAgents()
            toast(editAgent ? 'Membre mis à jour' : 'Membre ajouté avec succès', 'success')
          }}
        />
      </Dialog>

      {/* Stats détaillées */}
      {statsAgent && (
        <AgentStats
          agent={statsAgent}
          onClose={() => setStatsAgent(null)}
        />
      )}
    </AppLayout>
  )
}

function AgentRow({
  agent, onEdit, onToggle, onStats
}: {
  agent: AgentAvecStats
  onEdit: () => void
  onToggle: () => void
  onStats: () => void
}) {
  const role = ROLE_CONFIG[agent.role]

  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
        style={{ backgroundColor: agent.actif ? '#0D1B2A' : '#94a3b8' }}
      >
        {getInitiales(agent.nom, agent.prenom)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {agent.prenom} {agent.nom}
          </p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${role.color}`}>
            {role.icon}
            {role.label}
          </span>
          {!agent.actif && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Inactif</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{agent.email}</p>
      </div>

      {/* Stats */}
      <div className="hidden lg:flex items-center gap-6 flex-shrink-0">
        <div className="text-center">
          <p className="text-sm font-bold text-slate-900">{agent.nbRejets}</p>
          <p className="text-xs text-slate-400">rejets</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-emerald-600">{agent.tauxResolution}%</p>
          <p className="text-xs text-slate-400">résolution</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-[#00C4CC]">{formatCurrency(agent.montantRecupere)}</p>
          <p className="text-xs text-slate-400">récupéré</p>
        </div>

        {/* Barre progression */}
        <div className="w-24">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${agent.tauxResolution}%`,
                backgroundColor: agent.tauxResolution >= 70 ? '#10B981' : agent.tauxResolution >= 40 ? '#F59E0B' : '#EF4444'
              }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onStats}
          className="p-2 text-slate-400 hover:text-[#00C4CC] hover:bg-[#00C4CC]/10 rounded-lg transition-all"
          title="Voir les statistiques"
        >
          <BarChart2 className="w-4 h-4" />
        </button>
        <button
          onClick={onEdit}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          title="Modifier"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onToggle}
          className={`p-2 rounded-lg transition-all ${
            agent.actif
              ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
              : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50'
          }`}
          title={agent.actif ? 'Désactiver' : 'Réactiver'}
        >
          {agent.actif ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
