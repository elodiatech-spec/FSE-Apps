/**
 * ElodiaTech FSE — Export de données CSV et Excel
 *
 * Utilise SheetJS (xlsx) pour générer des fichiers Excel professionnels
 * avec en-têtes stylisés, et CSV natif pour la compatibilité maximale.
 */

import ExcelJS from 'exceljs'
import { RejetFSE, Facturation, Medecin } from './supabase'
import { formatCurrency, formatDate, formatPeriode } from './utils'

// ─── Helpers ────────────────────────────────────────────────────────────────

function dateStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  résolu: 'Résolu',
  non_résolu: 'Non résolu',
  escalade_medecin: 'Escalade médecin',
  retransmis: 'Retransmis',
}

const FAMILLE_LABELS: Record<string, string> = {
  droits_adri: 'Droits / ADRi',
  cotation: 'Cotation',
  parametrage: 'Paramétrage',
  caisse: 'Caisse',
  amc_dre: 'AMC / DRE',
}

const VOIE_LABELS: Record<string, string> = {
  auto: 'File A (Auto)',
  agent: 'File B (Agent)',
  medecin: 'File C (Médecin)',
}

/** Génère et déclenche le téléchargement d'un fichier Excel à partir de lignes */
async function downloadExcel(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)

  if (rows.length > 0) {
    const keys = Object.keys(rows[0])
    ws.columns = keys.map(k => ({
      header: k,
      key: k,
      width: Math.min(
        Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)) + 2,
        50
      ),
    }))
    ws.addRows(rows)
    // En-tête en gras + fond marine
    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Génère et déclenche le téléchargement d'un fichier CSV (séparateur ; pour Excel FR) */
function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = keys.join(';')
  const body = rows.map(r => keys.map(k => escape(r[k])).join(';')).join('\n')
  // BOM UTF-8 pour les accents dans Excel
  const blob = new Blob(['﻿' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Export Rejets FSE ────────────────────────────────────────────────────────

function rejetsToRows(rejets: RejetFSE[]) {
  return rejets.map(r => ({
    'N° FSE': r.id_fse,
    'Date rejet': formatDate(r.date_rejet),
    'Cabinet': (r as RejetFSE & { medecins?: { nom_cabinet?: string } }).medecins?.nom_cabinet || '',
    'Code erreur': r.code_erreur,
    'Libellé': r.libelle_erreur,
    'Famille': FAMILLE_LABELS[r.famille_rejet] || r.famille_rejet,
    'Niveau': r.niveau_rejet,
    'Part': r.part_concernee,
    'Logiciel': r.logiciel_source,
    'Montant FSE (€)': r.montant_fse,
    'Montant récupéré (€)': r.montant_recupere ?? '',
    'Statut': STATUT_LABELS[r.statut] || r.statut,
    'File': r.voie_traitement ? (VOIE_LABELS[r.voie_traitement] || r.voie_traitement) : '',
    'Nb relances': (r as RejetFSE & { nb_relances?: number }).nb_relances ?? 0,
  }))
}

export function exportRejetsExcel(rejets: RejetFSE[]) {
  downloadExcel(rejetsToRows(rejets), 'Rejets FSE', `Rejets_FSE_${dateStamp()}.xlsx`)
}

export function exportRejetsCsv(rejets: RejetFSE[]) {
  downloadCsv(rejetsToRows(rejets), `Rejets_FSE_${dateStamp()}.csv`)
}

// ─── Export Facturation ───────────────────────────────────────────────────────

function facturationToRows(factures: Facturation[], medecins: Medecin[]) {
  const medMap = new Map(medecins.map(m => [m.id, m]))
  return factures.map(f => {
    const med = medMap.get(f.medecin_id)
    return {
      'Période': formatPeriode(f.periode),
      'Cabinet': med?.nom_cabinet || '',
      'Offre': (med?.offre || '').replace(/_/g, ' ').toUpperCase(),
      'Rejets traités': f.nb_rejets_traites,
      'Montant récupéré (€)': f.montant_recupere,
      'Commission (€)': f.montant_commission,
      'Dépassement (€)': f.montant_depassement,
      'Frais dossier (€)': f.frais_dossier,
      'Total facturé (€)': f.total_facture,
      'Statut paiement': f.statut_paiement,
    }
  })
}

export function exportFacturationExcel(factures: Facturation[], medecins: Medecin[]) {
  downloadExcel(facturationToRows(factures, medecins), 'Facturation', `Facturation_${dateStamp()}.xlsx`)
}

export function exportFacturationCsv(factures: Facturation[], medecins: Medecin[]) {
  downloadCsv(facturationToRows(factures, medecins), `Facturation_${dateStamp()}.csv`)
}

// ─── Export Médecins ──────────────────────────────────────────────────────────

function medecinsToRows(medecins: Medecin[]) {
  return medecins.map(m => ({
    'Code ElodiaTech': m.code_elodiatech,
    'Cabinet': m.nom_cabinet,
    'Médecin': m.nom_medecin,
    'Email': m.email || '',
    'Logiciel': m.logiciel,
    'Offre': m.offre.replace(/_/g, ' ').toUpperCase(),
    'Statut CPE': m.statut_cpe || '',
    'Expiration CPE': m.date_expiration_cpe ? formatDate(m.date_expiration_cpe) : '',
    'Actif': m.actif ? 'Oui' : 'Non',
    'Date souscription': m.date_souscription ? formatDate(m.date_souscription) : '',
  }))
}

export function exportMedecinsExcel(medecins: Medecin[]) {
  downloadExcel(medecinsToRows(medecins), 'Médecins', `Medecins_${dateStamp()}.xlsx`)
}

export function exportMedecinsCsv(medecins: Medecin[]) {
  downloadCsv(medecinsToRows(medecins), `Medecins_${dateStamp()}.csv`)
}
