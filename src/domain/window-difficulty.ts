import type { QuoteLine } from './models'

export type DifficultyCounts = [number, number, number, number]
export function windowCounts(line: QuoteLine, fallbackDifficulty = 0): DifficultyCounts {
  if (line.difficultyCounts) return [...line.difficultyCounts]
  const counts: DifficultyCounts = [0, 0, 0, 0]
  counts[fallbackDifficulty] = line.quantity
  return counts
}
export function resizeWindow(line: QuoteLine, quantity: number, fallbackDifficulty = 0): QuoteLine {
  const counts = windowCounts(line, fallbackDifficulty)
  let difference = quantity - line.quantity
  if (difference >= 0) counts[0] += difference
  else {
    // Remove normal windows first, preserving assigned harder windows where possible.
    for (let i = 0; i < counts.length && difference < 0; i++) {
      const removed = Math.min(counts[i], -difference)
      counts[i] -= removed; difference += removed
    }
  }
  return { ...line, quantity, difficultyCounts: counts }
}
export function assignWindowDifficulty(line: QuoteLine, index: number, count: number, fallbackDifficulty = 0): QuoteLine {
  const counts = windowCounts(line, fallbackDifficulty)
  if (index === 0) {
    counts[0] = count
    return { ...line, quantity: counts.reduce((sum, n) => sum + n, 0), difficultyCounts: counts }
  }
  const available = counts[0] + counts[index]
  const assigned = Math.min(count, available)
  counts[0] = available - assigned
  counts[index] = assigned
  return { ...line, difficultyCounts: counts }
}
