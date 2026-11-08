import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/items": "http://127.0.0.1:8000",
      "/kpis": "http://127.0.0.1:8000",
      "/history": "http://127.0.0.1:8000",
      "/finance": "http://127.0.0.1:8000",
      "/chapter-scores": "http://127.0.0.1:8000",
    },
  },
});
