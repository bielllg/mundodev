import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { include: ["tests/unit/**/*.test.ts"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) =>
          id.includes("pixi") ? "pixi" : undefined,
      },
    },
  },
});
