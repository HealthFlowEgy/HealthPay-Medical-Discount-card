/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@healthpay/quote-sdk", "@healthpay/shared"],
  webpack: (config) => {
    config.resolve.conditionNames = [
      "source",
      ...(config.resolve.conditionNames ?? ["require", "import", "node", "default"]),
    ];
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
