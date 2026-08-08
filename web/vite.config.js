import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api/* goes to Jeswin's Express server when mocks are off.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
