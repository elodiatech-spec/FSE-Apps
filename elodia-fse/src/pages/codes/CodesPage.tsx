import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Edit2, Trash2, Download, BookOpen, Sparkles } from 'lucide-react'
import { supabase, CodeErreur } from '@/lib/supabase'
import { CODES_ERREUR } from '@/lib/noemieParser'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { LoadingPage } from '@/components/ui/spinner'
import { FamilleBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/toast'

const FAMILLES = ['droits_adri', 'cotation', 'parametrage', 'caisse', 'amc_dre'] as const
const VOIES = ['auto', 'agent', 'medecin'] as const
const VOIE_LABEL: Record<string, string> = { auto: 'File A — Auto', agent: 'File B — Agent', medecin: 'File C — Médecin' }
const SOURCE_LABEL: Record<string, string> = { defaut: 'Défaut', manuel: 'Manuel', ia: 'IA' }

const emptyCode: CodeErreur = {
  code: '', libelle: '', famille: 'droits_adri', voie: 'agent',
  confiance: 0.7, diagnostic: '', procedure: [], source: 'manuel', actif: true,
}

export function CodesPage() {
  const [codes, setCodes] = useState<CodeErreur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<CodeErreur | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const { toast } = useToast()

  const fetchCodes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('codes_erreur').select('*').order('code')
    setCodes((data as CodeErreur[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  async function importDefaults() {
    setSeeding(true)
    const rows = Object.entries(CODES_ERREUR).map(([code, c]) => ({
      code, libelle: c.libelle, famille: c.famille, voie: c.voie,
      confiance: c.confiance, diagnostic: c.diagnostic, procedure: c.procedure, source: 'defaut', actif: true,
    }))
    const { error } = await supabase.from('codes_erreur').upsert(rows, { onConflict: 'code' })
    setSeeding(false)
    if (error) toast('Erreur import : ' + error.message, 'error')
    else { toast(`${rows.length} codes par défaut importés`, 'success'); fetchCodes() }
  }

  async function saveCode() {
    if (!editing || !editing.code || !editing.libelle) {
      toast('Code et libellé obligatoires', 'error'); return
    }
    const payload = { ...editing, confiance: Number(editing.confiance) }
    const { error } = isNew
      ? await supabase.from('codes_erreur').insert(payload)
      : await supabase.from('codes_erreur').update(payload).eq('code', editing.code)
    if (error) { toast('Erreur : ' + error.message, 'error'); return }
    toast(isNew ? 'Code ajouté' : 'Code mis à jour', 'success')
    setEditing(null)
    fetchCodes()
  }

  async function deleteCode(code: string) {
    if (!confirm(`Supprimer le code ${code} ?`)) return
    const { error } = await supabase.from('codes_erreur').delete().eq('code', code)
    if (error) toast('Erreur : ' + error.message, 'error')
    else { toast('Code supprimé', 'success'); fetchCodes() }
  }

  const filtered = codes.filter(c =>
    c.code.includes(search) ||
    c.libelle.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppLayout
      title="Codes erreurs"
      subtitle={`${codes.length} code(s) dans la base de connaissance`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={importDefaults} loading={seeding}>
            <Download className="w-4 h-4" />
            Importer les codes par défaut
          </Button>
          <Button variant="teal" onClick={() => { setEditing({ ...emptyCode }); setIsNew(true) }}>
            <Plus className="w-4 h-4" />
            Ajouter un code
          </Button>
        </div>
      }
    >
      {/* Info */}
      <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Base de connaissance des codes NOEMIE</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Ces codes pilotent la classification automatique des rejets (famille, file A/B/C, diagnostic).
            Modifiez-les ici quand l'Assurance Maladie crée ou met à jour des codes — sans redéploiement.
            Si la base est vide, cliquez « Importer les codes par défaut ».
          </p>
        </div>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Rechercher par code ou libellé..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          className="max-w-md"
        />
      </div>

      {loading ? <LoadingPage /> : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{codes.length === 0 ? 'Base de codes vide' : 'Aucun résultat'}</p>
          {codes.length === 0 && (
            <p className="text-slate-400 text-sm mt-1">Cliquez « Importer les codes par défaut » pour démarrer.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-3">Code</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Libellé</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Famille</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">File</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">Source</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => (
                  <tr key={c.code} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-mono font-bold text-slate-800 text-sm">{c.code}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{c.libelle}</td>
                    <td className="px-4 py-3"><FamilleBadge famille={c.famille} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{VOIE_LABEL[c.voie]}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        c.source === 'ia' ? 'bg-violet-100 text-violet-700' : c.source === 'manuel' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {c.source === 'ia' && <Sparkles className="w-3 h-3" />}
                        {SOURCE_LABEL[c.source]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditing({ ...c }); setIsNew(false) }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteCode(c.code)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? 'Ajouter un code' : `Modifier le code ${editing?.code}`}
        size="md"
      >
        {editing && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Code *"
                placeholder="1101"
                value={editing.code}
                onChange={e => setEditing({ ...editing, code: e.target.value })}
                disabled={!isNew}
              />
              <Input
                label="Confiance (0 à 1)"
                type="number"
                value={String(editing.confiance)}
                onChange={e => setEditing({ ...editing, confiance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <Input
              label="Libellé *"
              placeholder="Droits AMO fermés à la date de soins"
              value={editing.libelle}
              onChange={e => setEditing({ ...editing, libelle: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Famille" value={editing.famille}
                onChange={e => setEditing({ ...editing, famille: e.target.value as CodeErreur['famille'] })}>
                {FAMILLES.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
              </Select>
              <Select label="Voie (file)" value={editing.voie}
                onChange={e => setEditing({ ...editing, voie: e.target.value as CodeErreur['voie'] })}>
                {VOIES.map(v => <option key={v} value={v}>{VOIE_LABEL[v]}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Diagnostic</label>
              <textarea
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20"
                rows={2}
                value={editing.diagnostic || ''}
                onChange={e => setEditing({ ...editing, diagnostic: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Procédure (une étape par ligne)</label>
              <textarea
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20"
                rows={5}
                value={(editing.procedure || []).join('\n')}
                onChange={e => setEditing({ ...editing, procedure: e.target.value.split('\n').filter(Boolean) })}
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
              <Button variant="teal" onClick={saveCode}>
                {isNew ? 'Ajouter' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </AppLayout>
  )
}
