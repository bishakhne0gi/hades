// Author: Bishakh
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "news",
      filename: "remoteEntry.js",
      exposes: { "./App": "./src/App.tsx" },
      dts: false,
      shared: ["react", "react-dom"],
    }),
  ],
  server: { port: 5004, strictPort: true, origin: "http://localhost:5004", cors: true },
  preview: { port: 5004, strictPort: true },
  build: { target: "chrome89" },
});
