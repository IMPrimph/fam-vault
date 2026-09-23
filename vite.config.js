import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`))

/**
 * Self-host Tesseract's worker, WASM cores and English model under /ocr/.
 * The library would otherwise fetch them from a public CDN, which the CSP
 * blocks (and which would tell a third party someone is scanning an ID).
 * Copied into public/ at startup so dev and build serve the same paths.
 * Only the LSTM cores are needed; the worker picks one by SIMD support.
 */
function selfHostOcr() {
  const out = 'public/ocr'
  return {
    name: 'self-host-ocr',
    buildStart() {
      const core = pkgDir('tesseract.js-core')
      mkdirSync(join(out, 'core'), { recursive: true })
      mkdirSync(join(out, 'lang'), { recursive: true })
      cpSync(join(pkgDir('tesseract.js'), 'dist/worker.min.js'), join(out, 'worker.min.js'))
      for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
        cpSync(join(core, f), join(out, 'core', f))
      }
      cpSync(join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'), join(out, 'lang/eng.traineddata.gz'))
    },
  }
}

export default defineConfig({
  plugins: [
    selfHostOcr(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: false, // using public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2}'],
        // ~7MB of OCR assets and the pdf.js chunks are only for scanning;
        // they're cached on first use (below) instead of on install.
        globIgnores: ['ocr/**', '**/pdf*.mjs', '**/pdf-*.js', '**/tesseract*.js'],
        // Never precache the service worker itself
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // OCR worker, cores and model: large, versioned by package, and
            // needed offline once used. Same-origin, so never PII.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-assets', expiration: { maxEntries: 10 } },
          },
          {
            // Lazy scanning chunks (pdf.js, tesseract.js) left out of precache.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /\/assets\/(pdf|tesseract)[^/]*\.m?js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'scan-code', expiration: { maxEntries: 20 } },
          },
          {
            // Supabase API — always fetch fresh, never cache PII
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Supabase Auth — never cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Supabase Storage — never cache sensitive family documents in browser
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
