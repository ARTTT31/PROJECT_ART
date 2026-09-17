'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react'

/* ── Types ────────────────────────────────────────────── */

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  success: (title: string, message?: string) => string
  error: (title: string, message?: string) => string
  warning: (title: string, message?: string) => string
  info: (title: string, message?: string) => string
}

/* ── Context ──────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null)

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = `toast-${++toastCounter}`
      const duration = toast.duration ?? 4000
      const newToast: Toast = { ...toast, id }

      setToasts((prev) => [...prev.slice(-4), newToast]) // max 5 visible

      if (duration > 0) {
        setTimeout(() => removeToast(id), duration)
      }

      return id
    },
    [removeToast],
  )

  const success = useCallback((title: string, message?: string) => addToast({ type: 'success', title, message }), [addToast])
  const error = useCallback((title: string, message?: string) => addToast({ type: 'error', title, message, duration: 6000 }), [addToast])
  const warning = useCallback((title: string, message?: string) => addToast({ type: 'warning', title, message }), [addToast])
  const info = useCallback((title: string, message?: string) => addToast({ type: 'info', title, message }), [addToast])

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, addToast, removeToast, success, error, warning, info }),
    [toasts, addToast, removeToast, success, error, warning, info],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>')
  }
  return ctx
}

/* ── Toast Container & Item ───────────────────────────── */

const typeConfig: Record<ToastType, { icon: React.ReactNode; alertClass: string; iconBg: string; iconColor: string }> = {
  success: {
    icon: <CheckCircle size={20} aria-hidden="true" />,
    alertClass: 'alert-success',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: <AlertCircle size={20} aria-hidden="true" />,
    alertClass: 'alert-error',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
  warning: {
    icon: <AlertTriangle size={20} aria-hidden="true" />,
    alertClass: 'alert-warning',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  info: {
    icon: <Info size={20} aria-hidden="true" />,
    alertClass: 'alert-info',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
  },
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed left-1/2 top-6 z-[var(--z-toast,1100)] flex -translate-x-1/2 flex-col gap-3"
      aria-label="การแจ้งเตือน"
      role="region"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const config = typeConfig[toast.type]

  return (
    <div
      className="flex w-[min(90vw,400px)] items-center gap-3 rounded-[24px] border border-white/40 bg-white/80 p-3.5 shadow-[0_16px_48px_rgba(15,23,42,0.15),0_8px_24px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-[24px] saturate-[180%] animate-slide-in-top"
      role="alert"
      aria-live="polite"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${config.iconBg} ${config.iconColor} shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold tracking-tight text-[#1d1d1f]">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-[13px] font-medium leading-snug text-[#6e6e73] line-clamp-2">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3]"
        aria-label="ปิดการแจ้งเตือน"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export default ToastProvider
