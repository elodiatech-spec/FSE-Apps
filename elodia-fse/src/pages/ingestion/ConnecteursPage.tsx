import { useEffect, useState } from 'react'
import { Play, RefreshCw, Terminal, Clock, CheckCircle2, XCircle, AlertTriangle, Copy, Check } from 'lucide-react'
import { supabase, Medecin } from '@/lib/supabase'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { formatDatetime } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

const CONNECTEURS = [
  {
    id: 'doctolib',
    nom: 'Doctolib',
    type: 'Cloud — Playwright',
    description: 'Recupere les rejets FSE depuis l interface Doctolib pro via automation navigateur',
    statut: 'pret',
    priorite: 1,
    script: 'connectors/doctolib.mjs',
    icon: '🩺',
  },
  {
    id: 'medistory',
    nom: 'Medistory',
    type: 'Cloud — Playwright',
    description: 'Connexion a l espace pro Medistory pour extraction des RSP',
    statut: 'pret',
    priorite: 2,
    script: 'connectors/medistory.mjs',
    icon: '📋',
  },
  {
    id: 'maiia',
    nom: 'Maiia',
    type: 'Cloud — Playwright + export CSV',
    description: 'Extraction des rejets depuis le portail Cegedim Maiia avec export CSV automatique',
    statut: 'pret',
    priorite: 3,
    script: 'connectors/maiia.mjs',
    icon: '🏥',
  },
  {
    id: 'axisante',
    nom: 'Axisante',
    type: 'Local — AnyDesk + Playwright',
    description: 'Version cloud via Playwright. Version locale via AnyDesk (acces non supervise requis)',
    statut: 'pret',
    priorite: 4,
    script: 'connectors/axisante.mjs',
    icon: '🖥️',
  },
  {
    id: 'hellodoc',
    nom: 'HelloDoc',
    type: 'Local — AnyDesk + fichier .rsp',
    description: 'Copie les fichiers .rsp directement depuis le poste cabinet via AnyDesk CLI',
    statut: 'pret',
    priorite: 5,
    script: 'connectors/hellodoc.mjs',
    icon: '📁',
  },
  {
    id: 'docteursante',
    nom: 'Docteur Sante',
    type: 'Cloud — Playwright',
    description: 'Extraction depuis le portail Docteur Sante pro',
    statut: 'pret',
    priorite: 6,
    script: 'connectors/docteursante.mjs',
    icon: '💊',
  },
]

