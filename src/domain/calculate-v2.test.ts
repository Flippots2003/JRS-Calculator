import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { calculate } from './calculate'
import { defaultSettings, legacyDefaultSettings, emptyDraft } from './models'
import { upgradeDraft, upgradeSettings } from './upgrade'
import { calculationSchema } from './models'
import { createBackup, restoreBackup } from '../storage/backup'
import { JrsDatabase, saveQuote, saveSettings } from '../storage/database'

function fixture() {
  const settings = defaultSettings(); const draft = emptyDraft()
  settings.minimumHourlyCents = 0; settings.minimumOrderCents = 0; settings.preparationMinutes = 0
  settings.rates['windows-outside-1'] = { priceCents: 500, minutes: 3 }
  draft.lines[6].quantity = 10
  return { settings, draft }
}
describe('Nieuwe exclusieve prijsregels', () => {
  it('telt tien ramen één keer en verhoogt alleen hun buitenbasis met exact 75%', () => {
    const { settings, draft } = fixture()
    expect(calculate(draft, settings).exclusiveCents).toBe(5000)
    draft.windowCleaning = 'both'
    const r = calculate(draft, settings)
    expect(r.quantity).toBe(10); expect(r.baseCents).toBe(5000)
    expect(r.windowSupplementCents).toBe(3750); expect(r.exclusiveCents).toBe(8750)
    expect(r.vatCents).toBe(1838); expect(r.totalCents).toBe(10588)
    expect(r.totalMinutes).toBe(53)
  })
  it('past de raamtoeslag niet toe op rolluiken, garagepoorten of veranda’s', () => {
    const { settings, draft } = fixture(); draft.windowCleaning = 'both'; draft.overlapConfirmed = true
    for (const id of ['shutters-1', 'garages-1', 'conservatories-1']) {
      settings.rates[id] = { priceCents: 2000, minutes: 1 }; draft.lines.find(l => l.id === id)!.quantity = 1
    }
    const r = calculate(draft, settings)
    expect(r.windowSupplementCents).toBe(3750); expect(r.exclusiveCents).toBe(14750)
    expect(r.issues).toEqual([])
  })
  it('rekent de uurgrens, opdrachtgrens en handmatige eindprijs uitsluitend exclusief btw', () => {
    const { settings, draft } = fixture(); settings.minimumHourlyCents = 5500
    settings.rates['windows-outside-1'].minutes = 12
    let r = calculate(draft, settings)
    expect(r.laborCents).toBe(11000); expect(r.exclusiveCents).toBe(11000); expect(r.totalCents).toBe(13310)
    draft.manualTotalCents = 4000; r = calculate(draft, settings)
    expect(r.exclusiveCents).toBe(4000); expect(r.totalCents).toBe(4840)
    expect(r.manualWarnings).toHaveLength(1); expect(r.issues).toHaveLength(1)
    draft.manualConfirmed = true; expect(calculate(draft, settings).issues).toEqual([])
    draft.manualTotalCents = null; settings.minimumHourlyCents = 0; settings.minimumOrderCents = 6000
    expect(calculate(draft, settings).exclusiveCents).toBe(6000)
  })
  it('neemt kosten niet mee in de arbeidsuurnorm en laat btw maar één keer ontstaan', () => {
    const { settings, draft } = fixture(); settings.minimumHourlyCents = 5500
    settings.rates['windows-outside-1'].minutes = 12
    draft.materialCents = 2000; draft.internalMaterialCents = 100000; draft.travelOverrideCents = 1000
    const r = calculate(draft, settings)
    expect(r.laborCents).toBe(11000); expect(r.exclusiveCents).toBe(14000); expect(r.vatCents).toBe(2940)
  })
  it('begrenst kortingen vóór de exclusieve uurnorm', () => {
    const { settings, draft } = fixture(); draft.frequency = 1; settings.frequencyBps[1] = 2000
    draft.discountType = 'fixed'; draft.discountValue = 10000; settings.minimumHourlyCents = 5500
    const r = calculate(draft, settings)
    expect(r.frequencyDiscountCents).toBe(1000); expect(r.extraDiscountCents).toBe(4000)
    expect(r.hourlyCorrectionCents).toBe(2750)
  })
  it('heeft standaard alle stukprijzen en tijden ingevuld en een exclusieve arbeidsgrens', () => {
    const s = defaultSettings(); expect(s.priceBasis).toBe('exclusive'); expect(s.minimumHourlyCents).toBe(5500)
    expect(Object.values(s.rates).every(r => r.priceCents !== null && r.minutes !== null)).toBe(true)
  })
  it('zet oude inclusieve invoer om zonder oude opgeslagen resultaten te veranderen', () => {
    const old = legacyDefaultSettings(); old.rates['windows-outside-1'] = { priceCents: 1210, minutes: 5 }
    const d = emptyDraft(); d.lines[1].quantity = 4; d.materialCents = 1210; d.manualTotalCents = 12100
    const next = upgradeSettings(old); const nextDraft = upgradeDraft(d, old)
    expect(next.rates['windows-outside-1'].priceCents).toBe(1000)
    expect(nextDraft.lines[1].quantity).toBe(0); expect(nextDraft.lines[6].quantity).toBe(4)
    expect(nextDraft.windowCleaning).toBe('both'); expect(nextDraft.materialCents).toBe(1000)
    expect(nextDraft.manualTotalCents).toBe(10000)
    expect(old.rates['windows-outside-1'].priceCents).toBe(1210)
  })
  it('herkent een oud resultaat zonder de nieuwe toeslagvelden', () => {
    const s = legacyDefaultSettings(); const d = emptyDraft(); s.rates['windows-both-1'] = { priceCents: 500, minutes: 1 }; d.lines[1].quantity = 10
    const r = calculate(d, s); const { windowSupplementCents, ...raw } = r
    expect(calculationSchema.parse(raw).totalCents).toBe(5000)
  })
  it('herstelt nieuwe offertes, de 75%-keuze en historische versies uit een versie-2-back-up', async () => {
    const source = new JrsDatabase(crypto.randomUUID()); const target = new JrsDatabase(crypto.randomUUID())
    try {
      const { settings, draft } = fixture(); draft.windowCleaning = 'both'
      await saveSettings(settings, source); const quote = await saveQuote(draft, settings, null, source)
      const backup = await createBackup(source); expect(backup.schemaVersion).toBe(2)
      await restoreBackup(backup, target)
      const restored = (await target.quotes.get(quote.id))!
      expect(restored.draft.windowCleaning).toBe('both'); expect(restored.result.exclusiveCents).toBe(8750)
    } finally { await source.delete(); await target.delete() }
  })
})
