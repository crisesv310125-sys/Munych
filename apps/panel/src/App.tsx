import { useEffect, type ComponentType } from 'react';
import { Navigate, Route, RouterProvider, createHashRouter, createRoutesFromElements } from 'react-router-dom';
import { AppStateProvider } from './state/AppStateContext';
import { LoginPage } from './pages/LoginPage';
import { SetPasswordPage } from './pages/SetPasswordPage';

// Solo el login va en el bundle inicial; el resto se carga por ruta (y se precarga en segundo plano, ver App).
const loaders = {
  JudgeLayout: () => import('./components/layout/JudgeLayout').then((m) => m.JudgeLayout),
  DashboardPage: () => import('./pages/judge/DashboardPage').then((m) => m.DashboardPage),
  CommitteePage: () => import('./pages/judge/CommitteePage').then((m) => m.CommitteePage),
  ProgressPage: () => import('./pages/judge/ProgressPage').then((m) => m.ProgressPage),
  ProfilePage: () => import('./pages/judge/ProfilePage').then((m) => m.ProfilePage),
  AdminLayout: () => import('./components/layout/AdminLayout').then((m) => m.AdminLayout),
  EventScopeLayout: () => import('./components/layout/EventScopeLayout').then((m) => m.EventScopeLayout),
  EventsPage: () => import('./pages/admin/EventsPage').then((m) => m.EventsPage),
  AdminDashboardPage: () => import('./pages/admin/AdminDashboardPage').then((m) => m.AdminDashboardPage),
  CommitteesPage: () => import('./pages/admin/CommitteesPage').then((m) => m.CommitteesPage),
  SessionsPage: () => import('./pages/admin/SessionsPage').then((m) => m.SessionsPage),
  CountriesPage: () => import('./pages/admin/CountriesPage').then((m) => m.CountriesPage),
  JudgesPage: () => import('./pages/admin/JudgesPage').then((m) => m.JudgesPage),
  CriteriaPage: () => import('./pages/admin/CriteriaPage').then((m) => m.CriteriaPage),
  ResultsPage: () => import('./pages/admin/ResultsPage').then((m) => m.ResultsPage),
  ExportPage: () => import('./pages/admin/ExportPage').then((m) => m.ExportPage),
  VotingAccessPage: () => import('./pages/admin/VotingAccessPage').then((m) => m.VotingAccessPage),
  VotePage: () => import('./pages/vote/VotePage').then((m) => m.VotePage),
  StaffPage: () => import('./pages/admin/staff/StaffPage').then((m) => m.StaffPage),
  StaffTypePage: () => import('./pages/admin/staff/StaffTypePage').then((m) => m.StaffTypePage),
  StaffEvaluatePage: () => import('./pages/staff/StaffEvaluatePage').then((m) => m.StaffEvaluatePage),
} satisfies Record<string, () => Promise<ComponentType>>;

const lazy = (name: keyof typeof loaders) => async () => ({ Component: await loaders[name]() });

// Data router (no <HashRouter>) para poder usar useBlocker: avisar al juez si sale con calificaciones sin guardar.
const router = createHashRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      {/* Destino de los enlaces de invitación y recuperación (ver supabaseClient.ts). */}
      <Route path="/crear-contrasena" element={<SetPasswordPage />} />
      {/* Boleta pública del delegado: entra con su token, sin cuenta (ADR-005). */}
      <Route path="/votar" lazy={lazy('VotePage')} />
      <Route path="/votar/:token" lazy={lazy('VotePage')} />
      {/* Evaluación del staff: entra con su enlace personal, sin cuenta (hito 15). */}
      <Route path="/staff/evaluar" lazy={lazy('StaffEvaluatePage')} />
      <Route path="/staff/evaluar/:token" lazy={lazy('StaffEvaluatePage')} />

      <Route path="/juez" lazy={lazy('JudgeLayout')}>
        <Route index lazy={lazy('DashboardPage')} />
        <Route path="progreso" lazy={lazy('ProgressPage')} />
        <Route path="perfil" lazy={lazy('ProfilePage')} />
        <Route path="comites/:committeeId" lazy={lazy('CommitteePage')} />
      </Route>

      <Route path="/admin" lazy={lazy('AdminLayout')}>
        <Route index element={<Navigate to="eventos" replace />} />
        <Route path="eventos" lazy={lazy('EventsPage')} />
        {/* El staff es de la organización: también se administra fuera de un evento. */}
        <Route path="staff" lazy={lazy('StaffPage')} />
        <Route path="staff/:typeId" lazy={lazy('StaffTypePage')} />
        <Route path="eventos/:eventId" lazy={lazy('EventScopeLayout')}>
          <Route index lazy={lazy('AdminDashboardPage')} />
          <Route path="comites" lazy={lazy('CommitteesPage')} />
          <Route path="sesiones" lazy={lazy('SessionsPage')} />
          <Route path="paises" lazy={lazy('CountriesPage')} />
          <Route path="jueces" lazy={lazy('JudgesPage')} />
          <Route path="staff" lazy={lazy('StaffPage')} />
          <Route path="staff/:typeId" lazy={lazy('StaffTypePage')} />
          <Route path="criterios" lazy={lazy('CriteriaPage')} />
          <Route path="resultados" lazy={lazy('ResultsPage')} />
          <Route path="exportar" lazy={lazy('ExportPage')} />
          <Route path="votacion" lazy={lazy('VotingAccessPage')} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </>,
  ),
);

function App() {
  // Precarga el resto del panel mientras el usuario escribe sus credenciales: al entrar ya está descargado.
  useEffect(() => {
    const id = setTimeout(() => Object.values(loaders).forEach((load) => load().catch(() => {})), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <AppStateProvider>
      <RouterProvider router={router} />
    </AppStateProvider>
  );
}

export default App;
