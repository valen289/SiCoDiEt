import { useAlert } from '../context/AlertContext';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X, ShieldAlert } from 'lucide-react';
import '../styles/alerts.css';

const typeConfig = {
  success: {
    icon: CheckCircle,
    defaultColor: '#28a745',
    defaultBg: '#d4edda',
    defaultBorder: '#c3e6cb',
  },
  error: {
    icon: AlertCircle,
    defaultColor: '#dc3545',
    defaultBg: '#f8d7da',
    defaultBorder: '#f5c6cb',
  },
  warning: {
    icon: AlertTriangle,
    defaultColor: '#ffc107',
    defaultBg: '#fff3cd',
    defaultBorder: '#ffeeba',
  },
  info: {
    icon: Info,
    defaultColor: '#17a2b8',
    defaultBg: '#d1ecf1',
    defaultBorder: '#bee5eb',
  },
  confirm: {
    icon: ShieldAlert,
    defaultColor: '#fd7e14',
    defaultBg: '#ffe8cc',
    defaultBorder: '#ffd699',
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
    boxShadow: alert.boxShadow ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
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
