import { calculationSchema, type Draft, type Settings } from './models'
import { calculateLegacy } from './calculate-legacy'
import { calculateExclusive } from './calculate-v2'
import type { z } from 'zod'

export type Calculation = z.infer<typeof calculationSchema>
export function calculate(draft: Draft, settings: Settings): Calculation {
  return settings.pricingVersion === 2 ? calculateExclusive(draft, settings) : calculationSchema.parse(calculateLegacy(draft, settings))
}
export function overlapRisk(draft: Draft) {
  return draft.lines.some(l => l.quantity > 0 && l.id.startsWith('conservatories-'))
    && draft.lines.some(l => l.quantity > 0 && l.id.startsWith('windows-'))
}
export function saveErrors(draft: Draft, settings: Settings) {
  const errors = [...calculate(draft, settings).issues]
  if (settings.vatRegime === 'exempt' && !settings.vatExplanation.trim()) errors.push('Vul de toepasselijke vermelding voor de btw-vrijstelling in bij Instellingen.')
  return errors
}
