// Author: Bishakh
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";

// Host: loads the remotes at runtime. @module-federation/vite supports `vite dev`
// with HMR for the host AND remotes (the previous @originjs plugin did not).
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "shell",
      remotes: {
        scoreboard: { type: "module", name: "scoreboard", entry: "http://localhost:5001/remoteEntry.js" },
        matchCenter: { type: "module", name: "matchCenter", entry: "http://localhost:5002/remoteEntry.js" },
        standings: { type: "module", name: "standings", entry: "http://localhost:5003/remoteEntry.js" },
        news: { type: "module", name: "news", entry: "http://localhost:5004/remoteEntry.js" },
      },
      filename: "remoteEntry.js",
      dts: false,
      shared: ["react", "react-dom"],
    }),
  ],
  server: { port: 5000, strictPort: true, origin: "http://localhost:5000" },
  preview: { port: 5000, strictPort: true },
  build: { target: "chrome89" },
});
