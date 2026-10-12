import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Samakan dengan "paths" di tsconfig supaya modul yang import "@/..." bisa dites.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // Jangan ikutkan worktree Claude & build artifacts
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/**"],
  },
});
