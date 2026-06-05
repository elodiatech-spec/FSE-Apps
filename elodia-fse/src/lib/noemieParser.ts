/**
 * ElodiaTech FSE — Parser NOEMIE RSP
 *
 * Référence normative :
 *   - CDC SESAM-Vitale 1.40 Addendum 8 (fév. 2023)
 *   - OCT-CDC-004 v2.08 (RSP / NOEMIE-PS)
 *
 * Format RSP NOEMIE-PS :
 *   Fichier texte ASCII, enregistrements de longueur fixe.
 *   Chaque ligne commence par un code d'enregistrement 2 chiffres.
 *
 *   03 — En-tête lot
 *   04 — Identification émetteur
 *   09 — En-tête RSP
 *   11 — En-tête FSE
 *   20 — Détail prestation
 *   51 — Rejet lot
 *   52 — Rejet FSE
 *   54 — Rejet acte/prestation
 *   59 — Signalement
 *   61 — Données paiement
 *   99 — Fin de fichier
 */

export interface RejetsNoemie {
  id_fse: string
  code_erreur: string
  libelle_erreur: string
  famille_rejet: 'droits_adri' | 'cotation' | 'parametrage' | 'caisse' | 'amc_dre'
  niveau_rejet: 'lot' | 'fse' | 'acte' | 'signalement'
  part_concernee: 'amo' | 'amc' | 'les_deux'
  montant_fse: number
  date_rejet: string
  logiciel_source: string
  voie_traitement: 'auto' | 'agent' | 'medecin'
  confiance: number
  ticket_correction: {
    diagnostic: string
    procedure: string[]
    famille: string
    voie: string
    confiance: number
  }
}

export interface ParseResult {
  rejets: RejetsNoemie[]
  total: number
  errors: string[]
  format: 'noemie' | 'csv' | 'unknown'
}

// ─── Base de connaissance des codes erreur NOEMIE ────────────────────────────

