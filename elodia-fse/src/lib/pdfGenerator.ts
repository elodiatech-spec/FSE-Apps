import jsPDF from 'jspdf'
import { Medecin, RejetFSE, Facturation } from './supabase'
import { formatCurrency, formatDate, formatPeriode, calculerZenFSE, calculerLibertyFSE, calculerPassRecup } from './utils'

const MARINE = '#0D1B2A'
const TEAL = '#00C4CC'

function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  // Background header
  doc.setFillColor(13, 27, 42)
  doc.rect(0, 0, 210, 35, 'F')

  // ElodiaTech text (logo)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('ElodiaTech', 15, 15)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 196, 204)
  doc.text('FSE Manager', 15, 21)

  // Title on right
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 210 - 15, 14, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 200, 220)
  doc.text(subtitle, 210 - 15, 21, { align: 'right' })

  // Teal line
  doc.setFillColor(0, 196, 204)
  doc.rect(0, 35, 210, 1.5, 'F')
}

function drawSection(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(241, 245, 249)
  doc.rect(10, y, 190, 7, 'F')
  doc.setTextColor(13, 27, 42)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, y + 5)
  return y + 10
}

function drawInfoRow(doc: jsPDF, label: string, value: string, y: number, highlight = false) {
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(label, 14, y)
  doc.setTextColor(highlight ? 0 : 30, highlight ? 150 : 41, highlight ? 100 : 59)
  doc.setFont('helvetica', highlight ? 'bold' : 'normal')
  doc.text(value, 80, y)
  return y + 6
}

function drawTableHeader(doc: jsPDF, headers: string[], widths: number[], y: number) {
  doc.setFillColor(13, 27, 42)
  doc.rect(10, y, 190, 7, 'F')
  let x = 14
  headers.forEach((h, i) => {
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text(h, x, y + 5)
    x += widths[i]
  })
  return y + 7
}

function drawTableRow(doc: jsPDF, cells: string[], widths: number[], y: number, alternate: boolean) {
  if (alternate) {
    doc.setFillColor(248, 250, 252)
    doc.rect(10, y, 190, 6.5, 'F')
  }
  let x = 14
  cells.forEach((c, i) => {
    doc.setTextColor(51, 65, 85)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text(c, x, y + 4.5)
    x += widths[i]
  })
  return y + 6.5
}

function drawFooter(doc: jsPDF, pageNumber: number) {
  const pageHeight = doc.internal.pageSize.height
  doc.setFillColor(241, 245, 249)
  doc.rect(0, pageHeight - 12, 210, 12, 'F')
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('ElodiaTech — contact@elodiatech.com — Martinique', 15, pageHeight - 5)
  doc.text(`Page ${pageNumber}`, 210 - 15, pageHeight - 5, { align: 'right' })
  doc.text('Document confidentiel', 105, pageHeight - 5, { align: 'center' })
}

export async function generateReleve(medecin: Medecin, rejets: RejetFSE[], periode: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const periodeLabel = formatPeriode(periode)

  drawHeader(doc, 'RELEVE DE TRAITEMENT', periodeLabel)

  let y = 44

  // Cabinet info
  y = drawSection(doc, 'CABINET MEDICAL', y)
  y = drawInfoRow(doc, 'Cabinet', medecin.nom_cabinet, y)
  y = drawInfoRow(doc, 'Medecin', medecin.nom_medecin, y)
  y = drawInfoRow(doc, 'Code ElodiaTech', medecin.code_elodiatech, y)
  y = drawInfoRow(doc, 'Logiciel', medecin.logiciel, y)
  y = drawInfoRow(doc, 'Offre', medecin.offre.replace(/_/g, ' ').toUpperCase(), y)
  y += 4

  // Summary
  y = drawSection(doc, 'RESUME DU MOIS', y)
  const resolus = rejets.filter(r => r.statut === 'résolu' || r.statut === 'retransmis')
  const montantTotal = rejets.reduce((s, r) => s + r.montant_fse, 0)
  const montantRecupere = rejets.reduce((s, r) => s + (r.montant_recupere || 0), 0)
  const tauxResolution = rejets.length > 0 ? Math.round((resolus.length / rejets.length) * 100) : 0

  y = drawInfoRow(doc, 'Total rejets traites', String(rejets.length), y)
  y = drawInfoRow(doc, 'Rejets resolus', `${resolus.length} (${tauxResolution}%)`, y)
  y = drawInfoRow(doc, 'Montant FSE total', formatCurrency(montantTotal), y)
  y = drawInfoRow(doc, 'Montant recupere', formatCurrency(montantRecupere), y, true)
  y += 4

  // Rejets table
  if (rejets.length > 0) {
    y = drawSection(doc, 'DETAIL DES REJETS', y)
    const headers = ['N° FSE', 'Date', 'Code erreur', 'Famille', 'Montant FSE', 'Recupere', 'Statut']
    const widths = [30, 20, 22, 25, 25, 22, 26]
    y = drawTableHeader(doc, headers, widths, y)

    rejets.forEach((r, i) => {
      if (y > 270) {
        drawFooter(doc, doc.getNumberOfPages())
        doc.addPage()
        drawHeader(doc, 'RELEVE DE TRAITEMENT', periodeLabel + ' (suite)')
        y = 44
        y = drawTableHeader(doc, headers, widths, y)
      }
      const statutLabel = r.statut === 'résolu' ? 'Resolu' : r.statut === 'retransmis' ? 'Retransmis' : r.statut === 'en_attente' ? 'En attente' : r.statut === 'en_cours' ? 'En cours' : r.statut
      y = drawTableRow(doc, [
        r.id_fse.slice(-8),
        formatDate(r.date_rejet),
        r.code_erreur,
        r.famille_rejet.replace(/_/g, ' '),
        formatCurrency(r.montant_fse),
        r.montant_recupere != null ? formatCurrency(r.montant_recupere) : '-',
        statutLabel,
      ], widths, y, i % 2 === 1)
    })
    y += 4

    // Total row
    doc.setFillColor(0, 196, 204)
    doc.rect(10, y, 190, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL', 14, y + 5)
    doc.text(formatCurrency(montantTotal), 14 + 30 + 20 + 22 + 25, y + 5)
    doc.text(formatCurrency(montantRecupere), 14 + 30 + 20 + 22 + 25 + 25, y + 5)
    y += 12
  }

  // Note
  doc.setFillColor(254, 243, 199)
  doc.rect(10, y, 190, 12, 'F')
  doc.setTextColor(146, 64, 14)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'italic')
  doc.text('Ce releve est etabli par ElodiaTech sur la base des fichiers RSP recus de votre caisse primaire.', 14, y + 5)
  doc.text('Pour toute contestation, contactez-nous sous 30 jours a contact@elodiatech.com', 14, y + 10)

  drawFooter(doc, 1)
  doc.save(`Releve_ElodiaTech_${medecin.code_elodiatech}_${periode}.pdf`)
}

