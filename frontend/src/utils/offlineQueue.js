// Cola de consumos pendientes de sincronizar, en IndexedDB. Solo el registro de
// consumo se guarda offline (es el 90% del uso del trabajador en el campo) --
// crear insumos, editar dietas o cambiar usuarios sigue requiriendo conexión.
const DB_NAME = 'sicodiet-offline';
const DB_VERSION = 1;
const STORE = 'consumos-pendientes';

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function conStore(modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo);
    const store = tx.objectStore(STORE);
    const resultado = fn(store);
    tx.oncomplete = () => resolve(resultado);
    tx.onerror = () => reject(tx.error);
  });
}

export async function encolarConsumo(payload) {
  const registro = { payload, fecha_encolado: new Date().toISOString(), intentos: 0 };
  await conStore('readwrite', (store) => store.add(registro));
}

export async function listarPendientes() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function eliminarPendiente(id) {
  await conStore('readwrite', (store) => store.delete(id));
}

export async function marcarIntento(id, registro) {
  await conStore('readwrite', (store) => store.put({ ...registro, id, intentos: (registro.intentos || 0) + 1 }));
}

export async function contarPendientes() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
