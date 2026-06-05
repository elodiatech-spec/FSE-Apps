import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, AlertTriangle, Users, FileX2, Euro, Percent } from 'lucide-react'
import { supabase, Medecin, RejetFSE } from '@/lib/supabase'
import { AppLayout } from '@/components/layout/AppLayout'
import { KpiCard } from '@/components/shared/KpiCard'
import { LogicielBadge, OffreBadge, StatutBadge } from '@/components/shared/StatusBadge'
import { RelancesWidget } from '@/components/shared/RelancesWidget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingPage } from '@/components/ui/spinner'
import { formatCurrency, formatDate, daysBetween } from '@/lib/utils'

interface Stats {
  caMois: number
  rejetsResolus: number
  tauxAuto: number
  commissionManageuse: number
  totalRejets: number
}

export function DashboardGerant() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [recentRejets, setRecentRejets] = useState<RejetFSE[]>([])
  const [cpeAlerts, setCpeAlerts] = useState<Medecin[]>([])
  const [loading, setLoading] = useState(true)

  const caData = [
    { mois: 'Jan', ca: 2840 },
    { mois: 'Fév', ca: 3200 },
    { mois: 'Mar', ca: 2990 },
    { mois: 'Avr', ca: 3600 },
    { mois: 'Mai', ca: 4100 },
    { mois: 'Jun', ca: 3850 },
  ]

  const rejetsData = [
    { jour: 'Lun', auto: 12, agent: 5, medecin: 2 },
    { jour: 'Mar', auto: 15, agent: 7, medecin: 1 },
    { jour: 'Mer', auto: 10, agent: 8, medecin: 3 },
    { jour: 'Jeu', auto: 18, agent: 4, medecin: 2 },
    { jour: 'Ven', auto: 14, agent: 6, medecin: 1 },
    { jour: 'Sam', auto: 6, agent: 2, medecin: 0 },
    { jour: 'Dim', auto: 3, agent: 1, medecin: 0 },
  ]

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [medecinRes, rejetRes] = await Promise.all([
      supabase.from('medecins').select('*').eq('actif', true).order('nom_cabinet'),
      supabase.from('rejets_fse').select('*, medecins(nom_cabinet), agents(nom,prenom)').order('created_at', { ascending: false }).limit(5),
    ])

    const allMedecins = medecinRes.data || []
    const allRejets = rejetRes.data || []

    const resolus = allRejets.filter(r => r.statut === 'résolu' || r.statut === 'retransmis').length
    const autoRejets = allRejets.filter(r => r.voie_traitement === 'auto').length
    const tauxAuto = allRejets.length > 0 ? Math.round((autoRejets / allRejets.length) * 100) : 0

    setMedecins(allMedecins)
    setRecentRejets(allRejets)
    setCpeAlerts(allMedecins.filter(m => {
      if (!m.date_expiration_cpe) return false
      return daysBetween(m.date_expiration_cpe) < 90
    }))

    setStats({
      caMois: 3850,
      rejetsResolus: resolus,
      tauxAuto,
      commissionManageuse: 385,
      totalRejets: allRejets.length,
    })

    setLoading(false)
  }

  if (loading) return (
    <AppLayout title="Tableau de bord Gérant">
      <LoadingPage />
    </AppLayout>
  )

  return (
    <AppLayout
      title="Tableau de bord"
      subtitle="Vue d'ensemble de l'activité ElodiaTech FSE"
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          title="CA du mois"
          value={formatCurrency(stats?.caMois || 0)}
          subtitle="Juin 2026"
          icon={<Euro className="w-5 h-5" />}
          trend={{ value: 12, label: 'vs mai' }}
        />
        <KpiCard
          title="Rejets résolus"
          value={stats?.rejetsResolus || 0}
          subtitle={`sur ${stats?.totalRejets || 0} au total`}
          icon={<FileX2 className="w-5 h-5" />}
          variant="teal"
        />
        <KpiCard
          title="Taux résolution auto"
          value={`${stats?.tauxAuto || 0}%`}
          subtitle="File A validée"
          icon={<Percent className="w-5 h-5" />}
          trend={{ value: 5, label: 'vs sem. préc.' }}
        />
        <KpiCard
          title="Commission manageuse"
          value={formatCurrency(stats?.commissionManageuse || 0)}
          subtitle="Estimation juin"
          icon={<TrendingUp className="w-5 h-5" />}
          variant="dark"
        />
      </div>

      {/* Alerts */}
      {(cpeAlerts.length > 0) && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {cpeAlerts.length} carte(s) CPE expire(nt) dans moins de 90 jours
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {cpeAlerts.map(m => (
                <span key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 rounded-lg text-xs text-amber-700 font-medium">
                  {m.nom_cabinet}
                  <span className="text-amber-500">
                    {m.date_expiration_cpe ? `(${daysBetween(m.date_expiration_cpe)}j)` : ''}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* CA Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="p-6 pb-4">
            <CardTitle>Chiffre d'affaires — 6 derniers mois</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={caData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C4CC" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00C4CC" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={v => `${v}€`} />
                <Tooltip formatter={(v) => [`${v}€`, 'CA']} />
                <Area
                  type="monotone"
                  dataKey="ca"
                  stroke="#00C4CC"
                  strokeWidth={2}
                  fill="url(#colorCA)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rejets week chart */}
        <Card>
          <CardHeader className="p-6 pb-4">
            <CardTitle>Rejets de la semaine</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rejetsData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="auto" name="Auto" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="agent" name="Agent" stackId="a" fill="#F59E0B" />
                <Bar dataKey="medecin" name="Médecin" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Widget relances */}
      <div className="mb-6">
        <RelancesWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Médecins actifs */}
        <Card>
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle>Médecins actifs</CardTitle>
              <Badge variant="default">{medecins.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {medecins.slice(0, 5).map(m => (
                <div key={m.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0D1B2A] flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-[#00C4CC]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{m.nom_cabinet}</p>
                    <p className="text-xs text-slate-500">{m.nom_medecin}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LogicielBadge logiciel={m.logiciel} />
                    <OffreBadge offre={m.offre} />
                  </div>
                </div>
              ))}
              {medecins.length === 0 && (
                <div className="px-6 py-8 text-center text-slate-500 text-sm">
                  Aucun médecin actif
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rejets récents */}
        <Card>
          <CardHeader className="p-6 pb-4">
            <CardTitle>Derniers rejets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentRejets.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.id_fse}</p>
                    <p className="text-xs text-slate-500">{r.code_erreur} — {formatDate(r.date_rejet)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{formatCurrency(r.montant_fse)}</span>
                    <StatutBadge statut={r.statut} />
                  </div>
                </div>
              ))}
              {recentRejets.length === 0 && (
                <div className="px-6 py-8 text-center text-slate-500 text-sm">
                  Aucun rejet récent
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
