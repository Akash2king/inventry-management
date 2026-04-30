const path = require("path");
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

module.exports = defineConfig({
  plugins: [react()],
  // Tauri release loads index.html via file://, so assets must be relative.
  base: "./",
  root: path.resolve(__dirname),
  clearScreen: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (id.includes("recharts")) {
            return "vendor-charts";
          }
          if (id.includes("xlsx")) {
            return "vendor-xlsx";
          }
          if (id.includes("pdf-lib")) {
            return "vendor-pdf";
          }
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
