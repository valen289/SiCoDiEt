import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const REGLAS = [
  'Al menos 1 minúscula',
  'Al menos 1 mayúscula',
  'Al menos 1 número',
  'Al menos 1 carácter especial',
  'Mínimo 8 caracteres',
];

export default function PasswordRulesHint() {
  const [open, setOpen] = useState(false);

  return (
    <div className="password-rules-hint">
      <button
        type="button"
        className="password-rules-hint__toggle"
        onClick={() => setOpen(o => !o)}
      >
        Reglas de la contraseña {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <ul className="password-rules-hint__list">
          {REGLAS.map(regla => <li key={regla}>{regla}</li>)}
        </ul>
      )}
    </div>
  );
}
