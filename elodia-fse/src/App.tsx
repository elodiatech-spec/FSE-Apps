import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/toast'
import { LoginPage } from '@/pages/Login'
import { SetupPage } from '@/pages/Setup'
import { DashboardGerant } from '@/pages/dashboard/DashboardGerant'
import { DashboardAgent } from '@/pages/dashboard/DashboardAgent'
import { DashboardManageuse } from '@/pages/dashboard/DashboardManageuse'
import { RejetsPage } from '@/pages/rejets/RejetsPage'
import { MedecinsPage } from '@/pages/medecins/MedecinsPage'
import { FacturationPage } from '@/pages/facturation/FacturationPage'
import { CommissionsPage } from '@/pages/commissions/CommissionsPage'
import { MedecinPortal } from '@/pages/medecins/MedecinPortal'
import { IngestionPage } from '@/pages/ingestion/IngestionPage'
import { ConnecteursPage } from '@/pages/ingestion/ConnecteursPage'
import { AgentsPage } from '@/pages/agents/AgentsPage'
import { AidePage } from '@/pages/aide/AidePage'
import { supabase } from '@/lib/supabase'

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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
