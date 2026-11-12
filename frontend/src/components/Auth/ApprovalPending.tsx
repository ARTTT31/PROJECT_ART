'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock, LogIn, Shield } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

/**
 * "Your request was received" screen for deployments that approve sign-ups by
 * hand. Shared by /register and /login so both show the same three-step story:
 * received → waiting for an admin → can sign in.
 */
export default function ApprovalPending({
  email,
  title,
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
  const { tr } = useI18n();

  return (
    <div className="auth-state" role="status" aria-live="polite">
      <span className="auth-state-icon" aria-hidden="true">
        <CheckCircle2 size={30} strokeWidth={2.2} />
      </span>

      <h2 className="auth-state-title">
        {title ?? tr('ส่งคำขอสมัครสมาชิกสำเร็จแล้ว', 'Sign-up request sent')}
      </h2>
      <p className="auth-state-text">
        {lead ?? (
          <>
            {tr('เราได้รับคำขอของ', 'We received a request from')}{' '}
            <strong>{email}</strong>
            {tr(' เรียบร้อยแล้ว', '.')}
          </>
        )}
      </p>

      <ol className="auth-steps">
        <li className="auth-step auth-step--done">
          <span className="auth-step-marker" aria-hidden="true">
            <Check size={13} strokeWidth={3} />
          </span>
          <span className="auth-step-body">
            <span className="auth-step-title">{tr('รับคำขอเรียบร้อย', 'Request received')}</span>
            <span className="auth-step-text">
              {tr('ระบบบันทึกข้อมูลบัญชีของคุณแล้ว', 'Your account details have been saved')}
            </span>
          </span>
        </li>

        <li className="auth-step auth-step--current">
          <span className="auth-step-marker" aria-hidden="true">
            <Clock size={13} strokeWidth={2.4} />
          </span>
          <span className="auth-step-body">
            <span className="auth-step-title">
              {tr('รอผู้ดูแลระบบอนุมัติ', 'Waiting for admin approval')}
            </span>
            <span className="auth-step-text">
              {tr(
                'ระบบนี้กำหนดให้แอดมินอนุมัติก่อนเข้าใช้งาน',
                'An admin must approve your account before you can sign in',
              )}
            </span>
          </span>
        </li>

        <li className="auth-step">
          <span className="auth-step-marker" aria-hidden="true">
            <LogIn size={13} strokeWidth={2.4} />
          </span>
          <span className="auth-step-body">
            <span className="auth-step-title">{tr('เข้าใช้งานได้ทันที', 'Ready to use')}</span>
            <span className="auth-step-text">
              {tr('เข้าสู่ระบบด้วยอีเมลนี้เมื่อได้รับอนุมัติ', 'Sign in with this email once approved')}
            </span>
          </span>
        </li>
      </ol>

      <div className="auth-note">
        <Shield size={15} className="auth-note-icon" aria-hidden="true" />
        <p className="auth-note-text">
          {note ??
            tr(
              'เมื่อผู้ดูแลระบบอนุมัติแล้ว บัญชีจะใช้งานได้ทันที และเราจะแจ้งผลให้ทราบทางอีเมล',
              "Once an admin approves, your account works right away and we'll email you the result",
            )}
        </p>
      </div>

      <div className="auth-actions">
        <button type="button" className="login-submit" onClick={onBack}>
          <span>{tr('กลับไปหน้าเข้าสู่ระบบ', 'Back to sign in')}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
