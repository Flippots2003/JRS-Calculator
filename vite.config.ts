import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Default to a domain root locally; GitHub Pages publishes below the repository path.
const base = process.env.DEPLOY_BASE || '/'
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw new Error('DEPLOY_BASE moet een pad met afsluitende slash zijn, bijvoorbeeld /JRS-Calculator/.')

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), VitePWA({
    base, scope: base,
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'],
    manifest: {
      name: 'JRS Offertecalculator', short_name: 'JRS Offertes', lang: 'nl-BE',
      description: 'Offertes voor Jarne\'s Ramenservice, ook offline.',
      theme_color: '#164e44', background_color: '#f5f7f6', display: 'standalone',
      id: base, start_url: base, scope: base, orientation: 'any',
      icons: [
        { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: `${base}icon-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      cleanupOutdatedCaches: true, navigateFallback: `${base}index.html`,
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
  })],
  build: { target: 'es2022' },
})
