// electron.vite.config.ts
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
var __electron_vite_injected_dirname = "C:\\Users\\LG\\Desktop\\ecengine";
var electron_vite_config_default = defineConfig({
  main: {
    build: { rollupOptions: { external: ["better-sqlite3", "sharp"], input: { index: resolve(__electron_vite_injected_dirname, "electron/main.ts") } } }
  },
  preload: {
    build: { rollupOptions: { external: [], input: { index: resolve(__electron_vite_injected_dirname, "electron/preload.ts") } } }
  },
  renderer: {
    root: "src",
    build: { rollupOptions: { input: { index: resolve(__electron_vite_injected_dirname, "src/index.html") } } },
    plugins: [react()],
    resolve: {
      alias: { "@": resolve(__electron_vite_injected_dirname, "src") }
    }
  }
});
export {
  electron_vite_config_default as default
};
