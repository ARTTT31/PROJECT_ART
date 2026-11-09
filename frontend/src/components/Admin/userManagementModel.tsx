import type { ReactNode } from 'react';
import { ShieldAlert, User } from 'lucide-react';

// Define a simplified User type for admin management
export interface AdminUser {
  id: number;
  email: string | null;
  username: string | null;
  name: string;
  role: string;
  is_active: boolean;
  /** Whether this account signs in with a TOTP second factor. */
  two_factor_enabled?: boolean;
  accessible_pages: string | null;
  deleted_at?: string | null;
  /** Sign-up lifecycle: null (normal), 'pending', 'rejected'. */
  status?: string | null;
  /** Last successful sign-in, ISO string. */
  last_login?: string | null;
  /** Live devices for this account, counted by the admin list endpoint. */
  active_sessions?: number;
}

/** A soft-deleted account, as returned by `GET /api/v1/users/deleted`. */
export interface TrashUser extends AdminUser {
  deleted_at: string;
  days_remaining: number;
  purge_at: string;
}

/** Admin-created account form state. */
export interface CreateUserForm {
  username: string;
  display_name: string;
  email: string;
  password: string;
  role: string;
  pages: string[];
}

export const AVAILABLE_PAGES = [
  { id: 'dashboard', label: 'หน้าหลัก (Dashboard)' },
  { id: 'profile', label: 'หน้าโปรไฟล์ (Profile)' },
  { id: 'camera', label: 'กล้อง (Camera)' },
];

export const PAGE_SIZE = 10;

/** Thai label for a trash row's remaining restore window. */
export const remainingLabel = (days: number) =>
  days <= 0 ? 'หมดเวลาแล้ว' : `กู้คืนได้อีก ${days} วัน`;

/**
 * Format an API timestamp for the trash table. The backend stores naive UTC, so
 * a value without a zone suffix is read as UTC — without that, a deletion made
 * this morning shows up as yesterday evening in a UTC+7 browser.
 */
export const formatDateTime = (value: string): string => {
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/** Short Thai title for an HTTP failure, shared by the action handlers. */
export const statusTitle = (status: number): string => {
  if (status === 400) return 'ทำรายการไม่ได้';
  if (status === 401 || status === 403) return 'ไม่ได้รับอนุญาต';
  if (status === 404) return 'ไม่พบข้อมูล';
  if (status === 409) return 'ข้อมูลซ้ำ';
  if (status === 422) return 'ข้อมูลไม่ถูกต้อง';
  if (status === 429) return 'ทำรายการบ่อยเกินไป';
  return 'เกิดข้อผิดพลาด';
};

/**
 * Readable message out of an API error body. FastAPI answers validation
 * failures with `detail` as a list of field errors, while our own handlers send
 * a plain string — the create form surfaces both.
 */
export const apiMessage = (data: unknown, fallback: string): string => {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; loc?: unknown[] };
    if (first?.msg) {
      const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : undefined;
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  }
  return fallback;
};

/** Human-readable identifier for confirm dialogs, toasts and aria-labels. */
export const displayLabel = (u: AdminUser) => u.email || u.username || u.name;

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export const ROLE_OPTIONS: FilterOption[] = [
  { value: '', label: 'ทุกสิทธิ์', icon: <User size={13} className="text-[var(--ink-tertiary)]" /> },
  { value: 'admin', label: 'Admin', icon: <ShieldAlert size={13} className="text-purple-600" /> },
  { value: 'user', label: 'User', icon: <User size={13} className="text-slate-600" /> },
];

// Status filter is text-only on purpose: the coloured dots and icons added
// noise to a short list the admin reads at a glance.
export const STATUS_OPTIONS: FilterOption[] = [
  { value: '', label: 'ทุกสถานะ' },
  { value: 'active', label: 'ใช้งานปกติ' },
  { value: 'suspended', label: 'ระงับบัญชี' },
  { value: 'pending', label: 'รออนุมัติ' },
  { value: 'trash', label: 'ถังขยะ (ลบแล้ว)' },
];
