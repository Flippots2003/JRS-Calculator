// Reference: https://www.solvari.be/nl/glazenwasser (checked 14 October 2026).
// The guide publishes €35–€60/hour excluding VAT for detached homes.
// Unit prices and durations below are JRS starting estimates derived from time
// budgets and a €55/hour floor, NOT published individual competitor prices.
export const standardRates: Record<string, { priceCents: number; minutes: number }> = {}
const windows = [[400, 3], [600, 5], [900, 8], [1200, 10], [1200, 10]]
windows.forEach(([priceCents, minutes], i) => {
  standardRates[`windows-outside-${i}`] = { priceCents, minutes }
  // Compatibility values only; new quotes use a single outside count +75%.
  standardRates[`windows-both-${i}`] = { priceCents: priceCents * 175 / 100, minutes: Math.round(minutes * 175 / 100) }
})
for (const [group, values] of Object.entries({
  shutters: [[1200, 10], [2000, 15], [3000, 25]],
  garages: [[2500, 20], [4000, 30], [5500, 45]],
  conservatories: [[8000, 75], [13000, 120], [20000, 180], [6000, 60], [10000, 90], [16000, 150]],
})) values.forEach(([priceCents, minutes], i) => { standardRates[`${group}-${i}`] = { priceCents, minutes } })
