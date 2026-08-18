// Registro del Service Worker + captura del evento de instalación. El browser
// dispara beforeinstallprompt una sola vez y solo si no se llama a preventDefault()
// se muestra el prompt nativo automáticamente -- lo interceptamos para poder
// mostrarlo nosotros desde un botón propio (InstallBanner.jsx) en vez del banner
// genérico del navegador.
import { iniciarSincronizacionAutomatica } from './offlineSync';

let deferredInstallPrompt = null;
const listeners = new Set();

function notificar() {
  listeners.forEach((cb) => cb(deferredInstallPrompt));
}

export function onInstallPromptChange(cb) {
  listeners.add(cb);
  cb(deferredInstallPrompt);
  return () => listeners.delete(cb);
}

export async function pedirInstalacion() {
  if (!deferredInstallPrompt) return null;
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  notificar();
  prompt.prompt();
  return prompt.userChoice;
}

export function inicializarPWA() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    notificar();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    notificar();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('No se pudo registrar el Service Worker:', err);
      });
    });
  }

  iniciarSincronizacionAutomatica();
}
