'use client'

import { useMemo } from 'react'
import { History, User, Clock, FileText } from 'lucide-react'

interface AuditLog {
  id: number
  user_id?: number
  action: string
  details?: string
  ip_address?: string
  user_agent?: string
  created_at: string
  user?: {
    id: number
    name: string
    email: string
  }
}

interface AuditLogTableProps {
  logs: AuditLog[]
}

const actionColors: Record<string, { bg: string; text: string; icon: string }> = {
  'USER_LOGIN': { bg: 'bg-blue-100/50', text: 'text-blue-700', icon: '🔓' },
  'USER_LOGOUT': { bg: 'bg-gray-100/50', text: 'text-gray-700', icon: '🔒' },
  'ADMIN_USER_CREATE': { bg: 'bg-green-100/50', text: 'text-green-700', icon: '➕' },
  'ADMIN_USER_UPDATE': { bg: 'bg-yellow-100/50', text: 'text-yellow-700', icon: '✏️' },
  'ADMIN_USER_DELETE': { bg: 'bg-red-100/50', text: 'text-red-700', icon: '❌' },
}

const getActionConfig = (action: string) => {
  return actionColors[action] || { bg: 'bg-slate-100/50', text: 'text-slate-700', icon: '📋' }
}

const getThaiActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    'USER_LOGIN': 'เข้าสู่ระบบ',
    'USER_LOGOUT': 'ออกจากระบบ',
    'ADMIN_USER_CREATE': 'สร้างผู้ใช้',
    'ADMIN_USER_UPDATE': 'อัพเดตผู้ใช้',
    'ADMIN_USER_DELETE': 'ลบผู้ใช้',
  }
  return labels[action] || action
}

export default function AuditLogTable({ logs }: AuditLogTableProps) {
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [logs])

  if (!logs || logs.length === 0) {
    return (
      <div className="p-12 text-center">
        <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">ไม่พบประวัติกิจกรรม</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">เวลา</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">ผู้ใช้</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">การกระทำ</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">รายละเอียด</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">IP Address</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedLogs.map((log) => {
            const config = getActionConfig(log.action)
            return (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-slate-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-900">
                      {new Date(log.created_at).toLocaleDateString('th-TH', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric'
                      })}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-200/50 flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {log.user ? log.user.name : 'ระบบ'}
                      </p>
                      {log.user && (
                        <p className="text-xs text-slate-500 truncate">{log.user.email}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${config.bg} ${config.text} border-current border-opacity-20`}>
                    <span>{config.icon}</span>
                    {getThaiActionLabel(log.action)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 max-w-xs">
                  {log.details ? (
                    <div className="flex items-start gap-2">
                      <FileText size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="truncate">{log.details}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                  {log.ip_address ? (
                    <span className="px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-medium">{log.ip_address}</span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
