import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import {
  Wheat, Package, LineChart, LogOut, Calculator, Menu, X, User,
  Database, Droplets, UserCog, Users, Bell, Plus, History
} from 'lucide-react';
import '../styles/layout.css';

const foodTypes = [
  { value: 'silo', label: 'Silo', icon: Database },
  { value: 'bolson', label: 'Bolson', icon: Package },
  { value: 'fardo', label: 'Fardo', icon: Wheat },
  { value: 'sales', label: 'Sales', icon: Droplets },
];

const moduleItems = [
  { path: '/lotes', icon: Package, label: 'Lotes' },
  { path: '/consumos', icon: LineChart, label: 'Consumos' },
  { path: '/dietas', icon: Calculator, label: 'Dietas' },
  { path: '/alertas', icon: Bell, label: 'Alertas' },
  { path: '/historial', icon: History, label: 'Historial' },
  { path: '/perfil', icon: UserCog, label: 'Perfil' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { confirm } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitForm, setNewUnitForm] = useState({ nombre: '', tipo: 'silo' });

  const isOperario = user?.rol === 'operario';

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Cerrar Sesión',
      message: '¿Estás seguro que deseas cerrar sesión?',
      type: 'warning',
      confirmText: 'Sí, cerrar sesión',
      cancelText: 'Cancelar',
      animationType: 'slide',
      animationDirection: 'right',
    });
    if (confirmed) {
      logout();
      navigate('/login');
    }
  };

  const handleNavClick = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleFoodTypeClick = (typeValue) => {
    navigate(`/silos/${typeValue}`);
    setDrawerOpen(false);
  };

  const handleUserClick = () => {
    navigate('/perfil');
  };

  const isActivePath = (path) => {
    if (path === '/silos') return location.pathname.startsWith('/silos');
    return location.pathname === path;
  };

  const handleAddUnit = () => {
    if (!newUnitForm.nombre.trim()) return;
    setNewUnitForm({ nombre: '', tipo: 'silo' });
    setShowAddUnitModal(false);
  };

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="header-left">
            <button className="menu-toggle" onClick={() => setDrawerOpen(true)} aria-label="Menu">
              <Menu size={22} />
            </button>
            <h1 className="header-logo">SiCoDiEt</h1>
          </div>
          <div className="header-right">
            <div className="user-info" onClick={handleUserClick} role="button" tabIndex={0} aria-label="Ir a perfil">
              <User size={16} />
              <div className="user-details">
                <span className="user-name">{user?.nombre}</span>
                <span className="user-role">{user?.rol}</span>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Cerrar Sesión">
              <LogOut size={16} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="sidebar-desktop">
        <div className="sidebar-section">
          <span className="sidebar-section-title">ALIMENTOS</span>
          <nav className="sidebar-nav">
            {foodTypes.map(type => {
              const TypeIcon = type.icon;
              const isActive = location.pathname === `/silos/${type.value}`;
              return (
                <button
                  key={type.value}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleFoodTypeClick(type.value)}
                >
                  <TypeIcon size={18} />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-title">UNIDADES</span>
          <button className="sidebar-add-btn" onClick={() => setShowAddUnitModal(true)}>
            <Plus size={16} />
            <span>Agregar unidad</span>
          </button>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-title">MÓDULOS</span>
          <nav className="sidebar-nav">
            {moduleItems.map(item => (
              <button
                key={item.path}
                className={`sidebar-nav-item ${isActivePath(item.path) ? 'active' : ''}`}
                onClick={() => handleNavClick(item.path)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      <div className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />

      {/* Mobile Drawer */}
      <aside className={`drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h2 className="drawer-logo">SiCoDiEt</h2>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>
        <div className="drawer-user">
          <User size={20} />
          <div>
            <span className="drawer-user-name">{user?.nombre}</span>
            <span className="drawer-user-role">{user?.rol}</span>
          </div>
        </div>
        <nav className="drawer-nav">
          <div className="drawer-section">
            <span className="drawer-section-title">ALIMENTOS</span>
            {foodTypes.map(type => {
              const TypeIcon = type.icon;
              const isActive = location.pathname === `/silos/${type.value}`;
              return (
                <button
                  key={type.value}
                  className={`drawer-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleFoodTypeClick(type.value)}
                >
                  <TypeIcon size={18} />
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
          <div className="drawer-section">
            <span className="drawer-section-title">UNIDADES</span>
            <button className="drawer-add-btn" onClick={() => { setShowAddUnitModal(true); setDrawerOpen(false); }}>
              <Plus size={16} />
              <span>Agregar unidad</span>
            </button>
          </div>
          <div className="drawer-section">
            <span className="drawer-section-title">MÓDULOS</span>
            {moduleItems.map(item => (
              <button
                key={item.path}
                className={`drawer-nav-item ${isActivePath(item.path) ? 'active' : ''}`}
                onClick={() => handleNavClick(item.path)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="drawer-footer">
          <button className="drawer-logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="main-container">
          <Outlet />
        </div>
      </main>

      {/* Add Unit Modal */}
      {showAddUnitModal && (
        <div className="modal-overlay" onClick={() => setShowAddUnitModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="h5 mb-0">Nueva Unidad de Alimento</h3>
              <button type="button" className="btn-close" onClick={() => setShowAddUnitModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Nombre de la unidad</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUnitForm.nombre}
                  onChange={e => setNewUnitForm({...newUnitForm, nombre: e.target.value})}
                  placeholder="Ej: Grano, Concentrado, Forraje"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Tipo</label>
                <select
                  className="form-select"
                  value={newUnitForm.tipo}
                  onChange={e => setNewUnitForm({...newUnitForm, tipo: e.target.value})}
                >
                  <option value="silo">Silo</option>
                  <option value="bolson">Bolson</option>
                  <option value="fardo">Fardo</option>
                  <option value="sales">Sales</option>
                  <option value="grano">Grano</option>
                  <option value="concentrado">Concentrado</option>
                  <option value="aditivo">Aditivo</option>
                  <option value="forraje">Forraje</option>
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowAddUnitModal(false)}>Cancelar</button>
                <button className="btn btn-success" onClick={handleAddUnit}>Agregar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
