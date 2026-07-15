import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // Jangan ikutkan worktree Claude & build artifacts
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/**"],
  },
});
