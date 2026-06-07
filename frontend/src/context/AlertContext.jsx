import { createContext, useState, useContext, useCallback } from 'react';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const showAlert = useCallback((options) => {
    const id = Date.now() + Math.random();
    const alert = {
      id,
      type: options.type || 'info',
      title: options.title || '',
      message: options.message || '',
      icon: options.icon || null,
      accentColor: options.accentColor || null,
      backgroundColor: options.backgroundColor || null,
      borderSize: options.borderSize || '1px',
      boxShadow: options.boxShadow !== false,
      animationType: options.animationType || 'slide',
      animationDirection: options.animationDirection || 'right',
      animationSpeed: options.animationSpeed || 0.5,
      duration: options.duration || 4000,
      actions: options.actions || null,
      onClose: options.onClose || null,
    };

    setAlerts(prev => [...prev, alert]);

    if (alert.duration > 0) {
      setTimeout(() => {
        dismissAlert(id);
      }, alert.duration);
    }

    return id;
  }, []);

  const dismissAlert = useCallback((id) => {
    setAlerts(prev => {
      const alert = prev.find(a => a.id === id);
      if (alert?.onClose) alert.onClose();
      return prev.filter(a => a.id !== id);
    });
  }, []);

  const success = useCallback((message, options = {}) => {
    return showAlert({ type: 'success', message, ...options });
  }, [showAlert]);

  const error = useCallback((message, options = {}) => {
    return showAlert({ type: 'error', message, ...options });
  }, [showAlert]);

  const warning = useCallback((message, options = {}) => {
    return showAlert({ type: 'warning', message, ...options });
  }, [showAlert]);

  const info = useCallback((message, options = {}) => {
    return showAlert({ type: 'info', message, ...options });
  }, [showAlert]);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      const id = Date.now() + Math.random();
      const alert = {
        id,
        type: options.type || 'warning',
        title: options.title || 'Confirmar',
        message: options.message || '¿Estás seguro?',
        icon: options.icon || null,
        accentColor: options.accentColor || null,
        backgroundColor: options.backgroundColor || null,
        borderSize: options.borderSize || '1px',
        boxShadow: options.boxShadow !== false,
        animationType: options.animationType || 'slide',
        animationDirection: options.animationDirection || 'right',
        animationSpeed: options.animationSpeed || 0.3,
        duration: 0,
        isConfirm: true,
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar',
        onConfirm: () => {
          dismissAlert(id);
          resolve(true);
        },
        onCancel: () => {
          dismissAlert(id);
          resolve(false);
        },
      };

      setAlerts(prev => [...prev, alert]);
    });
  }, [dismissAlert]);

  return (
    <AlertContext.Provider value={{ alerts, dismissAlert, showAlert, success, error, warning, info, confirm }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
}
