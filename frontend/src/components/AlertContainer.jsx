import { useAlert } from '../context/AlertContext';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import '../styles/alerts.css';

// Colores alineados al sistema de diseño de la app (index.css --success/--danger/--warning/--info),
// no a los genericos de Bootstrap, para que los toasts se sientan parte de la misma marca que el
// resto de la UI (dashboard, sidebar, alertas de stock).
// Hex solidos (no rgba) mezclados con blanco -- evita que el toast se vea
// "transparente"/desvaido independientemente de lo que haya detras.
const typeConfig = {
  success: {
    icon: CheckCircle,
    defaultColor: '#4D8A54',
    defaultBg: '#E4EDE5',
    defaultBorder: '#C1D6C3',
  },
  error: {
    icon: AlertCircle,
    defaultColor: '#D35D4E',
    defaultBg: '#F8E7E4',
    defaultBorder: '#F0C6C1',
  },
  warning: {
    icon: AlertTriangle,
    defaultColor: '#D9A441',
    defaultBg: '#F8EFDD',
    defaultBorder: '#F2DFBD',
  },
  info: {
    icon: Info,
    defaultColor: '#5E8CB8',
    defaultBg: '#E7EEF4',
    defaultBorder: '#C7D7E6',
  },
};

function AlertItem({ alert, onDismiss }) {
  const config = typeConfig[alert.type] || typeConfig.info;
  const Icon = alert.icon ? alert.icon : config.icon;
  const accentColor = alert.accentColor || config.defaultColor;
  const backgroundColor = alert.backgroundColor || config.defaultBg;
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
    </div>
  );
}

// Las confirmaciones son una decision que requiere foco, no una notificacion de paso --
// por eso van en un modal centrado con backdrop propio, no apretadas en el mismo
// contenedor angosto de los toasts (eso era la causa de los problemas de layout:
// icono/titulo mal alineados, poco aprovechamiento del ancho, botones inconsistentes).
function ConfirmModal({ alert }) {
  const config = typeConfig[alert.type] || typeConfig.warning;
  const Icon = alert.icon ? alert.icon : config.icon;
  const accentColor = alert.accentColor || config.defaultColor;
  const iconBg = alert.backgroundColor || config.defaultBg;

  return (
    <div className="confirm-modal-backdrop" onClick={alert.onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="confirm-modal-close" onClick={alert.onCancel} aria-label="Cerrar">
          <X size={16} />
        </button>
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon" style={{ backgroundColor: iconBg, color: accentColor }}>
            <Icon size={22} />
          </div>
          <h3 className="confirm-modal-title">{alert.title}</h3>
        </div>
        <p className="confirm-modal-message">{alert.message}</p>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn confirm-modal-btn--cancel" onClick={alert.onCancel}>
            {alert.cancelText}
          </button>
          <button
            className="confirm-modal-btn confirm-modal-btn--confirm"
            style={{ backgroundColor: accentColor }}
            onClick={alert.onConfirm}
          >
            {alert.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertContainer() {
  const { alerts, dismissAlert } = useAlert();

  if (alerts.length === 0) return null;

  const toasts = alerts.filter((a) => !a.isConfirm);
  const confirms = alerts.filter((a) => a.isConfirm);

  return (
    <>
      {toasts.length > 0 && (
        <div className="alert-container">
          {toasts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={dismissAlert} />
          ))}
        </div>
      )}
      {confirms.map((alert) => (
        <ConfirmModal key={alert.id} alert={alert} />
      ))}
    </>
  );
}
