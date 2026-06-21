// Author: Bishakh
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

// The host declares which remotes it loads and where their remoteEntry lives.
// In local dev/preview each remote is served by `vite preview` on its own port.
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "shell",
      remotes: {
        scoreboard: "http://localhost:5001/assets/remoteEntry.js",
        matchCenter: "http://localhost:5002/assets/remoteEntry.js",
        standings: "http://localhost:5003/assets/remoteEntry.js",
        news: "http://localhost:5004/assets/remoteEntry.js",
      },
      shared: ["react", "react-dom"],
    }),
  ],
  build: { target: "esnext", minify: false, cssCodeSplit: false },
});
