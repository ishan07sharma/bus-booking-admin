import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep firebase-admin (and jose/jwks-rsa) out of the Next bundler —
  // otherwise Vercel hits ERR_REQUIRE_ESM on jose.
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "jose",
    "jwks-rsa",
  ],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,DELETE,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Authorization, Content-Type",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
