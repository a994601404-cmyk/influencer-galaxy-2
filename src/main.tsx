import { createRoot } from 'react-dom/client'
import { RouterProvider, createHashRouter, Navigate } from 'react-router'
import './index.css'
import { TRPCProvider } from '@/providers/trpc'
import AuthGuard from '@/components/AuthGuard'
import AppLayout from './components/AppLayout'

// One-time cleanup of the legacy localStorage-based auth (replaced by server-side auth)
localStorage.removeItem('pulseboost_auth_v1')
localStorage.removeItem('pulseboost_users_v1')
localStorage.removeItem('pulseboost_admin_seeded')
import Login from './pages/Login'
import LandingPage from './pages/LandingPage'
import NotFound from './pages/NotFound'
import Dashboard from './pages/Dashboard'
import Influencers from './pages/Influencers'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Review from './pages/Review'

const router = createHashRouter([
  { path: '/login', element: <Login /> },
  { path: '/landing', element: <LandingPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <AuthGuard><Dashboard /></AuthGuard> },
      { path: 'influencers', element: <AuthGuard><Influencers /></AuthGuard> },
      { path: 'analytics', element: <AuthGuard><Analytics /></AuthGuard> },
      { path: 'review', element: <AuthGuard><Review /></AuthGuard> },
      { path: 'settings', element: <AuthGuard><Settings /></AuthGuard> },
    ],
  },
  // Catch-all: redirect unknown paths to landing
  { path: '*', element: <Navigate to="/landing" replace /> },
])

createRoot(document.getElementById('root')!).render(
  <TRPCProvider>
    <RouterProvider router={router} />
  </TRPCProvider>
)
