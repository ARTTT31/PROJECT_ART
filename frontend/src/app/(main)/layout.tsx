import DashboardLayout from '@/components/Layout/DashboardLayout'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayout>{children}</DashboardLayout>
}
