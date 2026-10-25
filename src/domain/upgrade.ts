import { previousStandardRates, revisionTwoRates, revisionThreeRates, revisionFourRates, standardRates } from './standard-rates'
import { catalog } from './catalog'
import { defaultSettings, type Settings, type Draft } from './models'
import { roundRatio } from './money'

export function upgradeSettings(old: Settings, applyNewMinimums = true): Settings {
  if (old.pricingVersion === 2) {
    const next = structuredClone({ ...old, priceBasis: 'exclusive' as const })
    if (applyNewMinimums && old.tariffRevision !== 5) {
      for (const item of catalog) {
        const rate = next.rates[item.id], previous = (old.tariffRevision === 1 ? previousStandardRates : old.tariffRevision === 2 ? revisionTwoRates : old.tariffRevision === 3 ? revisionThreeRates : revisionFourRates)[item.id], current = standardRates[item.id]
        // Migrate each untouched default independently; keep custom prices/times.
        if (rate.priceCents === previous.priceCents) rate.priceCents = current.priceCents
        if (rate.minutes === previous.minutes) rate.minutes = current.minutes
      }
      next.tariffRevision = 5
      if (old.tariffRevision < 3 && old.difficultyBps.every(p => p === 0)) next.difficultyBps = [0, 1500, 3000, 5000]
    }
    return next
  }
  const defaults = defaultSettings()
  const vat = old.vatRegime === 'exempt' ? 0 : old.vatBps
  const net = (n: number) => roundRatio(n, 10000, 10000 + vat)
  const inputNet = (n: number) => old.priceBasis === 'inclusive' ? net(n) : n
  return {
    ...structuredClone(old), difficultyBps: applyNewMinimums && old.difficultyBps.every(p => p === 0) ? defaults.difficultyBps : old.difficultyBps, tariffRevision: 5, pricingVersion: 2, priceBasis: 'exclusive',
    rates: Object.fromEntries(catalog.map(item => {
      const rate = old.rates[item.id]
      return [item.id, { priceCents: rate.priceCents === null ? defaults.rates[item.id].priceCents : inputNet(rate.priceCents), minutes: rate.minutes ?? defaults.rates[item.id].minutes }]
    })),
    minimumHourlyCents: applyNewMinimums && old.minimumHourlyCents === 4500 ? defaults.minimumHourlyCents : net(old.minimumHourlyCents),
    minimumOrderCents: applyNewMinimums && old.minimumOrderCents === 3500 ? defaults.minimumOrderCents : net(old.minimumOrderCents),
    preparationMinutes: applyNewMinimums && old.preparationMinutes === 0 ? defaults.preparationMinutes : old.preparationMinutes,
    travel: { ...old.travel, perKmCents: inputNet(old.travel.perKmCents) },
  }
}
export function upgradeDraft(old: Draft, settings: Settings): Draft {
  if (settings.pricingVersion === 2) return structuredClone(old)
  const draft = structuredClone(old)
  const vat = settings.vatRegime === 'exempt' ? 0 : settings.vatBps
  const net = (n: number) => roundRatio(n, 10000, 10000 + vat)
  const inputNet = (n: number | null) => n === null ? null : settings.priceBasis === 'inclusive' ? net(n) : n
  draft.lines.forEach(l => { l.overridePriceCents = inputNet(l.overridePriceCents) })
  draft.materialCents = inputNet(draft.materialCents)!
  draft.internalMaterialCents = inputNet(draft.internalMaterialCents)!
  draft.travelOverrideCents = inputNet(draft.travelOverrideCents)
  draft.manualTotalCents = draft.manualTotalCents === null ? null : net(draft.manualTotalCents)
  if (draft.discountType === 'fixed') draft.discountValue = inputNet(draft.discountValue)!
  draft.windowCleaning = draft.lines.some(l => l.id.startsWith('windows-both-') && l.quantity > 0) ? 'both' : 'outside'
  for (let i = 0; i < 5; i++) {
    const both = draft.lines.find(l => l.id === `windows-both-${i}`)!
    const outside = draft.lines.find(l => l.id === `windows-outside-${i}`)!
    if (both.quantity > 0) {
      if (outside.quantity === 0) {
        outside.overridePriceCents = both.overridePriceCents === null ? null : roundRatio(both.overridePriceCents, 100, 175)
        outside.overrideMinutes = both.overrideMinutes === null ? null : roundRatio(both.overrideMinutes, 100, 175)
      } else outside.note = [outside.note, 'Oude afzonderlijke raamtellingen samengevoegd: controleer deze regel.'].filter(Boolean).join(' ').slice(0, 5000)
      outside.quantity += both.quantity
      outside.note = [outside.note, both.note].filter(Boolean).join(' ').slice(0, 5000)
    }
    both.quantity = 0
  }
  draft.manualConfirmed = false
  return draft
}
