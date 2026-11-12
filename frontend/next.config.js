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

  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  async rewrites() {
    const apiBaseUrl = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/$/, '');
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
    // Camera feeds are LAN snapshots over http, which `https:` alone blocks. An
    // allow-list keeps that hole narrow: set NEXT_PUBLIC_CAMERA_IMG_ORIGINS to the
    // exact origins (comma separated, e.g. "http://192.168.1.50") a deployment
    // uses. Without it the previous blanket `http:` stays, so no camera that
    // works today silently stops loading. (Scripts still need 'unsafe-inline':
    // a nonce needs middleware plus dynamic rendering, and this site is
    // statically prerendered.)
    const cameraImgOrigins = (process.env.NEXT_PUBLIC_CAMERA_IMG_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const imgSources = [
      "'self'",
      'data:',
      'blob:',
      'https:',
      ...(cameraImgOrigins.length ? cameraImgOrigins : ['http:']),
    ].join(' ');
    const connectSources = [
      "'self'",
      ...(apiOrigin ? [apiOrigin, apiOrigin.replace('http', 'ws')] : []),
      'wss://*.onrender.com',
      'https://vitals.vercel-insights.com',
      'https://vercel.live',
      'https://*.open-meteo.com',
      'https://api.bigdatacloud.net',
      // Cloudflare Turnstile (optional CAPTCHA) verifies against this origin.
      'https://challenges.cloudflare.com',
      // Team crests in the football widget. `img-src` already allows https, but
      // the Serwist service worker re-fetches cached images, and that fetch is
      // governed by connect-src — without this the crests fail only in
      // production, where the SW is enabled.
      'https://a.espncdn.com',
    ].join(' ');
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://apis.google.com https://accounts.google.com https://va.vercel-scripts.com https://vercel.live https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src ${imgSources}; font-src 'self' https://fonts.gstatic.com https://vercel.live; connect-src ${connectSources}; frame-src 'self' https://accounts.google.com https://vercel.live https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'`,
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

// Source-map upload only runs when the Sentry org/project AND an auth token are
// configured. Without them the plugin stays a no-op, so no placeholder values
// are needed and CI builds never attempt an upload.
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

const sentryOptions = {
  silent: true,
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(sentryUploadEnabled ? {} : { sourcemaps: { disable: true } }),
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
