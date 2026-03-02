import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.prop.test.ts"],
    exclude: ["apps/**", "node_modules/**", "dist/**", "coverage/**"]
  }
});
