'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock, LogIn, Shield } from 'lucide-react';

/**
 * "Your request was received" screen for deployments that approve sign-ups by
 * hand. Shared by /register and /login so both show the same three-step story:
 * received → waiting for an admin → can sign in.
 */
export default function ApprovalPending({
  email,
  title = 'ส่งคำขอสมัครสมาชิกสำเร็จแล้ว',
  lead,
  note,
  onBack,
}: {
  email: string;
  title?: string;
  lead?: ReactNode;
  note?: string;
  onBack: () => void;
}) {
  return (
    <div className="auth-state" role="status" aria-live="polite">
      <span className="auth-state-icon" aria-hidden="true">
        <CheckCircle2 size={30} strokeWidth={2.2} />
      </span>

      <h2 className="auth-state-title">{title}</h2>
      <p className="auth-state-text">
        {lead ?? (
          <>
            เราได้รับคำขอของ <strong>{email}</strong> เรียบร้อยแล้ว
          </>
        )}
      </p>

      <ol className="auth-steps">
        <li className="auth-step auth-step--done">
          <span className="auth-step-marker" aria-hidden="true">
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="auth-step-body">
            <span className="auth-step-title">รับคำขอเรียบร้อย</span>
            <span className="auth-step-text">ระบบบันทึกข้อมูลบัญชีของคุณแล้ว</span>
          </span>
        </li>

        <li className="auth-step auth-step--current">
          <span className="auth-step-marker" aria-hidden="true">
            <Clock size={13} strokeWidth={2.4} />
          </span>
          <span className="auth-step-body">
            <span className="auth-step-title">รอผู้ดูแลระบบอนุมัติ</span>
            <span className="auth-step-text">ระบบนี้กำหนดให้แอดมินอนุมัติก่อนเข้าใช้งาน</span>
          </span>
        </li>

        <li className="auth-step">
          <span className="auth-step-marker" aria-hidden="true">
            <LogIn size={13} strokeWidth={2.4} />
          </span>
          <span className="auth-step-body">
            <span className="auth-step-title">เข้าใช้งานได้ทันที</span>
            <span className="auth-step-text">เข้าสู่ระบบด้วยอีเมลนี้เมื่อได้รับอนุมัติ</span>
          </span>
        </li>
      </ol>

      <div className="auth-note">
        <Shield size={15} className="auth-note-icon" aria-hidden="true" />
        <p className="auth-note-text">
          {note ?? 'เมื่อผู้ดูแลระบบอนุมัติแล้ว บัญชีจะใช้งานได้ทันที และเราจะแจ้งผลให้ทราบทางอีเมล'}
        </p>
      </div>

      <div className="auth-actions">
        <button type="button" className="login-submit" onClick={onBack}>
          <span>กลับไปหน้าเข้าสู่ระบบ</span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