const CODES_ERREUR: Record<string, {
  libelle: string
  famille: RejetsNoemie['famille_rejet']
  voie: RejetsNoemie['voie_traitement']
  procedure: string[]
  diagnostic: string
  confiance: number
}> = {
  // FAMILLE 1 — Droits / ADRi
  '1101': {
    libelle: 'Droits AMO fermes ou inexistants a la date de soins',
    famille: 'droits_adri',
    voie: 'auto',
    confiance: 0.95,
    diagnostic: 'Les droits AMO du patient sont fermes a la date de la consultation. Verification ADRi necessaire pour mise a jour.',
    procedure: [
      'Interroger ADRi pour verifier les droits en temps reel',
      'Mettre a jour la carte Vitale du patient',
      'Regenerer la FSE avec les droits actualises',
      'Retransmettre dans le prochain lot'
    ]
  },
  '1102': {
    libelle: 'Beneficiaire inconnu de la caisse',
    famille: 'droits_adri',
    voie: 'auto',
    confiance: 0.90,
    diagnostic: 'Le beneficiaire n est pas reconnu par la caisse destinataire. Verification du numero de SS necessaire.',
    procedure: [
      'Verifier le numero de securite sociale via INSi',
      'Controler la coherence nom/prenom/date de naissance',
      'Corriger les informations patient dans le logiciel',
      'Retransmettre la FSE corrigee'
    ]
  },
  '1103': {
    libelle: 'Piece justificative expiree ou absente',
    famille: 'droits_adri',
    voie: 'auto',
    confiance: 0.85,
    diagnostic: 'La piece justificative (carte Vitale, attestation) est expiree ou manquante.',
    procedure: [
      'Demander au patient une nouvelle attestation AMO',
      'Mettre a jour la carte Vitale ou saisir manuellement',
      'Retransmettre avec PJ valide'
    ]
  },
  '1110': {
    libelle: 'Identifiant patient incorrect (NIR/NIA)',
    famille: 'droits_adri',
    voie: 'auto',
    confiance: 0.92,
    diagnostic: 'Le NIR ou NIA du patient est incorrect ou mal formule.',
    procedure: [
      'Verifier le NIR via le teleservice INSi',
      'Corriger le numero beneficiaire',
      'Regenerer et retransmettre la FSE'
    ]
  },
  // FAMILLE 2 — Cotation
  '2201': {
    libelle: 'Code acte CCAM invalide ou inconnu',
    famille: 'cotation',
    voie: 'agent',
    confiance: 0.80,
    diagnostic: 'Le code acte CCAM saisi n existe pas ou est desactive. Verification du referentiel necessaire.',
    procedure: [
      'Consulter le referentiel CCAM officiel (ameli.fr)',
      'Verifier la date de validite du code acte',
      'Proposer le code correct au medecin pour validation',
      'Ne pas corriger sans accord explicite du medecin'
    ]
  },
  '2203': {
    libelle: 'Acte incompatible avec la specialite du praticien',
    famille: 'cotation',
    voie: 'agent',
    confiance: 0.78,
    diagnostic: 'L acte CCAM cote n est pas autorise pour la specialite du medecin. Validation medicale obligatoire.',
    procedure: [
      'Verifier la specialite declaree dans le RPPS',
      'Consulter les regles de cotation CCAM pour cette specialite',
      'Obtenir validation explicite du medecin',
      'Corriger la cotation uniquement apres aval medical'
    ]
  },
  '2204': {
    libelle: 'Association d actes non conforme aux regles CCAM',
    famille: 'cotation',
    voie: 'agent',
    confiance: 0.75,
    diagnostic: 'L association des actes CCAM sur cette FSE ne respecte pas les regles de compatibilite.',
    procedure: [
      'Analyser les regles d association CCAM (modificateurs, regles de cumul)',
      'Identifier l acte principal et les actes associes',
      'Corriger les coefficients ou retirer l acte incompatible',
      'Valider avec le medecin avant retransmission'
    ]
  },
  '2210': {
    libelle: 'Tarif hors nomenclature ou depassement non justifie',
    famille: 'cotation',
    voie: 'agent',
    confiance: 0.72,
    diagnostic: 'Le tarif facture ne correspond pas a la nomenclature ou le depassement d honoraires n est pas justifie.',
    procedure: [
      'Verifier le tarif opposable selon la convention du medecin',
      'Controler la mention du depassement et son motif',
      'Corriger le montant ou la mention de depassement',
      'Validation medicale requise'
    ]
  },
  // FAMILLE 3 — Parametrage
  '3301': {
    libelle: 'Numero RPPS du praticien absent ou invalide',
    famille: 'parametrage',
    voie: 'medecin',
    confiance: 0.88,
    diagnostic: 'Le numero RPPS du praticien executant est absent ou invalide dans la FSE.',
    procedure: [
      'Contacter le medecin pour verifier son RPPS dans le logiciel',
      'Verifier le RPPS sur le portail RPPS/ADELI',
      'Corriger le parametre dans le logiciel medical',
      'Retransmettre le lot apres correction'
    ]
  },
  '3302': {
    libelle: 'Numero FINESS absent ou invalide',
    famille: 'parametrage',
    voie: 'medecin',
    confiance: 0.85,
    diagnostic: 'Le numero FINESS de l etablissement est absent ou incorrect dans le parametre logiciel.',
    procedure: [
      'Verifier le FINESS sur le portail eS-sante',
      'Corriger dans les parametres du logiciel',
      'Retransmettre apres correction'
    ]
  },
  '3303': {
    libelle: 'Format de fichier non conforme au standard B2',
    famille: 'parametrage',
    voie: 'medecin',
    confiance: 0.82,
    diagnostic: 'Le fichier FSE n est pas conforme au format B2 (2003 ou 2004). Probleme de version logicielle possible.',
    procedure: [
      'Verifier la version du logiciel medical (mise a jour requise ?)',
      'Contacter le support du logiciel si le format est incorrect',
      'Regenerer le lot FSE apres mise a jour'
    ]
  },
  '3310': {
    libelle: 'Signature electronique absente ou invalide (CPS/CPE)',
    famille: 'parametrage',
    voie: 'medecin',
    confiance: 0.90,
    diagnostic: 'La signature electronique du lot FSE est absente, invalide ou le certificat est expire.',
    procedure: [
      'Verifier le statut de la carte CPS ou CPE',
      'Renouveler la carte si expiree (contacter ANS)',
      'Resignre le lot avec une carte valide',
      'Retransmettre'
    ]
  },
  // FAMILLE 4 — Caisse en attente
  '4401': {
    libelle: 'Dossier en cours de traitement par la caisse',
    famille: 'caisse',
    voie: 'agent',
    confiance: 0.60,
    diagnostic: 'La caisse est en cours d instruction du dossier. Un RSP complementaire sera emis. Aucune action immediate requise.',
    procedure: [
      'Mettre le rejet en surveillance (statut "en attente caisse")',
      'Attendre le RSP complementaire (delai : 7 a 30 jours)',
      'Relancer la caisse si pas de retour apres 30 jours'
    ]
  },
  '4402': {
    libelle: 'Dossier en litige - traitement suspendus',
    famille: 'caisse',
    voie: 'agent',
    confiance: 0.55,
    diagnostic: 'Le dossier est en litige aupres de la caisse. Contact direct avec la CPAM necessaire.',
    procedure: [
      'Identifier le numero de dossier litige',
      'Contacter la CPAM par courrier recommande ou MSS',
      'Joindre les pieces justificatives',
      'Suivre la reponse dans les 45 jours'
    ]
  },
  // FAMILLE 5 — AMC / DRE
  '5501': {
    libelle: 'Destinataire AMC inconnu ou inactif',
    famille: 'amc_dre',
    voie: 'auto',
    confiance: 0.85,
    diagnostic: 'L organisme AMC destinataire de la DRE est inconnu ou n est plus actif.',
    procedure: [
      'Verifier les droits AMC du patient via ADRi',
      'Mettre a jour le code organisme AMC',
      'Retransmettre la DRE au bon destinataire'
    ]
  },
  '5502': {
    libelle: 'Taux AMC non conforme au contrat',
    famille: 'amc_dre',
    voie: 'auto',
    confiance: 0.80,
    diagnostic: 'Le taux de prise en charge AMC ne correspond pas au contrat de l assure.',
    procedure: [
      'Verifier les conditions du contrat AMC via ADRi',
      'Corriger le taux dans la FSE',
      'Retransmettre la DRE corrigee'
    ]
  },
  '5510': {
    libelle: 'DRE rejetee - piece justificative AMC manquante',
    famille: 'amc_dre',
    voie: 'agent',
    confiance: 0.78,
    diagnostic: 'La demande de remboursement complementaire est rejetee par l AMC faute de piece justificative.',
    procedure: [
      'Identifier la PJ manquante (ordonnance, prescription, ALD)',
      'Contacter le patient ou le medecin pour obtenir la PJ',
      'Transmettre via SCOR ou courrier',
      'Retransmettre la DRE avec la PJ jointe'
    ]
  }
}

