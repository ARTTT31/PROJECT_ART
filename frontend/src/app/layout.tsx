import type { Metadata, Viewport } from 'next';
import { Anuphan } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SpeedInsights } from '@vercel/speed-insights/next';

const anuphan = Anuphan({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-anuphan',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'ART Workspace',
  description: 'Modern workspace management system',
  openGraph: {
    title: 'ART Workspace',
    description: 'Manage your dashboard efficiently',
    type: 'website',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
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

