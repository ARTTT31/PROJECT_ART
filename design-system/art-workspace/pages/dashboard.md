# Page Override: /dashboard

**Route:** `/dashboard`
**File:** `frontend/src/app/dashboard/page.tsx`
**Register:** Product UI / Data Dashboard
**Last Updated:** 2026-07-02

---

## Purpose

The main operational dashboard — widgets, calendar, task list, oil prices, QR code. This page is data-dense and task-focused. It uses the ART UI control layer (Layer 2 tokens) rather than the Apple showcase layer (Layer 1), because density and scannability matter more than spacious aesthetics here.

---

## Active Overrides (relative to MASTER.md v2.0)

| Rule | Global Default | This Page |
|------|---------------|-----------|
| Section padding | `py-24`–`py-32` | Standard widget layout padding — no large section rhythm |
| Tile radius | `rounded-[32px]` | `rounded-2xl` (16px) — widgets use UI card standard |
| Background | `#f5f5f7` | `var(--art-page-bg)` — subtle blue-tinted gradient |
| Heading size | 48–68px display | Standard widget title scale (15px semibold) |
| Tile color-field | Saturated gradient fills | White bg with subtle shadow — data readability first |
| Typography tokens | `--apple-ink` / `--apple-muted` | `--art-ink` / `--art-muted` |

---

## Widget Card Spec

```tsx
<div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-[0_2px_8px_rgba(15,23,42,0.04)]
                transition-all duration-200 hover:-translate-y-0.5
                hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
  {/* Widget header */}
  <div className="widget-header">
    <div className="widget-header-icon primary">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
    <h2 className="text-[15px] font-bold tracking-tight text-slate-900">ชื่อ Widget</h2>
    {/* Controls */}
  </div>

  {/* Widget body */}
  <div className="widget-body">
    {/* content */}
  </div>
</div>
```

---

## Allowed on this page

- `slate-*` color palette for all text and borders
- `rounded-2xl` (16px) for widget containers
- `widget-header`, `widget-body`, `premium-card` CSS classes
- Dense data layout — tables, lists, compact spacing
- `--art-primary` (`#0ea5e9`) for interactive states and focus rings

## NOT allowed on this page

- Apple bento tile gradients (`from-[#4776e6]` etc.) — too decorative for data
- `.apple-heading-hero` or `.apple-heading-section` display type
- `py-24` / `py-32` section rhythm — use widget padding instead
- `.apple-tile` class — widgets use `premium-card` or explicit `rounded-2xl bg-white`

---

## Dialog Spec (Widget Manager Modal)

Uses `components/ui/Dialog.tsx` with standard subcomponent API:

```tsx
<Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>การแสดงผลวิดเจ็ต</DialogTitle>
      <DialogDescription>ติ๊กถูกเพื่อแสดงหรือซ่อนวิดเจ็ต</DialogDescription>
    </DialogHeader>
    <DialogBody>...</DialogBody>
    <DialogFooter>...</DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Widget Layout Grid

```
┌─────────────────────────────────────────────┐
│  DashboardLayout (Sidebar + Header)         │
│  ┌───────────────┐  ┌──────┐  ┌──────────┐ │
│  │  Calendar     │  │ Oil  │  │ QR Code  │ │
│  │  (full/2/3)   │  │Price │  │          │ │
│  └───────────────┘  └──────┘  └──────────┘ │
│  ┌─────────────────────────────────────────┐│
│  │  Task List Widget                       ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

Widget visibility and order are user-configurable via the Widget Manager modal (drag-and-drop with `@dnd-kit`).
