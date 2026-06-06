/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Consume workspace packages as TypeScript source.
  transpilePackages: ["@healthpay/shared", "@healthpay/db"],
  webpack: (config) => {
    // Prefer the `source` export condition so dev/build use TS source directly.
    config.resolve.conditionNames = [
      "source",
      ...(config.resolve.conditionNames ?? ["require", "import", "node", "default"]),
    ];
    // The workspace TS sources use ESM `.js` import specifiers; let webpack
    // resolve those to the underlying `.ts`/`.tsx` files.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
  // postgres-js is a server-only dependency (Next 14 option name).
  experimental: {
    serverComponentsExternalPackages: ["postgres"],
  },
};

export default nextConfig;
