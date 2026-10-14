import { expect, it } from 'vitest'
import { emptyDraft } from './models'
import { assignWindowDifficulty, resizeWindow, windowCounts } from './window-difficulty'

it('verdeelt vijf ramen als drie normaal, één gemiddeld en één moeilijk zonder het totaal te wijzigen', () => {
  let line = resizeWindow(emptyDraft().lines[6], 5)
  line = assignWindowDifficulty(line, 1, 1)
  line = assignWindowDifficulty(line, 2, 1)
  expect(line.quantity).toBe(5); expect(line.difficultyCounts).toEqual([3, 1, 1, 0])
  expect(resizeWindow(line, 7).difficultyCounts).toEqual([5, 1, 1, 0])
  expect(resizeWindow(line, 1).difficultyCounts).toEqual([0, 0, 1, 0])
  expect(resizeWindow(line, 0).difficultyCounts).toEqual([0, 0, 0, 0])
  expect(assignWindowDifficulty(line, 0, 2).quantity).toBe(4)
})
it('kan niet meer moeilijke ramen toewijzen dan er zijn en behoudt oude globale moeilijkheid bij aanpassen', () => {
  const line = { ...emptyDraft().lines[6], quantity: 5 }
  expect(windowCounts(line, 2)).toEqual([0, 0, 5, 0])
  expect(resizeWindow(line, 6, 2).difficultyCounts).toEqual([1, 0, 5, 0])
  expect(assignWindowDifficulty(resizeWindow(line, 5), 2, 10).difficultyCounts).toEqual([0, 0, 5, 0])
})
