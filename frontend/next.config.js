/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // Check for changes every 1 second (essential for Docker on Windows host mounts)
        aggregateTimeout: 300, // Delay before rebuilding
        ignored: ['**/node_modules/**', '**/.next/**'],
      };
    }
    return config;
  },
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['@/components'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
