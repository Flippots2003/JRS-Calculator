import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'],
    manifest: {
      name: 'JRS Offertecalculator', short_name: 'JRS Offertes', lang: 'nl-BE',
      description: 'Offertes voor Jarne\'s Ramenservice, ook offline.',
      theme_color: '#164e44', background_color: '#f5f7f6', display: 'standalone',
      start_url: '/', scope: '/', orientation: 'any',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      cleanupOutdatedCaches: true, navigateFallback: '/index.html',
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
  })],
  build: { target: 'es2022' },
})
