import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, UserRound, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { supabase, Medecin } from '@/lib/supabase'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogicielBadge, OffreBadge } from '@/components/shared/StatusBadge'
import { LoadingPage } from '@/components/ui/spinner'
import { Dialog } from '@/components/ui/dialog'
import { formatDate, daysBetween } from '@/lib/utils'
import { MedecinFiche } from './MedecinFiche'
import { MedecinForm } from './MedecinForm'
import { useToast } from '@/components/ui/toast'

export function MedecinsPage() {
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Medecin | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { toast } = useToast()

  const fetchMedecins = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('medecins').select('*').order('nom_cabinet')
    setMedecins(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMedecins() }, [fetchMedecins])

  const filtered = medecins.filter(m =>
    !search ||
    m.nom_cabinet.toLowerCase().includes(search.toLowerCase()) ||
    m.nom_medecin.toLowerCase().includes(search.toLowerCase()) ||
    m.code_elodiatech.toLowerCase().includes(search.toLowerCase())
  )

  function getCPEStatus(m: Medecin): { icon: React.ReactNode; color: string; label: string } {
    if (!m.date_expiration_cpe) return { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-slate-400', label: 'En attente' }
    const days = daysBetween(m.date_expiration_cpe)
    if (days < 0) return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-red-500', label: 'Expirée' }
    if (days < 90) return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-amber-500', label: `${days}j` }
    return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-emerald-500', label: formatDate(m.date_expiration_cpe) }
  }

  return (
    <AppLayout
      title="Médecins"
      subtitle={`${medecins.filter(m => m.actif).length} médecin${medecins.filter(m => m.actif).length > 1 ? 's' : ''} actif${medecins.filter(m => m.actif).length > 1 ? 's' : ''}`}
      actions={
        <Button variant="teal" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Ajouter un médecin
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-5">
        <Input
          placeholder="Rechercher par cabinet, médecin ou code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          className="max-w-md"
        />
      </div>

      {loading ? <LoadingPage /> : (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UserRound className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Aucun médecin trouvé</p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? 'Modifiez votre recherche' : 'Ajoutez votre premier médecin'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(m => {
              const cpe = getCPEStatus(m)
              return (
                <div
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-[#00C4CC]/30 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#0D1B2A' }}>
                      <UserRound className="w-5 h-5 text-[#00C4CC]" />
                    </div>
                    <div className="flex items-center gap-2">
                      {!m.actif && <span className="text-xs text-slate-400 font-medium">Inactif</span>}
                      <OffreBadge offre={m.offre} />
                    </div>
                  </div>

                  <h3 className="font-semibold text-slate-900 text-base group-hover:text-[#00C4CC] transition-colors">
                    {m.nom_cabinet}
                  </h3>
                  <p className="text-sm text-slate-500 mt-0.5">{m.nom_medecin}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{m.code_elodiatech}</p>

                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                    <LogicielBadge logiciel={m.logiciel} />
                    <div className={`flex items-center gap-1 text-xs font-medium ml-auto ${cpe.color}`}>
                      {cpe.icon}
                      <span>CPE : {cpe.label}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Fiche médecin */}
      {selected && (
        <MedecinFiche
          medecin={selected}
          onClose={() => setSelected(null)}
          onUpdate={fetchMedecins}
        />
      )}

      {/* Add form */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} title="Ajouter un médecin" size="lg">
        <MedecinForm
          onClose={() => setShowForm(false)}
          onSave={async () => {
            await fetchMedecins()
            setShowForm(false)
            toast('Médecin ajouté avec succès', 'success')
          }}
        />
      </Dialog>
    </AppLayout>
  )
}
