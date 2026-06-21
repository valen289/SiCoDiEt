import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import {
  LogOut, Menu, X, User, Plus, Trash2,
  LayoutDashboard, Database, Package, FlaskConical, Tag,
  ClipboardList, Calculator, Bell, History, DollarSign,
  ShoppingCart, Activity, UserCog, Users,
} from 'lucide-react';
import '../styles/layout.css';

/* ─── Iconos del sidebar (lucide-react, sin dependencias externas) ─────────── */
const NAV_ICONS = {
  dashboard:   LayoutDashboard,
  silo:        Database,
  fardo:       Package,
  sales:       FlaskConical,
  bolson:      Package,
  lotes:       Tag,
  consumos:    ClipboardList,
  dietas:      Calculator,
  alertas:     Bell,
  historial:   History,
  costos:      DollarSign,
  compras:     ShoppingCart,
  actividades: Activity,
  perfil:      UserCog,
  usuarios:    Users,
};

function NavIcon({ iconKey, size = 17 }) {
  const Icon = NAV_ICONS[iconKey] || Database;
  return <Icon size={size} className="nav-icon" aria-hidden="true" />;
}

const categorias = [
  { value: 'reserva_forrajera', label: 'Reserva Forrajera', iconKey: 'fardo'  },
  { value: 'concentrado',       label: 'Concentrados',       iconKey: 'silo'   },
  { value: 'sales',             label: 'Sales Minerales',    iconKey: 'sales'  },
];

const operacionesItems = [
  { path: '/lotes',    iconKey: 'lotes',    label: 'Lotes'    },
  { path: '/consumos', iconKey: 'consumos', label: 'Consumos' },
  { path: '/compras',  iconKey: 'compras',  label: 'Compras'  },
  { path: '/dietas',   iconKey: 'dietas',   label: 'Dietas'   },
];

const sistemaItems = [
  { path: '/alertas',     iconKey: 'alertas',     label: 'Alertas'     },
  { path: '/costos',      iconKey: 'costos',      label: 'Costos'      },
  { path: '/historial',   iconKey: 'historial',   label: 'Historial'   },
  { path: '/actividades', iconKey: 'actividades', label: 'Actividades' },
  { path: '/perfil',      iconKey: 'perfil',       label: 'Perfil'      },
];

const ROL_LABELS = { dueno: 'Dueño', encargado: 'Encargado', trabajador: 'Trabajador' };

