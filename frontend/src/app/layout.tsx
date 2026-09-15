import type { Metadata, Viewport } from 'next';
import { Anuphan } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SpeedInsights } from '@vercel/speed-insights/next';

const anuphan = Anuphan({
  weight: 'variable',
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-anuphan',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0071e3', // Apple Blue
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://project-art-sigma.vercel.app'),
  title: {
    template: '%s | ART Workspace',
    default: 'ART Workspace - จัดการวันทำงานของคุณให้ง่ายขึ้น',
  },
  description: 'แพลตฟอร์มจัดการงานส่วนตัวและเชื่อมต่อระบบภายใน (Dashboard) รวบรวมข้อมูลวันหยุด ราคาน้ำมัน และสภาพอากาศไว้ในที่เดียว',
  keywords: ['workspace', 'dashboard', 'productivity', 'management', 'art workspace'],
  authors: [{ name: 'ART Workspace Team' }],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'ART Workspace',
    description: 'แพลตฟอร์มจัดการงานส่วนตัวที่ออกแบบด้วย Apple HIG เรียบง่ายแต่ทรงพลัง',
    type: 'website',
    images: ['/og-image.png'],
    siteName: 'ART Workspace',
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

