import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The page is built into `page/dist` and carried inside the app, where the
// shell serves it on `app://page/`. `base: './'` keeps every address relative,
// so the same build opens under the scheme and under `vite preview`.
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'chrome140', sourcemap: true },
})
