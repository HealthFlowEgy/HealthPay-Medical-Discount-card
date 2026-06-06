// Partner origins permitted to embed the hosted quote page (iframe/webview).
const partnerOrigins = (process.env.PARTNER_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// CSP for the hosted quote page. `frame-ancestors` allows partner embedding.
// NOTE: 'unsafe-inline' is required for Next's hydration in this setup; tighten
// to nonce-based scripts before a hardened production launch.
const quoteCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  `frame-ancestors 'self'${partnerOrigins.length ? " " + partnerOrigins.join(" ") : ""}`,
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/quote/:path*",
        headers: [
          { key: "Content-Security-Policy", value: quoteCsp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
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
