'use client'

import clsx from 'clsx'
import { X } from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'

type DialogContextValue = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  // ปิดด้วยปุ่ม ESC
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  // ล็อกการเลื่อนพื้นหลังเวลาเปิด Dialog (กันอาการเลื่อนเอง/หา modal ไม่เจอ)
  React.useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Focus trap: keep Tab/Shift+Tab within the dialog
  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement | null
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
  )
}

// รองรับแบบง่าย (ในโปรเจกต์นี้ยังไม่ได้ใช้)
export function DialogTrigger({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(DialogContext)
  return (
    <button type="button" className={className} onClick={() => ctx?.onOpenChange(true)}>
      {children}
    </button>
  )
}

// รองรับแบบง่าย (ในโปรเจกต์นี้ยังไม่ได้ใช้)
export function DialogClose({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(DialogContext)
  return (
    <button type="button" className={className} onClick={() => ctx?.onOpenChange(false)}>
      {children}
    </button>
  )
}

export function DialogContent({
  title,
  description,
  className,
  children,
}: {
  title: string
  description?: string
  className?: string
  children: React.ReactNode
}) {
  const ctx = React.useContext(DialogContext)
  const titleId = React.useId()
  const descId = React.useId()

  if (!ctx?.open) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={() => ctx.onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={clsx(
          'fixed left-1/2 top-1/2 z-[1001] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)]',
          'art-surface !p-0 overflow-hidden rounded-[14px] border border-white/50 bg-white/90 shadow-glass-lg',
          'focus:outline-none',
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/20 bg-white/30 px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm font-medium text-slate-600">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => ctx.onOpenChange(false)}
            className="art-icon-button"
            aria-label="ปิดหน้าต่าง"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto p-6">{children}</div>
      </div>
    </>,
    document.body
  )
}
