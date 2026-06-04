import { Badge } from '@/components/ui/badge'

type Statut = 'en_attente' | 'en_cours' | 'résolu' | 'non_résolu' | 'escalade_medecin' | 'retransmis'
type Famille = 'droits_adri' | 'cotation' | 'parametrage' | 'caisse' | 'amc_dre'
type Logiciel = 'doctolib' | 'medistory' | 'maiia' | 'axisante' | 'hellodoc' | 'docteursante'
type Offre = 'zen_fse' | 'liberty_fse' | 'pass_recup'

export function StatutBadge({ statut }: { statut: Statut }) {
  const config: Record<Statut, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'teal' }> = {
    en_attente: { label: 'En attente', variant: 'default' },
    en_cours: { label: 'En cours', variant: 'info' },
    résolu: { label: 'Résolu', variant: 'success' },
    non_résolu: { label: 'Non résolu', variant: 'danger' },
    escalade_medecin: { label: 'Escalade médecin', variant: 'warning' },
    retransmis: { label: 'Retransmis', variant: 'teal' },
  }
  const c = config[statut]
  return <Badge variant={c.variant}>{c.label}</Badge>
}

export function FamilleBadge({ famille }: { famille: Famille }) {
  const config: Record<Famille, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'teal' }> = {
    droits_adri: { label: 'Droits/ADRi', variant: 'info' },
    cotation: { label: 'Cotation', variant: 'warning' },
    parametrage: { label: 'Paramétrage', variant: 'default' },
    caisse: { label: 'Caisse', variant: 'danger' },
    amc_dre: { label: 'AMC/DRE', variant: 'teal' },
  }
  const c = config[famille]
  return <Badge variant={c.variant}>{c.label}</Badge>
}

export function LogicielBadge({ logiciel }: { logiciel: Logiciel }) {
  const labels: Record<Logiciel, string> = {
    doctolib: 'Doctolib',
    medistory: 'Medistory',
    maiia: 'Maiia',
    axisante: 'Axisanté',
    hellodoc: 'HelloDoc',
    docteursante: 'Docteur Santé',
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-white text-xs font-mono">
      {labels[logiciel]}
    </span>
  )
}

export function OffreBadge({ offre }: { offre: Offre }) {
  const config: Record<Offre, { label: string; className: string }> = {
    zen_fse: { label: 'ZEN FSE', className: 'bg-blue-100 text-blue-700' },
    liberty_fse: { label: 'LIBERTY FSE', className: 'bg-violet-100 text-violet-700' },
    pass_recup: { label: "PASS RÉCUP'", className: 'bg-amber-100 text-amber-700' },
  }
  const c = config[offre]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.className}`}>
      {c.label}
    </span>
  )
}

export function FileBadge({ file }: { file: 'A' | 'B' | 'C' }) {
  const config = {
    A: { label: 'File A', className: 'bg-emerald-100 text-emerald-700' },
    B: { label: 'File B', className: 'bg-amber-100 text-amber-700' },
    C: { label: 'File C', className: 'bg-red-100 text-red-700' },
  }
  const c = config[file]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.className}`}>
      {c.label}
    </span>
  )
}
