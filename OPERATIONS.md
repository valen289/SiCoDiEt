# Operaciones — SiCoDiEt en producción

## Backups

Además de los backups que ofrezca el plan de Railway (verificar en el dashboard del
servicio MySQL → pestaña Backups), hay un backup independiente y automático:

- **Workflow:** `.github/workflows/db-backup.yml`, corre todos los días a las 07:00 UTC
  (04:00 Uruguay/Argentina) y también se puede disparar a mano desde GitHub →
  pestaña **Actions** → "Backup diario de la base de datos" → **Run workflow**.
- **Qué hace:** un `mysqldump` completo contra la base de Railway, subido como
  artifact del workflow (se conserva 30 días).
- **Configuración requerida (una sola vez):** en GitHub → Settings → Secrets and
  variables → Actions, crear estos 5 secrets con los valores **públicos** de
  conexión del servicio MySQL en Railway (pestaña "Connect" → "Public Network",
  no los valores internos `MYSQLHOST`/etc. que usa el backend):
  - `DB_HOST`
  - `DB_PORT`
  - `DB_USER`
  - `DB_PASSWORD`
  - `DB_NAME`

### Cómo restaurar un backup (probar al menos una vez)

1. Descargar el artifact desde GitHub → Actions → la corrida que corresponda →
   sección "Artifacts".
2. Levantar una base descartable local:
   ```powershell
   docker-compose up -d db
   ```
3. Importar el dump:
   ```powershell
   docker exec -i sicodiet-db mysql -u sicodiet -psecret gestion_tambo < backup-2026-06-22.sql
   ```
4. Verificar que los datos están:
   ```powershell
   docker exec -i sicodiet-db mysql -u sicodiet -psecret gestion_tambo -e "SELECT COUNT(*) FROM usuarios; SELECT COUNT(*) FROM dietas; SELECT COUNT(*) FROM consumos;"
   ```
5. Bajar la base descartable: `docker-compose down`.

## Si el productor reporta un error

1. Railway → servicio **SiCoDiEt** (backend) → pestaña **Deployments** → el
   deployment activo → **Deploy Logs** (errores en tiempo de arranque) o
   **HTTP Logs** (errores por request, con status code y timestamp).
2. Cruzar el timestamp que reporta el productor con los logs de esa franja.
3. Confirmar en Railway cuánto tiempo retiene esos logs según el plan — no asumir
   que quedan disponibles indefinidamente.

Por ahora no hay un servicio de alertas/APM (Sentry, etc.) — decisión consciente
mientras sea un solo desarrollador con pocos tambos en beta. Revisar esto si crece
la cantidad de productores o se vuelve difícil correlacionar errores con reportes.
