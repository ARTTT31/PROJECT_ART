'use client';

import { Download, Loader2, Search, UserPlus } from 'lucide-react';
import { datedFilename, downloadCsv, toCsv } from '@/lib/csv';
import { showConfirm } from '@/utils/sweetalert';
import FilterDropdown from './FilterDropdown';
import { ROLE_OPTIONS, STATUS_OPTIONS, type AdminUser } from './userManagementModel';

export default function UserListToolbar({
  query,
  onQueryChange,
  isFetching,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  isFiltered,
  onClearFilters,
  users,
  onCreate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  isFetching: boolean;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  isFiltered: boolean;
  onClearFilters: () => void;
  users: AdminUser[];
  onCreate: () => void;
}) {
  const handleExport = async () => {
    const confirmed = await showConfirm(
      'ส่งออกรายชื่อผู้ใช้?',
      `จะส่งออก ${users.length} รายการตามตัวกรองที่เห็นอยู่เป็นไฟล์ CSV`,
    );
    if (!confirmed.isConfirmed) return;

    const table = users as unknown as Array<Record<string, unknown>>;
    const rows = table.map((entry) => [
      String(entry.name ?? ''),
      String(entry.username ?? ''),
      String(entry.email ?? ''),
      String(entry.role ?? ''),
      String(entry.status ?? 'active'),
      String(entry.created_at ?? ''),
    ]);
    downloadCsv(
      datedFilename('users'),
      toCsv(['ชื่อ', 'ชื่อผู้ใช้', 'อีเมล', 'สิทธิ์', 'สถานะ', 'สร้างเมื่อ'], rows),
    );
  };

  return (
    <div className="relative z-20 flex flex-col gap-3 rounded-[18px] border border-[var(--hairline)] bg-[var(--surface)] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          {isFetching ? (
            <Loader2
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--accent-text)]"
            />
          ) : (
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]"
            />
          )}
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="ค้นหาชื่อ อีเมล หรือชื่อผู้ใช้"
            aria-label="ค้นหาผู้ใช้"
            style={{
              paddingLeft: '2.75rem',
              borderRadius: '9999px',
              minHeight: '42px',
              height: '42px',
            }}
            className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface-grouped)] pr-4 text-[13px] font-medium text-[var(--ink)] outline-hidden transition-all placeholder:text-[var(--ink-tertiary)] focus:bg-[var(--surface)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
          <FilterDropdown
            ariaLabel="กรองตามสิทธิ์"
            value={roleFilter}
            onChange={onRoleFilterChange}
            options={ROLE_OPTIONS}
          />
          <FilterDropdown
            ariaLabel="กรองตามสถานะ"
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={STATUS_OPTIONS}
            align="right"
            textOnly
          />
        </div>
        {isFiltered && (
          <button
            type="button"
            onClick={onClearFilters}
            className="sr-only"
            aria-label="ล้างตัวกรอง"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleExport}
        disabled={users.length === 0}
        style={{ minHeight: '42px', height: '42px' }}
        className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--surface-grouped)] px-5 text-[13px] font-bold text-[var(--ink)] transition-all hover:bg-[var(--surface-chip)] active:scale-95 disabled:opacity-40"
        title="ส่งออกรายชื่อตามตัวกรองที่เห็นอยู่"
      >
        <Download size={14} aria-hidden="true" /> ส่งออก CSV
      </button>
      <button
        onClick={onCreate}
        style={{ minHeight: '42px', height: '42px' }}
        className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-[13px] font-bold text-white shadow-xs transition-all hover:bg-[var(--accent-hover)] active:scale-95"
      >
        <UserPlus size={14} /> เพิ่มผู้ใช้
      </button>
    </div>
  );
}
