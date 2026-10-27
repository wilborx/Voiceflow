import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Tests dürfen nicht von der Zeitzone der Maschine abhängen.
    env: { TZ: "America/New_York" },
  },
});
