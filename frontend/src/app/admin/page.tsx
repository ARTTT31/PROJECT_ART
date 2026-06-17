'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import UserTable from '@/components/Admin/UserTable';
import AuditLogTable from '@/components/Admin/AuditLogTable';
import CreateUserDialog from '@/components/Admin/CreateUserDialog';
import EditUserDialog from '@/components/Admin/EditUserDialog';
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Check authentication and authorization
  useEffect(() => {
    const userData = localStorage.getItem('user');
 
    if (!userData) {
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
  }, [page, user, hasMore]);

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8 bg-slate-50/50 rounded-3xl border border-slate-100">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
              ระบบจัดการสมาชิก
            </h1>
            <p className="text-slate-500 mt-1 sm:mt-2 text-sm sm:text-base font-medium">
              ดูแลสิทธิ์เข้าถึง ติดตามกิจกรรม และจัดการผู้ใช้งานทั้งหมดในระบบ
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="art-primary-button w-full sm:w-auto !min-h-[44px] !px-5 !py-2.5 !text-sm shadow-md shadow-sky-500/20 hover:shadow-lg hover:shadow-sky-500/30 transition-all active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2 font-bold tracking-wide">
                <Plus className="h-4 w-4 stroke-[3]" />
                เพิ่มผู้ใช้งาน
              </span>
            </button>
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-[12px] shadow-[0_4px_12px_rgba(15,23,42,0.02)]">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Users size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">ผู้ใช้ทั้งหมด</p>
              <p className="text-xl font-bold text-slate-900">{stats.totalUsers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-[12px] shadow-[0_4px_12px_rgba(15,23,42,0.02)]">
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">ใช้งาน</p>
              <p className="text-xl font-bold text-slate-900">{stats.activeUsers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-[12px] shadow-[0_4px_12px_rgba(15,23,42,0.02)]">
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <AlertCircle size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">ถูกล็อค</p>
              <p className="text-xl font-bold text-slate-900">{stats.lockedUsers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white border border-slate-200/80 rounded-[12px] shadow-[0_4px_12px_rgba(15,23,42,0.02)]">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Activity size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">ผู้ดูแล</p>
              <p className="text-xl font-bold text-slate-900">{stats.adminUsers}</p>
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-xl text-sky-600 shadow-sm">
              <Users size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">รายชื่อผู้ใช้งานทั้งหมด</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">จัดการบทบาท เปิด/ปิด การเข้าถึง หรือแก้ไขข้อมูลทั่วไป</p>
            </div>
          </div>
          {loading && users.length === 0 ? (
            <div className="premium-card !p-12 text-center rounded-2xl border border-slate-100/80 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500 mx-auto" />
              <p className="text-slate-500 mt-4 font-medium">กำลังโหลดข้อมูลผู้ใช้...</p>
            </div>
          ) : (
            <div className="premium-card rounded-2xl overflow-hidden border border-slate-150 bg-white shadow-sm">
              <UserTable users={users} onEditUser={(u) => { setEditingUser(u); setShowEditDialog(true); }} />
            </div>
          )}
        </section>

        {/* Audit Logs Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-50 border border-purple-100 rounded-xl text-purple-600 shadow-sm">
              <History size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight">ประวัติการทำงานในระบบ (Audit Logs)</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">บันทึกทุกกิจกรรมและคำสั่งการแก้ไขเพื่อความโปร่งใส</p>
            </div>
          </div>
          {loading && auditLogs.length === 0 ? (
            <div className="premium-card !p-12 text-center rounded-2xl border border-slate-100/80 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-500 mx-auto" />
              <p className="text-slate-500 mt-4 font-medium">กำลังโหลดประวัติกิจกรรม...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="premium-card rounded-2xl overflow-hidden border border-slate-150 bg-white shadow-sm">
                <AuditLogTable logs={auditLogs} />
              </div>
              {hasMore && (
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="w-full h-12 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 font-bold text-sm rounded-xl shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? 'กำลังโหลด...' : 'โหลดข้อมูลเพิ่มเติม'}
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

      {/* Edit User Dialog */}
      <EditUserDialog
        isOpen={showEditDialog}
        onClose={() => { setShowEditDialog(false); setEditingUser(null); }}
        onUserUpdated={reloadUsers}
        user={editingUser}
      />
    </DashboardLayout>
  );
}
