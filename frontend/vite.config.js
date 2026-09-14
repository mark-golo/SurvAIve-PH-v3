import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // mode = 'victim' | 'responder' | 'development' | 'production'
  // Native variants use --mode victim / --mode responder (cross-platform, no env-var syntax)
  const variant = ['victim', 'responder'].includes(mode) ? mode : 'web'
  const isNative = variant !== 'web'

  return {
    plugins: [
      react(),
      tailwindcss(),

      // Rewrite the <script> src in index.html at build time so that:
      //   --mode victim     → /src/main-victim.jsx
      //   --mode responder  → /src/main-responder.jsx
      //   default build     → /src/main.jsx  (unchanged)
      //
      // The build input stays as index.html, so the output is always
      // dist/index.html — which is the file Capacitor's cap sync requires.
      isNative && {
        name: 'survaive-variant-entry',
        transformIndexHtml(html) {
          return html.replace(
            '/src/main.jsx',
            `/src/main-${variant}.jsx`,
          )
        },
      },

      // PWA / Workbox only for the web (Admin dashboard) build.
      // Capacitor handles its own asset bundling and SW registration — enabling
      // vite-plugin-pwa in native builds causes double-registration conflicts.
      !isNative && VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-css',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ].filter(Boolean),

    // Expose the current variant to all React modules at compile time.
    // Usage: if (__APP_VARIANT__ === 'victim') { ... }
    define: {
      __APP_VARIANT__: JSON.stringify(variant),
    },

    build: {
      // No rollupOptions.input override — input is always index.html
      // so output is always dist/index.html (required by Capacitor sync).
      outDir: 'dist',
    },

    server: {
      port: 5173,
    },
  }
})