// ─── Codes par défaut pour codes inconnus ────────────────────────────────────

function classifyUnknownCode(code: string): typeof CODES_ERREUR[string] {
  const prefix = code.slice(0, 1)
  const defaults: Record<string, typeof CODES_ERREUR[string]> = {
    '1': {
      libelle: 'Rejet relatif aux droits assure (code ' + code + ')',
      famille: 'droits_adri', voie: 'auto', confiance: 0.60,
      diagnostic: 'Code erreur droits AMO non repertorie. Verification manuelle des droits necessaire.',
      procedure: ['Verifier les droits AMO via ADRi', 'Contacter la caisse si necessaire']
    },
    '2': {
      libelle: 'Rejet de cotation (code ' + code + ')',
      famille: 'cotation', voie: 'agent', confiance: 0.50,
      diagnostic: 'Code erreur cotation non repertorie. Verification manuelle de la cotation CCAM/NGAP requise.',
      procedure: ['Verifier le referentiel CCAM', 'Validation medicale obligatoire']
    },
    '3': {
      libelle: 'Rejet de parametrage (code ' + code + ')',
      famille: 'parametrage', voie: 'medecin', confiance: 0.55,
      diagnostic: 'Code erreur parametrage non repertorie. Verification du parametre logiciel necessaire.',
      procedure: ['Verifier le parametre logiciel', 'Contacter le support logiciel si necessaire']
    },
    '4': {
      libelle: 'Rejet caisse en attente (code ' + code + ')',
      famille: 'caisse', voie: 'agent', confiance: 0.50,
      diagnostic: 'Code erreur caisse non repertorie. Surveillance du RSP complementaire.',
      procedure: ['Mettre en surveillance', 'Attendre RSP complementaire']
    },
    '5': {
      libelle: 'Rejet AMC/DRE (code ' + code + ')',
      famille: 'amc_dre', voie: 'auto', confiance: 0.55,
      diagnostic: 'Code erreur AMC non repertorie. Verification des droits complementaires necessaire.',
      procedure: ['Verifier droits AMC via ADRi', 'Retransmettre si necessaire']
    }
  }
  return defaults[prefix] || {
    libelle: 'Code erreur inconnu (' + code + ')',
    famille: 'parametrage', voie: 'agent', confiance: 0.30,
    diagnostic: 'Code erreur non identifie. Traitement manuel requis.',
    procedure: ['Rechercher le code dans la documentation NOEMIE', 'Contacter la CPAM si besoin']
  }
}

