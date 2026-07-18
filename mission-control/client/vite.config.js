import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, the React app runs on Vite's port and proxies
// /api calls to the Node backend on 8080. In production, the Node server
// serves the built files directly so there's no proxy needed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
