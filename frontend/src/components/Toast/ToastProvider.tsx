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
      className="fixed bottom-6 right-6 z-[var(--z-toast,1100)] flex flex-col gap-3"
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
      className={`alert art-toast-item w-80 items-start animate-slide-in-right ${config.alertClass}`}
      role="alert"
      aria-live="polite"
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.iconBg} ${config.iconColor}`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="art-icon-button small-control !h-8 !w-8 !rounded-lg !border-transparent !bg-transparent !shadow-none"
        aria-label="ปิดการแจ้งเตือน"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export default ToastProvider