export async function generateFacture(medecin: Medecin, facture: Facturation) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const periodeLabel = formatPeriode(facture.periode)
  const dateEmission = new Date().toLocaleDateString('fr-FR')
  const factureNum = `FAC-${facture.periode.replace('-', '')}-${medecin.code_elodiatech}`

  drawHeader(doc, 'FACTURE', factureNum)

  let y = 44

  // Emetteur + Destinataire
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 27, 42)
  doc.text('EMETTEUR', 14, y)
  doc.text('DESTINATAIRE', 115, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  const emetteur = ['ElodiaTech', 'Martinique, France', 'contact@elodiatech.com', 'SIRET : en cours']
  const destinataire = [medecin.nom_cabinet, medecin.nom_medecin, medecin.email || '', `Code : ${medecin.code_elodiatech}`]
  emetteur.forEach(line => { doc.text(line, 14, y); y += 5 })
  let y2 = y - 20
  destinataire.forEach(line => { doc.text(line, 115, y2); y2 += 5 })
  y += 4

  // Facture info
  doc.setFillColor(241, 245, 249)
  doc.rect(10, y, 190, 14, 'F')
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 27, 42)
  doc.text(`Facture N° : ${factureNum}`, 14, y + 5)
  doc.text(`Periode : ${periodeLabel}`, 14, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Date d'emission : ${dateEmission}`, 115, y + 5)
  doc.text(`Offre : ${medecin.offre.replace(/_/g, ' ').toUpperCase()}`, 115, y + 11)
  y += 20

  // Detail facturation selon offre
  y = drawSection(doc, 'DETAIL DE LA FACTURATION', y)

  if (medecin.offre === 'zen_fse') {
    y = drawInfoRow(doc, 'Abonnement de base (40 rejets)', '99,00 EUR', y)
    if (facture.nb_tranches_depassement > 0) {
      y = drawInfoRow(doc, `Depassement (${facture.nb_tranches_depassement} tranche(s) x 40 EUR)`, formatCurrency(facture.montant_depassement), y)
    }
    y = drawInfoRow(doc, 'Rejets traites ce mois', String(facture.nb_rejets_traites), y)
  } else if (medecin.offre === 'liberty_fse') {
    y = drawInfoRow(doc, 'Montant recupere', formatCurrency(facture.montant_recupere), y)
    y = drawInfoRow(doc, 'Taux de commission', '12%', y)
    y = drawInfoRow(doc, 'Commission calculee', formatCurrency(facture.montant_commission), y)
    if (facture.frais_dossier > 0) {
      y = drawInfoRow(doc, 'Frais de dossier (unique)', formatCurrency(facture.frais_dossier), y)
    }
  } else {
    const taux = (medecin.tranche_pass_recup || 0) < 20000 ? '10%' : '12%'
    y = drawInfoRow(doc, 'Montant recupere', formatCurrency(facture.montant_recupere), y)
    y = drawInfoRow(doc, `Taux applicable (tranche ${taux})`, taux, y)
    y = drawInfoRow(doc, 'Commission calculee', formatCurrency(facture.montant_commission), y)
    if (facture.frais_dossier > 0) {
      y = drawInfoRow(doc, 'Frais de dossier (unique)', formatCurrency(facture.frais_dossier), y)
    }
  }
  y += 6

  // Total box
  doc.setFillColor(13, 27, 42)
  doc.rect(110, y, 90, 20, 'F')
  doc.setTextColor(180, 200, 220)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('TOTAL TTC', 115, y + 7)
  doc.setTextColor(0, 196, 204)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(facture.total_facture), 195, y + 15, { align: 'right' })
  y += 26

  // Statut paiement
  const paye = facture.statut_paiement === 'payé'
  doc.setFillColor(paye ? 209 : 254, paye ? 250 : 243, paye ? 229 : 199)
  doc.rect(10, y, 190, 8, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(paye ? 21 : 146, paye ? 128 : 64, paye ? 61 : 14)
  doc.text(paye ? 'PAYE - Merci pour votre reglement' : 'EN ATTENTE DE REGLEMENT', 14, y + 5.5)
  y += 14

  // Conditions
  y = drawSection(doc, 'CONDITIONS DE REGLEMENT', y)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Paiement par virement bancaire sous 30 jours a reception de facture.', 14, y)
  y += 5
  doc.text('Tout retard de paiement entraine des penalites au taux BCE + 10 points.', 14, y)

  drawFooter(doc, 1)
  doc.save(`Facture_ElodiaTech_${factureNum}.pdf`)
}
