import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// DeepSeek Mobile — Vite config.
// The app ships inside a Capacitor WebView, so we emit a self-contained
// static bundle with relative asset paths and no source-map leakage.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // Editors that write atomically (temp dir + rename) would otherwise make
      // the watcher choke on the short-lived staging directories.
      ignored: [
        '**/.*.tmpdir/**',
        '**/*.tmp',
        '**/artifacts/**',
        '**/android/**',
        '**/dist/**',
        '**/ios/**',
      ],
    },
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome110',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    // Let Rollup split vendor code automatically: hand-written chunks here
    // caused KaTeX to be emitted twice (once for the manual chunk, once for the
    // dynamic Mermaid import graph).
  },
  optimizeDeps: {
    // Mermaid (and dayjs under it) are CommonJS; letting esbuild pre-bundle them
    // is what makes the lazy `import('mermaid')` work in dev.
    include: ['mermaid', 'katex', 'markdown-it', 'highlight.js/lib/common'],
  },
})
