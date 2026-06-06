import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load the repo-root .env into process.env for DB-backed integration tests,
// without adding a dotenv dependency. Missing file is fine (tests self-skip).
function loadEnv() {
  for (const p of [resolve(__dirname, ".env.local"), resolve(__dirname, "../../.env")]) {
    try {
      for (const line of readFileSync(p, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && m[1] && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      /* no env file here */
    }
  }
}
loadEnv();

export default defineConfig({
  resolve: {
    conditions: ["source", "import", "module", "node", "default"],
    alias: {
      "@/": `${resolve(__dirname, "src")}/`,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
