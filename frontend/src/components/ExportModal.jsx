import { useState } from 'react';
import api from '../services/api';
import { Download } from 'lucide-react';

// Modal generico de exportacion: pega a GET /api/exportar con tipo fijo (consumos,
// insumos, costos, compras) + rango de fechas + formato (csv/xlsx) elegidos por el usuario.
export default function ExportModal({ show, onClose, tipoExport, extraParams = {}, defaultFechaInicio, defaultFechaFin, titulo = 'Exportar datos' }) {
  const [fechaInicio, setFechaInicio] = useState(defaultFechaInicio || '');
  const [fechaFin, setFechaFin] = useState(defaultFechaFin || '');
  const [formato, setFormato] = useState('csv');
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleDescargar = async () => {
    setLoading(true);
    try {
      const params = { tipo: tipoExport, fecha_inicio: fechaInicio, fecha_fin: fechaFin, formato, ...extraParams };
      const res = await api.get('/exportar', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tipoExport}_${fechaInicio}_${fechaFin}.${formato}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      console.error('Error exportando:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3 className="h5 mb-0 d-flex align-items-center gap-2"><Download size={18} />{titulo}</h3>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>
        <div className="modal-body">
          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small">Desde</label>
              <input type="date" className="form-control form-control-sm" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div className="col-6">
              <label className="form-label small">Hasta</label>
              <input type="date" className="form-control form-control-sm" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label small d-block">Formato</label>
            <div className="btn-group w-100" role="group">
              <button type="button" className={`btn btn-sm ${formato === 'csv' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setFormato('csv')}>CSV</button>
              <button type="button" className={`btn btn-sm ${formato === 'xlsx' ? 'btn-success' : 'btn-outline-secondary'}`} onClick={() => setFormato('xlsx')}>Excel (XLSX)</button>
            </div>
          </div>
          <div className="d-flex gap-2 justify-content-end">
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn btn-success btn-sm d-flex align-items-center gap-1" onClick={handleDescargar} disabled={loading || !fechaInicio || !fechaFin}>
              <Download size={14} /> {loading ? 'Descargando...' : 'Descargar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
