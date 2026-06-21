// Author: Bishakh
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "matchCenter",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.tsx" },
      shared: ["react", "react-dom"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
  server: { port: 5002, strictPort: true, cors: true },
  preview: { port: 5002, strictPort: true },
});
