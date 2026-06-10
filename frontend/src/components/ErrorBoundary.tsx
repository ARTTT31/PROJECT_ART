'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import Link from 'next/link'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional fallback UI; receives the error and a reset function */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** Called when an error is caught (for logging) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Global Error Boundary — catches render-time errors in child components
 * and displays a friendly fallback UI instead of a blank white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Preserve console output for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      // Default fallback UI
      return (
        <div
          className="flex min-h-[400px] items-center justify-center p-6"
          style={{ background: 'var(--art-page-bg)' }}
          role="alert"
          aria-live="assertive"
        >
          <div className="w-full max-w-md overflow-hidden rounded-[var(--art-radius-lg)] border border-white/30 bg-white/80 backdrop-blur-[24px] shadow-glass-lg">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-200/50 bg-red-50/50 px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertTriangle size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">เกิดข้อผิดพลาด</h2>
                <p className="text-sm text-slate-500">ระบบไม่สามารถแสดงส่วนนี้ได้</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600">
                เกิดข้อผิดพลาดที่ไม่คาดคิด คุณสามารถลองโหลดใหม่ หรือกลับไปยังหน้าหลัก
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-red-700">
                  {this.state.error.message}
                </pre>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-slate-200/50 px-6 py-4">
              <button
                onClick={this.handleReset}
                className="art-primary-button inline-flex items-center gap-2 !rounded-xl text-sm"
              >
                <RotateCcw size={16} aria-hidden="true" />
                ลองใหม่
              </button>
              <Link
                href="/dashboard"
                className="art-soft-button inline-flex items-center gap-2 !rounded-xl text-sm"
              >
                <Home size={16} aria-hidden="true" />
                กลับหน้าหลัก
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