// ─── Parser NOEMIE texte ──────────────────────────────────────────────────────

function parseNoemie(content: string, logiciel = 'inconnu'): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const rejets: RejetsNoemie[] = []
  const errors: string[] = []

  let currentFSE = ''
  let currentMontant = 0
  let currentDate = new Date().toISOString().split('T')[0]

  for (const line of lines) {
    if (line.length < 2) continue
    const code = line.slice(0, 2)
    const data = line.slice(2).trim()

    try {
      switch (code) {
        case '11': // En-tête FSE
          // Format: [id_fse][date][montant][...]
          currentFSE = data.slice(0, 13).trim() || ('FSE-' + Date.now())
          const dateRaw = data.slice(13, 21).trim()
          if (dateRaw.length === 8) {
            currentDate = `${dateRaw.slice(4, 8)}-${dateRaw.slice(2, 4)}-${dateRaw.slice(0, 2)}`
          }
          const montantRaw = data.slice(21, 34).trim()
          currentMontant = montantRaw ? parseFloat(montantRaw) / 100 : 0
          break

        case '51': // Rejet lot
        case '52': // Rejet FSE
        case '54': { // Rejet acte
          const niveauMap: Record<string, RejetsNoemie['niveau_rejet']> = {
            '51': 'lot', '52': 'fse', '54': 'acte'
          }
          const niveau = niveauMap[code]

          // Extraction code erreur (positions variables selon version)
          // Position 6 de l'entite 294 selon CDC
          const codeErreur = data.slice(0, 6).trim() || data.slice(0, 4).trim()
          const partRaw = data.slice(6, 7).trim()
          const partMap: Record<string, RejetsNoemie['part_concernee']> = {
            '1': 'amo', '2': 'amc', '3': 'les_deux', 'A': 'amo', 'C': 'amc'
          }
          const part: RejetsNoemie['part_concernee'] = partMap[partRaw] || 'amo'

          if (!codeErreur) break

          const infos = CODES_ERREUR[codeErreur] || classifyUnknownCode(codeErreur)

          // REGLE METIER : cotation → jamais voie auto
          const voie = infos.famille === 'cotation' ? 'agent' : infos.voie

          rejets.push({
            id_fse: currentFSE,
            code_erreur: codeErreur,
            libelle_erreur: infos.libelle,
            famille_rejet: infos.famille,
            niveau_rejet: niveau,
            part_concernee: part,
            montant_fse: currentMontant,
            date_rejet: currentDate,
            logiciel_source: logiciel,
            voie_traitement: voie,
            confiance: infos.confiance,
            ticket_correction: {
              famille: infos.famille,
              voie,
              confiance: infos.confiance,
              diagnostic: infos.diagnostic,
              procedure: infos.procedure
            }
          })
          break
        }

        case '99': // Fin de fichier
          break
      }
    } catch (e) {
      errors.push(`Ligne ignoree (code ${code}): ${(e as Error).message}`)
    }
  }

  return { rejets, total: rejets.length, errors, format: 'noemie' }
}

