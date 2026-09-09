import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Tanda 10A (ADR-012): separa vendors estables del codigo de
        // la app para que el navegador los cachee entre deploys sin
        // volver a descargarlos. Esta version de Vite (8.x) corre
        // sobre Rolldown, no sobre Rollup: la opcion moderna es
        // `output.codeSplitting.groups` (`manualChunks` sigue
        // aceptada pero esta deprecada en Rolldown en favor de esta).
        // El code-splitting por ruta (React.lazy en AppRoutes.tsx) ya
        // separa cada modulo en su propio chunk sin esta config —
        // esto solo separa el vendor que quedaba pegado al chunk de
        // entrada (index-*.js: React + React DOM + TanStack Query).
        codeSplitting: {
          groups: [
            { name: 'vendor-react-dom', test: /node_modules[\\/]react-dom[\\/]/ },
            { name: 'vendor-react', test: /node_modules[\\/]react[\\/]/ },
            { name: 'vendor-tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/ },
            { name: 'vendor-lucide', test: /node_modules[\\/]lucide-react[\\/]/ },
          ],
        },
      },
    },
  },
})
