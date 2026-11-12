'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { useToast } from '@/components/Toast/ToastProvider';
import { useAuth } from '@/components/Auth/AuthProvider';
import { showConfirm, showDeleteConfirm } from '@/utils/sweetalert';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseAccessiblePages } from '@/utils/accessiblePages';
import PendingRequestsBanner from './PendingRequestsBanner';
import UserCreatePanel from './UserCreatePanel';
import UserEditPanel from './UserEditPanel';
import UserListToolbar from './UserListToolbar';
import UserManagementSkeleton from './UserManagementSkeleton';
import UserTable from './UserTable';
import {
  apiMessage,
  AVAILABLE_PAGES,
  displayLabel,
  PAGE_SIZE,
  statusTitle,
  type AdminUser,
  type CreateUserForm,
  type TrashUser,
} from './userManagementModel';

const emptyCreateForm = (): CreateUserForm => ({
  username: '',
  display_name: '',
  email: '',
  password: '',
  role: 'user',
  pages: AVAILABLE_PAGES.map((p) => p.id),
});

export default function UserManagement() {
  const { success: showSuccess, error: showError } = useToast();
  // The signed-in admin: deleting your own account is refused by the backend
  // ("คุณไม่สามารถลบบัญชีผู้ใช้ของตัวเองได้"), so the row's button says so
  // up front instead of letting the user discover it after a confirm dialog.
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // ── Search / filter / paging ────────────────────────────────────────
  // The search box is debounced so a fast typist does not fire a request per
  // keystroke, and the filters are sent to the API rather than applied to the
  // page in hand — otherwise "no results" would only ever mean "not on this
  // page".
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  // NaN while the API did not report a total: the pager then falls back to
  // "a full page means there may be more".
  const [total, setTotal] = useState(Number.NaN);
  const [trash, setTrash] = useState<TrashUser[]>([]);
  // Sign-up requests waiting for a decision. They are listed by their own
  // endpoint so the queue is visible without hunting for inactive accounts.
  const [pending, setPending] = useState<AdminUser[]>([]);
  const [pendingBusyId, setPendingBusyId] = useState<number | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [resettingTwoFactorId, setResettingTwoFactorId] = useState<number | null>(null);

  const [editRole, setEditRole] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPages, setEditPages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [trashBusyId, setTrashBusyId] = useState<number | null>(null);
  // Learn the real window from the API instead of hard-coding it in the copy.
  const [retentionDays, setRetentionDays] = useState(30);
  const deleteInFlight = useRef(false);
  const trashActionInFlight = useRef(false);

  // ── Create user ─────────────────────────────────────────────────────
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm);
  const [isCreatingSaving, setIsCreatingSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // A new search term or filter is a new result set: start it on page 1.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, roleFilter, statusFilter]);

  const loadUsers = useCallback(async () => {
    setIsFetching(true);
    try {
      if (statusFilter === 'trash') {
        const res = await fetchWithAuth('/api/v1/users/deleted');
        if (res.ok) {
          setTrash(await res.json());
        } else {
          showError('ข้อผิดพลาด', 'ไม่สามารถโหลดรายชื่อที่ถูกลบได้');
        }
        return;
      }

      if (statusFilter === 'pending') {
        const res = await fetchWithAuth('/api/v1/users/pending');
        if (res.ok) {
          setPending(await res.json());
        } else {
          showError('ข้อผิดพลาด', 'ไม่สามารถโหลดคำขอสมัครได้');
        }
        return;
      }

      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      const term = debouncedQuery.trim();
      if (term) params.set('q', term);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter === 'active') params.set('is_active', 'true');
      if (statusFilter === 'suspended') params.set('is_active', 'false');

      const res = await fetchWithAuth(`/api/v1/users/?${params.toString()}`);
      if (!res.ok) {
        showError('ข้อผิดพลาด', 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้');
        return;
      }

      setUsers(await res.json());
      const reported = res.headers.get('X-Total-Count');
      setTotal(reported === null || reported === '' ? Number.NaN : Number(reported));
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetching(false);
      setInitialLoading(false);
    }
  }, [debouncedQuery, roleFilter, statusFilter, page, showError]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const hasNextPage = useMemo(
    () => (Number.isNaN(total) ? users.length === PAGE_SIZE : (page + 1) * PAGE_SIZE < total),
    [total, users.length, page],
  );

  const showPagination = useMemo(() => {
    // Neither the trash nor the approval queue is paged: both are short lists
    // that an admin works through in one pass.
    if (statusFilter === 'trash' || statusFilter === 'pending') return false;
    return page > 0 || hasNextPage || (!Number.isNaN(total) && total > PAGE_SIZE);
  }, [statusFilter, page, hasNextPage, total]);

  const filteredTrash = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    if (!term) return trash;
    return trash.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(term)) ||
        (t.email && t.email.toLowerCase().includes(term)) ||
        (t.username && t.username.toLowerCase().includes(term)),
    );
  }, [trash, debouncedQuery]);

  const filteredPending = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    if (!term) return pending;
    return pending.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.email && p.email.toLowerCase().includes(term)) ||
        (p.username && p.username.toLowerCase().includes(term)),
    );
  }, [pending, debouncedQuery]);

  const pendingInView = useMemo(() => users.filter((u) => u.status === 'pending'), [users]);

  const isFiltered = Boolean(debouncedQuery.trim() || roleFilter || statusFilter);

  const clearFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setRoleFilter('');
    setStatusFilter('');
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditIsActive(user.is_active);
    setEditPages(parseAccessiblePages(user.accessible_pages));
  };

  const closeEdit = () => {
    setEditingUser(null);
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const payload = {
        role: editRole,
        is_active: editIsActive,
        accessible_pages: JSON.stringify(editPages),
      };
      const res = await fetchWithAuth(`/api/v1/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showSuccess('สำเร็จ', 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว');
        loadUsers();
        closeEdit();
      } else {
        const data = await res.json().catch(() => ({}));
        showError('เกิดข้อผิดพลาด', data.detail || 'ไม่สามารถอัปเดตได้');
      }
    } catch (e) {
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Clear an account's TOTP secret and recovery codes.
   *
   * The escape hatch for a user who lost the authenticator AND the recovery
   * codes; without it the only fix is editing the database. The API refuses it
   * for the caller's own account, so an admin cannot strip their own second
   * factor from a stolen session.
   */
  const handleResetTwoFactor = async (user: AdminUser) => {
    const confirmed = await showConfirm(
      'รีเซ็ตการยืนยันสองขั้นตอน?',
      `${displayLabel(user)} จะเข้าสู่ระบบด้วยรหัสผ่านเท่านั้น ` +
        'และรหัสสำรองเดิมทั้งหมดจะใช้ไม่ได้ — ให้ผู้ใช้ตั้งค่า 2FA ใหม่หลังเข้าสู่ระบบ',
    );
    if (!confirmed.isConfirmed) return;

    setResettingTwoFactorId(user.id);
    try {
      const res = await fetchWithAuth(`/api/v1/users/${user.id}/reset-2fa`, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showSuccess('รีเซ็ต 2FA แล้ว', `${displayLabel(user)} เข้าใช้รหัสผ่านอย่างเดียวได้แล้ว`);
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, two_factor_enabled: false } : u)),
        );
        setEditingUser((prev) =>
          prev && prev.id === user.id ? { ...prev, two_factor_enabled: false } : prev,
        );
      } else {
        showError('รีเซ็ตไม่สำเร็จ', data.detail || 'ไม่สามารถรีเซ็ต 2FA ได้');
      }
    } catch {
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setResettingTwoFactorId(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    // One deletion at a time. A ref (not state) is the latch: it must already be
    // set while the confirmation dialog is still open, before any re-render.
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;

    const label = displayLabel(user);
    try {
      const confirmed = await showDeleteConfirm(
        'ลบผู้ใช้งานนี้?',
        `บัญชี "${label}" จะถูกย้ายเข้าถังขยะ: ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์ทันที ` +
          `และกู้คืนได้ภายใน ${retentionDays} วันก่อนระบบลบถาวร`,
      );
      if (!confirmed.isConfirmed) return;

      setDeletingId(user.id);
      const res = await fetchWithAuth(`/api/v1/users/${user.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Drop the row straight away — no need to re-fetch the whole list.
        setUsers((prev) => {
          const next = prev.filter((u) => u.id !== user.id);
          if (next.length === 0 && page > 0) {
            setPage((p) => Math.max(0, p - 1));
          }
          return next;
        });
        setTotal((prev) => (Number.isNaN(prev) ? prev : Math.max(0, prev - 1)));
        const days = data?.data?.retention_days;
        if (typeof days === 'number') setRetentionDays(days);
        showSuccess(
          'ย้ายเข้าถังขยะแล้ว',
          `ลบบัญชี ${label} — กู้คืนได้ในแท็บ "ถังขยะ" ภายใน ${typeof days === 'number' ? days : retentionDays} วัน`,
        );
        return;
      }

      if (res.status === 400) {
        showError('ลบไม่ได้', data.detail || 'คำขอนี้ถูกปฏิเสธ');
      } else if (res.status === 404) {
        showError('ไม่พบผู้ใช้', 'บัญชีนี้อาจถูกลบไปแล้ว — กำลังโหลดรายชื่อใหม่');
        loadUsers();
      } else if (res.status === 429) {
        showError('ทำรายการบ่อยเกินไป', 'กรุณารอสักครู่แล้วลองใหม่อีกครั้ง');
      } else if (res.status === 401 || res.status === 403) {
        showError('ไม่ได้รับอนุญาต', 'เฉพาะผู้ดูแลระบบเท่านั้นที่ลบผู้ใช้ได้');
      } else {
        showError('เกิดข้อผิดพลาด', data.detail || 'ไม่สามารถลบผู้ใช้ได้');
      }
    } catch (e) {
      console.error(e);
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      deleteInFlight.current = false;
      setDeletingId(null);
    }
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm());
    setIsCreating(true);
  };

  const handleCreate = async () => {
    const username = createForm.username.trim();
    const displayName = createForm.display_name.trim();

    // Validate here so the admin gets a sentence instead of a bare 422, and so
    // the round trip is only spent on a request that can succeed.
    if (username.length < 3) {
      showError('ข้อมูลไม่ครบถ้วน', 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!displayName) {
      showError('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อที่แสดง');
      return;
    }
    if (createForm.password.length < 8) {
      showError('ข้อมูลไม่ครบถ้วน', 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (createForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email.trim())) {
      showError('อีเมลไม่ถูกต้อง', 'กรุณาตรวจสอบรูปแบบอีเมลอีกครั้ง');
      return;
    }

    setIsCreatingSaving(true);
    try {
      const res = await fetchWithAuth('/api/v1/users/admin-create', {
        method: 'POST',
        body: JSON.stringify({
          username,
          display_name: displayName,
          password: createForm.password,
          email: createForm.email.trim() || null,
          role: createForm.role,
          accessible_pages: JSON.stringify(createForm.pages),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showSuccess('สร้างผู้ใช้สำเร็จ', `เพิ่มบัญชี ${username} เรียบร้อยแล้ว`);
        setIsCreating(false);
        clearFilters();
        await loadUsers();
        return;
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถสร้างผู้ใช้ได้'));
    } catch (e) {
      console.error(e);
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsCreatingSaving(false);
    }
  };

  /** Approve a sign-up request: the account becomes usable immediately. */
  const handleApprove = async (user: AdminUser) => {
    if (pendingBusyId !== null) return;
    setPendingBusyId(user.id);
    try {
      const res = await fetchWithAuth(`/api/v1/users/${user.id}/approve`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setPending((prev) => prev.filter((u) => u.id !== user.id));
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: 'active', is_active: true } : u)),
        );
        showSuccess('อนุมัติแล้ว', `${displayLabel(user)} เข้าใช้งานได้ทันที`);
        return;
      }

      if (res.status === 404) {
        showError('ไม่พบคำขอนี้', 'คำขอนี้อาจถูกตัดสินไปแล้ว — กำลังโหลดรายการใหม่');
        await loadUsers();
        return;
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถอนุมัติได้'));
    } catch (e) {
      console.error(e);
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setPendingBusyId(null);
    }
  };

  /** Refuse a sign-up request. It stays on record, but can never sign in. */
  const handleReject = async (user: AdminUser) => {
    if (pendingBusyId !== null) return;

    const label = displayLabel(user);
    const confirmed = await showDeleteConfirm(
      'ปฏิเสธคำขอสมัครนี้?',
      `บัญชี "${label}" จะไม่สามารถเข้าสู่ระบบได้ — บันทึกไว้เป็นคำขอที่ถูกปฏิเสธ ` +
        'และเจ้าของอีเมลนี้สามารถยื่นคำขอใหม่ได้',
    );
    if (!confirmed.isConfirmed) return;

    setPendingBusyId(user.id);
    try {
      const res = await fetchWithAuth(`/api/v1/users/${user.id}/reject`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setPending((prev) => prev.filter((u) => u.id !== user.id));
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: 'rejected', is_active: false } : u)),
        );
        showSuccess('ปฏิเสธคำขอแล้ว', `${label} จะไม่สามารถเข้าสู่ระบบได้`);
        return;
      }

      if (res.status === 404) {
        showError('ไม่พบคำขอนี้', 'คำขอนี้อาจถูกตัดสินไปแล้ว — กำลังโหลดรายการใหม่');
        await loadUsers();
        return;
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถปฏิเสธคำขอได้'));
    } catch (e) {
      console.error(e);
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setPendingBusyId(null);
    }
  };

  /** Approve every request on the current page in one pass. */
  const handleBulkApprove = async () => {
    if (bulkApproving || pendingInView.length === 0) return;
    setBulkApproving(true);
    try {
      for (const candidate of pendingInView) {
        await fetchWithAuth(`/api/v1/users/${candidate.id}/approve`, {
          method: 'POST',
        });
      }
    } finally {
      setBulkApproving(false);
      // Re-filtering is what refetches the list for this view.
      setStatusFilter('pending');
    }
  };

  const handleRestore = async (user: TrashUser) => {
    if (trashActionInFlight.current) return;
    trashActionInFlight.current = true;

    const label = displayLabel(user);
    setTrashBusyId(user.id);
    try {
      const res = await fetchWithAuth(`/api/v1/users/${user.id}/restore`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setTrash((prev) => prev.filter((u) => u.id !== user.id));
        showSuccess('กู้คืนผู้ใช้สำเร็จ', `${label} กลับมาใช้งานได้ตามปกติแล้ว`);
        return;
      }

      if (res.status === 404) {
        showError('ไม่พบบัญชีในถังขยะ', 'บัญชีนี้อาจถูกลบถาวรไปแล้ว — กำลังโหลดรายการใหม่');
        await loadUsers();
        return;
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถกู้คืนผู้ใช้ได้'));
    } catch (e) {
      console.error(e);
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      trashActionInFlight.current = false;
      setTrashBusyId(null);
    }
  };

  /** The one irreversible action: only reachable from the trash, by design. */
  const handlePurge = async (user: TrashUser) => {
    if (trashActionInFlight.current) return;

    const label = displayLabel(user);
    const confirmed = await showDeleteConfirm(
      'ลบบัญชีนี้ถาวร?',
      `บัญชี "${label}" และประวัติเซสชันจะถูกลบออกจากฐานข้อมูลทันที ` +
        'และกู้คืนไม่ได้อีก (ประวัติการใช้งานใน Audit Log จะยังอยู่)',
    );
    if (!confirmed.isConfirmed) return;

    trashActionInFlight.current = true;
    setTrashBusyId(user.id);
    try {
      const res = await fetchWithAuth(`/api/v1/users/${user.id}?purge=true`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setTrash((prev) => prev.filter((u) => u.id !== user.id));
        showSuccess('ลบถาวรสำเร็จ', `ลบบัญชี ${label} ออกจากระบบแล้ว`);
        return;
      }

      showError(statusTitle(res.status), apiMessage(data, 'ไม่สามารถลบถาวรได้'));
    } catch (e) {
      console.error(e);
      showError('ไม่สามารถเชื่อมต่อได้', 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      trashActionInFlight.current = false;
      setTrashBusyId(null);
    }
  };

  if (initialLoading) {
    return <UserManagementSkeleton />;
  }

  return (
    <div className="space-y-4">
      {editingUser ? (
        <UserEditPanel
          user={editingUser}
          currentUserId={currentUser?.id}
          role={editRole}
          onRoleChange={setEditRole}
          isActive={editIsActive}
          onIsActiveChange={setEditIsActive}
          isSaving={isSaving}
          resettingTwoFactorId={resettingTwoFactorId}
          onSave={handleSave}
          onCancel={closeEdit}
          onResetTwoFactor={handleResetTwoFactor}
        />
      ) : isCreating ? (
        <UserCreatePanel
          form={createForm}
          onFormChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
          isSaving={isCreatingSaving}
          onSave={handleCreate}
          onCancel={() => setIsCreating(false)}
        />
      ) : (
        <>
          {statusFilter !== 'pending' && pendingInView.length > 0 && (
            <PendingRequestsBanner
              count={pendingInView.length}
              bulkApproving={bulkApproving}
              onBulkApprove={handleBulkApprove}
              onFilterPending={() => setStatusFilter('pending')}
            />
          )}

          <UserListToolbar
            query={query}
            onQueryChange={setQuery}
            isFetching={isFetching}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            isFiltered={isFiltered}
            onClearFilters={clearFilters}
            users={users}
            onCreate={openCreate}
          />

          <UserTable
            statusFilter={statusFilter}
            isFetching={isFetching}
            users={users}
            filteredTrash={filteredTrash}
            filteredPending={filteredPending}
            currentUser={currentUser}
            deletingId={deletingId}
            pendingBusyId={pendingBusyId}
            trashBusyId={trashBusyId}
            isFiltered={isFiltered}
            debouncedQuery={debouncedQuery}
            onRestore={handleRestore}
            onPurge={handlePurge}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={openEdit}
            onDelete={handleDelete}
          />

          {showPagination && (
            <div className="flex flex-col gap-3 rounded-apple-lg border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[13px] font-medium text-[var(--ink-muted)]">
                {statusFilter === 'trash'
                  ? debouncedQuery.trim()
                    ? `พบ ${filteredTrash.length} บัญชีในถังขยะ`
                    : `${trash.length} บัญชีในถังขยะ`
                  : Number.isNaN(total)
                    ? `หน้า ${page + 1}`
                    : `พบ ${total} บัญชี · หน้า ${page + 1} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}
              </span>
              {statusFilter !== 'trash' && (
                <div className="inline-flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                    disabled={page === 0}
                    aria-label="หน้าก่อนหน้า"
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-grouped)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink)] transition-all hover:bg-[var(--surface-chip-2)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={13} /> ก่อนหน้า
                  </button>
                  <button
                    onClick={() => setPage((prev) => prev + 1)}
                    disabled={!hasNextPage}
                    aria-label="หน้าถัดไป"
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-grouped)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink)] transition-all hover:bg-[var(--surface-chip-2)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ถัดไป <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
