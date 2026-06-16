import type { Metadata } from 'next';
import { Anuphan } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SpeedInsights } from '@vercel/speed-insights/next';

const anuphan = Anuphan({
  weight: ['400', '600', '700'],
  subsets: ['thai', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ART Workspace',
  description: 'Modern workspace management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        {/* Basic SEO */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Modern workspace management system with live weather & air quality monitoring" />
        <meta property="og:title" content="ART Workspace" />
        <meta property="og:description" content="Check weather, AQI, and manage your dashboard" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </head>
      <body className={anuphan.className}>
          {/* Theme toggle removed */}
          <Providers>
            {children}
            <SpeedInsights />
          </Providers>
      </body>
    </html>
  );
}