export default function Layout() {
  const { user, logout } = useAuth();
  const { confirm } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitForm, setNewUnitForm] = useState({ nombre: '' });
  const [customFoodTypes, setCustomFoodTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sicodiet-custom-food-types') || '[]'); }
    catch { return []; }
  });

  const isDueno = user?.rol === 'dueno';
  const isTrabajador = user?.rol === 'trabajador';

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
    if (confirmed) { logout(); navigate('/login'); }
  };

  const handleNavClick = (path) => { navigate(path); setDrawerOpen(false); };
  const handleFoodTypeClick = (v) => { navigate(`/silos/${v}`); setDrawerOpen(false); };
  const handleUserClick = () => navigate('/perfil');

  const isActivePath = (path) => {
    if (path === '/silos') return location.pathname.startsWith('/silos');
    return location.pathname === path;
  };
  const isDashboardActive = () => location.pathname === '/dashboard';

  const handleAddUnit = () => {
    if (!newUnitForm.nombre.trim()) return;
    const value = newUnitForm.nombre.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const newCat = { value, label: newUnitForm.nombre, iconKey: 'silo' };
    const updated = [...customFoodTypes.filter(t => t.value !== value), newCat];
    setCustomFoodTypes(updated);
    localStorage.setItem('sicodiet-custom-food-types', JSON.stringify(updated));
    setNewUnitForm({ nombre: '' });
    setShowAddUnitModal(false);
    navigate(`/silos/${value}`);
  };

  const handleDeleteCustomType = (value) => {
    const updated = customFoodTypes.filter(t => t.value !== value);
    setCustomFoodTypes(updated);
    localStorage.setItem('sicodiet-custom-food-types', JSON.stringify(updated));
  };

  /* ─── Sidebar compartido ────────────────────────────────────────────────── */
  const SidebarContent = ({ mobile = false }) => {
    const NavItem = ({ path, iconKey, label, onClick, isActive }) => (
      <button
        className={`${mobile ? 'drawer-nav-item' : 'sidebar-nav-item'} ${isActive ? 'active' : ''}`}
        onClick={onClick || (() => handleNavClick(path))}
      >
        <NavIcon iconKey={iconKey} size={mobile ? 18 : 17} />
        <span>{label}</span>
      </button>
    );

    // Items de OPERACIONES visibles según rol
    const operacionesVisibles = isTrabajador
      ? operacionesItems.filter(i => i.path === '/consumos')
      : operacionesItems;

    // Items de SISTEMA visibles según rol
    const sistemaVisibles = isTrabajador
      ? sistemaItems.filter(i => i.path === '/alertas' || i.path === '/perfil')
      : sistemaItems;

    return (
      <>
        {/* GENERAL — oculto para trabajador */}
        {!isTrabajador && (
          <div className={mobile ? 'drawer-section' : 'sidebar-section'}>
            {!mobile && <span className="sidebar-section-title">GENERAL</span>}
            {mobile && <span className="drawer-section-title">GENERAL</span>}
            <nav className={mobile ? '' : 'sidebar-nav'}>
              <NavItem path="/dashboard" iconKey="dashboard" label="Inicio" isActive={isDashboardActive()} />
            </nav>
          </div>
        )}

        {/* ALIMENTOS — oculto para trabajador */}
        {!isTrabajador && (
          <div className={mobile ? 'drawer-section' : 'sidebar-section'}>
            {!mobile && <span className="sidebar-section-title">ALIMENTOS</span>}
            {mobile && <span className="drawer-section-title">ALIMENTOS</span>}
            <nav className={mobile ? '' : 'sidebar-nav'}>
              {categorias.map(cat => {
                const isActive = location.pathname === `/silos/${cat.value}`;
                return (
                  <button
                    key={cat.value}
                    className={`${mobile ? 'drawer-nav-item' : 'sidebar-nav-item'} ${isActive ? 'active' : ''}`}
                    onClick={() => handleFoodTypeClick(cat.value)}
                  >
                    <NavIcon iconKey={cat.iconKey} size={mobile ? 18 : 17} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
              {customFoodTypes.map(type => {
                const isActive = location.pathname === `/silos/${type.value}`;
                return (
                  <div key={type.value} className={mobile ? 'drawer-nav-row' : 'sidebar-nav-row'}>
                    <button
                      className={`${mobile ? 'drawer-nav-item' : 'sidebar-nav-item'} ${isActive ? 'active' : ''}`}
                      onClick={() => handleFoodTypeClick(type.value)}
                    >
                      <NavIcon iconKey={type.iconKey || 'silo'} size={mobile ? 18 : 17} />
                      <span>{type.label}</span>
                    </button>
                    <button className="sidebar-delete-btn" onClick={() => handleDeleteCustomType(type.value)} title="Eliminar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              <button
                className={mobile ? 'drawer-add-btn' : 'sidebar-add-btn'}
                onClick={() => { setShowAddUnitModal(true); if (mobile) setDrawerOpen(false); }}
              >
                <Plus size={14} />
                <span>Agregar unidad</span>
              </button>
            </nav>
          </div>
        )}

        {/* OPERACIONES */}
        <div className={mobile ? 'drawer-section' : 'sidebar-section'}>
          {!mobile && <span className="sidebar-section-title">OPERACIONES</span>}
          {mobile && <span className="drawer-section-title">OPERACIONES</span>}
          <nav className={mobile ? '' : 'sidebar-nav'}>
            {operacionesVisibles.map(item => (
              <NavItem
                key={item.path}
                path={item.path}
                iconKey={item.iconKey}
                label={item.label}
                isActive={isActivePath(item.path)}
              />
            ))}
          </nav>
        </div>

        {/* SISTEMA */}
        <div className={mobile ? 'drawer-section' : 'sidebar-section'}>
          {!mobile && <span className="sidebar-section-title">SISTEMA</span>}
          {mobile && <span className="drawer-section-title">SISTEMA</span>}
          <nav className={mobile ? '' : 'sidebar-nav'}>
            {sistemaVisibles.map(item => (
              <NavItem
                key={item.path}
                path={item.path}
                iconKey={item.iconKey}
                label={item.label}
                isActive={isActivePath(item.path)}
              />
            ))}
            {isDueno && (
              <NavItem
                path="/usuarios"
                iconKey="usuarios"
                label="Usuarios"
                isActive={isActivePath('/usuarios')}
              />
            )}
          </nav>
        </div>
      </>
    );
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
                <span className="user-role">{ROL_LABELS[user?.rol] || user?.rol}</span>
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
        <SidebarContent mobile={false} />
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
            <span className="drawer-user-role">{ROL_LABELS[user?.rol] || user?.rol}</span>
          </div>
        </div>
        <nav className="drawer-nav">
          <SidebarContent mobile={true} />
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
                <label className="form-label">Nombre de la categoría</label>
                <input
                  type="text"
                  className="form-control"
                  value={newUnitForm.nombre}
                  onChange={e => setNewUnitForm({ nombre: e.target.value })}
                  placeholder="Ej: Vitaminas, Suplementos, Minerales"
                  onKeyDown={e => e.key === 'Enter' && handleAddUnit()}
                  autoFocus
                />
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
