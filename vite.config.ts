import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_TRIBE_LAT": JSON.stringify(
      process.env.VITE_TRIBE_LAT ?? "51.5074"
    ),
    "import.meta.env.VITE_TRIBE_LNG": JSON.stringify(
      process.env.VITE_TRIBE_LNG ?? "-0.1278"
    ),
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
