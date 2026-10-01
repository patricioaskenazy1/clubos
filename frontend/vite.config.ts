import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El front habla con el backend en localhost:4000; el proxy evita
// tener que lidiar con CORS y URLs absolutas en el codigo del cliente.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
