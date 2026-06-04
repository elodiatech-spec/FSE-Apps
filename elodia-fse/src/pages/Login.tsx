import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn, agent } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

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

    // The agent state will be set asynchronously; redirect based on role
    // We need to wait for agent to be loaded
    setTimeout(() => {
      const role = agent?.role
      if (role === 'gerant') navigate('/dashboard/gerant')
      else if (role === 'manageuse') navigate('/dashboard/manageuse')
      else navigate('/dashboard/agent')
    }, 500)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ backgroundColor: '#0D1B2A' }}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-5" style={{ backgroundColor: '#00C4CC' }} />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-5" style={{ backgroundColor: '#00C4CC' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-3" style={{ backgroundColor: '#00C4CC' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <img
            src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png"
            alt="ElodiaTech"
            className="h-20 object-contain mb-8"
          />
          <h1 className="text-3xl font-bold text-white mb-3">ElodiaTech FSE</h1>
          <p className="text-white/60 text-base leading-relaxed">
            Plateforme de gestion des rejets de feuilles de soins électroniques en Martinique
          </p>

          <div className="mt-12 grid grid-cols-2 gap-4 w-full">
            {[
              { label: 'Familles de rejets', value: '5' },
              { label: 'Logiciels intégrés', value: '6' },
              { label: 'Taux résolution auto', value: '>60%' },
              { label: 'Délai retransmission', value: '<48h' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-2xl font-bold" style={{ color: '#00C4CC' }}>{stat.value}</p>
                <p className="text-white/50 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
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
          <p className="text-slate-500 text-sm mb-8">Accédez à votre espace ElodiaTech FSE</p>

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
                  placeholder="••••••••"
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

            <Button
              type="submit"
              variant="teal"
              size="lg"
              loading={loading}
              className="w-full mt-6"
            >
              Se connecter
            </Button>
          </form>

          <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Comptes de démo</p>
            <div className="space-y-1.5">
              {[
                { role: 'Gérant', email: 'gerant@elodiatech.com' },
                { role: 'Manageuse', email: 'manageuse@elodiatech.com' },
                { role: 'Agent', email: 'agent@elodiatech.com' },
              ].map(c => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => { setEmail(c.email); setPassword('demo123456') }}
                  className="flex items-center justify-between w-full px-3 py-2 hover:bg-white rounded-lg transition-colors group"
                >
                  <span className="text-xs text-slate-500">{c.role}</span>
                  <span className="text-xs font-mono text-[#00C4CC] group-hover:underline">{c.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
