import type { Metadata, Viewport } from 'next';
import { Anuphan } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const anuphan = Anuphan({
  weight: 'variable',
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-anuphan',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0066cc', // Apple Blue
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    template: '%s | ART Workspace',
    default: 'ART Workspace - จัดการวันทำงานของคุณให้ง่ายขึ้น',
  },
  description:
    'แพลตฟอร์มจัดการงานส่วนตัวและเชื่อมต่อระบบภายใน (Dashboard) รวบรวมข้อมูลวันหยุด ราคาน้ำมัน และสภาพอากาศไว้ในที่เดียว',
  keywords: ['workspace', 'dashboard', 'productivity', 'management', 'art workspace'],
  authors: [{ name: 'ART Workspace Team' }],
  // The workspace logo an admin uploads lives in the database, so the icon is
  // resolved by a route that returns a PNG (or the bundled mark as fallback).
  icons: {
    icon: [{ url: '/branding-icon?size=192', sizes: '192x192', type: 'image/png' }],
    shortcut: '/branding-icon?size=192',
    apple: [{ url: '/branding-icon?size=192', sizes: '192x192', type: 'image/png' }],
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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ART Workspace',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={anuphan.variable}>
        {/* Theme toggle removed */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
