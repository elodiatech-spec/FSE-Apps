import { useEffect, useState, useCallback } from 'react'
import { Search, Filter, X, FileX2, ChevronDown } from 'lucide-react'
import { supabase, RejetFSE } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { StatutBadge, FamilleBadge, LogicielBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { LoadingPage } from '@/components/ui/spinner'
import { Drawer } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ExportButton } from '@/components/shared/ExportButton'
import { exportRejetsExcel, exportRejetsCsv } from '@/lib/exportData'
import { formatCurrency, formatDate, formatDatetime } from '@/lib/utils'
import { RejetDrawer } from './RejetDrawer'

type Filters = {
  search: string
  medecin: string
  statut: string
  famille: string
  voie: string
}

export function RejetsPage() {
  const [rejets, setRejets] = useState<RejetFSE[]>([])
  const [medecins, setMedecins] = useState<{ id: string; nom_cabinet: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RejetFSE | null>(null)
  const [filters, setFilters] = useState<Filters>({
    search: '', medecin: '', statut: '', famille: '', voie: ''
  })
  const { agent } = useAuth()
  const { toast } = useToast()

  const fetchRejets = useCallback(async () => {
    setLoading(true)
    const [rejetsRes, medecinRes] = await Promise.all([
      supabase.from('rejets_fse').select('*, medecins(id,nom_cabinet,logiciel), agents(id,nom,prenom)').order('created_at', { ascending: false }),
      supabase.from('medecins').select('id,nom_cabinet').eq('actif', true).order('nom_cabinet'),
    ])
    setRejets(rejetsRes.data || [])
    setMedecins(medecinRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRejets() }, [fetchRejets])

  const filtered = rejets.filter(r => {
    const nomCab = (r.medecins as { nom_cabinet?: string })?.nom_cabinet || ''
    if (filters.search && !r.id_fse.toLowerCase().includes(filters.search.toLowerCase()) &&
        !r.code_erreur.toLowerCase().includes(filters.search.toLowerCase()) &&
        !nomCab.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.medecin && r.medecin_id !== filters.medecin) return false
    if (filters.statut && r.statut !== filters.statut) return false
    if (filters.famille && r.famille_rejet !== filters.famille) return false
    if (filters.voie && r.voie_traitement !== filters.voie) return false
    return true
  })

  function clearFilters() {
    setFilters({ search: '', medecin: '', statut: '', famille: '', voie: '' })
  }

  const hasFilters = Object.values(filters).some(v => v !== '')

  return (
    <AppLayout
      title="Rejets FSE"
      subtitle={`${filtered.length} rejet${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''}`}
      actions={
        <ExportButton
          disabled={filtered.length === 0}
          onExcel={() => exportRejetsExcel(filtered)}
          onCsv={() => exportRejetsCsv(filtered)}
        />
      }
    >
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Input
              placeholder="Rechercher FSE, code erreur, cabinet..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select value={filters.medecin} onChange={e => setFilters(f => ({ ...f, medecin: e.target.value }))}>
            <option value="">Tous les médecins</option>
            {medecins.map(m => <option key={m.id} value={m.id}>{m.nom_cabinet}</option>)}
          </Select>
          <Select value={filters.statut} onChange={e => setFilters(f => ({ ...f, statut: e.target.value }))}>
            <option value="">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="en_cours">En cours</option>
            <option value="résolu">Résolu</option>
            <option value="non_résolu">Non résolu</option>
            <option value="escalade_medecin">Escalade médecin</option>
            <option value="retransmis">Retransmis</option>
          </Select>
          <Select value={filters.famille} onChange={e => setFilters(f => ({ ...f, famille: e.target.value }))}>
            <option value="">Toutes les familles</option>
            <option value="droits_adri">Droits/ADRi</option>
            <option value="cotation">Cotation</option>
            <option value="parametrage">Paramétrage</option>
            <option value="caisse">Caisse</option>
            <option value="amc_dre">AMC/DRE</option>
          </Select>
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? <LoadingPage /> : (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileX2 className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">Aucun rejet trouvé</p>
              <p className="text-slate-400 text-sm mt-1">
                {hasFilters ? 'Essayez de modifier vos filtres' : 'Les rejets apparaîtront ici'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">FSE / Date</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Cabinet</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Code erreur</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Famille</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Montant</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Statut</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(r => {
                    const medecin = r.medecins as { nom_cabinet?: string; logiciel?: string } | undefined
                    const ag = r.agents as { nom?: string; prenom?: string } | undefined
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-3">
                          <p className="text-sm font-mono font-semibold text-slate-900">{r.id_fse}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.date_rejet)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-800 truncate max-w-[160px]">{medecin?.nom_cabinet || '—'}</p>
                          {medecin?.logiciel && <LogicielBadge logiciel={medecin.logiciel as 'doctolib' | 'medistory' | 'maiia' | 'axisante' | 'hellodoc' | 'docteursante'} />}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-mono text-slate-700">{r.code_erreur}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[140px]">{r.libelle_erreur}</p>
                        </td>
                        <td className="px-4 py-3">
                          <FamilleBadge famille={r.famille_rejet} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(r.montant_fse)}</p>
                          {r.montant_recupere != null && (
                            <p className="text-xs text-emerald-600">↳ {formatCurrency(r.montant_recupere)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatutBadge statut={r.statut} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-600">
                            {ag ? `${ag.prenom} ${ag.nom}` : '—'}
                          </p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <RejetDrawer
          rejet={selected}
          onClose={() => setSelected(null)}
          onUpdate={async () => { await fetchRejets(); setSelected(null); toast('Rejet mis à jour', 'success') }}
        />
      )}
    </AppLayout>
  )
}
