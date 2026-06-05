import { useState } from 'react'
import { HelpCircle, ChevronDown } from 'lucide-react'

const FAQ = [
  {
    q: "Qu'est-ce qu'un rejet FSE ?",
    r: "Un rejet est une Feuille de Soins Électronique qui n'a pas été payée par l'Assurance Maladie ou la complémentaire, en raison d'une anomalie (droits, cotation, paramétrage, etc.). ElodiaTech analyse et corrige ces rejets pour récupérer les sommes dues.",
  },
  {
    q: "Que signifient les statuts de mes rejets ?",
    r: "« En attente » : pris en charge, traitement à venir. « En cours » : un agent travaille dessus. « Résolu » / « Retransmis » : corrigé et renvoyé à la caisse. « Action requise » : votre intervention est nécessaire (voir l'onglet Actions requises).",
  },
  {
    q: "Pourquoi me demande-t-on parfois d'intervenir ?",
    r: "Certains rejets (notamment de cotation ou de paramétrage de votre logiciel) ne peuvent être corrigés sans votre validation médicale ou une information que vous seul détenez. Dans ce cas, vous recevez un email et une fiche apparaît dans « Actions requises » avec la marche à suivre.",
  },
  {
    q: "Comment télécharger mes relevés et factures ?",
    r: "Rendez-vous dans l'onglet « Relevés et factures ». Chaque mois, vous pouvez télécharger le relevé détaillé de traitement (PDF) et votre facture.",
  },
  {
    q: "Qu'est-ce que la carte CPE et pourquoi son expiration est-elle signalée ?",
    r: "La carte CPE (ou eCPE) permet la signature électronique de vos feuilles de soins. Si elle expire, la transmission des FSE est bloquée. Nous vous alertons en amont pour anticiper le renouvellement auprès de l'ANS (délai 4 à 8 semaines).",
  },
  {
    q: "Mes données de santé sont-elles protégées ?",
    r: "Oui. Vos données sont traitées de manière confidentielle, conformément à la réglementation (RGPD). Seules les personnes habilitées d'ElodiaTech y accèdent, dans le cadre du traitement de vos rejets.",
  },
  {
    q: "Comment fonctionne ma facturation ?",
    r: "Selon l'offre souscrite : ZEN FSE (abonnement mensuel par paliers de rejets), LIBERTY FSE (commission sur les montants récupérés), ou PASS RÉCUP' (commission selon le volume récupéré). Le détail figure sur chaque facture.",
  },
  {
    q: "Qui contacter en cas de question ?",
    r: "Écrivez-nous à contact@elodiatech.com. Notre équipe vous répond et peut vous accompagner sur tout point concernant vos rejets ou votre espace.",
  },
]

export function MedecinFAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <HelpCircle className="w-5 h-5 text-[#00C4CC]" />
        <h2 className="text-sm font-semibold text-slate-900">Foire aux questions</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {FAQ.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex items-center gap-3 w-full px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-medium text-slate-900 flex-1">{item.q}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && (
              <div className="px-5 pb-4 -mt-1">
                <p className="text-sm text-slate-600 leading-relaxed">{item.r}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-xs text-slate-500 text-center">
          Une autre question ? Écrivez-nous à{' '}
          <a href="mailto:contact@elodiatech.com" className="text-[#00C4CC] font-medium">contact@elodiatech.com</a>
        </p>
      </div>
    </div>
  )
}
