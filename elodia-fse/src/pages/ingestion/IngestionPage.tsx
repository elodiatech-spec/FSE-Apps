import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle2, AlertTriangle, X, ChevronRight, Zap, Brain } from 'lucide-react'
import { supabase, Medecin } from '@/lib/supabase'
import { parseRspFile, ParseResult, CODES_ERREUR, setCodesErreur } from '@/lib/noemieParser'
import { CodeErreur } from '@/lib/supabase'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { FamilleBadge } from '@/components/shared/StatusBadge'
import { useToast } from '@/components/ui/toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useEffect } from 'react'

type Step = 'upload' | 'preview' | 'done'

export function IngestionPage() {
  const [step, setStep] = useState<Step>('upload')
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [selectedMedecin, setSelectedMedecin] = useState('')
  const [logiciel, setLogiciel] = useState('doctolib')
  const [dragging, setDragging] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [filename, setFilename] = useState('')
  const [inserting, setInserting] = useState(false)
  const [insertedCount, setInsertedCount] = useState(0)
  const { toast } = useToast()

  useEffect(() => {
    supabase.from('medecins').select('*').eq('actif', true).order('nom_cabinet')
      .then(({ data }) => setMedecins(data || []))

    // Charge la base de codes depuis Supabase (priorité sur les codes "en dur")
    supabase.from('codes_erreur').select('*').eq('actif', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map: typeof CODES_ERREUR = {}
          for (const c of data as CodeErreur[]) {
            map[c.code] = {
              libelle: c.libelle,
              famille: c.famille,
              voie: c.voie,
              confiance: Number(c.confiance),
              diagnostic: c.diagnostic || '',
              procedure: Array.isArray(c.procedure) ? c.procedure : [],
            }
          }
          setCodesErreur(map)
        }
      })
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!selectedMedecin) {
      toast('Selectionnez un medecin avant d importer', 'error')
      return
    }
    setFilename(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const result = parseRspFile(content, file.name, logiciel)
      setParseResult(result)
      setStep('preview')
    }
    reader.readAsText(file, 'ISO-8859-1')
  }, [selectedMedecin, logiciel, toast])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  async function handleInsert() {
    if (!parseResult || !selectedMedecin) return
    setInserting(true)
    let count = 0

    for (const r of parseResult.rejets) {
      const { error } = await supabase.from('rejets_fse').insert({
        id_fse: r.id_fse,
        date_rejet: r.date_rejet,
        medecin_id: selectedMedecin,
        logiciel_source: r.logiciel_source,
        code_erreur: r.code_erreur,
        libelle_erreur: r.libelle_erreur,
        famille_rejet: r.famille_rejet,
        niveau_rejet: r.niveau_rejet,
        part_concernee: r.part_concernee,
        montant_fse: r.montant_fse,
        statut: 'en_attente',
        voie_traitement: r.voie_traitement,
        fichier_valide: false,
        ticket_correction: r.ticket_correction,
      })
      if (!error) count++
    }

    setInsertedCount(count)
    setInserting(false)
    setStep('done')
    toast(`${count} rejet(s) ingeres avec succes`, 'success')
  }

  const voieColor = (v: string) => {
    if (v === 'auto') return 'text-emerald-600 bg-emerald-50'
    if (v === 'agent') return 'text-amber-600 bg-amber-50'
    return 'text-red-600 bg-red-50'
  }

  const voieLabel = (v: string) => {
    if (v === 'auto') return 'File A — Auto'
    if (v === 'agent') return 'File B — Agent'
    return 'File C — Medecin'
  }

  const stats = parseResult ? {
    auto: parseResult.rejets.filter(r => r.voie_traitement === 'auto').length,
    agent: parseResult.rejets.filter(r => r.voie_traitement === 'agent').length,
    medecin: parseResult.rejets.filter(r => r.voie_traitement === 'medecin').length,
    montantTotal: parseResult.rejets.reduce((s, r) => s + r.montant_fse, 0),
    highConf: parseResult.rejets.filter(r => r.confiance >= 0.80).length,
  } : null

  return (
    <AppLayout
      title="Ingestion RSP"
      subtitle="Importer et analyser les fichiers de retour CPAM (NOEMIE-PS)"
    >
      {step === 'upload' && (
        <div className="max-w-2xl mx-auto">
          {/* Config */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-6 mb-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Medecin"
                value={selectedMedecin}
                onChange={e => setSelectedMedecin(e.target.value)}
              >
                <option value="">Selectionner un medecin...</option>
                {medecins.map(m => (
                  <option key={m.id} value={m.id}>{m.nom_cabinet}</option>
                ))}
              </Select>
              <Select
                label="Logiciel source"
                value={logiciel}
                onChange={e => setLogiciel(e.target.value)}
              >
                <option value="doctolib">Doctolib</option>
                <option value="medistory">Medistory</option>
                <option value="maiia">Maiia</option>
                <option value="axisante">Axisante</option>
                <option value="hellodoc">HelloDoc</option>
                <option value="docteursante">Docteur Sante</option>
              </Select>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
              dragging
                ? 'border-[#00C4CC] bg-[#00C4CC]/5 scale-[1.01]'
                : 'border-slate-200 hover:border-[#00C4CC]/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              accept=".rsp,.txt,.csv,.noe"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#00C4CC]/10 flex items-center justify-center">
                <Upload className="w-7 h-7 text-[#00C4CC]" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">
                  Deposer le fichier RSP ici
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Formats acceptes : .rsp, .txt (NOEMIE-PS), .csv (export logiciel)
                </p>
              </div>
              <Button variant="teal" size="sm" className="pointer-events-none">
                Parcourir les fichiers
              </Button>
            </div>
          </div>

          {/* Info formats */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              {
                title: 'Format NOEMIE-PS',
                desc: 'Fichier .rsp retourne par la CPAM apres traitement des lots FSE',
                badge: 'Natif',
                color: 'bg-blue-50 border-blue-100',
              },
              {
                title: 'Export CSV logiciel',
                desc: 'Export CSV depuis Doctolib, Medistory, Maiia avec colonnes id_fse, code_erreur, montant',
                badge: 'Compatible',
                color: 'bg-emerald-50 border-emerald-100',
              }
            ].map(f => (
              <div key={f.title} className={`rounded-xl border p-4 ${f.color}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                  <span className="text-xs font-medium px-2 py-0.5 bg-white rounded-full text-slate-600 border border-slate-200">{f.badge}</span>
                </div>
                <p className="text-xs text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'preview' && parseResult && stats && (
        <div>
          {/* Header avec stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <div className="bg-[#0D1B2A] rounded-xl p-4 text-white col-span-2 lg:col-span-1">
              <p className="text-white/50 text-xs">Fichier</p>
              <p className="text-white font-mono text-sm font-semibold truncate mt-1">{filename}</p>
              <p className="text-[#00C4CC] text-xs mt-1">{parseResult.format.toUpperCase()}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-slate-500 text-xs">Total rejets</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{parseResult.total}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
              <p className="text-emerald-600 text-xs">File A (auto)</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.auto}</p>
            </div>
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
              <p className="text-amber-600 text-xs">File B (agent)</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{stats.agent}</p>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-100 p-4">
              <p className="text-red-600 text-xs">File C (medecin)</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{stats.medecin}</p>
            </div>
          </div>

          {/* Alertes */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <Brain className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">
                Diagnostic IA : {stats.highConf}/{parseResult.total} rejets avec confiance &gt;= 80%
              </p>
              <p className="text-xs text-blue-600">
                Montant total : {formatCurrency(stats.montantTotal)} — IA applique les regles NOEMIE + base 50 codes erreurs
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-3 py-1.5">
              <Zap className="w-3.5 h-3.5 text-[#00C4CC]" />
              <span className="text-xs font-semibold text-slate-700">
                {Math.round((stats.auto / parseResult.total) * 100) || 0}% automatisable
              </span>
            </div>
          </div>

          {parseResult.errors.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-semibold text-amber-700">{parseResult.errors.length} ligne(s) ignorees :</p>
              {parseResult.errors.slice(0, 3).map((e, i) => (
                <p key={i} className="text-xs text-amber-600 mt-0.5">{e}</p>
              ))}
            </div>
          )}

          {/* Tableau preview */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Apercu des rejets analyses</p>
              <button onClick={() => setStep('upload')} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Annuler
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-5 py-2.5">FSE</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2.5">Code</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2.5">Famille</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2.5">Montant</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2.5">File IA</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-2.5">Confiance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {parseResult.rejets.slice(0, 15).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-5 py-2.5">
                        <p className="text-xs font-mono font-semibold text-slate-800">{r.id_fse}</p>
                        <p className="text-xs text-slate-400">{formatDate(r.date_rejet)}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-mono font-bold text-slate-700">{r.code_erreur}</p>
                        <p className="text-xs text-slate-400 max-w-[160px] truncate">{r.libelle_erreur}</p>
                      </td>
                      <td className="px-4 py-2.5"><FamilleBadge famille={r.famille_rejet} /></td>
                      <td className="px-4 py-2.5 text-sm font-semibold text-slate-800">{formatCurrency(r.montant_fse)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${voieColor(r.voie_traitement)}`}>
                          {voieLabel(r.voie_traitement)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${r.confiance >= 0.8 ? 'bg-emerald-400' : r.confiance >= 0.6 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${r.confiance * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{Math.round(r.confiance * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.total > 15 && (
                <p className="text-xs text-slate-400 text-center py-3">
                  + {parseResult.total - 15} rejets supplementaires non affiches
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep('upload')} className="text-sm text-slate-500 hover:text-slate-700">
              Importer un autre fichier
            </button>
            <Button variant="teal" size="lg" loading={inserting} onClick={handleInsert}>
              <CheckCircle2 className="w-5 h-5" />
              Ingerer {parseResult.total} rejet(s) en base
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Ingestion terminee</h2>
          <p className="text-slate-500 mb-6">
            {insertedCount} rejet(s) ont ete analyses et inseres dans la base de donnees.
            Les files A/B/C ont ete remplies automatiquement.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => { setStep('upload'); setParseResult(null) }}>
              Importer un autre fichier
            </Button>
            <Button variant="teal" onClick={() => window.location.href = '/rejets'}>
              Voir les rejets
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
