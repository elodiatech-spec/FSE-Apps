import { useState } from 'react'
import { CheckCircle, Clock, User, AlertTriangle, Brain, FileText, Mail, Sparkles } from 'lucide-react'
import { supabase, RejetFSE } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Drawer } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { StatutBadge, FamilleBadge, LogicielBadge } from '@/components/shared/StatusBadge'
import { formatCurrency, formatDate, formatDatetime } from '@/lib/utils'
import { sendEmailEscaladeMedecin } from '@/lib/emailService'
import { useToast } from '@/components/ui/toast'

interface Props {
  rejet: RejetFSE
  onClose: () => void
  onUpdate: () => void
}

export function RejetDrawer({ rejet, onClose, onUpdate }: Props) {
  const [statut, setStatut] = useState(rejet.statut)
  const [notes, setNotes] = useState(rejet.notes || '')
  const [montantRecupere, setMontantRecupere] = useState(String(rejet.montant_recupere ?? ''))
  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const { agent } = useAuth()
  const { toast } = useToast()

  const medecin = rejet.medecins as { nom_cabinet?: string; logiciel?: string } | undefined
  const ag = rejet.agents as { nom?: string; prenom?: string } | undefined

  type Ticket = {
    famille?: string
    diagnostic?: string
    procedure?: string[]
    voie?: string
    confiance?: number
    docs?: string[]
    genere_par?: string
  }
  const [aiTicket, setAiTicket] = useState<Ticket | null>(null)
  const ticket: Ticket | null = aiTicket || (rejet.ticket_correction as Ticket | null)

  async function analyzeWithAI() {
    setAiLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/diagnostic-rejet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ rejet: {
          code_erreur: rejet.code_erreur,
          libelle_erreur: rejet.libelle_erreur,
          famille_rejet: rejet.famille_rejet,
          niveau_rejet: rejet.niveau_rejet,
          part_concernee: rejet.part_concernee,
          montant_fse: rejet.montant_fse,
          logiciel_source: rejet.logiciel_source,
        } }),
      })
      if (res.status === 503) { toast("Assistant IA non activé (clé manquante)", 'error'); setAiLoading(false); return }
      const data = await res.json()
      if (!res.ok || !data.diagnostic) { toast("Échec de l'analyse IA", 'error'); setAiLoading(false); return }

      const newTicket: Ticket = {
        ...(rejet.ticket_correction as Ticket | null),
        diagnostic: data.diagnostic,
        procedure: data.procedure,
        confiance: data.confiance,
        voie: data.voie,
        genere_par: 'ia',
      }
      setAiTicket(newTicket)
      await supabase.from('rejets_fse').update({ ticket_correction: newTicket }).eq('id', rejet.id)
      toast('Diagnostic IA généré et enregistré', 'success')
    } catch {
      toast("Erreur lors de l'analyse IA", 'error')
    }
    setAiLoading(false)
  }

  async function saveCodeToBase() {
    if (!ticket) return
    const { error } = await supabase.from('codes_erreur').upsert({
      code: rejet.code_erreur,
      libelle: rejet.libelle_erreur,
      famille: rejet.famille_rejet,
      voie: ticket.voie || 'agent',
      confiance: ticket.confiance ?? 0.8,
      diagnostic: ticket.diagnostic || '',
      procedure: ticket.procedure || [],
      source: 'ia',
      actif: true,
    }, { onConflict: 'code' })
    if (error) toast('Erreur : ' + error.message, 'error')
    else toast(`Code ${rejet.code_erreur} ajouté à la base — gratuit la prochaine fois`, 'success')
  }

  async function handleSave() {
    setSaving(true)
    const wasEscalade = rejet.statut !== 'escalade_medecin' && statut === 'escalade_medecin'

    await supabase.from('rejets_fse').update({
      statut,
      notes,
      montant_recupere: montantRecupere ? parseFloat(montantRecupere) : null,
      agent_id: agent?.id,
      date_traitement: new Date().toISOString(),
    }).eq('id', rejet.id)

    // Email automatique si passage en escalade médecin
    if (wasEscalade) {
      const medecin = rejet.medecins as { id?: string; email?: string; nom_cabinet?: string; nom_medecin?: string; code_elodiatech?: string; logiciel?: string; offre?: string; actif?: boolean; date_souscription?: string; statut_cpe?: string }
      if (medecin?.email) {
        await sendEmailEscaladeMedecin(medecin as never, [{ ...rejet, statut: 'escalade_medecin' }])
        toast('Email envoye au medecin automatiquement', 'success')
      }
    }

    setSaving(false)
    onUpdate()
  }

  async function handleSendEmailManual() {
    setSendingEmail(true)
    const medecin = rejet.medecins as { email?: string; id?: string; nom_cabinet?: string } | undefined
    if (!medecin?.email) {
      toast('Email du medecin non renseigne', 'error')
      setSendingEmail(false)
      return
    }
    const ok = await sendEmailEscaladeMedecin(medecin as never, [rejet])
    toast(ok ? 'Email envoye au medecin' : 'Erreur envoi — verifiez la cle Resend', ok ? 'success' : 'error')
    setSendingEmail(false)
  }

  const timeline = [
    { date: rejet.created_at, label: 'Rejet reçu', icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-slate-400' },
    ...(rejet.date_traitement ? [{ date: rejet.date_traitement, label: `Pris en charge par ${ag?.prenom || '—'}`, icon: <User className="w-3.5 h-3.5" />, color: 'bg-blue-400' }] : []),
    ...(rejet.statut === 'résolu' || rejet.statut === 'retransmis' ? [{ date: rejet.updated_at, label: 'Résolu', icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'bg-emerald-400' }] : []),
    ...(rejet.statut === 'escalade_medecin' ? [{ date: rejet.updated_at, label: 'Escalade médecin', icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'bg-amber-400' }] : []),
  ]

  return (
    <Drawer open onClose={onClose} title={`Rejet ${rejet.id_fse}`} width="520px">
      <div className="p-6 space-y-6">
        {/* Header info */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Cabinet médical</p>
              <p className="font-semibold text-slate-900">{medecin?.nom_cabinet || '—'}</p>
            </div>
            {medecin?.logiciel && <LogicielBadge logiciel={medecin.logiciel as 'doctolib' | 'medistory' | 'maiia' | 'axisante' | 'hellodoc' | 'docteursante'} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500">Date rejet</p>
              <p className="text-sm font-medium text-slate-900">{formatDate(rejet.date_rejet)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Montant FSE</p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(rejet.montant_fse)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Code erreur</p>
              <p className="text-sm font-mono font-medium text-slate-900">{rejet.code_erreur}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Niveau</p>
              <p className="text-sm text-slate-700 capitalize">{rejet.niveau_rejet}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Libellé erreur</p>
            <p className="text-sm text-slate-700">{rejet.libelle_erreur}</p>
          </div>
          <div className="flex items-center gap-2">
            <FamilleBadge famille={rejet.famille_rejet} />
            <StatutBadge statut={rejet.statut} />
            {rejet.famille_rejet === 'cotation' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                <AlertTriangle className="w-3 h-3" />
                Validation obligatoire
              </span>
            )}
          </div>
        </div>

        {/* AI Ticket */}
        {ticket && (
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-blue-900">
                {ticket.genere_par === 'ia' ? 'Diagnostic IA' : 'Ticket IA'}
              </p>
              {ticket.genere_par === 'ia' && (
                <span className="text-xs font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> génératif
                </span>
              )}
              {ticket.confiance && (
                <span className="ml-auto text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {Math.round(ticket.confiance * 100)}% confiance
                </span>
              )}
            </div>
            {ticket.diagnostic && (
              <p className="text-sm text-blue-800 mb-3">{ticket.diagnostic}</p>
            )}
            {ticket.procedure && ticket.procedure.length > 0 && (
              <ol className="space-y-1">
                {ticket.procedure.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-blue-700">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center font-semibold text-xs">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
            {ticket.voie && (
              <p className="text-xs text-blue-600 mt-2 font-medium">
                Voie recommandée : {ticket.voie === 'auto' ? '🤖 Automatique' : ticket.voie === 'agent' ? '👤 Agent' : '🩺 Médecin'}
              </p>
            )}
            <button
              onClick={analyzeWithAI}
              disabled={aiLoading}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 transition-all disabled:opacity-50"
            >
              {aiLoading
                ? <><span className="w-3.5 h-3.5 border border-violet-400 border-t-transparent rounded-full animate-spin" /> Analyse en cours...</>
                : <><Sparkles className="w-3.5 h-3.5" /> {ticket.genere_par === 'ia' ? 'Relancer l\'analyse IA' : 'Approfondir avec l\'IA'}</>}
            </button>
            {ticket.genere_par === 'ia' && agent?.role === 'gerant' && (
              <button
                onClick={saveCodeToBase}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                Enregistrer ce code dans la base (gratuit ensuite)
              </button>
            )}
          </div>
        )}

        {/* Pas de ticket → proposer une analyse IA directe */}
        {!ticket && (
          <button
            onClick={analyzeWithAI}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-all disabled:opacity-50"
          >
            {aiLoading
              ? <><span className="w-4 h-4 border border-violet-400 border-t-transparent rounded-full animate-spin" /> Analyse en cours...</>
              : <><Sparkles className="w-4 h-4" /> Analyser ce rejet avec l'IA</>}
          </button>
        )}

        {/* Treatment form */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Traitement</h3>

          <Select
            label="Statut"
            value={statut}
            onChange={e => setStatut(e.target.value as RejetFSE['statut'])}
          >
            <option value="en_attente">En attente</option>
            <option value="en_cours">En cours</option>
            <option value="résolu">Résolu</option>
            <option value="non_résolu">Non résolu</option>
            <option value="escalade_medecin">Escalade médecin</option>
            <option value="retransmis">Retransmis</option>
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Montant récupéré (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={montantRecupere}
              onChange={e => setMontantRecupere(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C4CC] focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Ajouter des notes de traitement..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C4CC] focus:border-transparent resize-none"
            />
          </div>

          <Button variant="teal" loading={saving} onClick={handleSave} className="w-full">
            <CheckCircle className="w-4 h-4" />
            Sauvegarder le traitement
          </Button>

          {(rejet.statut === 'escalade_medecin' || statut === 'escalade_medecin') && (
            <Button
              variant="outline"
              loading={sendingEmail}
              onClick={handleSendEmailManual}
              className="w-full"
            >
              <Mail className="w-4 h-4" />
              Envoyer notification au medecin
            </Button>
          )}
        </div>

        {/* Timeline */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Historique</h3>
          <div className="relative pl-4">
            <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-slate-200" />
            {timeline.map((event, i) => (
              <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                <div className={`absolute -left-1.5 mt-0.5 w-3 h-3 rounded-full flex items-center justify-center text-white ${event.color}`}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-slate-700">{event.label}</p>
                  <p className="text-xs text-slate-400">{formatDatetime(event.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
