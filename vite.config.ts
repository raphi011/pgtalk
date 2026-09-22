import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import { labPlugin } from "./server/plugin.js";

export default defineConfig({
  plugins: [{ enforce: "pre", ...mdx({ providerImportSource: "/src/mdx" }) }, react(), labPlugin()],
  server: { host: "127.0.0.1", port: 5173 },
});
