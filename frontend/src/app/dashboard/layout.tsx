import { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://project-art-sigma.vercel.app'),
  title: 'แดชบอร์ด | ART Workspace',
  description: 'ระบบแดชบอร์ด วันหยุดนักขัตฤกษ์ สภาพอากาศ ราคาน้ำมัน และเครื่องมือต่างๆ ของ ART Workspace',
  keywords: 'dashboard, art workspace, holidays, weather, oil prices, qr code',
  alternates: {
    canonical: '/dashboard',
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: 'แดชบอร์ด | ART Workspace',
    description: 'ระบบจัดการงานและเครื่องมือต่างๆ ในที่เดียว',
    type: 'website',
  },
}

export default function DashboardLayoutMetadata({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
