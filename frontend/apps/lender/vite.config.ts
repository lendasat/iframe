/// <reference types='vitest' />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  envDir: "../../../",
  server: {
    port: 4201,
    host: "localhost",
    proxy: {
      "/api": {
        target: "http://localhost:7338",
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 4301,
    host: "localhost",
  },

  plugins: [
    react(),
    svgr({
      svgrOptions: {
        exportType: "named",
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: "**/*.svg",
    }),
  ],

  build: {
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
