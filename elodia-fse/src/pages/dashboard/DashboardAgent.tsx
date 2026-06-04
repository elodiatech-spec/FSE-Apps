import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Wrench, Clock, ChevronRight } from 'lucide-react'
import { supabase, RejetFSE } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { FamilleBadge, StatutBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { LoadingPage } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'

interface FileRejets {
  fileA: RejetFSE[]
  fileB: RejetFSE[]
  fileC: RejetFSE[]
}

export function DashboardAgent() {
  const [files, setFiles] = useState<FileRejets>({ fileA: [], fileB: [], fileC: [] })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const { agent } = useAuth()
  const { toast } = useToast()

  const fetchRejets = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('rejets_fse')
      .select('*, medecins(nom_cabinet, logiciel)')
      .in('statut', ['en_attente', 'en_cours'])
      .order('created_at', { ascending: true })

    const all = data || []

    // File A: auto-corrected, waiting validation (fichier_valide = false, voie = auto)
    const fileA = all.filter(r => r.voie_traitement === 'auto' && !r.fichier_valide && r.famille_rejet !== 'cotation')
    // File B: agent intervention needed
    const fileB = all.filter(r => r.voie_traitement === 'agent' || (!r.voie_traitement && r.famille_rejet !== 'cotation') || r.famille_rejet === 'cotation')
    // File C: physician escalation
    const fileC = all.filter(r => r.voie_traitement === 'medecin' || r.statut === 'escalade_medecin')

    setFiles({ fileA, fileB, fileC })
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRejets()
  }, [fetchRejets])

  async function validerRejet(id: string) {
    setActionLoading(id)
    await supabase
      .from('rejets_fse')
      .update({ statut: 'retransmis', fichier_valide: true, agent_id: agent?.id, date_traitement: new Date().toISOString() })
      .eq('id', id)
    toast('Rejet validé et retransmis', 'success')
    await fetchRejets()
    setActionLoading(null)
  }

  async function rejeterFileA(id: string) {
    setActionLoading(id)
    await supabase
      .from('rejets_fse')
      .update({ voie_traitement: 'agent', agent_id: agent?.id })
      .eq('id', id)
    toast('Rejet déplacé en File B', 'info')
    await fetchRejets()
    setActionLoading(null)
  }

  async function traiterRejet(id: string) {
    setActionLoading(id)
    await supabase
      .from('rejets_fse')
      .update({ statut: 'en_cours', agent_id: agent?.id })
      .eq('id', id)
    toast('Rejet pris en charge', 'info')
    await fetchRejets()
    setActionLoading(null)
  }

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const totalToday = files.fileA.length + files.fileB.length
  const done = files.fileA.filter(r => r.fichier_valide).length

  if (loading) return (
    <AppLayout title="Mon tableau de bord">
      <LoadingPage />
    </AppLayout>
  )

  return (
    <AppLayout
      title="File de travail"
      subtitle={`${today} — ${agent?.prenom} ${agent?.nom}`}
    >
      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Progression journalière</p>
            <p className="text-xs text-slate-500 mt-0.5">{done} traités sur {totalToday} rejets assignés</p>
          </div>
          <span className="text-2xl font-bold text-[#00C4CC]">
            {totalToday > 0 ? Math.round((done / totalToday) * 100) : 0}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00C4CC] rounded-full transition-all duration-500"
            style={{ width: `${totalToday > 0 ? (done / totalToday) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* File A */}
        <FileColumn
          title="File A — Validation auto"
          count={files.fileA.length}
          color="emerald"
          icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
          empty="Aucun rejet en attente de validation"
        >
          {files.fileA.map(r => (
            <RejetCard key={r.id} rejet={r}>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="teal"
                  loading={actionLoading === r.id}
                  onClick={() => validerRejet(r.id)}
                  className="flex-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Valider
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={actionLoading === r.id}
                  onClick={() => rejeterFileA(r.id)}
                  className="flex-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Rejeter
                </Button>
              </div>
            </RejetCard>
          ))}
        </FileColumn>

        {/* File B */}
        <FileColumn
          title="File B — Intervention agent"
          count={files.fileB.length}
          color="amber"
          icon={<Wrench className="w-5 h-5 text-amber-500" />}
          empty="Aucun rejet à traiter"
        >
          {files.fileB.map(r => (
            <RejetCard key={r.id} rejet={r}>
              {r.famille_rejet === 'cotation' && (
                <div className="mt-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-700 font-medium">⚠️ Cotation — Validation humaine obligatoire</p>
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                loading={actionLoading === r.id}
                onClick={() => traiterRejet(r.id)}
                className="w-full mt-3"
              >
                <Wrench className="w-3.5 h-3.5" />
                Prendre en charge
              </Button>
            </RejetCard>
          ))}
        </FileColumn>

        {/* File C */}
        <FileColumn
          title="File C — Escalade médecin"
          count={files.fileC.length}
          color="red"
          icon={<Clock className="w-5 h-5 text-red-500" />}
          empty="Aucune escalade en cours"
        >
          {files.fileC.map(r => (
            <RejetCard key={r.id} rejet={r}>
              <div className="mt-2 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                <p className="text-xs text-red-700 font-medium">En attente du médecin</p>
                <ChevronRight className="w-3.5 h-3.5 text-red-400" />
              </div>
            </RejetCard>
          ))}
        </FileColumn>
      </div>
    </AppLayout>
  )
}

function FileColumn({
  title, count, color, icon, children, empty
}: {
  title: string
  count: number
  color: string
  icon: React.ReactNode
  children: React.ReactNode
  empty: string
}) {
  const borderColors: Record<string, string> = {
    emerald: 'border-t-emerald-400',
    amber: 'border-t-amber-400',
    red: 'border-t-red-400',
  }
  const bgColors: Record<string, string> = {
    emerald: 'bg-emerald-50',
    amber: 'bg-amber-50',
    red: 'bg-red-50',
  }

  return (
    <div className={`rounded-2xl border border-slate-200/60 border-t-4 ${borderColors[color]} bg-white overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-3 ${bgColors[color]}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        </div>
        <span className="text-sm font-bold text-slate-700 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
          {count}
        </span>
      </div>
      <div className="p-3 space-y-3 min-h-[200px]">
        {count === 0 ? (
          <div className="flex items-center justify-center h-32 text-center">
            <p className="text-xs text-slate-400">{empty}</p>
          </div>
        ) : children}
      </div>
    </div>
  )
}

function RejetCard({ rejet, children }: { rejet: RejetFSE; children?: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono font-semibold text-slate-700">{rejet.id_fse}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {(rejet.medecins as { nom_cabinet?: string })?.nom_cabinet || '—'}
          </p>
        </div>
        <span className="text-sm font-bold text-slate-800 flex-shrink-0">{formatCurrency(rejet.montant_fse)}</span>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <FamilleBadge famille={rejet.famille_rejet} />
        <StatutBadge statut={rejet.statut} />
      </div>
      <p className="text-xs text-slate-400 mt-1.5">{rejet.code_erreur} — {formatDate(rejet.date_rejet)}</p>
      {children}
    </div>
  )
}
