import { z } from 'zod'
import { catalog } from './catalog'

// Money is always stored as integer cents; percentages as basis points.
export const centsSchema = z.number().int().min(0).max(100_000_000)
const minutesSchema = z.number().int().min(0).max(100_000)
const percentSchema = z.number().int().min(0).max(10_000)
const text = z.string().max(5000)
export const customerSchema = z.object({
  id: z.string(), name: text, contact: text, street: text, postcode: text, city: text,
  phone: text, email: text, vatNumber: text,
  type: z.enum(['private', 'business']), notes: text,
  separateAddress: z.boolean(), executionAddress: text,
})
export const rateSchema = z.object({ priceCents: centsSchema.nullable(), minutes: minutesSchema.nullable() })
export const settingsSchema = z.object({
  company: z.object({
    name: text, address: text, phone: text, email: z.union([z.literal(''), z.email()]),
    enterpriseNumber: text, vatNumber: text, website: text, logo: z.string().max(3_000_000).refine(s => s === '' || /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s), 'Het logo moet een lokaal PNG- of JPEG-bestand zijn.'),
    quoteText: text, terms: text, payment: text, validityDays: z.number().int().min(1).max(365),
  }),
  rates: z.record(z.string(), rateSchema).refine(r => catalog.every(c => c.id in r), 'De prijslijst is onvolledig.'),
  priceBasis: z.enum(['inclusive', 'exclusive']), vatBps: percentSchema,
  vatRegime: z.enum(['normal', 'exempt']), vatExplanation: text,
  minimumHourlyCents: centsSchema, minimumOrderCents: centsSchema, preparationMinutes: minutesSchema,
  difficultyBps: z.array(percentSchema).length(4), accessBps: z.array(percentSchema).length(4),
  frequencyBps: z.array(percentSchema).length(6),
  travel: z.object({ origin: text, freeRadiusDeciKm: z.number().int().min(0).max(100_000), perKmCents: centsSchema, returnTrip: z.boolean() }),
})
export const lineSchema = z.object({
  id: z.string().refine(id => catalog.some(c => c.id === id), 'Onbekende dienst.'),
  quantity: z.number().int().min(0).max(10_000),
  overridePriceCents: centsSchema.nullable(), overrideMinutes: minutesSchema.nullable(), note: text,
})
export const draftSchema = z.object({
  customer: customerSchema, lines: z.array(lineSchema).length(catalog.length).refine(lines => new Set(lines.map(l => l.id)).size === lines.length, 'Dubbele diensten.'),
  difficulty: z.number().int().min(0).max(3), access: z.number().int().min(0).max(3),
  frequency: z.number().int().min(0).max(5), discountType: z.enum(['percent', 'fixed']), discountValue: centsSchema,
  internalMaterialCents: centsSchema, materialCents: centsSchema,
  distanceDeciKm: z.number().int().min(0).max(100_000), travelOverrideCents: centsSchema.nullable(),
  manualTotalCents: centsSchema.nullable(), manualConfirmed: z.boolean(), overlapConfirmed: z.boolean(),
  vatConfirmed: z.boolean(), notes: text,
}).refine(d => d.discountType !== 'percent' || d.discountValue <= 10_000, 'Een korting kan maximaal 100% bedragen.')
export type Customer = z.infer<typeof customerSchema>
export type Rate = z.infer<typeof rateSchema>
export type Settings = z.infer<typeof settingsSchema>
export type QuoteLine = z.infer<typeof lineSchema>
export type Draft = z.infer<typeof draftSchema>
export const statuses = ['Concept', 'Verzonden', 'Goedgekeurd', 'Afgewezen'] as const
const computedNumber = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
export const calculationSchema = z.object({
  calculationVersion: z.literal(1),
  lines: z.array(lineSchema.extend({ name: text, group: z.enum(['windows-both', 'windows-outside', 'shutters', 'garages', 'conservatories']), unitCents: computedNumber.nullable(), totalCents: computedNumber, minutes: computedNumber })),
  issues: z.array(text), baseCents: computedNumber, totalMinutes: computedNumber, surchargeBps: computedNumber,
  surchargeCents: computedNumber, frequencyDiscountCents: computedNumber, extraDiscountCents: computedNumber,
  discountedLaborCents: computedNumber, minimumLaborCents: computedNumber, hourlyCorrectionCents: computedNumber,
  laborCents: computedNumber, materialCents: computedNumber, paidDeciKm: computedNumber, automaticTravelCents: computedNumber,
  travelCents: computedNumber, minimumCorrectionCents: computedNumber, automaticTotalCents: computedNumber,
  totalCents: computedNumber, exclusiveCents: computedNumber, vatCents: computedNumber, vatBps: percentSchema,
  manualWarnings: z.array(text), quantity: computedNumber,
})
export const quoteVersionSchema = z.object({
  savedAt: z.string().datetime(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  draft: draftSchema, settings: settingsSchema,
  result: calculationSchema,
})
export const quoteSchema = quoteVersionSchema.extend({
  id: z.string(), number: z.string().regex(/^JRS-\d{4}-\d{4,}$/),
  status: z.enum(statuses), revisions: z.array(quoteVersionSchema),
})
export type QuoteVersion = z.infer<typeof quoteVersionSchema>
export type Quote = z.infer<typeof quoteSchema>
export const backupSchema = z.object({
  app: z.literal('JRS Offertecalculator'), schemaVersion: z.literal(1), exportedAt: z.string().datetime(),
  settings: settingsSchema, customers: z.array(customerSchema), quotes: z.array(quoteSchema),
  workspace: z.object({ draft: draftSchema, settings: settingsSchema, editingId: z.string().nullable() }).nullable().optional(),
}).superRefine((data, ctx) => {
  for (const items of [data.customers, data.quotes]) {
    if (new Set(items.map(i => i.id)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Dubbele identificatienummers in de back-up.' })
  }
  if (new Set(data.quotes.map(q => q.number)).size !== data.quotes.length) ctx.addIssue({ code: 'custom', message: 'Dubbele offertenummers in de back-up.' })
})
export type Backup = z.infer<typeof backupSchema>

export function emptyCustomer(): Customer {
  return { id: '', name: '', contact: '', street: '', postcode: '', city: '', phone: '', email: '', vatNumber: '', type: 'private', notes: '', separateAddress: false, executionAddress: '' }
}
export function emptyDraft(): Draft {
  return { customer: emptyCustomer(), lines: catalog.map(c => ({ id: c.id, quantity: 0, overridePriceCents: null, overrideMinutes: null, note: '' })), difficulty: 0, access: 0, frequency: 0, discountType: 'percent', discountValue: 0, internalMaterialCents: 0, materialCents: 0, distanceDeciKm: 0, travelOverrideCents: null, manualTotalCents: null, manualConfirmed: false, overlapConfirmed: false, vatConfirmed: false, notes: '' }
}
export function defaultSettings(): Settings {
  return {
    company: { name: "Jarne's Ramenservice", address: '', phone: '', email: '', enterpriseNumber: '', vatNumber: '', website: '', logo: '', quoteText: '', terms: '', payment: '', validityDays: 30 },
    rates: Object.fromEntries(catalog.map(c => [c.id, { priceCents: null, minutes: null }])),
    priceBasis: 'inclusive', vatBps: 2100, vatRegime: 'normal', vatExplanation: '',
    minimumHourlyCents: 4500, minimumOrderCents: 3500, preparationMinutes: 0,
    difficultyBps: [0, 0, 0, 0], accessBps: [0, 0, 0, 0], frequencyBps: [0, 0, 0, 0, 0, 0],
    travel: { origin: '', freeRadiusDeciKm: 0, perKmCents: 0, returnTrip: true },
  }
}