export function ConnecteursPage() {
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [selectedMedecin, setSelectedMedecin] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    supabase.from('medecins').select('*').eq('actif', true).order('nom_cabinet')
      .then(({ data }) => setMedecins(data || []))
  }, [])

  function copyCommand(connecteur: typeof CONNECTEURS[0]) {
    const med = medecins.find(m => m.id === selectedMedecin)
    const cmd = [
      `SUPABASE_URL=https://awyrojlanodjnuoepweq.supabase.co \\`,
      `SUPABASE_KEY=sb_publishable_... \\`,
      `DOCTOLIB_EMAIL="${med?.email || 'email@cabinet.com'}" \\`,
      `DOCTOLIB_PASSWORD="mot_de_passe" \\`,
      `MEDECIN_ID="${selectedMedecin || 'UUID_MEDECIN'}" \\`,
      `node ${connecteur.script}`
    ].join('\n')
    navigator.clipboard.writeText(cmd)
    setCopied(connecteur.id)
    setTimeout(() => setCopied(null), 2500)
    toast('Commande copiee !', 'success')
  }

  function copyInstall() {
    navigator.clipboard.writeText(
      'cd elodia-fse\nnpm install playwright\nnpx playwright install chromium'
    )
    toast('Commande d installation copiee', 'success')
  }

  const statutStyle: Record<string, string> = {
    pret: 'bg-emerald-100 text-emerald-700',
    bientot: 'bg-amber-100 text-amber-700',
    erreur: 'bg-red-100 text-red-700',
  }

  const statutLabel: Record<string, string> = {
    pret: 'Pret',
    bientot: 'Bientot',
    erreur: 'Erreur',
  }

  return (
    <AppLayout
      title="Connecteurs logiciels"
      subtitle="Recuperation automatique des rejets FSE depuis les logiciels medicaux"
    >
      {/* Installation Playwright */}
      <div className="bg-[#0D1B2A] rounded-2xl p-5 mb-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-base mb-1">Prerequis : installer Playwright</p>
            <p className="text-white/50 text-sm">
              Les connecteurs utilisent Playwright pour piloter le navigateur automatiquement.
            </p>
            <div className="mt-3 bg-black/30 rounded-xl px-4 py-3 font-mono text-sm text-[#00C4CC]">
              <p>cd elodia-fse</p>
              <p>npm install playwright</p>
              <p>npx playwright install chromium</p>
            </div>
          </div>
          <button
            onClick={copyInstall}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium transition-all ml-4 flex-shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            Copier
          </button>
        </div>
      </div>

      {/* Selectionner un medecin */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-5 mb-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900 mb-3">
          Selectionner le medecin pour la commande
        </p>
        <Select
          value={selectedMedecin}
          onChange={e => setSelectedMedecin(e.target.value)}
          className="max-w-sm"
        >
          <option value="">Choisir un medecin...</option>
          {medecins.map(m => (
            <option key={m.id} value={m.id}>
              {m.nom_cabinet} — {m.logiciel}
            </option>
          ))}
        </Select>
      </div>

      {/* Liste connecteurs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {CONNECTEURS.map(c => (
          <div
            key={c.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
              c.statut === 'pret' ? 'border-emerald-200' : 'border-slate-200/60'
            }`}
          >
            <div className={`px-5 py-4 border-b ${c.statut === 'pret' ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{c.nom}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statutStyle[c.statut]}`}>
                        {statutLabel[c.statut]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{c.type}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center">
                  {c.priorite}
                </span>
              </div>
            </div>

            <div className="p-5">
              <p className="text-sm text-slate-600 mb-4">{c.description}</p>

              {c.statut === 'pret' ? (
                <>
                  <div className="bg-slate-900 rounded-xl px-4 py-3 mb-3">
                    <p className="font-mono text-xs text-slate-400 mb-1"># Lancement manuel</p>
                    <p className="font-mono text-xs text-[#00C4CC] break-all">
                      MEDECIN_ID=&quot;{selectedMedecin || 'UUID'}&quot; node {c.script}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyCommand(c)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        copied === c.id
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-700 hover:bg-[#00C4CC]/10 hover:text-[#00C4CC]'
                      }`}
                    >
                      {copied === c.id ? <><Check className="w-3.5 h-3.5" /> Copie</> : <><Copy className="w-3.5 h-3.5" /> Copier la commande</>}
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#0D1B2A] text-white hover:bg-[#1a2d42] transition-all">
                      <Terminal className="w-3.5 h-3.5" />
                      Voir les logs
                    </button>
                  </div>

                  {/* Cron suggestion */}
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-xs font-semibold text-blue-800 mb-1">
                      Automatisation (cron toutes les 6h)
                    </p>
                    <p className="font-mono text-xs text-blue-700 break-all">
                      0 */6 * * * MEDECIN_ID=&quot;UUID&quot; node /chemin/{c.script}
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-3">
                  <Clock className="w-4 h-4" />
                  Developpement prevu — Phase 2B
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Architecture note */}
      <div className="mt-5 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">Architecture des connecteurs</p>
            <p className="text-sm text-amber-700">
              Les connecteurs sont des scripts Node.js autonomes qui tournent sur un serveur ou en local.
              Ils ne necessitent pas que l application React soit ouverte.
              Pour Axisante et HelloDoc (logiciels locaux), AnyDesk doit etre installe sur le poste du cabinet.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              {[
                { label: 'Cloud (Playwright)', desc: 'Tourne sur votre serveur, acces URL Doctolib/Medistory' },
                { label: 'Local (AnyDesk)', desc: 'Tourne sur votre poste, acces distant au cabinet' },
                { label: 'Fichier .rsp', desc: 'Upload manuel via la page Ingestion RSP' },
              ].map(a => (
                <div key={a.label} className="bg-white rounded-lg p-2.5 border border-amber-200">
                  <p className="font-semibold text-amber-900">{a.label}</p>
                  <p className="text-amber-700 mt-0.5">{a.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
