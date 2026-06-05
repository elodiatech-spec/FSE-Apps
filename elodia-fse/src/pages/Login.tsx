import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Play, CheckCircle, UserPlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

const PWD = 'demo123456'

const AGENTS = [
  { nom: 'MARTIN', prenom: 'Frederic', email: 'gerant@elodiatech.com', role: 'gerant' as const, actif: true },
  { nom: 'JOSEPH', prenom: 'Marie', email: 'manageuse@elodiatech.com', role: 'manageuse' as const, actif: true },
  { nom: 'DURAND', prenom: 'Jean', email: 'agent1@elodiatech.com', role: 'agent' as const, actif: true },
  { nom: 'PIERRE', prenom: 'Sophie', email: 'agent2@elodiatech.com', role: 'agent' as const, actif: true },
  { nom: 'ROSEAU', prenom: 'Patrick', email: 'agent3@elodiatech.com', role: 'agent' as const, actif: true },
]

const DEMO_ACCOUNTS = [
  { role: 'Gerant', email: 'gerant@elodiatech.com' },
  { role: 'Manageuse', email: 'manageuse@elodiatech.com' },
  { role: 'Agent', email: 'agent1@elodiatech.com' },
]

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [creatingAuth, setCreatingAuth] = useState(false)
  const [demoLoaded, setDemoLoaded] = useState(false)
  const [authDone, setAuthDone] = useState(false)
  const { signIn, agent } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    supabase
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => {
        if (count && count > 0) setDemoLoaded(true)
      })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      toast('Email ou mot de passe incorrect', 'error')
      return
    }
    setTimeout(() => {
      const role = agent?.role
      if (role === 'gerant') navigate('/dashboard/gerant')
      else if (role === 'manageuse') navigate('/dashboard/manageuse')
      else navigate('/dashboard/agent')
    }, 600)
  }

  async function handleLoadDemo() {
    setLoadingDemo(true)
    try {
      for (const ag of AGENTS) {
        await supabase.auth.signUp({ email: ag.email, password: PWD })
      }
      const { data: insertedAgents, error: ae } = await supabase
        .from('agents').insert(AGENTS).select()
      if (ae) throw ae

      const manageuse = insertedAgents?.find(a => a.role === 'manageuse')
      const agentJean = insertedAgents?.find(a => a.prenom === 'Jean')
      const expiryDate = new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0]

      const { data: meds, error: me } = await supabase.from('medecins').insert([
        {
          code_elodiatech: 'ET-001', nom_cabinet: 'Cabinet du Dr BELLECOUR',
          nom_medecin: 'Dr Sophie BELLECOUR', logiciel: 'doctolib', offre: 'zen_fse',
          date_souscription: '2025-01-15', quota_zen: 40, statut_cpe: 'actif',
          date_expiration_cpe: '2027-01-15',
          adresse_mssante: 'sophie.bellecour@medecin.mssante.fr',
          email: 'contact@cabinet-bellecour.re', actif: true,
        },
        {
          code_elodiatech: 'ET-002', nom_cabinet: 'Medecine Generale Fort-de-France',
          nom_medecin: 'Dr Marc DUVALIER', logiciel: 'medistory', offre: 'liberty_fse',
          date_souscription: '2025-03-01', statut_cpe: 'expirant',
          date_expiration_cpe: expiryDate,
          adresse_mssante: 'marc.duvalier@medecin.mssante.fr',
          email: 'duvalier.medecin@gmail.com', actif: true,
        },
        {
          code_elodiatech: 'ET-003', nom_cabinet: 'Polyclinique du Lamentin',
          nom_medecin: 'Dr Isabelle CELESTE', logiciel: 'maiia', offre: 'pass_recup',
          date_souscription: '2024-11-01', tranche_pass_recup: 18000,
          statut_cpe: 'en_attente', email: 'celeste@polyclinique-lamentin.fr', actif: true,
        },
      ]).select()
      if (me) throw me

      const [m1, m2, m3] = meds!

      await supabase.from('rejets_fse').insert([
        {
          id_fse: 'FSE-2026-001234', date_rejet: '2026-06-01',
          medecin_id: m1.id, logiciel_source: 'doctolib',
          code_erreur: '1101', libelle_erreur: 'Droits AMO expires',
          famille_rejet: 'droits_adri', niveau_rejet: 'fse', part_concernee: 'amo',
          montant_fse: 250.00, agent_id: agentJean?.id,
          statut: 'en_attente', voie_traitement: 'auto', fichier_valide: false,
          ticket_correction: {
            famille: 'droits_adri', confiance: 0.95, voie: 'auto',
            diagnostic: 'Droits AMO expires. Verification ADRi recommandee.',
            procedure: ['Verifier droits ADRi', 'Mettre a jour Vitale', 'Retransmettre'],
          },
        },
        {
          id_fse: 'FSE-2026-001235', date_rejet: '2026-06-02',
          medecin_id: m2.id, logiciel_source: 'medistory',
          code_erreur: '2203', libelle_erreur: 'Code CCAM incompatible avec la specialite',
          famille_rejet: 'cotation', niveau_rejet: 'acte', part_concernee: 'amo',
          montant_fse: 180.50, agent_id: agentJean?.id,
          statut: 'en_cours', voie_traitement: 'agent', fichier_valide: false,
          ticket_correction: {
            famille: 'cotation', confiance: 0.78, voie: 'agent',
            diagnostic: 'Acte CCAM incompatible. Validation humaine obligatoire.',
            procedure: ['Verifier RPPS', 'Consulter CCAM', 'Corriger avec accord medical'],
          },
        },
        {
          id_fse: 'FSE-2026-001236', date_rejet: '2026-06-03',
          medecin_id: m3.id, logiciel_source: 'maiia',
          code_erreur: '3301', libelle_erreur: 'Numero RPPS du prescripteur absent',
          famille_rejet: 'parametrage', niveau_rejet: 'lot', part_concernee: 'amo',
          montant_fse: 520.75, statut: 'escalade_medecin',
          voie_traitement: 'medecin', fichier_valide: false,
          ticket_correction: {
            famille: 'parametrage', confiance: 0.88, voie: 'medecin',
            diagnostic: 'RPPS absent dans le parametre logiciel.',
            procedure: ['Contacter medecin via MSSante', 'Corriger RPPS dans Maiia', 'Retransmettre'],
          },
        },
      ])

      await supabase.from('facturation').insert([
        { periode: '2026-05', medecin_id: m1.id, offre: 'zen_fse', nb_rejets_traites: 42, montant_base: 99, nb_tranches_depassement: 1, montant_depassement: 40, montant_recupere: 1850, taux_commission: 0, montant_commission: 0, frais_dossier: 0, total_facture: 139, statut_paiement: 'payé' },
        { periode: '2026-05', medecin_id: m2.id, offre: 'liberty_fse', nb_rejets_traites: 18, montant_base: 0, nb_tranches_depassement: 0, montant_depassement: 0, montant_recupere: 2400, taux_commission: 0.12, montant_commission: 288, frais_dossier: 50, total_facture: 338, statut_paiement: 'en_attente' },
        { periode: '2026-05', medecin_id: m3.id, offre: 'pass_recup', nb_rejets_traites: 25, montant_base: 0, nb_tranches_depassement: 0, montant_depassement: 0, montant_recupere: 3200, taux_commission: 0.10, montant_commission: 320, frais_dossier: 99, total_facture: 419, statut_paiement: 'en_attente' },
      ])

      if (manageuse) {
        await supabase.from('commissions_manageuse').insert([
          { periode: '2026-04', manageuse_id: manageuse.id, nb_rejets_manageuse: 22, montant_facture_manageuse: 980, montant_facture_agents: 3200, statut_paiement: 'payé' },
          { periode: '2026-05', manageuse_id: manageuse.id, nb_rejets_manageuse: 28, montant_facture_manageuse: 1250, montant_facture_agents: 4100, statut_paiement: 'en_attente' },
          { periode: '2026-06', manageuse_id: manageuse.id, nb_rejets_manageuse: 15, montant_facture_manageuse: 680, montant_facture_agents: 2300, statut_paiement: 'en_attente' },
        ])
      }

      setDemoLoaded(true)
      setAuthDone(true)
      setEmail('gerant@elodiatech.com')
      setPassword(PWD)
      toast('Donnees de demo chargees ! Cliquez Se connecter.', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast('Erreur : ' + msg, 'error')
    }
    setLoadingDemo(false)
  }

  async function handleCreateAuth() {
    setCreatingAuth(true)
    let ok = 0
    for (const ag of AGENTS) {
      const { error } = await supabase.auth.signUp({ email: ag.email, password: PWD })
      if (!error || error.message.includes('already')) ok++
    }
    setAuthDone(true)
    setCreatingAuth(false)
    setEmail('gerant@elodiatech.com')
    setPassword(PWD)
    toast(ok + ' compte(s) crees. Essayez de vous connecter.', 'success')
  }

  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ backgroundColor: '#0D1B2A' }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-5" style={{ backgroundColor: '#00C4CC' }} />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-5" style={{ backgroundColor: '#00C4CC' }} />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <img
            src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png"
            alt="ElodiaTech"
            className="h-20 object-contain mb-8"
          />
          <h1 className="text-3xl font-bold text-white mb-3">ElodiaTech FSE</h1>
          <p className="text-white/60 text-base leading-relaxed">
            Plateforme de gestion des rejets FSE en Martinique
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 w-full">
            {[
              { label: 'Familles de rejets', value: '5' },
              { label: 'Logiciels integres', value: '6' },
              { label: 'Resolution auto', value: '+60%' },
              { label: 'Retransmission', value: '48h' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-bold" style={{ color: '#00C4CC' }}>{stat.value}</p>
                <p className="text-white/50 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png"
              alt="ElodiaTech"
              className="h-14 object-contain"
            />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Connexion</h2>
          <p className="text-slate-500 text-sm mb-8">Accedez a votre espace ElodiaTech FSE</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Adresse email"
              type="email"
              placeholder="prenom.nom@elodiatech.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
              autoComplete="email"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">Mot de passe</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-10 pl-10 pr-10 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00C4CC] focus:border-transparent placeholder:text-slate-400 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="teal" size="lg" loading={loading} className="w-full mt-6">
              Se connecter
            </Button>
          </form>

          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Comptes de demo</p>
              {demoLoaded ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Donnees chargees
                </span>
              ) : (
                <Button size="sm" variant="default" loading={loadingDemo} onClick={handleLoadDemo} className="text-xs h-7 px-2.5">
                  <Play className="w-3 h-3" />
                  Charger les donnees
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map(c => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => { setEmail(c.email); setPassword(PWD) }}
                  className="flex items-center justify-between w-full px-3 py-2 hover:bg-white rounded-lg transition-colors group"
                >
                  <span className="text-xs text-slate-500">{c.role}</span>
                  <span className="text-xs font-mono text-[#00C4CC] group-hover:underline">{c.email}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              Mot de passe : <span className="font-mono font-semibold">{PWD}</span>
            </p>
          </div>

          {demoLoaded && !authDone && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-800 font-semibold mb-1">
                Comptes Auth non crees
              </p>
              <p className="text-xs text-amber-700 mb-2">
                Dans Supabase, desactivez la confirmation email dans Authentication, puis cliquez ci-dessous.
              </p>
              <Button size="sm" variant="default" loading={creatingAuth} onClick={handleCreateAuth} className="w-full">
                <UserPlus className="w-3.5 h-3.5" />
                Creer les comptes de connexion
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
