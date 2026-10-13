import { backupSchema, calculationSchema, settingsSchema, type Backup } from '../domain/models'
import { calculate, saveErrors } from '../domain/calculate'
import { db, loadSettings, loadWorkspace, type JrsDatabase } from './database'

export async function createBackup(database = db): Promise<Backup> {
  return database.transaction('r', database.meta, database.customers, database.quotes, async () => ({
    app: 'JRS Offertecalculator', schemaVersion: 1, exportedAt: new Date().toISOString(),
    settings: await loadSettings(database), customers: await database.customers.toArray(),
    quotes: await database.quotes.toArray(), workspace: await loadWorkspace(database),
  }))
}
export function validateBackup(raw: unknown): Backup {
  if (raw && typeof raw === 'object' && 'schemaVersion' in raw && raw.schemaVersion !== 1) throw new Error('Deze dataschemaversie wordt nog niet ondersteund. Importeer het bestand in een geschikte appversie.')
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) throw new Error('Ongeldige back-up: ' + parsed.error.issues[0].message)
  for (const q of parsed.data.quotes) {
    for (const version of [q, ...q.revisions]) {
      const result = calculate(version.draft, version.settings)
      if (saveErrors(version.draft, version.settings).length || JSON.stringify(calculationSchema.parse(result)) !== JSON.stringify(version.result)) throw new Error(`De berekening in ${q.number} stemt niet overeen met de opgeslagen gegevens.`)
    }
  }
  return parsed.data
}
export async function restoreBackup(raw: unknown, database: JrsDatabase = db) {
  const backup = validateBackup(raw)
  await database.transaction('rw', database.meta, database.customers, database.quotes, async () => {
    await database.meta.clear(); await database.customers.clear(); await database.quotes.clear()
    await database.meta.put({ key: 'settings', value: backup.settings })
    if (backup.workspace) await database.meta.put({ key: 'workspace', value: backup.workspace })
    await database.meta.put({ key: 'lastRestore', value: new Date().toISOString() })
    await database.customers.bulkPut(backup.customers)
    await database.quotes.bulkPut(backup.quotes)
  })
  return backup
}
export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name
  document.body.append(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
export function downloadJson(data: unknown, name: string) {
  downloadFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), name)
}
export async function readJson(file: File) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Het bestand is te groot (maximum 30 MB).')
  try { return JSON.parse(await file.text()) as unknown } catch { throw new Error('Dit bestand bevat geen geldige JSON.') }
}
export function validatePriceList(raw: unknown) {
  if (!raw || typeof raw !== 'object' || !('app' in raw) || raw.app !== 'JRS Prijslijst' || !('schemaVersion' in raw) || raw.schemaVersion !== 1 || !('settings' in raw)) throw new Error('Dit is geen ondersteunde JRS-prijslijst.')
  return settingsSchema.parse(raw.settings)
}
