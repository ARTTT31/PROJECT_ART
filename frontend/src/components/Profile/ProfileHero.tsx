'use client';

import type { ChangeEvent, RefObject } from 'react';
import { AtSign, Camera, Loader2, Mail, ShieldAlert, User } from 'lucide-react';

export default function ProfileHero({
  name,
  email,
  username,
  avatar,
  isAdmin,
  avatarInputRef,
  isUploadingAvatar,
  onAvatarFileSelect,
  onPickAvatar,
  headingRef,
}: {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  avatar?: string | null;
  isAdmin: boolean;
  avatarInputRef: RefObject<HTMLInputElement | null>;
  isUploadingAvatar: boolean;
  onAvatarFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onPickAvatar: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className="overflow-hidden rounded-apple-lg bg-[var(--surface)] border border-[var(--hairline)] p-5 sm:p-7 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        {/* Left: Avatar + Identity */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative shrink-0 group">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
              onChange={onAvatarFileSelect}
              className="hidden"
              aria-label="อัปโหลดรูปโปรไฟล์"
            />

            {avatar ? (
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-apple-lg ring-4 ring-[var(--hairline-soft)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatar} alt={name || 'โปรไฟล์'} className="h-full w-full object-cover" />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
                )}
              </div>
            ) : (
              <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-apple-lg bg-[var(--accent)] text-2xl sm:text-3xl font-extrabold text-white ring-4 ring-[var(--hairline-soft)]">
                {isUploadingAvatar ? (
                  <Loader2 size={24} className="animate-spin text-white" />
                ) : (
                  name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
            )}

            {/* Upload photo button badge */}
            <button
              type="button"
              onClick={onPickAvatar}
              disabled={isUploadingAvatar}
              title="เปลี่ยนรูปโปรไฟล์ (ไม่เกิน 1MB)"
              aria-label="เปลี่ยนรูปโปรไฟล์"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--hairline)] transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
            >
              <Camera size={13} className="text-[var(--accent-text)]" />
            </button>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                ref={headingRef}
                className="truncate text-apple-title2 font-semibold text-[var(--ink)]"
              >
                {name || 'ผู้ใช้งาน'}
              </h1>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 ring-1 ring-purple-600/20">
                  <ShieldAlert size={11} /> จัดการระบบ (Admin)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-500/20">
                  <User size={11} /> ผู้ใช้ทั่วไป (User)
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-muted)]">
              <span className="inline-flex items-center gap-1">
                <Mail size={12} className="text-[var(--ink-tertiary)]" />
                {email || 'ไม่ได้ระบุอีเมล'}
              </span>
              {username && (
                <span className="inline-flex items-center gap-1">
                  <AtSign size={12} className="text-[var(--ink-tertiary)]" />
                  {username}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
