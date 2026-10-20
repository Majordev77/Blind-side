/**
 * Builds the offline demo (standalone.html) into dist-standalone/ as a
 * single JS and CSS file, which scripts/inline-standalone.mjs then inlines.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist-standalone',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: resolve(__dirname, 'standalone.html'),
      output: { inlineDynamicImports: true },
    },
  },
})
