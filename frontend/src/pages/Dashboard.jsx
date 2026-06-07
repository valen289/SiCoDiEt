import { useState, useEffect } from 'react';
import api from '../services/api';
import { AlertCircle, TrendingUp, Package, Users, AlertTriangle } from 'lucide-react';
import '../styles/dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState({
    insumos: 0,
    alertas: 0,
    lotes: 0,
    ganado: 0
  });
  const [alertas, setAlertas] = useState([]);
  const [insumosAlertas, setInsumosAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  const getNivelAlertaColor = (tipo) => {
    if (tipo === 'stock_critico') return '#dc3545';
    if (tipo === 'stock_bajo') return '#ffc107';
    return '#28a745';
  };

  const getNivelAlertaLabel = (tipo) => {
    if (tipo === 'stock_critico') return 'CRITICO';
    if (tipo === 'stock_bajo') return 'PRECAUCION';
    return 'NORMAL';
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [insumosRes, alertasRes, lotesRes, ganadoRes, estadoAlertasRes] = await Promise.all([
        api.get('/insumos'),
        api.get('/alertas?leidas=false'),
        api.get('/lotes'),
        api.get('/ganado'),
        api.get('/insumos/estado-alertas')
      ]);

      setStats({
        insumos: insumosRes.data.insumos.length,
        alertas: alertasRes.data.alertas.length,
        lotes: lotesRes.data.lotes.length,
        ganado: ganadoRes.data.ganado?.total_vacas || 0
      });
      setAlertas(alertasRes.data.alertas.slice(0, 5));
      setInsumosAlertas((estadoAlertasRes.data.insumos || []).filter(i => i.nivel_alerta === 'critico' || i.nivel_alerta === 'precaucion'));
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { icon: Package, label: 'Insumos', value: stats.insumos, color: '#4CAF50' },
    { icon: AlertCircle, label: 'Alertas', value: stats.alertas, color: '#f44336' },
    { icon: Users, label: 'Lotes', value: stats.lotes, color: '#2196F3' },
    { icon: TrendingUp, label: 'Vacas', value: stats.ganado, color: '#FF9800' },
  ];

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ borderLeft: `4px solid ${card.color}` }}>
            <card.icon size={24} style={{ color: card.color }} />
            <div>
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      {alertas.length > 0 && (
        <div className="alertas-section">
          <h2>Alertas Recientes</h2>
          {alertas.map(alerta => (
            <div key={alerta.id} className={`alerta-item alerta-${alerta.tipo}`} style={{ borderLeft: `4px solid ${getNivelAlertaColor(alerta.tipo)}` }}>
              <AlertTriangle size={20} style={{ color: getNivelAlertaColor(alerta.tipo) }} />
              <div>
                <strong>{alerta.insumo_nombre}</strong>
                <span className="badge ms-2" style={{ backgroundColor: getNivelAlertaColor(alerta.tipo) }}>
                  {getNivelAlertaLabel(alerta.tipo)}
                </span>
                <p>{alerta.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {insumosAlertas.length > 0 && (
        <div className="alertas-section mt-4">
          <h2>Estado de Insumos</h2>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Stock</th>
                  <th>Dias Restantes</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {insumosAlertas.map(insumo => (
                  <tr key={insumo.id} style={{ borderLeft: `4px solid ${insumo.color_alerta}` }}>
                    <td><strong>{insumo.nombre}</strong></td>
                    <td>{parseFloat(insumo.stock_actual).toLocaleString('es-AR', { maximumFractionDigits: 2 })} {insumo.unidad}</td>
                    <td className="fw-bold">{insumo.dias_restantes} dias</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: insumo.color_alerta }}>
                        {insumo.label_alerta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
