import type { MetadataRoute } from 'next';
import {
  brandingVersion,
  fetchServerBranding,
  shortAppName,
} from '@/lib/branding/serverBranding';

/**
 * The web app manifest is generated, not a static file, because the app is
 * nameable: whatever the workspace is called has to be what an install puts on
 * the home screen.
 *
 * The icon URLs carry a version tag derived from the name and logo. Android
 * re-reads the manifest when the installed app starts and refreshes the icon and
 * label only when the icon URL changes, so a rename or a new logo now reaches an
 * install that already exists — no reinstall needed.
 */
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await fetchServerBranding();
  const name = branding.company_name;
  const version = brandingVersion(name, branding.brand_logo_url);

  const icon = (size: number, maskable = false) =>
    `/branding-icon?size=${size}${maskable ? '&safe=1' : ''}&v=${version}`;

  return {
    name,
    short_name: shortAppName(name),
    description: `${name} — ${branding.company_tagline}`,
    id: '/dashboard',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: '#0066cc',
    lang: 'th',
    dir: 'ltr',
    icons: [
      { src: icon(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
      {
        src: icon(192, true),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: icon(512, true),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'จดโน้ตด่วน',
        short_name: 'จดโน้ต',
        description: 'เปิดบันทึกข้อความและรายการ To-Do ทันที',
        url: '/dashboard?action=quick-note',
        icons: [{ src: icon(192), sizes: '192x192' }],
      },
      {
        name: 'เช็คราคาน้ำมัน',
        short_name: 'ราคาน้ำมัน',
        description: 'ตรวจสอบราคาน้ำมันขายปลีกวันนี้',
        url: '/dashboard?action=oil-prices',
        icons: [{ src: icon(192), sizes: '192x192' }],
      },
      {
        name: 'คุยกับ AI Copilot',
        short_name: 'AI ผู้ช่วย',
        description: 'เปิดหน้าต่างถาม-ตอบและสั่งการอัจฉริยะ',
        url: '/dashboard?action=copilot',
        icons: [{ src: icon(192), sizes: '192x192' }],
      },
      {
        name: 'ดูกล้องวงจรปิด CCTV',
        short_name: 'กล้อง CCTV',
        description: 'เปิดดูกล้องวงจรปิดแบบสด',
        url: '/camera',
        icons: [{ src: icon(192), sizes: '192x192' }],
      },
    ],
    share_target: {
      action: '/share-target',
      method: 'GET',
      enctype: 'application/x-www-form-urlencoded',
      params: { title: 'title', text: 'text', url: 'url' },
    },
  };
}
