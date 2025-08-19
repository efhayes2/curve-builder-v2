import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: 'storage.googleapis.com',
        protocol: 'https',
        pathname: '/mrgn-public/**/*',
      },
    ],
  },
  eslint: {
    // ✅ Skip ESLint errors during Vercel builds
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '10.96.0.18',      // <-- your LAN / proxy IP or host
    // 'my.dev.domain', // e.g. if you use a custom host
    // '*.dev.local',   // subdomain wildcard is supported per docs
  ],
};

export default nextConfig;
