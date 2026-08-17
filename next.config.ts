import type { NextConfig } from "next";

// Vercel packages Next.js routes with its own output-file tracing adapter.
// Standalone output is only needed by the self-hosted Docker image.
const nextConfig: NextConfig = process.env.VERCEL
  ? { serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'] }
  : {
      output: "standalone",
      serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
    };

export default nextConfig;
