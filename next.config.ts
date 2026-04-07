import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Allow the preview domain to load static chunks (Turbopack) cross-origin
  allowedDevOrigins: [
    "space.z.ai",
    "z.ai",
  ],
  // Increase server action body size limit for file uploads (default is 1MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // Production optimizations — external packages to avoid bundling issues
  serverExternalPackages: ['pdf-lib', 'mammoth', 'sharp', 'child_process'],
  // Empty turbopack config to silence warning (we don't need custom bundling)
  turbopack: {},
};

export default nextConfig;
