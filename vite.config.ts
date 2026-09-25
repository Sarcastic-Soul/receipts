import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `bun run dev:api` serves /api locally on 3001 (see scripts/dev-api.ts).
    proxy: { "/api": "http://localhost:3001" },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
