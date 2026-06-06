import { defineConfig } from "vitest/config";

// Resolve workspace packages (@healthpay/shared) from their TypeScript `source`
// export condition so the test loop never requires a prior build.
export default defineConfig({
  resolve: {
    conditions: ["source", "import", "module", "node", "default"],
  },
});
