// Reference: https://www.solvari.be/nl/glazenwasser (checked 14 October 2026).
// The guide publishes €35–€60/hour excluding VAT for detached homes.
// Unit prices and durations below are JRS starting estimates derived from time
// budgets and a €55/hour floor, NOT published individual competitor prices.
export const previousStandardRates: Record<string, { priceCents: number; minutes: number }> = {}
const windows = [[400, 3], [600, 5], [900, 8], [1200, 10], [1200, 10]]
windows.forEach(([priceCents, minutes], i) => {
  previousStandardRates[`windows-outside-${i}`] = { priceCents, minutes }
  // Compatibility values only; new quotes use a single outside count +75%.
  previousStandardRates[`windows-both-${i}`] = { priceCents: priceCents * 175 / 100, minutes: Math.round(minutes * 175 / 100) }
})
for (const [group, values] of Object.entries({
  shutters: [[1200, 10], [2000, 15], [3000, 25]],
  garages: [[2500, 20], [4000, 30], [5500, 45]],
  conservatories: [[8000, 75], [13000, 120], [20000, 180], [6000, 60], [10000, 90], [16000, 150]],
})) values.forEach(([priceCents, minutes], i) => { previousStandardRates[`${group}-${i}`] = { priceCents, minutes } })

// Revision 2: faster JRS working times and modestly lower unit prices.
export const standardRates: Record<string, { priceCents: number; minutes: number }> = {}
const revised = {
  'windows-outside': [[350, 2], [550, 3], [800, 4], [1050, 6], [1050, 6]],
  shutters: [[1050, 7], [1750, 11], [2650, 18]],
  garages: [[2200, 15], [3500, 22], [4800, 32]],
  conservatories: [[7000, 55], [11500, 90], [17500, 135], [5250, 45], [8750, 65], [14000, 110]],
}
for (const [group, values] of Object.entries(revised)) values.forEach(([priceCents, minutes], i) => {
  standardRates[`${group}-${i}`] = { priceCents, minutes }
  if (group === 'windows-outside') standardRates[`windows-both-${i}`] = {
    priceCents: Math.round(priceCents * 175 / 100), minutes: Math.round(minutes * 175 / 100),
  }
})

export const revisionTwoRates = structuredClone(standardRates)
// Revision 3: slightly lower large-window and sliding-window prices.
for (const [i, priceCents] of [[2, 750], [3, 950]]) {
  standardRates[`windows-outside-${i}`].priceCents = priceCents
  standardRates[`windows-both-${i}`].priceCents = Math.round(priceCents * 175 / 100)
}

export const revisionThreeRates = structuredClone(standardRates)
// Revision 4: JRS measured speed for ordinary windows, outside only.
for (const [i, minutes] of [[0, 1], [1, 2], [2, 3]]) {
  standardRates[`windows-outside-${i}`].minutes = minutes
  standardRates[`windows-both-${i}`].minutes = Math.round(minutes * 175 / 100)
}
