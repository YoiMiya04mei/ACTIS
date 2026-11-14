import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  reactStrictMode: true,
  serverExternalPackages: ["ssh2"],
  experimental: {
    middlewareClientMaxBodySize: "150mb",
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

