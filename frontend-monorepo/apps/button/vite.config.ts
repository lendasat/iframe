import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";


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
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
