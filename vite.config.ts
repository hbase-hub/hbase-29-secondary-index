import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/hbase-29-secondary-index/',
  server: {
    port: 54329,
  },
})
