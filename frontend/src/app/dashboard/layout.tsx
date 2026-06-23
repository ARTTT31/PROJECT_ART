import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'แดชบอร์ด | ART Workspace',
  description: 'ระบบจัดการงาน, ปฏิทิน, ราคาน้ำมัน และเครื่องมือต่างๆ ของ ART Workspace',
  keywords: 'dashboard, art workspace, task management, calendar, oil prices, qr code',
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
