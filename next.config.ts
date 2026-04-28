// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  // Evita warning de lockfiles múltiples
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;