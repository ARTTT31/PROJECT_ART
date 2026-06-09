'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import UserTable from '@/components/Admin/UserTable';
import AuditLogTable from '@/components/Admin/AuditLogTable';
import CreateUserDialog from '@/components/Admin/CreateUserDialog';
import { Users, History, AlertCircle, CheckCircle2, Activity, Plus } from 'lucide-react'
import { apiClient } from '@/lib/api/client';

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    lockedUsers: 0,
    adminUsers: 0,
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Check authentication and authorization
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setUser(parsedUser);
    } catch (err) {
      router.push('/login');
    }
  }, [router]);

  // Load users once
  useEffect(() => {
    if (!user) return;

    console.log('👤 Loading users... User role:', user.role);
    
    apiClient
      .get('/users')
      .then((response) => {
        console.log('✅ Users loaded:', response.data);
        const fetchedUsers = response.data;
        setUsers(fetchedUsers);
        // Calculate stats
        setStats({
          totalUsers: fetchedUsers.length,
          activeUsers: fetchedUsers.filter((u: any) => u.is_active).length,
          lockedUsers: fetchedUsers.filter((u: any) => u.is_locked).length,
          adminUsers: fetchedUsers.filter((u: any) => u.role === 'admin').length,
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('❌ Error fetching users:', err?.response?.status, err?.message);
        setError('Failed to load users');
        setLoading(false);
      });
  }, [user]);

  // Reload users function
  const reloadUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      const fetchedUsers = response.data;
      setUsers(fetchedUsers);
      setStats({
        totalUsers: fetchedUsers.length,
        activeUsers: fetchedUsers.filter((u: any) => u.is_active).length,
        lockedUsers: fetchedUsers.filter((u: any) => u.is_locked).length,
        adminUsers: fetchedUsers.filter((u: any) => u.role === 'admin').length,
      });
    } catch (err) {
      console.error('Error reloading users:', err);
    }
  };

  // Load audit logs with infinite scroll
  useEffect(() => {
    if (!user || !hasMore) return;

    apiClient
      .get(`/audit/paginated?page=${page}&size=20`)
      .then((response) => {
        const data = response.data;
        setAuditLogs((prev) => [...prev, ...data.items]);
        setHasMore(data.hasNext);
        if (data.hasNext) setPage((p) => p + 1);
      })
      .catch((err) => {
        console.error('Error fetching audit logs:', err);
        setError('Failed to load audit logs');
      })
      .finally(() => setLoading(false));
  }, [page, user]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">ระบบจัดการ</h1>
            <p className="text-slate-500 mt-2 font-medium">จัดการผู้ใช้และติดตามกิจกรรม</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              สร้างผู้ใช้
            </button>
            {error && (
              <div className="flex items-center gap-3 bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-2xl backdrop-blur-sm">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="premium-card !p-5 flex flex-col rounded-2xl hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-600 font-medium text-sm">ผู้ใช้ทั้งหมด</p>
              <div className="p-2.5 bg-blue-100/50 rounded-xl text-blue-600">
                <Users size={18} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.totalUsers}</div>
            <p className="text-xs text-slate-400 mt-2">จำนวนผู้ใช้ทั้งหมดในระบบ</p>
          </div>

          <div className="premium-card !p-5 flex flex-col rounded-2xl hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-600 font-medium text-sm">ผู้ใช้ทีใช้งาน</p>
              <div className="p-2.5 bg-green-100/50 rounded-xl text-green-600">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.activeUsers}</div>
            <p className="text-xs text-slate-400 mt-2">ผู้ใช้งานปกติ</p>
          </div>

          <div className="premium-card !p-5 flex flex-col rounded-2xl hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-600 font-medium text-sm">ผู้ใช้ถูกล็อค</p>
              <div className="p-2.5 bg-red-100/50 rounded-xl text-red-600">
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.lockedUsers}</div>
            <p className="text-xs text-slate-400 mt-2">ผู้ใช้ถูกล็อคการเข้าถึง</p>
          </div>

          <div className="premium-card !p-5 flex flex-col rounded-2xl hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <p className="text-slate-600 font-medium text-sm">ผู้ดูแลระบบ</p>
              <div className="p-2.5 bg-amber-100/50 rounded-xl text-amber-600">
                <Activity size={18} />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{stats.adminUsers}</div>
            <p className="text-xs text-slate-400 mt-2">ผู้ดูแลระบบ</p>
          </div>
        </div>

        {/* User Management Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-100/50 rounded-xl text-sky-600">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้</h2>
              <p className="text-sm text-slate-500">แสดงรายการผู้ใช้ทั้งหมด</p>
            </div>
          </div>
          {loading && users.length === 0 ? (
            <div className="premium-card !p-12 text-center rounded-2xl">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500 mx-auto" />
              <p className="text-slate-500 mt-4">กำลังโหลดข้อมูลผู้ใช้...</p>
            </div>
          ) : (
            <div className="premium-card rounded-2xl overflow-hidden">
              <UserTable users={users} />
            </div>
          )}
        </section>

        {/* Audit Logs Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100/50 rounded-xl text-purple-600">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">ประวัติกิจกรรม</h2>
              <p className="text-sm text-slate-500">บันทึกการกระทำของผู้ใช้ทั้งหมด</p>
            </div>
          </div>
          {loading && auditLogs.length === 0 ? (
            <div className="premium-card !p-12 text-center rounded-2xl">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500 mx-auto" />
              <p className="text-slate-500 mt-4">กำลังโหลดประวัติกิจกรรม...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="premium-card rounded-2xl overflow-hidden">
                <AuditLogTable logs={auditLogs} />
              </div>
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-500 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-sky-500/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Create User Dialog */}
      <CreateUserDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onUserCreated={reloadUsers}
      />
    </DashboardLayout>
  );
}
