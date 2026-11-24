import { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  // The root layout's title template already appends "| <workspace name>", so
  // naming the brand here again printed it twice ("แดชบอร์ด | Workspace | Workspace").
  title: 'แดชบอร์ด',
  description:
    'ระบบแดชบอร์ด วันหยุดนักขัตฤกษ์ สภาพอากาศ ราคาน้ำมัน และเครื่องมือต่างๆ ในพื้นที่ทำงานของคุณ',
  keywords: 'dashboard, workspace, holidays, weather, oil prices, qr code',
  alternates: {
    canonical: '/dashboard',
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'แดชบอร์ด | Workspace',
    description: 'ระบบจัดการงานและเครื่องมือต่างๆ ในที่เดียว',
    type: 'website',
  },
};

export default function DashboardLayoutMetadata({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
