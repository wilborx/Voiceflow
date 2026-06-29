import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.join(projectRoot, "apps", "voiceflow", "src"),
      "@assets": path.join(projectRoot, "attached_assets"),
      react: path.join(
        projectRoot,
        "apps",
        "voiceflow",
        "node_modules",
        "react",
      ),
      "react-dom": path.join(
        projectRoot,
        "apps",
        "voiceflow",
        "node_modules",
        "react-dom",
      ),
      "react/jsx-runtime": path.join(
        projectRoot,
        "apps",
        "voiceflow",
        "node_modules",
        "react",
        "jsx-runtime",
      ),
      "react/jsx-dev-runtime": path.join(
        projectRoot,
        "apps",
        "voiceflow",
        "node_modules",
        "react",
        "jsx-dev-runtime",
      ),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        url: "http://localhost",
      },
    },
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules", "dist", "apps"],
    resolve: {
      conditions: ["workspace"],
    },
    server: {
      deps: {
        inline: [
          "@vapi-ai/server-sdk",
          "telnyx",
          "@workspace/db",
          "@workspace/api-zod",
        ],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules",
        "dist",
        "tests/",
        "**/*.config.ts",
        "**/*.config.{ts,js}",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
