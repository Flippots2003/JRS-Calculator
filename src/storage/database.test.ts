import { upgradeSettings } from '../domain/upgrade'
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { JrsDatabase, saveQuote, saveSettings, loadSettings, saveCustomer } from './database'
import { createBackup, restoreBackup, validateBackup } from './backup'
import { legacyDefaultSettings as defaultSettings, emptyDraft } from '../domain/models'
import { calculate } from '../domain/calculate'
const databases: JrsDatabase[] = []
function database() { const d = new JrsDatabase(crypto.randomUUID()); databases.push(d); return d }
function fixture() {
  const draft = emptyDraft(); const settings = defaultSettings()
  draft.customer = { ...draft.customer, name: 'Testklant', street: 'Teststraat 1', postcode: '9000', city: 'Gent' }
  draft.lines[1].quantity = 10; settings.rates['windows-both-1'] = { priceCents: 500, minutes: 1 }
  return { draft, settings }
}
afterEach(async () => { await Promise.all(databases.splice(0).map(d => d.delete())) })
describe('Lokale opslag en herstel', () => {
  it('G: bewaart historische tarieven, ook na prijswijzigingen en bewerkingen', async () => {
    const d = database(); const { draft, settings } = fixture()
    const quote = await saveQuote(draft, settings, null, d)
    settings.rates['windows-both-1'].priceCents = 800; await saveSettings(settings, d)
    const old = (await d.quotes.get(quote.id))!
    expect(calculate(old.draft, old.settings).totalCents).toBe(5000)
    const edited = await saveQuote(draft, settings, quote.id, d)
    expect(edited.number).toBe(quote.number); expect(edited.revisions[0].result.totalCents).toBe(5000)
    expect(edited.result.totalCents).toBe(8000)
  })
  it('kent unieke nummers toe bij gelijktijdig opslaan', async () => {
    const d = database(); const { draft, settings } = fixture()
    const results = await Promise.all([saveQuote(draft, settings, null, d), saveQuote(draft, settings, null, d)])
    expect(new Set(results.map(r => r.number)).size).toBe(2)
  })
  it('I: herstelt klanten, offertes, concept en instellingen in een lege database', async () => {
    const source = database(); const target = database(); const { draft, settings } = fixture()
    await saveSettings(settings, source); const q = await saveQuote(draft, settings, null, source)
    const backup = await createBackup(source); await restoreBackup(JSON.parse(JSON.stringify(backup)), target)
    expect(await target.customers.count()).toBe(1); expect((await target.quotes.get(q.id))?.result.totalCents).toBe(5000)
    expect(await loadSettings(target)).toEqual(upgradeSettings(settings))
    const next = await saveQuote(draft, settings, null, target); expect(next.number).not.toBe(q.number)
  })
  it('weigert kapotte, toekomstige en gemanipuleerde back-ups vóór overschrijven', async () => {
    const d = database(); const { draft, settings } = fixture(); await saveQuote(draft, settings, null, d)
    const backup = await createBackup(d)
    expect(() => validateBackup({ ...backup, schemaVersion: 99 })).toThrow('dataschemaversie')
    backup.quotes[0].result.totalCents = 1
    await expect(restoreBackup(backup, d)).rejects.toThrow('berekening')
    expect(await d.quotes.count()).toBe(1)
  })
  it('slaat geen incomplete offerte op', async () => { const d = database(); await expect(saveQuote(emptyDraft(), defaultSettings(), null, d)).rejects.toThrow(); expect(await d.quotes.count()).toBe(0) })
  it('bewaart een offerte zonder klantgegevens en herstelt die zonder lege klanten aan te maken', async () => {
    const source = database(); const target = database(); const { draft, settings } = fixture()
    draft.customer = emptyDraft().customer
    const quote = await saveQuote(draft, settings, null, source)
    expect(quote.draft.customer.name).toBe('')
    expect(await source.customers.count()).toBe(0)
    await restoreBackup(await createBackup(source), target)
    expect((await target.quotes.get(quote.id))?.result.totalCents).toBe(5000)
    expect(await target.customers.count()).toBe(0)
  })
  it('bewaart klanten met alleen een telefoonnummer of zonder ingevulde velden', async () => {
    const d = database(); const customer = emptyDraft().customer
    await saveCustomer({ ...customer, phone: '0123456789' }, d)
    await saveCustomer(customer, d)
    expect(await d.customers.count()).toBe(2)
  })
})
