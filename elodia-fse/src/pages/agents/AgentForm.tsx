import { useState, FormEvent } from 'react'
import { UserPlus, Mail, Lock, User, Shield } from 'lucide-react'
import { supabase, Agent } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'

interface Props {
  agent: Agent | null
  onClose: () => void
  onSave: () => void
}

export function AgentForm({ agent, onClose, onSave }: Props) {
  const [nom, setNom] = useState(agent?.nom || '')
  const [prenom, setPrenom] = useState(agent?.prenom || '')
  const [email, setEmail] = useState(agent?.email || '')
  const [role, setRole] = useState<Agent['role']>(agent?.role || 'agent')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const isEdit = !!agent

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nom || !prenom || !email) return
    setSaving(true)

    if (isEdit) {
      // Modification
      const { error } = await supabase
        .from('agents')
        .update({ nom, prenom, email, role })
        .eq('id', agent.id)

      if (error) {
        toast('Erreur : ' + error.message, 'error')
        setSaving(false)
        return
      }
    } else {
      // Création — crée d'abord le compte Auth Supabase
      if (!password || password.length < 8) {
        toast('Mot de passe requis (8 caractères minimum)', 'error')
        setSaving(false)
        return
      }

      const { error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nom, prenom, role } }
      })

      if (authErr && !authErr.message.includes('already')) {
        toast('Erreur création compte : ' + authErr.message, 'error')
        setSaving(false)
        return
      }

      // Insérer dans la table agents
      const { error } = await supabase.from('agents').insert({ nom, prenom, email, role, actif: true })
      if (error) {
        toast('Erreur : ' + error.message, 'error')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSave()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Prénom *"
          placeholder="Marie"
          value={prenom}
          onChange={e => setPrenom(e.target.value)}
          icon={<User className="w-4 h-4" />}
          required
        />
        <Input
          label="Nom *"
          placeholder="JOSEPH"
          value={nom}
          onChange={e => setNom(e.target.value.toUpperCase())}
          required
        />
      </div>

      <Input
        label="Email *"
        type="email"
        placeholder="prenom.nom@elodiatech.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        icon={<Mail className="w-4 h-4" />}
        required
        disabled={isEdit}
      />

      <Select
        label="Rôle *"
        value={role}
        onChange={e => setRole(e.target.value as Agent['role'])}
      >
        <option value="agent">Agent</option>
        <option value="manageuse">Manageuse</option>
        <option value="gerant">Gérant</option>
      </Select>

      {!isEdit && (
        <Input
          label="Mot de passe provisoire *"
          type="password"
          placeholder="Minimum 8 caractères"
          value={password}
          onChange={e => setPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
        />
      )}

      {!isEdit && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          Un compte de connexion sera créé automatiquement. L'agent devra changer son mot de passe à la première connexion.
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <Button variant="outline" type="button" onClick={onClose}>
          Annuler
        </Button>
        <Button variant="teal" type="submit" loading={saving}>
          <UserPlus className="w-4 h-4" />
          {isEdit ? 'Enregistrer les modifications' : 'Créer le membre'}
        </Button>
      </div>
    </form>
  )
}
