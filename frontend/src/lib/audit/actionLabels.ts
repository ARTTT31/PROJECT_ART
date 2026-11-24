/**
 * Thai/English labels for the actions the backend writes to `audit_logs`.
 *
 * Kept in a module (not inside the page) so the regression test can compare it
 * with the `action="…"` strings in the backend endpoints. A new backend action
 * that has no label here would otherwise reach the page as its raw key.
 */
export interface AuditActionLabel {
  th: string;
  en: string;
}

export const ACTION_LABELS: Record<string, AuditActionLabel> = {
  LOGIN_SUCCESS: { th: 'เข้าสู่ระบบ', en: 'Signed in' },
  LOGIN_FAILED: { th: 'เข้าสู่ระบบไม่สำเร็จ', en: 'Sign-in failed' },
  LOGOUT: { th: 'ออกจากระบบ', en: 'Signed out' },
  STEP_UP_VERIFIED: { th: 'ยืนยันตัวตนอีกครั้ง', en: 'Step-up verified' },
  USER_REGISTER: { th: 'สมัครสมาชิก', en: 'Signed up' },
  USER_REGISTER_PENDING: { th: 'สมัครสมาชิก (รออนุมัติ)', en: 'Sign-up (pending approval)' },
  USER_REGISTER_RESUBMIT: { th: 'ส่งคำขอสมัครใหม่', en: 'Sign-up resubmitted' },
  USER_REGISTER_BLOCKED: { th: 'ถูกปฏิเสธการสมัคร', en: 'Sign-up rejected' },
  USER_REGISTER_DUPLICATE: { th: 'สมัครซ้ำ', en: 'Duplicate sign-up' },
  PASSWORD_RESET_REQUESTED: { th: 'ขอลืมรหัสผ่าน', en: 'Password reset requested' },
  PASSWORD_RESET_COMPLETED: { th: 'ตั้งรหัสผ่านใหม่', en: 'Password reset' },
  PASSWORD_CHANGE: { th: 'เปลี่ยนรหัสผ่าน', en: 'Password changed' },
  EMAIL_VERIFIED: { th: 'ยืนยันอีเมล', en: 'Email verified' },
  EMAIL_VERIFICATION_RESENT: { th: 'ส่งอีเมลยืนยันอีกครั้ง', en: 'Verification email resent' },
  PROFILE_UPDATE: { th: 'แก้ไขโปรไฟล์', en: 'Profile updated' },
  UPDATE_QUICK_LINKS: { th: 'แก้ไขลิงก์ด่วน', en: 'Quick links updated' },
  '2FA_ENABLED': { th: 'เปิดใช้งาน 2FA', en: '2FA enabled' },
  '2FA_DISABLED': { th: 'ปิดใช้งาน 2FA', en: '2FA disabled' },
  '2FA_RECOVERY_CODE_USED': { th: 'ใช้รหัสสำรองเข้าใช้งาน', en: 'Recovery code used' },
  TRUSTED_DEVICE_ISSUED: { th: 'จดจำอุปกรณ์ (ข้าม 2FA)', en: 'Device trusted (2FA skipped)' },
  TRUSTED_DEVICE_USED: { th: 'เข้าใช้จากเครื่องที่จดจำไว้', en: 'Signed in from trusted device' },
  TRUST_DEVICE_REVOKED: { th: 'เพิกถอนอุปกรณ์ที่จดจำไว้', en: 'Trusted device revoked' },
  AVATAR_UPLOAD: { th: 'เปลี่ยนรูปโปรไฟล์', en: 'Avatar changed' },
  USER_SELF_DELETE: { th: 'ลบบัญชีตัวเอง', en: 'Account deleted' },
  UPDATE_BRANDING: { th: 'แก้ไขแบรนด์ระบบ', en: 'Branding updated' },
  UPLOAD_BRAND_LOGO: { th: 'เปลี่ยนโลโก้ระบบ', en: 'System logo changed' },
  UPLOAD_WORKSPACE_LOGO: { th: 'เปลี่ยนโลโก้ทีม', en: 'Workspace logo changed' },
  ADMIN_USER_CREATE: { th: 'แอดมินสร้างผู้ใช้', en: 'Admin created user' },
  ADMIN_USER_CREATE_HYBRID: { th: 'แอดมินสร้างผู้ใช้ (กำหนดเอง)', en: 'Admin created user (custom)' },
  ADMIN_USER_UPDATE: { th: 'แอดมินแก้ไขผู้ใช้', en: 'Admin updated user' },
  ADMIN_USER_DELETE: { th: 'แอดมินลบผู้ใช้', en: 'Admin deleted user' },
  ADMIN_USER_PURGE: { th: 'แอดมินลบผู้ใช้ถาวร', en: 'Admin permanently deleted user' },
  ADMIN_USER_RESTORE: { th: 'แอดมินกู้คืนผู้ใช้', en: 'Admin restored user' },
  ADMIN_RESET_2FA: { th: 'แอดมินรีเซ็ต 2FA', en: 'Admin reset 2FA' },
  ADMIN_REVOKE_SESSION: { th: 'แอดมินบังคับออกจากระบบ', en: 'Session revoked by admin' },
  SESSIONS_REVOKED: { th: 'ออกจากอุปกรณ์อื่นทั้งหมด', en: 'Other devices signed out' },
  ADMIN_USER_APPROVE: { th: 'อนุมัติสมาชิก', en: 'Member approved' },
  ADMIN_USER_REJECT: { th: 'ปฏิเสธสมาชิก', en: 'Member rejected' },
  UPDATE_COMPANY_HOLIDAYS: { th: 'บันทึกวันหยุดบริษัท', en: 'Company holidays saved' },
  DELETE_COMPANY_HOLIDAYS: { th: 'ลบปฏิทินวันหยุดบริษัท', en: 'Company holidays deleted' },
  UPDATE_PAGE_ACCESS: { th: 'ตั้งค่าหน้าที่เปิดใช้งาน', en: 'Page access updated' },
  AUDIT_LOG_VIEWED: { th: 'เปิดดูบันทึกกิจกรรม', en: 'Activity log viewed' },
  AUDIT_LOG_EXPORTED: { th: 'ส่งออกบันทึกกิจกรรม (CSV)', en: 'Activity log exported (CSV)' },
};
