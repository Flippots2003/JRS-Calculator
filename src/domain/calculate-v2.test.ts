import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { previousStandardRates, revisionTwoRates, revisionThreeRates } from './standard-rates'
import { calculate } from './calculate'
import { defaultSettings, legacyDefaultSettings, emptyDraft } from './models'
import { upgradeDraft, upgradeSettings } from './upgrade'
import { calculationSchema, draftSchema } from './models'
import { createBackup, restoreBackup } from '../storage/backup'
import { JrsDatabase, saveQuote, saveSettings, loadSettings, loadWorkspace, saveWorkspace } from '../storage/database'

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
  it('verlaagt alle standaardprijzen en tijden, met drie minuten voor een groot raam', () => {
    const settings = defaultSettings()
    for (const [id, old] of Object.entries(previousStandardRates)) {
      expect(settings.rates[id].priceCents).toBeLessThan(old.priceCents)
      expect(settings.rates[id].minutes).toBeLessThan(old.minutes)
    }
    expect(settings.rates['windows-outside-0']).toEqual({ priceCents: 350, minutes: 1 })
    expect(settings.rates['windows-outside-1']).toEqual({ priceCents: 550, minutes: 2 })
    expect(settings.rates['windows-outside-2']).toEqual({ priceCents: 750, minutes: 3 })
    const draft = emptyDraft(); draft.lines.find(l => l.id === 'windows-outside-2')!.quantity = 10
    expect(calculate(draft, settings).totalMinutes).toBe(40)
  })
  it('werkt bestaande standaardtarieven bij maar bewaart eigen afwijkingen en historische concepten', async () => {
    const database = new JrsDatabase(crypto.randomUUID())
    try {
      const old = defaultSettings(); old.tariffRevision = 1; old.rates = structuredClone(previousStandardRates)
      old.rates['windows-outside-1'].priceCents = 777
      old.rates['garages-0'].minutes = 13
      await saveSettings(old, database)
      const draft = emptyDraft(); draft.lines[6].quantity = 10
      const quote = await saveQuote(draft, old, null, database)
      const updated = await loadSettings(database)
      expect(updated.rates['windows-outside-2']).toEqual({ priceCents: 750, minutes: 3 })
      expect(updated.rates['windows-outside-1']).toEqual({ priceCents: 777, minutes: 2 })
      expect(updated.rates['garages-0']).toEqual({ priceCents: 2200, minutes: 13 })
      expect((await database.quotes.get(quote.id))!.settings.rates['windows-outside-2'].minutes).toBe(8)
      expect((await loadWorkspace(database))!.settings.rates['windows-outside-2'].minutes).toBe(8)
      await saveWorkspace({ draft: emptyDraft(), settings: old, editingId: null }, database)
      expect((await loadWorkspace(database))!.settings.rates['windows-outside-2'].minutes).toBe(3)
      expect(await loadSettings(database)).toEqual(updated)
    } finally { await database.delete() }
  })

  it('rekent moeilijkheid alleen voor de toegewezen ramen en combineert die met binnen/buiten', () => {
    const { settings, draft } = fixture(); settings.rates['windows-outside-1'] = { priceCents: 550, minutes: 3 }
    draft.lines[6].quantity = 5; draft.lines[6].difficultyCounts = [3, 1, 1, 0]
    draft.difficulty = 3 // Must not add the global 50% to distributed windows.
    let result = calculate(draft, settings)
    expect(result.baseCents).toBe(2750); expect(result.windowDifficultyCents).toBe(248)
    expect(result.surchargeCents).toBe(248); expect(result.totalMinutes).toBe(16)
    expect(result.exclusiveCents).toBe(2998)
    draft.windowCleaning = 'both'; result = calculate(draft, settings)
    expect(result.windowSupplementCents).toBe(2063); expect(result.windowDifficultyCents).toBe(433)
    expect(result.totalMinutes).toBe(29); expect(result.exclusiveCents).toBe(5246)
  })
  it('houdt globale moeilijkheid voor overige diensten en bereikbaarheid voor de gehele opdracht', () => {
    const { settings, draft } = fixture()
    draft.lines[6].quantity = 5; draft.lines[6].difficultyCounts = [3, 1, 1, 0]
    draft.difficulty = 2; draft.access = 1; settings.accessBps[1] = 1000
    const shutter = draft.lines.find(l => l.id === 'shutters-0')!; shutter.quantity = 1
    const result = calculate(draft, settings)
    expect(result.windowDifficultyCents).toBe(225)
    expect(result.surchargeCents).toBe(225 + 315 + 355)
  })
  it('weigert onjuiste verdelingen en verdelingen bij andere diensten', () => {
    const { draft } = fixture(); draft.lines[6].difficultyCounts = [3, 1, 1, 0]
    expect(draftSchema.safeParse(draft).success).toBe(false)
    draft.lines[6].difficultyCounts = [10, 0, 0, 0]
    expect(draftSchema.safeParse(draft).success).toBe(true)
    draft.lines.find(l => l.id === 'shutters-0')!.difficultyCounts = [0, 0, 0, 0]
    expect(draftSchema.safeParse(draft).success).toBe(false)
  })
  it('migreert versie-2 standaardprijzen zonder eigen prijzen of historische snapshots aan te passen', () => {
    const old = defaultSettings(); old.tariffRevision = 2; old.rates = structuredClone(revisionTwoRates); old.difficultyBps = [0, 0, 0, 0]
    old.rates['windows-outside-3'].priceCents = 999
    const next = upgradeSettings(old)
    expect(next.rates['windows-outside-2'].priceCents).toBe(750)
    expect(next.rates['windows-outside-3'].priceCents).toBe(999)
    expect(next.difficultyBps).toEqual([0, 1500, 3000, 5000])
    expect(upgradeSettings(old, false)).toEqual(old)
    old.difficultyBps = [0, 1000, 2500, 4000]
    expect(upgradeSettings(old).difficultyBps).toEqual(old.difficultyBps)
  })
  it('bewaart raamverdelingen en oorspronkelijke versie-2 offertes in dezelfde back-up', async () => {
    const source = new JrsDatabase(crypto.randomUUID()); const target = new JrsDatabase(crypto.randomUUID())
    try {
      const { settings, draft } = fixture(); await saveSettings(settings, source)
      const historical = await saveQuote(draft, settings, null, source)
      draft.lines[6].difficultyCounts = [6, 2, 1, 1]
      const quote = await saveQuote(draft, settings, null, source)
      const backup = await createBackup(source)
      const raw = JSON.parse(JSON.stringify(backup))
      delete raw.quotes.find((q: { id: string }) => q.id === historical.id).result.windowDifficultyCents
      await restoreBackup(raw, target)
      expect((await target.quotes.get(quote.id))!.draft.lines[6].difficultyCounts).toEqual([6, 2, 1, 1])
      expect((await target.quotes.get(historical.id))!.result.exclusiveCents).toBe(5000)
    } finally { await source.delete(); await target.delete() }
  })

  it('rekent ook geldige grote invoer exact zonder onveilige tussenproducten', () => {
    const { settings, draft } = fixture()
    settings.rates['windows-outside-1'].priceCents = 100_000_000
    settings.difficultyBps[3] = 10000
    draft.lines[6].quantity = 20000; draft.lines[6].difficultyCounts = [0, 0, 0, 20000]
    draft.windowCleaning = 'both'
    const result = calculate(draft, settings)
    expect(result.windowDifficultyCents).toBe(3_500_000_000_000)
    expect(result.exclusiveCents).toBe(7_000_000_000_000)
  })

  it('verkort standaardraamtijden zonder prijzen, eigen tijden of historische offertes te wijzigen', async () => {
    const database = new JrsDatabase(crypto.randomUUID())
    try {
      const old = defaultSettings(); old.tariffRevision = 3; old.rates = structuredClone(revisionThreeRates)
      old.rates['windows-outside-1'].minutes = 7
      old.difficultyBps = [0, 0, 0, 0]
      const draft = emptyDraft(); draft.lines[7].quantity = 10
      await saveSettings(old, database)
      const quote = await saveQuote(draft, old, null, database)
      const next = await loadSettings(database)
      expect(next.rates['windows-outside-0'].minutes).toBe(1)
      expect(next.rates['windows-outside-1'].minutes).toBe(7)
      expect(next.rates['windows-outside-2'].minutes).toBe(3)
      expect(Object.values(next.rates).map(r => r.priceCents)).toEqual(Object.values(old.rates).map(r => r.priceCents))
      expect(next.difficultyBps).toEqual([0, 0, 0, 0])
      expect((await database.quotes.get(quote.id))!.result.totalMinutes).toBe(50)
      expect(calculate(draft, next).totalMinutes).toBe(40)
    } finally { await database.delete() }
  })

})
