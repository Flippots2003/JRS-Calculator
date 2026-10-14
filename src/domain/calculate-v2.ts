import { catalog } from './catalog'
import { draftSchema, settingsSchema, type Draft, type Settings } from './models'
import { roundRatio } from './money'
import type { Calculation } from './calculate'

export function calculateExclusive(input: Draft, configuration: Settings): Calculation {
  const d = draftSchema.parse(input); const s = settingsSchema.parse(configuration)
  const vatBps = s.vatRegime === 'exempt' ? 0 : s.vatBps
  const issues: string[] = []
  const lines = d.lines.filter(l => l.quantity > 0).map(l => {
    const item = catalog.find(c => c.id === l.id)!
    const rate = s.rates[l.id]
    const price = l.overridePriceCents ?? rate.priceCents
    const minutes = l.overrideMinutes ?? rate.minutes
    if (l.id.startsWith('windows-both-')) issues.push('Gebruik de enkele raamtelling en kies de reiniging bij de totalen.')
    if (price === null) issues.push(`Stel een prijs in voor ${item.name.toLowerCase()}.`)
    if (minutes === null) issues.push(`Stel de werktijd in voor ${item.name.toLowerCase()}.`)
    const counts = l.id.startsWith('windows-outside-') ? l.difficultyCounts : null
    const weightedBps = counts ? counts.reduce((sum, n, i) => sum + n * s.difficultyBps[i], 0) : 0
    const isBoth = l.id.startsWith('windows-outside-') && d.windowCleaning === 'both'
    return { ...l, name: item.name, group: item.group, unitCents: price,
      totalCents: price === null ? 0 : price * l.quantity,
      minutes: minutes === null ? 0 : roundRatio(minutes * (l.quantity * 10000 + weightedBps), isBoth ? 175 : 100, 1000000),
    }
  })
  if (!lines.length) issues.push('Voeg minstens één onderdeel toe.')
  if (lines.some(l => l.group === 'conservatories') && lines.some(l => l.group.startsWith('windows-')) && !d.overlapConfirmed) issues.push('Bevestig dat glas van de veranda of het tuinhuis niet opnieuw als raam aangerekend wordt.')
  if ((vatBps !== 2100 || s.vatRegime === 'exempt') && !d.vatConfirmed) issues.push('Bevestig de toepasselijkheid van het afwijkende btw-regime.')
  const baseCents = lines.reduce((sum, l) => sum + l.totalCents, 0)
  const windowBase = lines.filter(l => l.group === 'windows-outside').reduce((sum, l) => sum + l.totalCents, 0)
  const windowSupplementCents = d.windowCleaning === 'both' ? roundRatio(windowBase, 75, 100) : 0
  const totalMinutes = lines.reduce((sum, l) => sum + l.minutes, 0) + (lines.length ? s.preparationMinutes : 0)
  const surchargeBps = s.difficultyBps[d.difficulty] + s.accessBps[d.access]
  const windowDifficultyCents = lines.filter(l => l.group === 'windows-outside' && l.difficultyCounts).reduce((sum, l) => {
    const weighted = l.difficultyCounts!.reduce((n, count, i) => n + count * s.difficultyBps[i], 0)
    return sum + roundRatio(l.unitCents ?? 0, weighted * (d.windowCleaning === 'both' ? 175 : 100), 1000000)
  }, 0)
  // Explicit window distributions replace the global difficulty, never add it twice.
  const globalDifficultyBase = lines.filter(l => !l.difficultyCounts).reduce((sum, l) => sum + l.totalCents, 0)
  const globalWindowBase = lines.filter(l => l.group === 'windows-outside' && !l.difficultyCounts).reduce((sum, l) => sum + l.totalCents, 0)
  const globalBase = globalDifficultyBase + (d.windowCleaning === 'both' ? roundRatio(globalWindowBase, 75, 100) : 0)
  // Preserve the original rounding for historical quotes without distributions.
  const surchargeCents = lines.some(l => l.difficultyCounts)
    ? windowDifficultyCents + roundRatio(globalBase, s.difficultyBps[d.difficulty], 10000) + roundRatio(baseCents + windowSupplementCents, s.accessBps[d.access], 10000)
    : roundRatio(baseCents + windowSupplementCents, surchargeBps, 10000)
  const adjusted = baseCents + windowSupplementCents + surchargeCents
  const frequencyDiscountCents = roundRatio(adjusted, s.frequencyBps[d.frequency], 10000)
  const afterFrequency = adjusted - frequencyDiscountCents
  const extraDiscountCents = Math.min(afterFrequency, d.discountType === 'percent' ? roundRatio(afterFrequency, d.discountValue, 10000) : d.discountValue)
  const discountedLaborCents = afterFrequency - extraDiscountCents
  const minimumLaborCents = roundRatio(s.minimumHourlyCents, totalMinutes, 60)
  const hourlyCorrectionCents = Math.max(0, minimumLaborCents - discountedLaborCents)
  const laborCents = discountedLaborCents + hourlyCorrectionCents
  const materialCents = d.materialCents
  const paidDeciKm = Math.max(0, d.distanceDeciKm - s.travel.freeRadiusDeciKm) * (s.travel.returnTrip ? 2 : 1)
  const automaticTravelCents = roundRatio(s.travel.perKmCents, paidDeciKm, 10)
  const travelCents = d.travelOverrideCents ?? automaticTravelCents
  const subtotal = laborCents + materialCents + travelCents
  const minimumCorrectionCents = lines.length ? Math.max(0, s.minimumOrderCents - subtotal) : 0
  const automaticTotalCents = subtotal + minimumCorrectionCents // Net, as are all v2 inputs.
  const exclusiveCents = d.manualTotalCents ?? automaticTotalCents
  const manualWarnings: string[] = []
  if (d.manualTotalCents !== null) {
    if (exclusiveCents < s.minimumOrderCents) manualWarnings.push('De eindprijs ligt onder de minimale opdrachtprijs.')
    if (exclusiveCents - materialCents - travelCents < minimumLaborCents) manualWarnings.push('De arbeidsvergoeding ligt onder het gewenste minimumuurtarief.')
    if (exclusiveCents < materialCents + travelCents) manualWarnings.push('De eindprijs dekt zelfs de doorgerekende kosten niet.')
    if (manualWarnings.length && !d.manualConfirmed) issues.push('Bevestig bewust de handmatige prijs onder de ingestelde minimumgrenzen.')
  }
  const vatCents = roundRatio(exclusiveCents, vatBps, 10000)
  return { calculationVersion: 2, windowSupplementCents, windowDifficultyCents, lines, issues, baseCents, totalMinutes, surchargeBps, surchargeCents,
    frequencyDiscountCents, extraDiscountCents, discountedLaborCents, minimumLaborCents, hourlyCorrectionCents, laborCents,
    materialCents, paidDeciKm, automaticTravelCents, travelCents, minimumCorrectionCents, automaticTotalCents,
    exclusiveCents, vatCents, totalCents: exclusiveCents + vatCents, vatBps, manualWarnings,
    quantity: lines.reduce((sum, l) => sum + l.quantity, 0),
  }
}
