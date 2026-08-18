import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { onInstallPromptChange, pedirInstalacion } from '../utils/pwa';

const DISMISS_KEY = 'sicodiet-install-banner-dismissed';

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => onInstallPromptChange(setPrompt), []);

  if (!prompt || dismissed) return null;

  const handleInstalar = async () => {
    await pedirInstalacion();
  };

  const handleCerrar = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <div className="install-banner">
      <Download size={18} className="install-banner__icon" />
      <div className="install-banner__text">
        <strong>Instalá la app</strong>
        <span>Accedé más rápido y registrá consumos incluso sin señal</span>
      </div>
      <button className="install-banner__btn" onClick={handleInstalar}>Instalar</button>
      <button className="install-banner__close" onClick={handleCerrar} aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}
