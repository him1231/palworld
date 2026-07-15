import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH is set by CI when deploying under a sub-path (GitHub Pages project site)
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
