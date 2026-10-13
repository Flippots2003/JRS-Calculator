import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

async function navigate(page: Page, name: string) { await page.getByRole('navigation').getByRole('button', { name, exact: true }).click() }
async function setRate(page: Page, price: string, minutes = '1') {
  await navigate(page, 'Instellingen')
  await page.getByLabel('Prijs Normaal raam Binnen & buiten', { exact: true }).fill(price)
  await page.getByLabel('Werktijd Normaal raam Binnen & buiten', { exact: true }).fill(minutes)
  await page.getByRole('button', { name: 'Instellingen opslaan', exact: true }).click()
  await expect(page.getByText('Alles is opgeslagen', { exact: true })).toBeVisible()
  await navigate(page, 'Calculator')
}
async function fillQuote(page: Page, quantity = '10') {
  await page.getByLabel('Klantnaam / bedrijfsnaam *', { exact: true }).fill('José Vermeulen')
  await page.getByLabel('Straat en huisnummer *', { exact: true }).fill('Teststraat 12')
  await page.getByLabel('Postcode *', { exact: true }).fill('9000')
  await page.getByLabel('Gemeente *', { exact: true }).fill('Gent')
  await page.getByLabel('Aantal Normaal raam Binnen & buiten', { exact: true }).fill(quantity)
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Offerte opslaan', exact: true }).click()
  await expect(page.getByRole('status')).toContainText(/Offerte JRS-\d{4}-\d{4} opgeslagen/)
}
test.beforeEach(async ({ page }) => {
  page.on('dialog', dialog => dialog.accept())
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Nieuwe offerte', exact: true })).toBeVisible()
})
test('geen fictieve bedrijfsprijzen; onvolledige offertes worden geblokkeerd', async ({ page }) => {
  await page.getByLabel('Aantal Normaal raam Binnen & buiten', { exact: true }).fill('1')
  await expect(page.getByText('Nog onvolledig', { exact: true })).toBeVisible()
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
  await expect(page.getByLabel('Aantal Normaal raam Binnen & buiten', { exact: true })).toHaveValue('10')
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
  expect(pdfText).toContain('José Vermeulen'); expect(pdfText).toContain('€ 50,00'); expect(pdfText).toContain('Ramen binnen & buiten')
})
test('uurnorm, materiaalkosten en bewuste handmatige afwijking', async ({ page }) => {
  await setRate(page, '5', '12'); await fillQuote(page)
  await expect(page.locator('.price-bar strong')).toHaveText(/90,00/)
  await page.getByLabel('Interne materiaalkost', { exact: true }).fill('100')
  await expect(page.locator('.price-bar strong')).toHaveText(/90,00/)
  await page.getByLabel('Materiaal voor klant', { exact: true }).fill('20')
  await expect(page.locator('.price-bar strong')).toHaveText(/110,00/)
  await page.getByText('Eindprijs handmatig aanpassen', { exact: false }).click()
  await page.getByLabel('Handmatige eindprijs inclusief btw').fill('30')
  await expect(page.getByText('De eindprijs ligt onder de minimale opdrachtprijs.')).toBeVisible()
  await page.getByRole('button', { name: 'Offerte opslaan' }).click()
  await expect(page.getByText('Deze offerte kan nog niet opgeslagen worden')).toBeVisible()
  await page.getByLabel('Ik aanvaard deze afwijking bewust.').check()
  await save(page)
  await page.getByLabel('Aantal Normaal raam Binnen & buiten', { exact: true }).fill('20')
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
  await navigate(page, 'Klanten')
  await page.getByLabel('Klanten zoeken').fill('Gent')
  await expect(page.getByRole('heading', { name: 'José Vermeulen' })).toBeVisible()
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
  await navigate(p, 'Klanten'); await expect(p.getByRole('heading', { name: 'José Vermeulen' })).toBeVisible()
  await navigate(p, 'Instellingen'); await p.getByRole('tab', { name: 'Back-up & app' }).click()
  await p.locator('input[type=file]').setInputFiles({ name: 'fout.json', mimeType: 'application/json', buffer: Buffer.from('{"schemaVersion":99}') })
  await expect(p.getByRole('alert')).toContainText('dataschemaversie')
  await navigate(p, 'Offertes'); await expect(p.locator('.quote-amount')).toHaveText(/50,00/)
  await fresh.close()
})
test('klant zonder offerte, alle dienstcategorieën, dupliceren en vorige versies', async ({ page }) => {
  await navigate(page, 'Klanten'); await page.getByRole('button', { name: 'Nieuwe klant' }).click()
  await page.getByLabel('Klantnaam / bedrijfsnaam *').fill('Losse klant')
  await page.getByRole('button', { name: 'Klant opslaan', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Losse klant' })).toBeVisible()
  await navigate(page, 'Calculator'); await setRate(page, '5'); await fillQuote(page)
  for (const name of ['Enkel buiten', 'Rolluiken', 'Garagepoorten', 'Veranda’s']) await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByLabel('Aantal Groot rolluik Rolluiken')).toBeVisible()
  await expect(page.getByLabel('Aantal Brede garagepoort Garagepoorten')).toBeVisible()
  await expect(page.getByLabel('Aantal Glazen tuinhuis — groot Veranda’s')).toBeVisible()
  await save(page)
  await page.getByLabel('Aantal Normaal raam Binnen & buiten', { exact: true }).fill('12'); await save(page)
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
  for (const name of ['Enkel buiten', 'Rolluiken', 'Garagepoorten', 'Veranda’s']) await page.getByRole('button', { name, exact: true }).click()
  for (const [name, group, quantity, price, minutes] of [
    ['Normaal raam', 'Enkel buiten', '1', '8', '3'],
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
  await expect(page.locator('.price-bar strong')).toHaveText(/158,00/)
  await page.getByRole('button', { name: 'Offerte opslaan' }).click()
  await expect(page.getByText('Deze offerte kan nog niet opgeslagen worden')).toBeVisible()
  await page.getByLabel('Ik bevestig dat dit verschillende onderdelen zijn.').check()
  await save(page)
  await navigate(page, 'Offertes')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /PDF JRS-.* downloaden/ }).click()
  const download = await downloadPromise
  const pdfText = execFileSync('pdftotext', [(await download.path())!, '-'], { encoding: 'utf8' })
  for (const title of ['Rolluiken', 'Garagepoorten', 'Veranda', '€ 158,00']) expect(pdfText).toContain(title)
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
