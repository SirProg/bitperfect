import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * ffmpeg.wasm multihilo usa SharedArrayBuffer, que solo está disponible en
 * contextos con cross-origin isolation. Estas cabeceras replican en local lo
 * que `vercel.json` declara en producción; sin ellas el core-mt no carga y la
 * app cae al fallback monohilo incluso en desarrollo.
 */
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  // Los paquetes de ffmpeg cargan workers y wasm en tiempo de ejecución;
  // pre-empaquetarlos rompe esa resolución.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
