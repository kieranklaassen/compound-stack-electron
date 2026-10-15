import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['page/**/*.test.{ts,tsx}'],
    setupFiles: ['page/test_setup.ts'],
    restoreMocks: true,
  },
})
