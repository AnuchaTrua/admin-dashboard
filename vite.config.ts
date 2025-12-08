import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig({
  css: { transformer: 'postcss' },
  plugins: [
    react(),
  ],
})
