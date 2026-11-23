import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Anuphan } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AuthUserSchema } from '@/lib/api/schemas';
import { parseUserCookieValue } from '@/lib/api/userCookie';
import { brandingVersion, getServerBranding } from '@/lib/branding/serverBranding';

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

/**
 * The workspace is nameable, so the browser title, the iOS home-screen label and
 * the manifest all follow the stored name instead of a hard-coded product name.
 * A rename therefore reaches a phone that installs the app later; the manifest
 * carries the same name for browsers that use it as the install source.
 */
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getServerBranding();
  const name = branding.company_name;
  const version = brandingVersion(name, branding.brand_logo_url);
  const icon = (size: number, safe = false) =>
    `/branding-icon?size=${size}${safe ? '&safe=1' : ''}&v=${version}`;

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: {
      template: `%s | ${name}`,
      default: `${name} - ${branding.company_tagline}`,
    },
    description:
      'แพลตฟอร์มจัดการงานส่วนตัวและเชื่อมต่อระบบภายใน (Dashboard) รวบรวมข้อมูลวันหยุด ราคาน้ำมัน และสภาพอากาศไว้ในที่เดียว',
    keywords: ['workspace', 'dashboard', 'productivity', 'management'],
    authors: [{ name: `${name} Team` }],
    // The workspace logo an admin uploads lives in the database, so the icon is
    // resolved by a route that returns a PNG (or the bundled mark as fallback).
    // The version tag is what lets a renamed workspace ship a new icon.
    icons: {
      icon: [
        { url: icon(192), sizes: '192x192', type: 'image/png' },
        { url: icon(512), sizes: '512x512', type: 'image/png' },
      ],
      shortcut: icon(192),
      apple: [
        { url: icon(180, true), sizes: '180x180', type: 'image/png' },
        { url: icon(192, true), sizes: '192x192', type: 'image/png' },
      ],
    },
    manifest: '/manifest.webmanifest',
    openGraph: {
      title: name,
      description: 'แพลตฟอร์มจัดการงานส่วนตัวที่ออกแบบด้วย Apple HIG เรียบง่ายแต่ทรงพลัง',
      type: 'website',
      images: ['/og-image.png'],
      siteName: name,
    },
    alternates: {
      canonical: '/',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: name,
    },
  };
}

/**
 * Applies the saved theme before the first paint. Without this, a dark-mode
 * reload would render a white page until React hydrates and the theme provider
 * writes the same attributes. Keep the key and the attribute names in sync with
 * context/ThemeContext.tsx (THEME_STORAGE_KEY).
 */
const themeInitScript = `(function(){try{var s=JSON.parse(localStorage.getItem('art_theme_settings')||'{}');var m=s.mode==='light'||s.mode==='dark'?s.mode:'system';var a=typeof s.accent==='string'?s.accent:'blue';var d=m==='dark'||(m==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.dataset.accent=a;r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

/**
 * The session the browser already holds, read on the server from the readable
 * `user` cookie the API writes on login/refresh. It is display data, not an
 * authorization decision (every API call is still validated server-side), and
 * it lets the first HTML paint the signed-in shell instead of a loading state.
 */
async function readInitialUser() {
  try {
    const raw = (await cookies()).get('user')?.value ?? null;
    const parsed = AuthUserSchema.safeParse(parseUserCookieValue(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The branding is read here, not in the browser, so the sidebar's name and
  // tagline in the HTML are the workspace's own. Seeding the provider from a
  // localStorage cache instead made the server render the neutral name and the
  // client its stored one — a hydration mismatch (React #418) on every page.
  const [initialUser, branding] = await Promise.all([readInitialUser(), getServerBranding()]);

  return (
    <html lang="th" suppressHydrationWarning>
      <body className={anuphan.variable}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers initialUser={initialUser} initialBranding={branding}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
