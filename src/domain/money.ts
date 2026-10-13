export function roundRatio(value: number, numerator: number, denominator: number): number {
  if (![value, numerator, denominator].every(Number.isSafeInteger) || value < 0 || numerator < 0 || denominator <= 0) throw new Error('Ongeldige rekenwaarde.')
  const product = BigInt(value) * BigInt(numerator)
  const result = (product + BigInt(Math.floor(denominator / 2))) / BigInt(denominator)
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Dit bedrag is te groot.')
  return Number(result)
}
export function parseDecimal(value: string, decimals = 2): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!new RegExp(`^\\d+(?:\\.\\d{0,${decimals}})?$`).test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const result = Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0'))
  return Number.isSafeInteger(result) ? result : null
}
export function decimalInput(value: number, decimals = 2) {
  return `${Math.floor(value / 10 ** decimals)},${String(value % 10 ** decimals).padStart(decimals, '0')}`
}
export const money = (cents: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
export const percent = (bps: number) => new Intl.NumberFormat('nl-BE', { maximumFractionDigits: 2 }).format(bps / 100) + '%'
export function duration(minutes: number) {
  return `${Math.floor(minutes / 60)} u ${minutes % 60} min`
}
