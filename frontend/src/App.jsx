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

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Navigate to="/silos" />
          </ProtectedRoute>
        } />
        <Route path="/silos" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Silos />} />
          <Route path=":tipo" element={<Silos />} />
        </Route>
        <Route path="/lotes" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Lotes />} />
        </Route>
        <Route path="/consumos" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Consumos />} />
        </Route>
        <Route path="/dietas" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dietas />} />
        </Route>
        <Route path="/alertas" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Alertas />} />
        </Route>
        <Route path="/historial" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Historial />} />
        </Route>
        <Route path="/usuarios" element={
          <DuenoRoute>
            <Layout />
          </DuenoRoute>
        }>
          <Route index element={<Usuarios />} />
        </Route>
        <Route path="/actividades" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Actividades />} />
        </Route>
        <Route path="/perfil" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Profile />} />
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
