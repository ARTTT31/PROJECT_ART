'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Centralized Dialog Component - Radix UI + Liquid Glass Styling
 * 
 * Features:
 * - WCAG AAA compliant with automatic focus management
 * - Focus trap with ESC key support
 * - Liquid Glass UI: Semi-transparent overlay with backdrop-blur
 * - Restores focus to trigger element on close
 * - Follows ART Workspace design system (16px max radius)
 */

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Liquid Glass UI: Semi-transparent overlay with backdrop blur
      'fixed inset-0 z-[1000]',
      'bg-slate-900/10 backdrop-blur-md',
      // Smooth fade-in animation
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Positioning
        'fixed left-[50%] top-[50%] z-[1001]',
        'translate-x-[-50%] translate-y-[-50%]',
        // Sizing
        'w-[calc(100vw-2rem)] max-w-lg',
        'max-h-[calc(100dvh-2rem)]',
        // Liquid Glass UI: White with subtle border and glass shadow
        'bg-white rounded-xl border border-slate-200/50',
        // Shadow: Glass XL (from design system)
        'shadow-[0_24px_64px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.05)]',
        // Overflow handling
        'overflow-hidden',
        // Focus styles (WCAG AAA: 7:1 contrast)
        'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2',
        // Animations
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        // Duration
        'duration-200',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          // Positioning
          'absolute right-4 top-4',
          // Sizing (48px min for touch targets)
          'h-10 w-10',
          // Styling
          'rounded-lg',
          'inline-flex items-center justify-center',
          // Colors
          'text-slate-500 hover:text-slate-900',
          'hover:bg-slate-100',
          // Transitions
          'transition-colors duration-150',
          // Focus ring (WCAG AAA)
          'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2',
          // Disabled state
          'disabled:pointer-events-none disabled:opacity-50'
        )}
        aria-label="ปิดหน้าต่าง"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Layout
      'flex flex-col gap-2',
      // Spacing
      'px-6 pt-6 pb-4',
      // Border separator
      'border-b border-slate-200/50',
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Layout
      'flex flex-col-reverse sm:flex-row sm:justify-end',
      // Spacing
      'gap-2 px-6 py-4',
      // Border separator
      'border-t border-slate-200/50',
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      // Typography (from design system: Title scale)
      'text-xl font-semibold leading-tight tracking-tight',
      // Color (Ink from design system)
      'text-slate-900',
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      // Typography (from design system: Body scale)
      'text-sm leading-relaxed',
      // Color (Muted from design system)
      'text-slate-600',
      className
    )}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

/**
 * DialogTitleSR — visually hidden DialogTitle for screen readers only.
 *
 * Use this when a dialog has no visible header but still needs an accessible
 * name to satisfy Radix UI's ARIA requirements and avoid the console warning:
 *   "Missing `Description` or `aria-describedby={undefined}`"
 *
 * Usage:
 *   <DialogContent>
 *     <DialogTitleSR>ชื่อ Dialog สำหรับ screen reader</DialogTitleSR>
 *     <DialogDescriptionSR>คำอธิบายสั้นๆ สำหรับ screen reader</DialogDescriptionSR>
 *     {children}
 *   </DialogContent>
 */
const DialogTitleSR = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('sr-only', className)}
    {...props}
  />
))
DialogTitleSR.displayName = 'DialogTitleSR'

/**
 * DialogDescriptionSR — visually hidden DialogDescription for screen readers only.
 * Pair with DialogTitleSR when a dialog has no visible header section.
 */
const DialogDescriptionSR = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('sr-only', className)}
    {...props}
  />
))
DialogDescriptionSR.displayName = 'DialogDescriptionSR'

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Scrollable content area
      'overflow-y-auto',
      'max-h-[calc(100dvh-14rem)]',
      // Spacing
      'px-6 py-4',
      className
    )}
    {...props}
  />
)
DialogBody.displayName = 'DialogBody'

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTitleSR,
  DialogDescription,
  DialogDescriptionSR,
  DialogBody,
}
