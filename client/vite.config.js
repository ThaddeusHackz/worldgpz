import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/leaflet") ||
            id.includes("node_modules/react-leaflet")
          )
            return "map";
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-")
          )
            return "charts";
          return undefined;
        },
      },
    },
  },
});
