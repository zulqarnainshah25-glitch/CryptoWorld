import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'src/index.html',
        about: 'src/pages/about.html',
        terms: 'src/pages/terms.html',
        disclaimer: 'src/pages/disclaimer.html',
        contact: 'src/pages/contact.html',
        admin: 'src/pages/admin.html'
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/pages\//]
      }
    })
  ]
});