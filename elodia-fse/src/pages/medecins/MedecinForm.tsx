import { useState, FormEvent } from 'react'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

interface Props {
  onClose: () => void
  onSave: () => void
}

type FormData = {
  code_elodiatech: string
  nom_cabinet: string
  nom_medecin: string
  logiciel: string
  offre: string
  date_souscription: string
  quota_zen: string
  tranche_pass_recup: string
  adresse_mssante: string
  email: string
  statut_cpe: string
  date_expiration_cpe: string
}

const STEPS = ['Identification', 'Offre', 'Accès', 'CPE', 'Confirmation']

export function MedecinForm({ onClose, onSave }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>({
    code_elodiatech: '',
    nom_cabinet: '',
    nom_medecin: '',
    logiciel: 'doctolib',
    offre: 'zen_fse',
    date_souscription: new Date().toISOString().split('T')[0],
    quota_zen: '40',
    tranche_pass_recup: '',
    adresse_mssante: '',
    email: '',
    statut_cpe: 'en_attente',
    date_expiration_cpe: '',
  })

  function update(field: keyof FormData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    setSaving(true)
    const { error } = await supabase.from('medecins').insert({
      code_elodiatech: form.code_elodiatech || `ET-${Date.now()}`,
      nom_cabinet: form.nom_cabinet,
      nom_medecin: form.nom_medecin,
      logiciel: form.logiciel,
      offre: form.offre,
      date_souscription: form.date_souscription,
      quota_zen: form.quota_zen ? parseInt(form.quota_zen) : null,
      tranche_pass_recup: form.tranche_pass_recup ? parseFloat(form.tranche_pass_recup) : null,
      adresse_mssante: form.adresse_mssante || null,
      email: form.email || null,
      statut_cpe: form.statut_cpe,
      date_expiration_cpe: form.date_expiration_cpe || null,
      actif: true,
    })
    setSaving(false)
    if (!error) onSave()
  }

  return (
    <div className="p-6">
      {/* Stepper */}
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all ${
              i < step ? 'bg-[#00C4CC] text-white' :
              i === step ? 'bg-[#0D1B2A] text-white' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[200px]">
        {step === 0 && (
          <div className="space-y-3">
            <Input
              label="Nom du cabinet *"
              placeholder="Cabinet du Dr..."
              value={form.nom_cabinet}
              onChange={e => update('nom_cabinet', e.target.value)}
            />
            <Input
              label="Nom du médecin *"
              placeholder="Dr Prénom NOM"
              value={form.nom_medecin}
              onChange={e => update('nom_medecin', e.target.value)}
            />
            <Input
              label="Code ElodiaTech"
              placeholder="ET-001"
              value={form.code_elodiatech}
              onChange={e => update('code_elodiatech', e.target.value)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Select label="Logiciel *" value={form.logiciel} onChange={e => update('logiciel', e.target.value)}>
              <option value="doctolib">Doctolib</option>
              <option value="medistory">Medistory</option>
              <option value="maiia">Maiia</option>
              <option value="axisante">Axisanté</option>
              <option value="hellodoc">HelloDoc</option>
              <option value="docteursante">Docteur Santé</option>
            </Select>
            <Select label="Offre *" value={form.offre} onChange={e => update('offre', e.target.value)}>
              <option value="zen_fse">ZEN FSE (99€/mois + tranches)</option>
              <option value="liberty_fse">LIBERTY FSE (12% commission)</option>
              <option value="pass_recup">PASS RÉCUP' (10-12% récupéré)</option>
            </Select>
            <Input
              label="Date de souscription *"
              type="date"
              value={form.date_souscription}
              onChange={e => update('date_souscription', e.target.value)}
            />
            {form.offre === 'zen_fse' && (
              <Input
                label="Quota ZEN FSE (rejets/mois)"
                type="number"
                value={form.quota_zen}
                onChange={e => update('quota_zen', e.target.value)}
              />
            )}
            {form.offre === 'pass_recup' && (
              <Input
                label="Tranche PASS RÉCUP' (€)"
                type="number"
                placeholder="Montant estimé récupérable"
                value={form.tranche_pass_recup}
                onChange={e => update('tranche_pass_recup', e.target.value)}
              />
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Input
              label="Email du cabinet"
              type="email"
              placeholder="contact@cabinet.fr"
              value={form.email}
              onChange={e => update('email', e.target.value)}
            />
            <Input
              label="Adresse MSSanté"
              placeholder="medecin@monserveur.mssante.fr"
              value={form.adresse_mssante}
              onChange={e => update('adresse_mssante', e.target.value)}
            />
            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
              Les accès logiciel seront configurés séparément (Bitwarden pour cloud, AnyDesk pour local).
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Select label="Statut CPE/eCPE" value={form.statut_cpe} onChange={e => update('statut_cpe', e.target.value)}>
              <option value="en_attente">En attente de commande</option>
              <option value="actif">Actif</option>
              <option value="expirant">Expirant bientôt</option>
              <option value="expiré">Expiré</option>
            </Select>
            <Input
              label="Date d'expiration CPE"
              type="date"
              value={form.date_expiration_cpe}
              onChange={e => update('date_expiration_cpe', e.target.value)}
            />
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              La carte CPE doit être commandée via le portail ANS TOPS. Délai : 4 à 8 semaines.
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Récapitulatif</h3>
            <div className="space-y-2">
              {[
                { label: 'Cabinet', value: form.nom_cabinet },
                { label: 'Médecin', value: form.nom_medecin },
                { label: 'Logiciel', value: form.logiciel },
                { label: 'Offre', value: form.offre },
                { label: 'Souscription', value: form.date_souscription },
                { label: 'Email', value: form.email || '—' },
                { label: 'CPE statut', value: form.statut_cpe },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
        <Button variant="outline" onClick={step === 0 ? onClose : () => setStep(s => s - 1)}>
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? 'Annuler' : 'Précédent'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            variant="teal"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 0 && (!form.nom_cabinet || !form.nom_medecin)}
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="teal" loading={saving} onClick={handleSubmit}>
            <Check className="w-4 h-4" />
            Enregistrer
          </Button>
        )}
      </div>
    </div>
  )
}
