import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2020",
  treeshake: true,
  // Consumers provide these (peer deps); never bundle them.
  external: ["react", "react-native"],
});
