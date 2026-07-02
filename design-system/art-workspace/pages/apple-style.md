# Page Override: /apple-style

**Route:** `/apple-style`
**File:** `frontend/src/app/apple-style/page.tsx`
**Register:** Brand / Product Showcase
**Last Updated:** 2026-07-02

---

## Purpose

Standalone Apple-inspired product showcase page. This is the canonical reference implementation for the v2.0 Apple showcase DNA. All future showcase-style pages should match this page's patterns.

---

## Active Overrides (relative to MASTER.md v2.0)

This page **is** the global standard for showcase surfaces. There are no overrides — it implements MASTER.md v2.0 directly.

---

## Layout Structure

```
<AppleNav />          sticky translucent nav — .apple-nav class
<Hero />              bg-white, py-24, hero display type
<BentoGrid />         bg-[#f5f5f7], py-28, three grid rows
  Row 1: 8/4 col     large tile + small tile
  Row 2: 4/4/4 col   three equal tiles
  Row 3: 6/6 col     two equal system tiles
<ClosingCTA />        bg-white, py-32
```

---

## Typography

| Element | Classes |
|---------|---------|
| Hero h1 | `.apple-heading-hero` or `text-[56px] sm:text-[68px] font-extrabold tracking-[-0.03em] leading-[1.05] text-[#1d1d1f]` |
| Section h2 | `.apple-heading-section` or `text-[48px] font-extrabold tracking-[-0.025em] leading-[1.08]` |
| Tile h3 | `.apple-heading-tile` or `text-[28px] sm:text-[32px] font-extrabold tracking-[-0.02em] leading-[1.1]` |
| Body | `.apple-body` or `text-[19px] leading-[1.6] text-[#6e6e73]` |
| Nav brand | `text-[17px] font-semibold tracking-tight text-[#1d1d1f]` |
| Nav items | `text-[13px] font-medium rounded-full px-4 py-1.5` |

---

## Tile Anatomy

Every bento tile follows this structure:

```tsx
<div className="apple-tile [gradient-bg] p-8 sm:p-10 sm:min-h-[420px]">
  {/* Icon badge — top left */}
  <div className="apple-tile-icon mb-6">
    <Icon className="h-7 w-7 text-white" aria-hidden="true" />
  </div>

  {/* Text — bottom of tile */}
  <div className="mt-auto">
    <h3 className="apple-heading-tile text-white mb-2">ชื่อ tile</h3>
    <p className="text-[17px] leading-relaxed text-white/90">คำอธิบาย</p>
  </div>

  {/* Optional CTA link */}
  <button className="mt-5 inline-flex items-center gap-1.5 text-[17px] font-semibold text-white
                     hover:translate-x-0.5 transition-transform duration-150 focus-visible:ring-2
                     focus-visible:ring-white/60">
    เรียนรู้เพิ่มเติม <ArrowRight className="h-4 w-4" />
  </button>
</div>
```

White tiles on `#f5f5f7` section use `.apple-card-icon` and `text-[#1d1d1f]` / `text-[#6e6e73]` instead of white text.

---

## Nav Spec

```tsx
<header className="apple-nav">
  <div className="mx-auto flex h-[52px] max-w-[1024px] items-center justify-between px-6">
    {/* Active pill: bg-[#1d1d1f] text-white */}
    {/* Default pill: text-[#424245] hover:bg-black/[0.06] */}
  </div>
</header>
```

---

## Approved Tile Colors (this page)

| Tile | Gradient |
|------|----------|
| Calendar (large) | `from-[#4776e6] to-[#8e54e9]` |
| Oil Price | `from-[#f09819] to-[#ff512f]` |
| Team | `bg-[#1d1d1f]` |
| Messages | `from-[#667eea] to-[#764ba2]` |
| Security | `from-[#0575e6] to-[#021b79]` |
| Documents | `bg-white ring-1 ring-black/[0.06]` |
| CPU/Performance | `bg-white ring-1 ring-black/[0.06]` |
