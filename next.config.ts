import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Experimental features para otimizar imports
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
  
  // Headers for caching
  async headers() {
    return [
      {
        source: '/api/admin/sync/status',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ]
  },
};

export default nextConfig;
