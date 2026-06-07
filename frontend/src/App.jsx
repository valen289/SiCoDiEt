import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import AlertContainer from './components/AlertContainer';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Silos from './pages/Silos';
import Lotes from './pages/Lotes';
import Consumos from './pages/Consumos';
import Dietas from './pages/Dietas';
import Alertas from './pages/Alertas';
import Historial from './pages/Historial';
import Usuarios from './pages/Usuarios';
import Profile from './pages/Profile';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="text-center">
        <div className="spinner-border text-success mb-3" role="status"></div>
        <p className="text-muted">Cargando...</p>
      </div>
    </div>;
  }
  
  return user ? children : <Navigate to="/login" />;
}

function OperarioRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="text-center">
        <div className="spinner-border text-success mb-3" role="status"></div>
        <p className="text-muted">Cargando...</p>
      </div>
    </div>;
  }
  
  if (!user) return <Navigate to="/login" />;
  if (user.rol !== 'operario') {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <h2 className="text-danger mb-3">Acceso Denegado</h2>
          <p className="text-muted">Solo los operarios pueden acceder a esta sección.</p>
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
        <OperarioRoute>
          <Layout />
        </OperarioRoute>
      }>
        <Route index element={<Usuarios />} />
      </Route>
      <Route path="/perfil" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Profile />} />
      </Route>
    </Routes>
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
