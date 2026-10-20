/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/',
  build: {
    outDir: 'dist',
  },
  server: {
    // `npm run api` serves public/api/*.php locally
    // 127.0.0.1, not localhost: `localhost` may resolve to ::1 for one side and 127.0.0.1 for the other
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
  test: {
    environment: 'jsdom',
    forceExit: true,
  } as never,
})
