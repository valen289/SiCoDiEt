import { useAlert } from '../context/AlertContext';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import '../styles/alerts.css';

// Colores alineados al sistema de diseño de la app (index.css --success/--danger/--warning/--info),
// no a los genericos de Bootstrap, para que los toasts se sientan parte de la misma marca que el
// resto de la UI (dashboard, sidebar, alertas de stock).
const typeConfig = {
  success: {
    icon: CheckCircle,
    defaultColor: '#4D8A54',
    defaultBg: 'rgba(77, 138, 84, 0.1)',
    defaultBorder: 'rgba(77, 138, 84, 0.25)',
  },
  error: {
    icon: AlertCircle,
    defaultColor: '#D35D4E',
    defaultBg: 'rgba(211, 93, 78, 0.1)',
    defaultBorder: 'rgba(211, 93, 78, 0.25)',
  },
  warning: {
    icon: AlertTriangle,
    defaultColor: '#D9A441',
    defaultBg: 'rgba(217, 164, 65, 0.12)',
    defaultBorder: 'rgba(217, 164, 65, 0.3)',
  },
  info: {
    icon: Info,
    defaultColor: '#5E8CB8',
    defaultBg: 'rgba(94, 140, 184, 0.1)',
    defaultBorder: 'rgba(94, 140, 184, 0.25)',
  },
};

function AlertItem({ alert, onDismiss }) {
  const config = typeConfig[alert.type] || typeConfig.info;
  const Icon = alert.icon ? alert.icon : config.icon;
  const accentColor = alert.accentColor || config.defaultColor;
  const backgroundColor = alert.backgroundColor || config.defaultBg;
  const borderColor = alert.accentColor || config.defaultBorder;
  const animationClass = `alert-animate-${alert.animationType}-${alert.animationDirection}`;

  const style = {
    borderLeft: `${alert.borderSize || '4px'} solid ${accentColor}`,
    backgroundColor,
    boxShadow: alert.boxShadow ? 'var(--shadow-md)' : 'none',
    animationDuration: `${alert.animationSpeed}s`,
  };

  return (
    <div className={`alert-custom ${animationClass}`} style={style}>
      <div className="alert-custom-icon" style={{ color: accentColor }}>
        <Icon size={20} />
      </div>
      <div className="alert-custom-content">
        {alert.title && <div className="alert-custom-title" style={{ color: accentColor }}>{alert.title}</div>}
        <div className="alert-custom-message">{alert.message}</div>
      </div>
      <button className="alert-custom-close" onClick={() => onDismiss(alert.id)}>
        <X size={16} />
      </button>
      {alert.isConfirm && (
        <div className="alert-custom-actions">
          <button className="btn btn-sm btn-secondary" onClick={alert.onCancel}>
            {alert.cancelText}
          </button>
          <button className="btn btn-sm" style={{ backgroundColor: accentColor, color: '#fff' }} onClick={alert.onConfirm}>
            {alert.confirmText}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AlertContainer() {
  const { alerts, dismissAlert } = useAlert();

  if (alerts.length === 0) return null;

  return (
    <div className="alert-container">
      {alerts.map(alert => (
        <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
      ))}
    </div>
  );
}
