import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: fr })
  } catch {
    return dateStr
  }
}

export function formatDatetime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: fr })
  } catch {
    return dateStr
  }
}

export function formatPeriode(periode: string): string {
  const [year, month] = periode.split('-')
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ]
  return `${monthNames[parseInt(month) - 1]} ${year}`
}

export function calculerZenFSE(nbRejets: number): number {
  if (nbRejets <= 40) return 99
  return 99 + Math.ceil((nbRejets - 40) / 40) * 40
}

export function calculerLibertyFSE(montantRecupere: number): number {
  return montantRecupere * 0.12
}

export function calculerPassRecup(montantRecupere: number, tranche: number): number {
  const taux = tranche < 20000 ? 0.10 : 0.12
  return montantRecupere * taux
}

export function getInitiales(nom: string, prenom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()
}

export function getCurrentPeriode(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function daysBetween(dateStr: string): number {
  const target = parseISO(dateStr)
  const now = new Date()
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
