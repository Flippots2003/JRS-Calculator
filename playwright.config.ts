import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'
const base = process.env.DEPLOY_BASE || '/'
const baseURL = `http://127.0.0.1:4173${base}`
export default defineConfig({
  testDir: './tests', fullyParallel: true, workers: 2, timeout: 45_000,
  expect: { timeout: 10_000 }, reporter: 'list',
  use: {
    baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'android-chrome', use: {
      ...devices['Pixel 7'], defaultBrowserType: 'chromium',
      launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined) },
    } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: baseURL, reuseExistingServer: !process.env.CI },
})
