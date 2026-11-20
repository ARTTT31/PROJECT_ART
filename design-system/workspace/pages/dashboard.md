# Page Override: /dashboard

**Route:** `/dashboard`
**File:** `frontend/src/app/(main)/dashboard/page.tsx`
**Register:** Product UI / Data Dashboard
**Last Updated:** 2026-10-05
**Aligns with:** MASTER.md v4.2 (Apple HIG)

---

## Purpose

The main operational dashboard — widgets, weather, Thai holidays, oil prices, QR code. This page is data-dense and task-focused, so it keeps a compact type scale while following the shared Apple HIG visual language.

---

## Active Overrides (relative to MASTER.md v4.2)

| Rule | Global Default | This Page |
|------|---------------|-----------|
| Layout padding | `p-6` (24px) | Standard dashboard widget grid padding (`p-4` or `p-6`) |
| Card radius | `18px` (`rounded-[18px]`) | Fully aligned with global standard — no overrides |
| Background | `#f5f5f7` | Fully aligned with global background |
| Widget heading | 17px semibold | Compact widget header (`text-base` / 16px semibold) |
| Border | `border border-black/[0.06]` | Standard hairline border for widgets |
| Body type | 17px | Compact `text-sm` (14px) for dense data — intentional density override |

---

## Widget Card Spec

Every widget container card follows this structure. It is a flat white surface with a hairline border and a single soft elevation — no gradients, no glass, no button glow:

```tsx
<div className="rounded-[18px] bg-white border border-black/[0.06] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-200">
  {/* Widget Header */}
  <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 mb-4">
    <div className="flex items-center gap-2">
      {/* Icon Badge — tinted with the single Action Blue accent */}
      <div className="text-[#0066cc]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-[#1d1d1f]">ชื่อ Widget</h2>
    </div>
    {/* Action / Controls on the right */}
  </div>

  {/* Widget Body */}
  <div className="text-sm text-[#1d1d1f]">
    {/* content */}
  </div>
</div>
```

---

## Allowed on this page

- Neutral surfaces: white `#ffffff` cards on the `#f5f5f7` page background
- Compact typography: `text-sm` (14px) for body and lists, `text-xs` (12px) for timestamps/metadata
- Accent color: `#0066cc` (Apple Action Blue) for active states, indicators, links, and focus rings
- Radius: `18px` for widget cards, `11px` for inner controls
- Grid layout: CSS grid container with custom sortable list wrappers (`@dnd-kit`)

## NOT allowed on this page

- Decorative gradients on cards or the hero banner (solid `#ffffff` only)
- Button glow / hover lift (`active:scale-[0.95]`, no `translateY`)
- Glassmorphic cards (`backdrop-blur` is reserved for transient overlays and the sticky header/sidebar)
- A second accent color — every "click me" signal is `#0066cc`

---

## Dialog Spec (Widget Manager Modal)

Uses `components/ui/Dialog.tsx` with the shared Apple style:
- Border radius: `18px` (`rounded-[18px]`)
- Surface: flat white with a hairline ring; overlay uses a dark tint + blur
- Primary action: solid `#0066cc` pill

```tsx
<Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>การแสดงผลวิดเจ็ต</DialogTitle>
      <DialogDescription>เปิดหรือปิดสวิตช์เพื่อจัดการวิดเจ็ตบนแดชบอร์ดหลักของคุณ</DialogDescription>
    </DialogHeader>
    <DialogBody>...</DialogBody>
    <DialogFooter>
      <button className="rounded-full bg-[#0066cc] text-white active:scale-[0.95]">เสร็จสิ้น</button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
