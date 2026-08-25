# Page Override: /dashboard

**Route:** `/dashboard`
**File:** `frontend/src/app/dashboard/page.tsx`
**Register:** Product UI / Data Dashboard
**Last Updated:** 2026-07-14

---

## Purpose

The main operational dashboard — widgets, calendar, task list, oil prices, QR code. This page is data-dense and task-focused. It implements the Enterprise Admin DNA of MASTER.md v3.0.

---

## Active Overrides (relative to MASTER.md v3.0)

| Rule | Global Default | This Page |
|------|---------------|-----------|
| Layout padding | `p-6` (24px) | Standard dashboard widget grid padding (`p-4` or `p-6`) |
| Tile/Widget radius | `rounded-lg` (8px) | Fully aligned with global standard — no overrides |
| Background | `#f0f2f5` | Fully aligned with layout background |
| Heading size | 20px semibold | Standard widget header text size (`text-base` / 16px font-semibold) |
| Border | `border border-[#f0f0f0]` | Standard border style for widgets |

---

## Widget Card Spec

Every widget container card follows this structure to match the Ant Design Pro Enterprise UI:

```tsx
<div className="rounded-lg bg-white border border-[#f0f0f0] p-5 shadow-sm transition-all duration-200 hover:shadow-md">
  {/* Widget Header */}
  <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-3 mb-4">
    <div className="flex items-center gap-2">
      {/* Icon Badge */}
      <div className="text-[#1677ff]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-[rgba(0,0,0,0.88)]">ชื่อ Widget</h2>
    </div>
    {/* Action / Controls on the right */}
  </div>

  {/* Widget Body */}
  <div className="text-sm text-[rgba(0,0,0,0.88)]">
    {/* content */}
  </div>
</div>
```

---

## Allowed on this page

- Neutral colors: Slate scale for borders and secondary typography
- Compact typography: `text-sm` (14px) for body and lists, `text-xs` (12px) for timestamps/metadata
- Accent color: `--ant-primary` (`#1677ff`) for active states, indicators, links, and primary focus rings
- Grid layout: CSS grid container with custom sortable list wrappers (`@dnd-kit`)

## NOT allowed on this page

- Giant card borders or radius (e.g. `rounded-2xl` is replaced by `rounded-lg`)
- Gradient fills on content cards (cards must remain solid `#ffffff` with a `#f0f0f0` border)
- Floating/Glassmorphic cards

---

## Dialog Spec (Widget Manager Modal)

Uses `components/ui/Dialog.tsx` with Ant Design Pro compact style:
- Border radius: `rounded-lg` (8px)
- Overlay: Dark tint backdrop (no heavy glass/blur on content box)

```tsx
<Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
  <DialogContent className="max-w-md rounded-lg border border-[#f0f0f0]">
    <DialogHeader className="border-b border-[#f0f0f0] pb-3">
      <DialogTitle className="text-base font-semibold text-[rgba(0,0,0,0.88)]">การแสดงผลวิดเจ็ต</DialogTitle>
      <DialogDescription className="text-xs text-[rgba(0,0,0,0.45)]">เลือกติ๊กถูกเพื่อแสดงหรือซ่อนวิดเจ็ตบนแดชบอร์ด</DialogDescription>
    </DialogHeader>
    <DialogBody className="py-4">...</DialogBody>
    <DialogFooter className="border-t border-[#f0f0f0] pt-3">...</DialogFooter>
  </DialogContent>
</Dialog>
```
