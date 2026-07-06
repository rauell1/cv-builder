import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Standalone output required by the build script (cp to .next/standalone/)
  output: 'standalone',
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
  // Production optimizations — external packages to avoid bundling issues.
  // z-ai-web-dev-sdk is Z.ai-environment-specific and must not be bundled
  // (it tries to connect to Z.ai services at import time, which hangs in other environments).
  serverExternalPackages: ['pdf-lib', 'mammoth', 'sharp', 'child_process', 'z-ai-web-dev-sdk'],
  // Empty turbopack config to silence warning (we don't need custom bundling)
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://va.vercel-scripts.com",
              "connect-src 'self' ws: wss: https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://vitals.vercel-insights.com",
              "img-src 'self' data: https: blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "upgrade-insecure-requests"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
