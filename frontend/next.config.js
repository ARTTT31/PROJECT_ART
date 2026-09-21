/** @type {import('next').NextConfig} */
// The development script uses webpack, not Turbopack. Serwist still emits its
// Turbopack advisory while loading Next 16's build config, so suppress that
// false-positive without changing PWA behaviour.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING ??= '1'

const nextConfig = {
  ...(process.env.EXPORT_STATIC === 'true' ? { output: 'export' } : {}),
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@tanstack/react-query', 'date-fns'],
  },

  async rewrites() {
    const apiBaseUrl = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },

  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_INTERNAL_URL || '';
    const apiOrigin = apiBaseUrl ? new URL(apiBaseUrl).origin : '';
    const connectSources = [
      "'self'",
      ...(apiOrigin ? [apiOrigin] : []),
      'https://www.eppo.go.th',
      'https://vitals.vercel-insights.com',
      'https://vercel.live',
      'https://*.open-meteo.com',
      'https://api.bigdatacloud.net',
    ].join(' ');
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://apis.google.com https://accounts.google.com https://va.vercel-scripts.com https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://vercel.live; connect-src ${connectSources}; frame-src 'self' https://accounts.google.com https://vercel.live; object-src 'none'; base-uri 'self'; form-action 'self'`,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Enable compression and static optimization
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};

const withSerwist = require('@serwist/next').default({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV !== 'production',
});

const { withSentryConfig } = require('@sentry/nextjs/config');

const sentryOptions = {
  silent: true,
  org: "your-org",
  project: "your-project",
};

const sentryWebpackOptions = {
  widenClientFileUpload: true,
  transpileClientSDK: true,
  hideSourceMaps: true,
  disableLogger: true,
};

module.exports = withSentryConfig(
  withSerwist(nextConfig),
  sentryOptions,
  sentryWebpackOptions
);
