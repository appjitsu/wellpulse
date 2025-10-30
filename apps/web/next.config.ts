import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Proxy API requests in development to enable cookie-based authentication
  // This makes API requests appear to come from the same origin as the web app
  async rewrites() {
    // Only proxy in development - production uses direct API calls
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }

    return [
      {
        source: '/api/:path*',
        destination: 'http://demo.localhost:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
