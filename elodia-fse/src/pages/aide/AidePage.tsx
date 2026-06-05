import { useState, useRef, useEffect } from 'react'
import {
  HelpCircle, Send, Sparkles, BookOpen, FileX2, UserRound,
  Receipt, Upload, AlertTriangle, ChevronDown, Bot, User as UserIcon
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'

interface ChatMessage { role: 'user' | 'model'; content: string }

const GUIDES = [
  {
    icon: <FileX2 className="w-5 h-5" />,
    titre: 'Traiter un rejet',
    contenu: [
      'Ouvrez la page Rejets FSE ou votre Kanban.',
      'Cliquez sur un rejet pour voir le détail et le diagnostic IA.',
      'Suivez la procédure proposée.',
      'Mettez à jour le statut et le montant récupéré, puis sauvegardez.',
    ],
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    titre: 'Comprendre les files A / B / C',
    contenu: [
      'File A (vert) : résolution automatique — vous validez.',
      'File B (orange) : intervention manuelle d\'un agent.',
      'File C (rouge) : action du médecin requise (email + relances auto).',
      'Règle : un rejet de cotation ne va jamais en File A.',
    ],
  },
  {
    icon: <Upload className="w-5 h-5" />,
    titre: 'Importer des rejets (RSP)',
    contenu: [
      'Allez dans Ingestion RSP.',
      'Sélectionnez le médecin et le logiciel source.',
      'Glissez le fichier .rsp ou .csv.',
      'Vérifiez l\'aperçu, puis cliquez « Ingérer ».',
    ],
  },
  {
    icon: <UserRound className="w-5 h-5" />,
    titre: 'Donner l\'accès à un médecin',
    contenu: [
      'Ouvrez la fiche du médecin.',
      'Cliquez sur « Lien espace médecin » (copie le lien).',
      'Envoyez ce lien au médecin par email.',
      'Il pourra suivre ses rejets et télécharger ses documents.',
    ],
  },
  {
    icon: <Receipt className="w-5 h-5" />,
    titre: 'Envoyer un relevé / une facture',
    contenu: [
      'Allez dans Facturation.',
      'Sur la ligne du médecin, cliquez « Envoyer ».',
      'Ou « Envoyer relevés du mois » pour tout envoyer d\'un coup.',
    ],
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    titre: 'Les 5 familles de rejets',
    contenu: [
      'Droits/ADRi : droits AMO, NIR — souvent automatisable.',
      'Cotation : CCAM — validation médecin obligatoire.',
      'Paramétrage : RPPS, FINESS, signature CPE.',
      'Caisse : dossier en instruction/litige.',
      'AMC/DRE : complémentaire santé.',
    ],
  },
]

const SUGGESTIONS = [
  'Comment traiter un rejet de cotation ?',
  'Que signifie la File C ?',
  'Comment relancer un médecin qui ne répond pas ?',
  'Quelle est la différence entre les offres ZEN, LIBERTY et PASS RÉCUP\' ?',
]

export function AidePage() {
  const [openGuide, setOpenGuide] = useState<number | null>(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function send(question?: string) {
    const q = (question ?? input).trim()
    if (!q || loading) return
    setInput('')
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (res.status === 503) {
        setNotConfigured(true)
        setLoading(false)
        return
      }

      const data = await res.json()
      if (!res.ok) {
        console.error('Assistant error:', data)
        setMessages([...newMessages, {
          role: 'model',
          content: "Désolé, une erreur technique m'empêche de répondre pour le moment. Réessayez dans un instant, ou contactez le support si cela persiste.",
        }])
        setLoading(false)
        return
      }
      const reply = data.reply || "Désolé, je n'ai pas pu répondre. Réessayez."
      setMessages([...newMessages, { role: 'model', content: reply }])
    } catch {
      setMessages([...newMessages, { role: 'model', content: "Erreur de connexion à l'assistant. Réessayez." }])
    }
    setLoading(false)
  }

  return (
    <AppLayout title="Aide" subtitle="Guides d'utilisation et assistant IA">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne guides */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#00C4CC]" />
            <h2 className="text-sm font-semibold text-slate-900">Guides rapides</h2>
          </div>
          <div className="space-y-2">
            {GUIDES.map((g, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenGuide(openGuide === i ? null : i)}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[#00C4CC]">{g.icon}</span>
                  <span className="text-sm font-medium text-slate-900 flex-1">{g.titre}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openGuide === i ? 'rotate-180' : ''}`} />
                </button>
                {openGuide === i && (
                  <div className="px-4 pb-4 pt-1">
                    <ol className="space-y-1.5">
                      {g.contenu.map((c, j) => (
                        <li key={j} className="flex gap-2 text-sm text-slate-600">
                          <span className="text-[#00C4CC] font-semibold flex-shrink-0">{j + 1}.</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Colonne assistant IA */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col" style={{ height: '600px' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-[#00C4CC]/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#00C4CC]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assistant ElodiaTech</h2>
              <p className="text-xs text-slate-400">Posez vos questions sur l'app et le métier FSE</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.length === 0 && !notConfigured && (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 mb-4">Comment puis-je vous aider ?</p>
                <div className="space-y-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-50 hover:bg-[#00C4CC]/10 text-slate-600 hover:text-[#00C4CC] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {notConfigured && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Assistant pas encore activé</p>
                    <p className="text-xs text-amber-600 mt-1">
                      La clé Anthropic doit être ajoutée dans les réglages (variable <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code>). Les guides ci-contre restent disponibles.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  m.role === 'user' ? 'bg-[#0D1B2A]' : 'bg-[#00C4CC]/10'
                }`}>
                  {m.role === 'user'
                    ? <UserIcon className="w-3.5 h-3.5 text-white" />
                    : <Sparkles className="w-3.5 h-3.5 text-[#00C4CC]" />}
                </div>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#0D1B2A] text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#00C4CC]/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-[#00C4CC]" />
                </div>
                <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                placeholder="Posez votre question..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#00C4CC] focus:ring-2 focus:ring-[#00C4CC]/20"
              />
              <button
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#00C4CC] text-white hover:bg-[#00b0b7] transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              L'assistant peut se tromper — vérifiez les informations importantes.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
