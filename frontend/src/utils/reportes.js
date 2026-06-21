import api from '../services/api';

// Descarga un reporte PDF desde el backend y dispara la descarga en el navegador.
// Si el navegador soporta Web Share API con archivos (Android/Chrome movil), tambien
// se puede compartir directo (ej. por WhatsApp) en vez de solo descargar.
export async function descargarReportePdf(endpoint, { params, filename } = {}) {
  const response = await api.get(`/reportes/${endpoint}`, { params, responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);

  return blob;
}

export function puedeCompartirArchivos() {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && typeof navigator.share === 'function';
}

function descargarBlob(file, filename) {
  const url = window.URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function compartirReportePdf(endpoint, { params, filename, titulo } = {}) {
  const response = await api.get(`/reportes/${endpoint}`, { params, responseType: 'blob' });
  const file = new File([response.data], filename, { type: 'application/pdf' });

  if (puedeCompartirArchivos() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titulo });
      return true;
    } catch (err) {
      if (err.name === 'AbortError') return false; // el usuario cancelo el share, no forzar descarga
      // cualquier otra falla del share (no soportado en la practica, etc.) cae a descarga directa
    }
  }

  descargarBlob(file, filename);
  return false;
}
