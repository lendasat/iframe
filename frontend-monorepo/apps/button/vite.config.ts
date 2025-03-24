import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  envDir: "../../../",
  server: {
    port: 4202,
    host: "localhost",
  },

  preview: {
    port: 4302,
    host: "localhost",
  },
  build: {
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  plugins: [react()],

})
