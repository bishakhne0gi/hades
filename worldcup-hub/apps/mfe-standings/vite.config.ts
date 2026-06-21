// Author: Bishakh
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "standings",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.tsx" },
      dts: false,
      shared: ["react", "react-dom"],
    }),
  ],
  server: { port: 5003, strictPort: true, origin: "http://localhost:5003", cors: true },
  preview: { port: 5003, strictPort: true },
  build: { target: "chrome89" },
});