// ─── Parser CSV (export logiciels) ───────────────────────────────────────────

function parseCsv(content: string, logiciel = 'inconnu'): ParseResult {
  const lines = content.split('\n').filter(Boolean)
  const rejets: RejetsNoemie[] = []
  const errors: string[] = []

  // Detecter le séparateur
  const sep = lines[0]?.includes(';') ? ';' : ','

  // Detecter les colonnes depuis l'en-tête
  const headers = lines[0]?.toLowerCase().split(sep).map(h => h.trim().replace(/"/g, '')) || []

  const col = (name: string) => {
    const variants = [name, name.replace(/_/g, ' '), name.replace(/_/g, '-')]
    for (const v of variants) {
      const idx = headers.findIndex(h => h.includes(v))
      if (idx >= 0) return idx
    }
    return -1
  }

  const idfseCol = col('fse') >= 0 ? col('fse') : col('id')
  const codeCol = col('code_erreur') >= 0 ? col('code_erreur') : col('code')
  const libelleCol = col('libelle') >= 0 ? col('libelle') : col('motif')
  const montantCol = col('montant')
  const dateCol = col('date')

  for (let i = 1; i < lines.length; i++) {
    try {
      const cells = lines[i].split(sep).map(c => c.trim().replace(/"/g, ''))
      if (cells.length < 2) continue

      const codeErreur = (codeCol >= 0 ? cells[codeCol] : '').trim()
      if (!codeErreur) continue

      const infos = CODES_ERREUR[codeErreur] || classifyUnknownCode(codeErreur)
      const voie = infos.famille === 'cotation' ? 'agent' : infos.voie
      const montantRaw = montantCol >= 0 ? cells[montantCol] : '0'
      const montant = parseFloat(montantRaw.replace(',', '.')) || 0
      const dateRaw = dateCol >= 0 ? cells[dateCol] : ''

      let dateRejet = new Date().toISOString().split('T')[0]
      if (dateRaw) {
        if (dateRaw.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [d, m, y] = dateRaw.split('/')
          dateRejet = `${y}-${m}-${d}`
        } else if (dateRaw.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateRejet = dateRaw
        }
      }

      rejets.push({
        id_fse: idfseCol >= 0 ? cells[idfseCol] : ('FSE-' + i),
        code_erreur: codeErreur,
        libelle_erreur: libelleCol >= 0 ? cells[libelleCol] : infos.libelle,
        famille_rejet: infos.famille,
        niveau_rejet: 'fse',
        part_concernee: 'amo',
        montant_fse: montant,
        date_rejet: dateRejet,
        logiciel_source: logiciel,
        voie_traitement: voie,
        confiance: infos.confiance,
        ticket_correction: {
          famille: infos.famille,
          voie,
          confiance: infos.confiance,
          diagnostic: infos.diagnostic,
          procedure: infos.procedure
        }
      })
    } catch (e) {
      errors.push(`Ligne ${i + 1} ignoree: ${(e as Error).message}`)
    }
  }

  return { rejets, total: rejets.length, errors, format: 'csv' }
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────

export function parseRspFile(content: string, filename: string, logiciel = 'inconnu'): ParseResult {
  const trimmed = content.trim()

  // Detecter format
  if (trimmed.match(/^0[39]/m) || trimmed.match(/^(11|52|54|51)\s/m)) {
    return parseNoemie(trimmed, logiciel)
  }

  if (trimmed.includes(';') || (trimmed.includes(',') && trimmed.split('\n')[0]?.toLowerCase().includes('fse'))) {
    return parseCsv(trimmed, logiciel)
  }

  // Essayer NOEMIE par defaut
  const noemieResult = parseNoemie(trimmed, logiciel)
  if (noemieResult.rejets.length > 0) return noemieResult

  // Essayer CSV en dernier recours
  const csvResult = parseCsv(trimmed, logiciel)
  if (csvResult.rejets.length > 0) return csvResult

  return { rejets: [], total: 0, errors: ['Format non reconnu — attendu : NOEMIE-PS ou CSV'], format: 'unknown' }
}

// Export de la base de connaissance pour l'UI
export { CODES_ERREUR }
