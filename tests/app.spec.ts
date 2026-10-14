import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { legacyDefaultSettings, emptyDraft } from '../src/domain/models'
import { calculate } from '../src/domain/calculate'

async function navigate(page: Page, name: string) { await page.getByRole('navigation').getByRole('button', { name, exact: true }).click() }
async function setRate(page: Page, price: string, minutes = '1') {
  await navigate(page, 'Instellingen')
  await page.getByLabel('Prijs Normaal raam Ramen', { exact: true }).fill(price)
  await page.getByLabel('Werktijd Normaal raam Ramen', { exact: true }).fill(minutes)
  await page.getByRole('button', { name: 'Instellingen opslaan', exact: true }).click()
  await expect(page.getByText('Alles is opgeslagen', { exact: true })).toBeVisible()
  await navigate(page, 'Calculator')
}
async function fillQuote(page: Page, quantity = '10') {
  await page.getByLabel('Naam', { exact: true }).fill('José Vermeulen')
  await page.getByLabel('Adres', { exact: true }).fill('Teststraat 12\n9000 Gent')
  await page.getByLabel('Aantal Normaal raam Ramen', { exact: true }).fill(quantity)
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Offerte opslaan', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(/Offerte JRS-\d{4}-\d{4} opgeslagen/)
}
test('vier optionele klantvelden; offerte en PDF werken zonder klantgegevens', async ({ page }) => {
  await expect(page.getByLabel('Naam', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Adres', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Telefoonnummer', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Btw-nummer (indien nodig)', { exact: true })).toBeVisible()
  await expect(page.getByLabel('E-mailadres', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Type klant', { exact: true })).toHaveCount(0)
  await expect(page.locator('input[required], textarea[required]')).toHaveCount(0)
  await setRate(page, '5')
  await page.getByLabel('Aantal Normaal raam Ramen', { exact: true }).fill('10')
  await save(page)
  await navigate(page, 'Offertes')
  await expect(page.getByRole('heading', { name: 'Zonder klantgegevens' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /PDF JRS-.* downloaden/ }).click()
  const download = await downloadPromise
  const pdfText = execFileSync('pdftotext', [(await download.path())!, '-'], { encoding: 'utf8' })
  expect(pdfText).toContain('€ 50,00')
  await navigate(page, 'Calculator')
  await expect(page.getByLabel('Bestaande klant selecteren')).toHaveCount(0)
})
test.beforeEach(async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Nieuwe offerte', exact: true })).toBeVisible()
})
test('één raamtelling met 75% bij de totalen en exclusieve PDF-prijzen', async ({ page }) => {
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Binnen & buiten', exact: true })).toHaveCount(0)
  await page.getByLabel('Aantal Normaal raam Ramen', { exact: true }).fill('10')
  await expect(page.locator('.price-bar strong')).toHaveText(/60,00/)
  await page.getByLabel('Reiniging van de ramen', { exact: true }).selectOption('both')
  await expect(page.locator('.price-bar strong')).toHaveText(/105,00/)
  await expect(page.getByLabel('Aantal Normaal raam Ramen', { exact: true })).toHaveValue('10')
  await expect(page.locator('.price-bar small')).toHaveText('Totaal exclusief btw')
  await page.getByRole('button', { name: 'Rolluiken', exact: true }).click()
  await page.getByLabel('Aantal Standaard rolluik Rolluiken', { exact: true }).fill('1')
  await expect(page.locator('.price-bar strong')).toHaveText(/125,00/)
  await save(page)
  await page.reload()
  await expect(page.getByLabel('Reiniging van de ramen')).toHaveValue('both')
  await navigate(page, 'Offertes')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /PDF JRS-.* downloaden/ }).click()
  const download = await downloadPromise
  const pdfText = execFileSync('pdftotext', [(await download.path())!, '-'], { encoding: 'utf8' })
  expect(pdfText).toContain('excl. btw'); expect(pdfText).toContain('€ 125,00')
  expect(pdfText).toContain('€ 151,25'); expect(pdfText).toContain('75%')
})
test('oude inclusieve offerte blijft bewaard; nieuwe regels worden alleen na bevestiging opgeslagen', async ({ page }) => {
  const settings = legacyDefaultSettings(); const draft = emptyDraft()
  settings.rates['windows-both-1'] = { priceCents: 500, minutes: 1 }; draft.lines[1].quantity = 10
  const quote = { id: 'historical', number: 'JRS-2026-0001', status: 'Concept', date: '2026-10-01', validUntil: '2026-10-31', savedAt: '2026-10-01T12:00:00.000Z', draft, settings, result: calculate(draft, settings), revisions: [] }
  // Original exports did not have these new version/choice fields.
  const backup = JSON.parse(JSON.stringify({ app: 'JRS Offertecalculator', schemaVersion: 1, exportedAt: '2026-10-01T12:00:00.000Z', settings, customers: [], quotes: [quote] }))
  delete backup.settings.pricingVersion; delete backup.quotes[0].settings.pricingVersion
  delete backup.quotes[0].draft.windowCleaning; delete backup.quotes[0].result.windowSupplementCents
  await navigate(page, 'Instellingen'); await page.getByRole('tab', { name: 'Back-up & app' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'historisch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByRole('status')).toContainText('Back-up volledig hersteld.')
  await navigate(page, 'Offertes'); await expect(page.locator('.quote-amount')).toContainText('41,32')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /PDF JRS-.* downloaden/ }).click()
  const download = await downloadPromise
  const text = execFileSync('pdftotext', [(await download.path())!, '-'], { encoding: 'utf8' })
  expect(text).toContain('€ 41,32'); expect(text).toContain('€ 50,00')
  await page.getByRole('button', { name: 'JRS-2026-0001 bewerken', exact: true }).click()
  await expect(page.getByLabel('Aantal Normaal raam Ramen')).toHaveValue('10')
  await expect(page.getByLabel('Reiniging van de ramen')).toHaveValue('both')
  await expect(page.locator('.price-bar strong')).toHaveText(/105,00/)
  await save(page); await navigate(page, 'Offertes')
  await expect(page.getByText('1 eerdere versie bewaard')).toBeVisible()
})
test('prijslijst is ingevuld; offertes zonder diensten worden geblokkeerd', async ({ page }) => {
  await expect(page.getByText('Ingevulde richtprijzen, excl. btw', { exact: true })).toBeVisible()
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Klanten', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Offerte opslaan' }).click()
  await expect(page.getByText('Deze offerte kan nog niet opgeslagen worden')).toBeVisible()
  await navigate(page, 'Offertes')
  await expect(page.getByRole('heading', { name: 'Klaar voor je eerste offerte' })).toBeVisible()
})
test('live bedragen, concept na herstart, historische tarieven en leesbare PDF', async ({ page }) => {
  await setRate(page, '5')
  await fillQuote(page)
  await expect(page.locator('.price-bar strong')).toHaveText(/50,00/)
  await expect(page.getByText('Concept bewaard', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Aantal Normaal raam Ramen', { exact: true })).toHaveValue('10')
  await save(page)
  await setRate(page, '8')
  await navigate(page, 'Offertes')
  await expect(page.locator('.quote-amount')).toHaveText(/50,00/)
  await page.getByRole('button', { name: /JRS-.* bewerken/ }).click()
  await expect(page.locator('.price-bar strong')).toHaveText(/50,00/)
  await navigate(page, 'Offertes')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /PDF JRS-.* downloaden/ }).click()
  const download = await downloadPromise; const path = await download.path()
  expect(download.suggestedFilename()).toMatch(/^JRS-Offerte-\d{4}-\d{4}\.pdf$/)
  const bytes = await readFile(path!); expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
  const pdfText = execFileSync('pdftotext', [path!, '-'], { encoding: 'utf8' })
  expect(pdfText).toContain('José Vermeulen'); expect(pdfText).toContain('€ 50,00'); expect(pdfText).toContain('Ramen')
})
test('uurnorm, materiaalkosten en bewuste handmatige afwijking', async ({ page }) => {
  await setRate(page, '5', '12'); await fillQuote(page)
  await expect(page.locator('.price-bar strong')).toHaveText(/119,17/)
  await page.getByLabel('Interne materiaalkost', { exact: true }).fill('100')
  await expect(page.locator('.price-bar strong')).toHaveText(/119,17/)
  await page.getByLabel('Materiaal voor klant', { exact: true }).fill('20')
  await expect(page.locator('.price-bar strong')).toHaveText(/139,17/)
  await page.getByText('Eindprijs handmatig aanpassen', { exact: false }).click()
  await page.getByLabel('Handmatige eindprijs exclusief btw').fill('30')
  await expect(page.getByText('De eindprijs ligt onder de minimale opdrachtprijs.')).toBeVisible()
  await page.getByRole('button', { name: 'Offerte opslaan' }).click()
  await expect(page.getByText('Deze offerte kan nog niet opgeslagen worden')).toBeVisible()
  await page.getByLabel('Ik aanvaard deze afwijking bewust.').check()
  await save(page)
  await page.getByLabel('Aantal Normaal raam Ramen', { exact: true }).fill('20')
  await expect(page.locator('.price-bar strong')).toHaveText(/30,00/)
  await expect(page.getByLabel('Ik aanvaard deze afwijking bewust.')).not.toBeChecked()
})
test('PWA start offline; klanten, tarieven, offertes en PDF werken zonder netwerk', async ({ page, context }) => {
  await expect(page.getByText('Offline beschikbaar', { exact: true })).toBeVisible()
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Nieuwe offerte', exact: true })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Nieuwe offerte', exact: true })).toBeVisible()
  await setRate(page, '5'); await fillQuote(page); await save(page)
  await navigate(page, 'Calculator')
  await expect(page.getByLabel('Bestaande klant selecteren').locator('option')).toContainText(['Nieuwe klant', 'José Vermeulen'])
  await navigate(page, 'Offertes')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /PDF JRS-.* downloaden/ }).click()
  const pdf = await downloadPromise
  expect((await readFile((await pdf.path())!)).subarray(0, 4).toString()).toBe('%PDF')
  await page.reload()
  await expect(page.locator('.price-bar strong')).toHaveText(/50,00/)
})
test('JSON-back-up herstelt gegevens; foutieve bestanden laten opslag intact', async ({ page, browser }, testInfo) => {
  await setRate(page, '5'); await fillQuote(page); await save(page)
  await navigate(page, 'Instellingen'); await page.getByRole('tab', { name: 'Back-up & app' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Volledige back-up exporteren' }).click()
  const download = await downloadPromise; const path = (await download.path())!
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = testInfo.project.use
  const fresh = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL })
  const p = await fresh.newPage(); p.on('dialog', d => d.accept()); await p.goto('./')
  await navigate(p, 'Instellingen'); await p.getByRole('tab', { name: 'Back-up & app' }).click()
  await p.locator('input[type=file]').setInputFiles(path)
  await expect(p.getByRole('status')).toContainText('Back-up volledig hersteld.')
  await navigate(p, 'Offertes'); await expect(p.locator('.quote-amount')).toHaveText(/50,00/)
  await navigate(p, 'Calculator'); await expect(p.getByLabel('Bestaande klant selecteren').locator('option')).toContainText(['Nieuwe klant', 'José Vermeulen'])
  await navigate(p, 'Instellingen'); await p.getByRole('tab', { name: 'Back-up & app' }).click()
  await p.locator('input[type=file]').setInputFiles({ name: 'fout.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') })
  await expect(p.getByRole('alert')).toContainText('dataschemaversie')
  await navigate(p, 'Offertes'); await expect(p.locator('.quote-amount')).toHaveText(/50,00/)
  await fresh.close()
})
test('klant zonder offerte, alle dienstcategorieën, dupliceren en vorige versies', async ({ page }) => {
  await navigate(page, 'Calculator')
  await page.getByLabel('Naam').fill('Losse klant')
  await page.getByRole('button', { name: 'Klant afzonderlijk opslaan', exact: true }).click()
  await expect(page.getByLabel('Bestaande klant selecteren').locator('option')).toContainText(['Nieuwe klant', 'Losse klant'])
  await navigate(page, 'Calculator'); await setRate(page, '5'); await fillQuote(page)
  for (const name of ['Rolluiken', 'Garagepoorten', 'Veranda’s']) await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByLabel('Aantal Groot rolluik Rolluiken')).toBeVisible()
  await expect(page.getByLabel('Aantal Brede garagepoort Garagepoorten')).toBeVisible()
  await expect(page.getByLabel('Aantal Glazen tuinhuis — groot Veranda’s')).toBeVisible()
  await save(page)
  await page.getByLabel('Aantal Normaal raam Ramen', { exact: true }).fill('12'); await save(page)
  await navigate(page, 'Offertes')
  await expect(page.getByText('1 eerdere versie bewaard')).toBeVisible()
  await page.getByRole('button', { name: /JRS-.* dupliceren/ }).click(); await save(page)
  await navigate(page, 'Offertes'); await expect(page.locator('.quote-card')).toHaveCount(2)
  await page.getByLabel(/Status JRS-/).first().selectOption('Goedgekeurd')
  await page.getByLabel('Offertestatus filter').selectOption('Goedgekeurd'); await expect(page.locator('.quote-card')).toHaveCount(1)
})
test('mobiele layout blijft binnen het scherm; manifest en app-iconen aanwezig', async ({ page, request }, testInfo) => {
  const manifest = await (await request.get('./manifest.webmanifest')).json()
  expect(manifest.name).toBe('JRS Offertecalculator'); expect(manifest.display).toBe('standalone')
  expect(manifest.start_url).toBe(new URL(testInfo.project.use.baseURL!).pathname)
  expect(manifest.scope).toBe(manifest.start_url)
  for (const icon of manifest.icons) expect(icon.src.startsWith(manifest.scope)).toBe(true)
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512', '512x512'])
  for (const width of [320, 393, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 393, height: 851 })
  await page.screenshot({ path: testInfo.outputPath('calculator-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.screenshot({ path: testInfo.outputPath('calculator-desktop.png'), fullPage: true })
})
test('alle diensten hebben werkende regelprijzen en vereisen controle op dubbeltelling', async ({ page }) => {
  await setRate(page, '5'); await fillQuote(page)
  for (const name of ['Rolluiken', 'Garagepoorten', 'Veranda’s']) await page.getByRole('button', { name, exact: true }).click()
  for (const [name, group, quantity, price, minutes] of [
    ['Standaard rolluik', 'Rolluiken', '2', '10', '4'],
    ['Standaard garagepoort', 'Garagepoorten', '1', '30', '8'],
    ['Veranda — klein', 'Veranda’s', '1', '50', '10'],
  ]) {
    const input = page.getByLabel(`Aantal ${name} ${group}`, { exact: true })
    const row = input.locator('xpath=ancestor::div[contains(@class,"service-line")]')
    await input.fill(quantity)
    await row.getByText('Aangepaste prijs, tijd of opmerking').click()
    await row.getByLabel(`Eigen stukprijs ${name}`, { exact: true }).fill(price)
    await row.getByLabel(`Eigen werktijd ${name}`, { exact: true }).fill(minutes)
  }
  await expect(page.locator('.price-bar strong')).toHaveText(/150,00/)
  await page.getByRole('button', { name: 'Offerte opslaan' }).click()
  await expect(page.getByText('Deze offerte kan nog niet opgeslagen worden')).toBeVisible()
  await page.getByLabel('Ik bevestig dat dit verschillende onderdelen zijn.').check()
  await save(page)
  await navigate(page, 'Offertes')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /PDF JRS-.* downloaden/ }).click()
  const download = await downloadPromise
  const pdfText = execFileSync('pdftotext', [(await download.path())!, '-'], { encoding: 'utf8' })
  for (const title of ['Rolluiken', 'Garagepoorten', 'Veranda', '€ 150,00']) expect(pdfText).toContain(title)
})
test('installatiehulp bewaart het browseraanbod en respecteert het iPhone-platform', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const prompt = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(prompt, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) })
    window.dispatchEvent(prompt)
  })
  await page.getByRole('button', { name: 'Installatiehulp openen' }).click()
  if (testInfo.project.name === 'iphone-webkit') {
    await expect(page.getByRole('heading', { name: 'Op iPhone installeren' })).toBeVisible()
    await expect(page.getByText('Zet op beginscherm', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Installeer app', exact: true })).toHaveCount(0)
    return
  }
  await expect(page.getByRole('button', { name: 'Installeer app', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Installeer app', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Installeer app', exact: true })).toHaveCount(0)
})
test('iPhone-installatiehulp toont Safari en Zet op beginscherm', async ({ browser }, testInfo) => {
  // This checks iPhone UI detection in each engine; it does not simulate native iOS installation.
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  try {
    const page = await context.newPage(); await page.goto('./')
    await page.getByRole('button', { name: 'Installatiehulp openen' }).click()
    await expect(page.getByRole('heading', { name: 'Op iPhone installeren' })).toBeVisible()
    await expect(page.getByText('Zet op beginscherm', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Installeer app', exact: true })).toHaveCount(0)
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', `${new URL(testInfo.project.use.baseURL!).pathname}icon-192.png`)
  } finally { await context.close() }
})
