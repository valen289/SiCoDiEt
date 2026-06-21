import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import AlertContainer from './components/AlertContainer';
import Layout from './components/Layout';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Silos = lazy(() => import('./pages/Silos'));
const Lotes = lazy(() => import('./pages/Lotes'));
const Consumos = lazy(() => import('./pages/Consumos'));
const Dietas = lazy(() => import('./pages/Dietas'));
const Alertas = lazy(() => import('./pages/Alertas'));
const Historial = lazy(() => import('./pages/Historial'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Profile = lazy(() => import('./pages/Profile'));
const Actividades = lazy(() => import('./pages/Actividades'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Costos = lazy(() => import('./pages/Costos'));
const Compras = lazy(() => import('./pages/Compras'));
const Landing = lazy(() => import('./pages/Landing'));

function PageLoader() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="spinner-border text-success" role="status" aria-label="Cargando..." />
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-success mb-3" role="status"></div>
          <p className="text-muted">Cargando...</p>
        </div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
}

function DuenoRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-success mb-3" role="status"></div>
          <p className="text-muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (user.rol !== 'dueno') {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <h2 className="text-danger mb-3">Acceso Denegado</h2>
          <p className="text-muted">Solo el Dueño puede acceder a esta sección.</p>
          <button className="btn btn-success" onClick={() => window.location.href = '/silos'}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return children;
}

// Bloquea al trabajador y lo redirige a /consumos silenciosamente
function DuenoEncargadoRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-success mb-3" role="status"></div>
          <p className="text-muted">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  if (user.rol === 'trabajador') return <Navigate to="/consumos" replace />;
  return children;
}

// Landing pública si no hay sesión; si hay sesión, redirige al home según rol
function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-success" role="status"></div>
      </div>
    );
  }

  if (!user) return <Landing />;
  return <Navigate to={user.rol === 'trabajador' ? '/consumos' : '/dashboard'} replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Landing pública o redirect según rol */}
        <Route path="/" element={<RootRoute />} />

        {/* Rutas solo para dueño + encargado */}
        <Route path="/dashboard" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Dashboard />} />
        </Route>
        <Route path="/silos" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Silos />} />
          <Route path=":tipo" element={<Silos />} />
        </Route>
        <Route path="/lotes" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Lotes />} />
        </Route>
        <Route path="/dietas" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Dietas />} />
        </Route>
        <Route path="/historial" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Historial />} />
        </Route>
        <Route path="/actividades" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Actividades />} />
        </Route>
        <Route path="/costos" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Costos />} />
        </Route>
        <Route path="/compras" element={
          <DuenoEncargadoRoute>
            <Layout />
          </DuenoEncargadoRoute>
        }>
          <Route index element={<Compras />} />
        </Route>

        {/* Rutas para todos los roles autenticados */}
        <Route path="/consumos" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Consumos />} />
        </Route>
        <Route path="/alertas" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Alertas />} />
        </Route>
        <Route path="/perfil" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Profile />} />
        </Route>

        {/* Ruta solo para dueño */}
        <Route path="/usuarios" element={
          <DuenoRoute>
            <Layout />
          </DuenoRoute>
        }>
          <Route index element={<Usuarios />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <Router>
      <AlertProvider>
        <AuthProvider>
          <AppRoutes />
          <AlertContainer />
        </AuthProvider>
      </AlertProvider>
    </Router>
  );
}
