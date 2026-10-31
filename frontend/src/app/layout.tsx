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
  // Matches the theme the theme card can switch to, so the browser chrome does
  // not stay light behind a dark page.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0066cc' },
    { media: '(prefers-color-scheme: dark)', color: '#121214' },
  ],
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

/**
 * Applies the saved theme before the first paint. Without this, a dark-mode
 * reload would render a white page until React hydrates and the theme provider
 * writes the same attributes. Keep the key and the attribute names in sync with
 * context/ThemeContext.tsx (THEME_STORAGE_KEY).
 */
const themeInitScript = `(function(){try{var s=JSON.parse(localStorage.getItem('art_theme_settings')||'{}');var m=s.mode==='light'||s.mode==='dark'?s.mode:'system';var a=typeof s.accent==='string'?s.accent:'blue';var d=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.dataset.accent=a;r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={anuphan.variable}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
