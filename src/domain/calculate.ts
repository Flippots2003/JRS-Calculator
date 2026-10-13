import { catalog } from './catalog'
import { draftSchema, settingsSchema, type Draft, type Settings } from './models'
import { roundRatio } from './money'
import { z } from 'zod'

export function overlapRisk(draft: Draft) {
  const active = draft.lines.filter(l => l.quantity > 0).map(l => l.id)
  return active.some(id => id.startsWith('windows-both-') && active.includes(id.replace('windows-both-', 'windows-outside-')))
    || (active.some(id => id.startsWith('conservatories-')) && active.some(id => id.startsWith('windows-')))
}
export function calculate(input: Draft, configuration: Settings) {
  const draft = draftSchema.parse(input)
  const settings = settingsSchema.parse(configuration)
  const vatBps = settings.vatRegime === 'exempt' ? 0 : settings.vatBps
  const gross = (amount: number) => settings.priceBasis === 'exclusive' ? roundRatio(amount, 10_000 + vatBps, 10_000) : amount
  const issues: string[] = []
  const lines = draft.lines.filter(l => l.quantity > 0).map(line => {
    const item = catalog.find(c => c.id === line.id)!
    const rate = settings.rates[line.id]
    const price = line.overridePriceCents ?? rate.priceCents
    const minutes = line.overrideMinutes ?? rate.minutes
    if (price === null) issues.push(`Stel een prijs in voor ${item.name.toLowerCase()} (${item.group === 'windows-both' ? 'binnen & buiten' : item.group === 'windows-outside' ? 'buiten' : 'dienst'}).`)
    if (minutes === null) issues.push(`Stel de werktijd in voor ${item.name.toLowerCase()}.`)
    return { ...line, name: item.name, group: item.group, unitCents: price === null ? null : gross(price), totalCents: price === null ? 0 : gross(line.quantity * price), minutes: minutes === null ? 0 : line.quantity * minutes }
  })
  if (!lines.length) issues.push('Voeg minstens één onderdeel toe.')
  if (overlapRisk(draft) && !draft.overlapConfirmed) issues.push('Bevestig dat de geselecteerde diensten geen onderdelen dubbel aanrekenen.')
  if ((vatBps !== 2100 || settings.vatRegime === 'exempt') && !draft.vatConfirmed) issues.push('Bevestig de toepasselijkheid van het afwijkende btw-regime.')
  const baseCents = lines.reduce((sum, line) => sum + line.totalCents, 0)
  const totalMinutes = lines.reduce((sum, line) => sum + line.minutes, 0) + (lines.length ? settings.preparationMinutes : 0)
  const surchargeBps = settings.difficultyBps[draft.difficulty] + settings.accessBps[draft.access]
  const surchargeCents = roundRatio(baseCents, surchargeBps, 10_000)
  const adjustedCents = baseCents + surchargeCents
  const frequencyDiscountCents = roundRatio(adjustedCents, settings.frequencyBps[draft.frequency], 10_000)
  const afterFrequencyCents = adjustedCents - frequencyDiscountCents
  const requestedDiscount = draft.discountType === 'percent' ? roundRatio(afterFrequencyCents, draft.discountValue, 10_000) : gross(draft.discountValue)
  const extraDiscountCents = Math.min(afterFrequencyCents, requestedDiscount)
  const discountedLaborCents = afterFrequencyCents - extraDiscountCents
  const minimumLaborCents = roundRatio(settings.minimumHourlyCents, totalMinutes, 60)
  const hourlyCorrectionCents = Math.max(0, minimumLaborCents - discountedLaborCents)
  const laborCents = discountedLaborCents + hourlyCorrectionCents
  const materialCents = gross(draft.materialCents)
  const paidDeciKm = Math.max(0, draft.distanceDeciKm - settings.travel.freeRadiusDeciKm) * (settings.travel.returnTrip ? 2 : 1)
  const automaticTravelCents = gross(roundRatio(settings.travel.perKmCents, paidDeciKm, 10))
  const travelCents = draft.travelOverrideCents === null ? automaticTravelCents : gross(draft.travelOverrideCents)
  const subtotalCents = laborCents + materialCents + travelCents
  const minimumCorrectionCents = lines.length ? Math.max(0, settings.minimumOrderCents - subtotalCents) : 0
  const automaticTotalCents = subtotalCents + minimumCorrectionCents
  const totalCents = draft.manualTotalCents ?? automaticTotalCents
  const manualWarnings: string[] = []
  if (draft.manualTotalCents !== null) {
    if (totalCents < settings.minimumOrderCents) manualWarnings.push('De eindprijs ligt onder de minimale opdrachtprijs.')
    if (totalCents - materialCents - travelCents < minimumLaborCents) manualWarnings.push('De arbeidsvergoeding ligt onder het gewenste minimumuurtarief.')
    if (totalCents < materialCents + travelCents) manualWarnings.push('De eindprijs dekt zelfs de doorgerekende kosten niet.')
    if (manualWarnings.length && !draft.manualConfirmed) issues.push('Bevestig bewust de handmatige prijs onder de ingestelde minimumgrenzen.')
  }
  const exclusiveCents = roundRatio(totalCents, 10_000, 10_000 + vatBps)
  return { calculationVersion: 1 as const, lines, issues, baseCents, totalMinutes, surchargeBps, surchargeCents, frequencyDiscountCents, extraDiscountCents, discountedLaborCents, minimumLaborCents, hourlyCorrectionCents, laborCents, materialCents, paidDeciKm, automaticTravelCents, travelCents, minimumCorrectionCents, automaticTotalCents, totalCents, exclusiveCents, vatCents: totalCents - exclusiveCents, vatBps, manualWarnings, quantity: lines.reduce((s, l) => s + l.quantity, 0) }
}
export type Calculation = ReturnType<typeof calculate>

export function saveErrors(draft: Draft, settings: Settings) {
  const errors = [...calculate(draft, settings).issues]
  if (!draft.customer.name.trim()) errors.push('Vul de klantnaam in.')
  if (settings.vatRegime === 'exempt' && !settings.vatExplanation.trim()) errors.push('Vul de toepasselijke vermelding voor de btw-vrijstelling in bij Instellingen.')
  if (draft.customer.email && !z.email().safeParse(draft.customer.email).success) errors.push('Vul een geldig e-mailadres in.')
  if (!draft.customer.street.trim() || !draft.customer.postcode.trim() || !draft.customer.city.trim()) errors.push('Vul het volledige klantadres in.')
  if (draft.customer.separateAddress && !draft.customer.executionAddress.trim()) errors.push('Vul het uitvoeringsadres in.')
  return errors
}
