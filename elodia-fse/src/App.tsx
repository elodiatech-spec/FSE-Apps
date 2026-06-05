import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/toast'
import { LoginPage } from '@/pages/Login'
import { SetupPage } from '@/pages/Setup'
import { supabase } from '@/lib/supabase'

// Chargement à la demande (code-splitting) — allège le démarrage
const named = <T extends Record<string, unknown>>(p: Promise<T>, key: keyof T) =>
  p.then(m => ({ default: m[key] as React.ComponentType }))

const DashboardGerant = lazy(() => named(import('@/pages/dashboard/DashboardGerant'), 'DashboardGerant'))
const DashboardAgent = lazy(() => named(import('@/pages/dashboard/DashboardAgent'), 'DashboardAgent'))
const DashboardManageuse = lazy(() => named(import('@/pages/dashboard/DashboardManageuse'), 'DashboardManageuse'))
const RejetsPage = lazy(() => named(import('@/pages/rejets/RejetsPage'), 'RejetsPage'))
const MedecinsPage = lazy(() => named(import('@/pages/medecins/MedecinsPage'), 'MedecinsPage'))
const FacturationPage = lazy(() => named(import('@/pages/facturation/FacturationPage'), 'FacturationPage'))
const CommissionsPage = lazy(() => named(import('@/pages/commissions/CommissionsPage'), 'CommissionsPage'))
const MedecinPortal = lazy(() => named(import('@/pages/medecins/MedecinPortal'), 'MedecinPortal'))
const IngestionPage = lazy(() => named(import('@/pages/ingestion/IngestionPage'), 'IngestionPage'))
const ConnecteursPage = lazy(() => named(import('@/pages/ingestion/ConnecteursPage'), 'ConnecteursPage'))
const AgentsPage = lazy(() => named(import('@/pages/agents/AgentsPage'), 'AgentsPage'))
const AidePage = lazy(() => named(import('@/pages/aide/AidePage'), 'AidePage'))
const CodesPage = lazy(() => named(import('@/pages/codes/CodesPage'), 'CodesPage'))

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1B2A]">
      <div className="flex flex-col items-center gap-4">
        <img
          src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png"
          alt="ElodiaTech"
          className="h-14 object-contain"
        />
        <div className="w-8 h-8 border-2 border-[#00C4CC]/30 border-t-[#00C4CC] rounded-full animate-spin" />
        <p className="text-white/50 text-sm">Chargement...</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { agent, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!agent) return <Navigate to="/login" replace />
  if (agent.role === 'gerant') return <Navigate to="/dashboard/gerant" replace />
  if (agent.role === 'manageuse') return <Navigate to="/dashboard/manageuse" replace />
  return <Navigate to="/dashboard/agent" replace />
}

function AppRoutes() {
  const [dbReady, setDbReady] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.from('agents').select('id').limit(1).then(({ error }) => {
      setDbReady(!error)
    })
  }, [])

  if (dbReady === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1B2A]">
        <div className="flex flex-col items-center gap-4">
          <img src="https://elodiatech.com/wp-content/uploads/2023/11/elodia-tech-LOGO-B-1536x1152.png" alt="ElodiaTech" className="h-14 object-contain" />
          <div className="w-8 h-8 border-2 border-[#00C4CC]/30 border-t-[#00C4CC] rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Connexion à la base de données...</p>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return <SetupPage onComplete={() => setDbReady(true)} />
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-[#00C4CC]/30 border-t-[#00C4CC] rounded-full animate-spin" />
      </div>
    }>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><RootRedirect /></RequireAuth>} />
      <Route path="/dashboard/gerant" element={<RequireAuth><DashboardGerant /></RequireAuth>} />
      <Route path="/dashboard/manageuse" element={<RequireAuth><DashboardManageuse /></RequireAuth>} />
      <Route path="/dashboard/agent" element={<RequireAuth><DashboardAgent /></RequireAuth>} />
      <Route path="/rejets" element={<RequireAuth><RejetsPage /></RequireAuth>} />
      <Route path="/medecins" element={<RequireAuth><MedecinsPage /></RequireAuth>} />
      <Route path="/facturation" element={<RequireAuth><FacturationPage /></RequireAuth>} />
      <Route path="/commissions" element={<RequireAuth><CommissionsPage /></RequireAuth>} />
      <Route path="/medecin/:id" element={<MedecinPortal />} />
      <Route path="/agents" element={<RequireAuth><AgentsPage /></RequireAuth>} />
      <Route path="/ingestion" element={<RequireAuth><IngestionPage /></RequireAuth>} />
      <Route path="/connecteurs" element={<RequireAuth><ConnecteursPage /></RequireAuth>} />
      <Route path="/aide" element={<RequireAuth><AidePage /></RequireAuth>} />
      <Route path="/codes" element={<RequireAuth><CodesPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
