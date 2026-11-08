'use client';

import {
  Clock,
  Loader2,
  RotateCcw,
  Settings,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  displayLabel,
  formatDateTime,
  remainingLabel,
  type AdminUser,
  type TrashUser,
} from './userManagementModel';

export default function UserTable({
  statusFilter,
  isFetching,
  users,
  filteredTrash,
  filteredPending,
  currentUser,
  deletingId,
  pendingBusyId,
  trashBusyId,
  isFiltered,
  debouncedQuery,
  onRestore,
  onPurge,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: {
  statusFilter: string;
  isFetching: boolean;
  users: AdminUser[];
  filteredTrash: TrashUser[];
  filteredPending: AdminUser[];
  currentUser?: { id: number } | null;
  deletingId: number | null;
  pendingBusyId: number | null;
  trashBusyId: number | null;
  isFiltered: boolean;
  debouncedQuery: string;
  onRestore: (user: TrashUser) => void;
  onPurge: (user: TrashUser) => void;
  onApprove: (user: AdminUser) => void;
  onReject: (user: AdminUser) => void;
  onEdit: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] min-h-[420px]">
      <div
        className={`h-0.5 w-full bg-[var(--accent)] transition-all duration-300 ${isFetching ? 'opacity-100 animate-pulse' : 'opacity-0'}`}
      />
      <div className="overflow-x-auto min-h-[340px]">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[var(--surface-subtle)] text-[var(--ink-muted)] text-[12px] font-bold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-4 border-b border-[var(--hairline-soft)]">ชื่อผู้ใช้</th>
              <th className="px-5 py-4 border-b border-[var(--hairline-soft)]">สิทธิ์</th>
              {statusFilter === 'trash' ? (
                <>
                  <th className="px-5 py-4 border-b border-[var(--hairline-soft)]">ลบเมื่อ</th>
                  <th className="px-5 py-4 border-b border-[var(--hairline-soft)]">เหลือเวลา</th>
                </>
              ) : (
                <th className="px-5 py-4 border-b border-[var(--hairline-soft)]">สถานะ</th>
              )}
              <th className="px-5 py-4 border-b border-[var(--hairline-soft)] text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody
            className={`divide-y divide-[var(--hairline)] transition-opacity duration-200 ${isFetching ? 'opacity-50' : 'opacity-100'}`}
          >
            {statusFilter === 'trash'
              ? filteredTrash.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[var(--ink)] text-[14px]">{t.name}</div>
                      <div className="text-[13px] text-[var(--ink-muted)] mt-0.5">
                        {t.email || t.username}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {t.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                          <ShieldAlert size={11} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/20">
                          <User size={11} /> User
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[13px] font-medium text-[var(--ink-muted)]">
                      {formatDateTime(t.deleted_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                          t.days_remaining <= 3
                            ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                            : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                        }`}
                      >
                        {remainingLabel(t.days_remaining)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onRestore(t)}
                          disabled={trashBusyId === t.id}
                          aria-label={`กู้คืนผู้ใช้ ${displayLabel(t)}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--accent-text)] transition-all hover:bg-[var(--accent-soft)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {trashBusyId === t.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <RotateCcw size={12} />
                          )}
                          กู้คืน
                        </button>
                        <button
                          onClick={() => onPurge(t)}
                          disabled={trashBusyId === t.id}
                          aria-label={`ลบถาวร ${displayLabel(t)}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 size={12} /> ลบถาวร
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              : statusFilter === 'pending'
                ? filteredPending.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[var(--ink)] text-[14px]">{p.name}</div>
                        <div className="text-[13px] text-[var(--ink-muted)] mt-0.5">
                          {p.email || p.username}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {p.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                            <ShieldAlert size={11} /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/20">
                            <User size={11} /> User
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          <Clock size={11} /> รออนุมัติ
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => onApprove(p)}
                            disabled={pendingBusyId === p.id}
                            aria-label={`อนุมัติคำขอของ ${displayLabel(p)}`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold text-white transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {pendingBusyId === p.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <UserCheck size={12} />
                            )}
                            อนุมัติ
                          </button>
                          <button
                            onClick={() => onReject(p)}
                            disabled={pendingBusyId === p.id}
                            aria-label={`ปฏิเสธคำขอของ ${displayLabel(p)}`}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <UserX size={12} /> ปฏิเสธ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : users.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[var(--ink)] text-[14px]">{u.name}</div>
                          <div className="text-[13px] text-[var(--ink-muted)] mt-0.5">
                            {u.email || u.username}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 ring-1 ring-inset ring-purple-600/20">
                              <ShieldAlert size={11} /> Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/20">
                              <User size={11} /> User
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {u.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                              <Clock size={11} /> รออนุมัติ
                            </span>
                          ) : u.is_active ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              ปกติ
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20">
                              ระงับบัญชี
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {u.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => onApprove(u)}
                                  disabled={pendingBusyId === u.id}
                                  aria-label={`อนุมัติคำขอของ ${displayLabel(u)}`}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-bold text-white transition-all hover:bg-[var(--accent-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 shadow-xs"
                                >
                                  {pendingBusyId === u.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <UserCheck size={12} />
                                  )}
                                  อนุมัติ
                                </button>
                                <button
                                  onClick={() => onReject(u)}
                                  disabled={pendingBusyId === u.id}
                                  aria-label={`ปฏิเสธคำขอของ ${displayLabel(u)}`}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <UserX size={12} /> ปฏิเสธ
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => onEdit(u)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--surface-grouped)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink)] transition-all hover:bg-[var(--surface-chip-2)] active:scale-95"
                                >
                                  <Settings size={12} /> ตั้งค่า
                                </button>
                                <button
                                  onClick={() => onDelete(u)}
                                  disabled={isSelf || deletingId === u.id}
                                  title={
                                    isSelf
                                      ? 'ไม่สามารถลบบัญชีของตัวเองได้'
                                      : `ลบผู้ใช้ ${displayLabel(u)}`
                                  }
                                  aria-label={`ลบผู้ใช้ ${displayLabel(u)}`}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-[12px] font-bold text-rose-700 ring-1 ring-inset ring-rose-600/20 transition-all hover:bg-rose-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-50"
                                >
                                  {deletingId === u.id ? (
                                    <>
                                      <Loader2 size={12} className="animate-spin" /> กำลังลบ...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 size={12} /> ลบ
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            {statusFilter === 'trash'
              ? filteredTrash.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-[13px] font-medium text-[var(--ink-muted)]"
                    >
                      {isFetching ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 size={15} className="animate-spin text-[var(--accent-text)]" />{' '}
                          กำลังโหลดข้อมูล...
                        </span>
                      ) : debouncedQuery.trim() ? (
                        'ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข'
                      ) : (
                        'ยังไม่มีบัญชีในถังขยะ'
                      )}
                    </td>
                  </tr>
                )
              : statusFilter === 'pending'
                ? filteredPending.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-[13px] font-medium text-[var(--ink-muted)]"
                      >
                        {isFetching ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={15} className="animate-spin text-[var(--accent-text)]" />{' '}
                            กำลังโหลดข้อมูล...
                          </span>
                        ) : debouncedQuery.trim() ? (
                          'ไม่พบคำขอที่ตรงกับเงื่อนไข'
                        ) : (
                          'ยังไม่มีคำขอสมัครที่รออนุมัติ'
                        )}
                      </td>
                    </tr>
                  )
                : users.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-10 text-center text-[13px] font-medium text-[var(--ink-muted)]"
                      >
                        {isFetching ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 size={15} className="animate-spin text-[var(--accent-text)]" />{' '}
                            กำลังโหลดข้อมูล...
                          </span>
                        ) : isFiltered ? (
                          'ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข'
                        ) : (
                          'ยังไม่มีผู้ใช้งานในระบบ'
                        )}
                      </td>
                    </tr>
                  )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
