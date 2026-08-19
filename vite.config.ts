import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    watch: {
      // Model binaries have no hot-reload story, and watching them means the
      // dev server dies with EBUSY if it opens one mid-copy. Ignoring the
      // folder also keeps a dozen multi-megabyte files out of the watch set.
      ignored: ['**/public/models/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
