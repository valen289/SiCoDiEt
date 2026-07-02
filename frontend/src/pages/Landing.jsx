import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, ClipboardList, DollarSign, ShoppingCart, Users, Activity, ArrowRight, Check,
} from 'lucide-react';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';
import heroBg from '../assets/imagen landing.png';
import '../styles/landing.css';

const features = [
  {
    icon: Database,
    title: 'Reservas con cobertura al día',
    desc: 'Cada depósito muestra unidades, días de cobertura y estado de alerta en tiempo real. Sin revisión manual.',
  },
  {
    icon: ClipboardList,
    title: 'Registro de consumo por turno y lote',
    desc: 'Cargá el turno AM o PM y el stock se descuenta automáticamente.',
  },
  {
    icon: DollarSign,
    title: 'Costo real por lote y por animal',
    desc: 'Costo total, diario y por animal disponibles al instante. Exportable a CSV para tus análisis.',
  },
  {
    icon: ShoppingCart,
    title: 'Historial de compras por proveedor',
    desc: 'Cada compra registrada con proveedor, precio y remito. El gasto del período, siempre disponible.',
  },
  {
    icon: Users,
    title: 'Acceso definido por rol',
    desc: 'Dueño, Técnico y Trabajador acceden solo a lo que les corresponde. Sin configuración compleja.',
  },
  {
    icon: Activity,
    title: 'Trazabilidad de cada acción',
    desc: 'Cada alta, edición o carga queda registrada con usuario y fecha. Historial completo del sistema.',
  },
];

export default function Landing() {
  useSEO({
    title: 'Gestión de alimentación y stock para establecimientos',
    description: 'SiCoDiEt es el sistema para controlar el stock de alimento, el consumo diario por lote y los costos de tu establecimiento, todo en un solo lugar.',
    keywords: 'establecimiento, ganado, alimentos, stock, consumo, costos, gestion, sicodiet',
  });

  useEffect(() => {
    const structuredData = {
      '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
      name: 'SiCoDiEt',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: 'Sistema de control de stock de alimento, consumo diario y costos para establecimientos.',
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <span className="landing-logo">SiCoDiEt</span>
        <Link to="/login" className="btn btn-outline-secondary btn-sm">Ingresar</Link>
      </nav>

      <header className="landing-hero" style={{ '--hero-image': `url(${heroBg})` }}>
        <div className="landing-hero-overlay" />
        <div className="landing-hero-content">
          <h1>Controlá el stock, consumo y costos de tu establecimiento desde un solo lugar</h1>
          <p>
            Gestioná reservas forrajeras, concentrados, compras y consumo diario sin planillas
            ni cálculos manuales.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="landing-btn landing-btn-primary">
              Comenzar ahora <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="landing-btn landing-btn-secondary">Ingresar</Link>
          </div>
          <ul className="landing-hero-trust">
            <li><Check size={16} /> Control de stock</li>
            <li><Check size={16} /> Consumo por lote</li>
            <li><Check size={16} /> Costos automáticos</li>
            <li><Check size={16} /> Acceso desde celular y PC</li>
          </ul>
        </div>
        <svg className="landing-hero-wave" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,40 C360,100 1080,0 1440,55 L1440,100 L0,100 Z" />
        </svg>
      </header>

      <section className="landing-features" aria-label="Funcionalidades">
        <h2>Qué hace SiCoDiEt por tu establecimiento</h2>
        <div className="landing-features-grid">
          {features.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="landing-feature-card">
              <div className="landing-feature-icon"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

<section className="landing-cta-band">
        <h2>¿Querés llevarlo a tu establecimiento?</h2>
        <p>Escribime y te ayudo a poner en marcha el sistema con tus datos.</p>
      </section>

      <Footer />
    </div>
  );
}
