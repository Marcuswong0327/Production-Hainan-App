import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Keep Vite cache outside node_modules to avoid Windows file locks/permissions issues.
  cacheDir: '.vite',
  optimizeDeps: {
    exclude: [
      '@supabase/supabase-js',
      'lucide-react',
      '@radix-ui/react-slot',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})




