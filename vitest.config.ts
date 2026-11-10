import { defineConfig } from "vitest/config";
import path from "path";

// ponytail: minimal standard vitest configuration with path alias mapping
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    include: ["tests/unit/**/*.test.ts"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

