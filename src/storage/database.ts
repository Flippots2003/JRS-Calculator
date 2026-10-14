import { upgradeSettings, upgradeDraft } from '../domain/upgrade'
import Dexie, { type Table } from 'dexie'
import { hasCustomerDetails } from '../domain/customers'
import { calculate, saveErrors } from '../domain/calculate'
import { defaultSettings, draftSchema, settingsSchema, customerSchema, type Customer, type Draft, type Quote, type QuoteVersion, type Settings } from '../domain/models'

export interface Workspace { draft: Draft; settings: Settings; editingId: string | null }
export class JrsDatabase extends Dexie {
  customers!: Table<Customer, string>
  quotes!: Table<Quote, string>
  meta!: Table<{ key: string; value: unknown }, string>
  constructor(name = 'jrs-offertecalculator') {
    super(name)
    this.version(1).stores({ customers: 'id,name,city', quotes: 'id,&number,status,date', meta: 'key' })
  }
}
export const db = new JrsDatabase()
export async function loadSettings(database = db): Promise<Settings> {
  const entry = await database.meta.get('settings')
  const stored = entry ? settingsSchema.parse(entry.value) : defaultSettings()
  const settings = upgradeSettings(stored)
  if (stored.pricingVersion !== 2) await database.meta.put({ key: 'settings', value: settings })
  return settings
}
export async function saveSettings(settings: Settings, database = db) {
  await database.meta.put({ key: 'settings', value: settingsSchema.parse(settings) })
}
export async function saveCustomer(input: Customer, database = db) {
  const customer = customerSchema.parse({ ...input, id: input.id || crypto.randomUUID() })
  await database.customers.put(customer)
  return customer
}
export async function loadWorkspace(database = db): Promise<Workspace | null> {
  const row = await database.meta.get('workspace')
  if (!row) return null
  const data = row.value as Workspace
  const oldSettings = settingsSchema.parse(data.settings)
  return { draft: upgradeDraft(draftSchema.parse(data.draft), oldSettings), settings: upgradeSettings(oldSettings), editingId: data.editingId }
}
export async function saveWorkspace(workspace: Workspace, database = db) {
  await database.meta.put({ key: 'workspace', value: structuredClone(workspace) })
}
export const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function expiry(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
export async function saveQuote(draft: Draft, settings: Settings, editingId: string | null, database = db): Promise<Quote> {
  const errors = saveErrors(draft, settings)
  if (errors.length) throw new Error(errors[0])
  return database.transaction('rw', database.quotes, database.customers, database.meta, async () => {
    const customer = draft.customer.id || hasCustomerDetails(draft.customer)
      ? await saveCustomer(draft.customer, database)
      : structuredClone(draft.customer)
    const old = editingId ? await database.quotes.get(editingId) : null
    if (editingId && !old) throw new Error('Deze offerte bestaat niet meer. Start een nieuwe offerte.')
    const date = old?.date ?? today()
    const year = date.slice(0, 4)
    let number = old?.number
    if (!number) {
      const key = `sequence-${year}`
      const last = Number((await database.meta.get(key))?.value ?? 0)
      const quotes = await database.quotes.toArray()
      let next = Math.max(last, ...quotes.filter(q => q.number.startsWith(`JRS-${year}-`)).map(q => Number(q.number.split('-')[2])), 0) + 1
      number = `JRS-${year}-${String(next).padStart(4, '0')}`
      await database.meta.put({ key, value: next })
    }
    const snapshotDraft = structuredClone({ ...draft, customer })
    const version: QuoteVersion = { date, validUntil: old?.validUntil ?? expiry(date, settings.company.validityDays), savedAt: new Date().toISOString(), draft: snapshotDraft, settings: structuredClone(settings), result: calculate(snapshotDraft, settings) }
    const revisions = old ? [...old.revisions, { date: old.date, validUntil: old.validUntil, savedAt: old.savedAt, draft: old.draft, settings: old.settings, result: old.result }] : []
    const quote: Quote = { ...version, id: old?.id ?? crypto.randomUUID(), number, status: old?.status ?? 'Concept', revisions }
    await database.quotes.put(quote)
    await saveWorkspace({ draft: snapshotDraft, settings, editingId: quote.id }, database)
    return quote
  })
}
