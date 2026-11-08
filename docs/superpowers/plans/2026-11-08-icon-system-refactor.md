# Plan: Icon System Refactoring & Brand Icon Integration

This plan outlines the steps to refactor icons across the project, eliminating residual inline SVGs in favor of `lucide-react`, expanding the Quick Links shortcut system to support official brand & social icons via `@icons-pack/react-simple-icons`, and ensuring strict compliance with Apple Human Interface Guidelines.

---

## 1. Objectives & Scope

1. **Clean up Inline SVGs (Lucide Standard)**:
   - Verify all non-canvas, non-animated icons use `lucide-react`.
   - `frontend/src/app/(main)/dashboard/page.tsx`: Replaced inline SVG in `WidgetFallback` with `AlertTriangle` (Completed).
2. **Expand Quick Links with Brand Icons (Simple Icons)**:
   - Add 20 popular brand and service icons to `frontend/src/utils/quickLinks.ts` (Google, Google Drive, Gmail, GitHub, LINE, Facebook, YouTube, X, Apple, Instagram, TikTok, Discord, Telegram, Notion, Figma, Trello, Spotify, WhatsApp, Reddit, Docker).
   - Add metadata (categories and brand colors) to `QUICK_LINK_ICON_OPTIONS`.
   - Provide a categorized Icon Picker UI in `QuickLinkDialog.tsx` (Tabs: ทั้งหมด / ทั่วไป / แบรนด์).
3. **Verify Compatibility & Tests**:
   - Update `frontend/src/utils/quickLinks.test.ts`.
   - Run Vitest tests (`npm run test`) and TypeScript type-check (`npm run type-check`).
   - Verify sidebar and profile quick links rendering.

---

## 2. File Decomposition & Tasks

### Task 1: Update `frontend/src/utils/quickLinks.ts`
- **Imports**: Import `ComponentType`, `CSSProperties`, `LucideIcon`, and Simple Icons (`SiGoogle`, `SiGoogledrive`, `SiGmail`, `SiGithub`, `SiLine`, `SiFacebook`, `SiYoutube`, `SiX`, `SiApple`, `SiInstagram`, `SiTiktok`, `SiDiscord`, `SiTelegram`, `SiNotion`, `SiFigma`, `SiTrello`, `SiSpotify`, `SiWhatsapp`, `SiReddit`, `SiDocker`).
- **Types**: Expand `QuickLinkIconKey` union to include brand keys.
- **Type**: Define `QuickLinkIconComponent = ComponentType<{ size?: number | string; className?: string; color?: string; style?: CSSProperties; 'aria-hidden'?: boolean | 'true' | 'false' }>`.
- **Options**: Add category (`general` vs `brand`) and `brandColor` to `QUICK_LINK_ICON_OPTIONS`.

### Task 2: Enhance Icon Picker in `frontend/src/components/Profile/QuickLinkDialog.tsx`
- Add category filter tabs (`ทั้งหมด` / `ทั่วไป` / `แบรนด์`) in the Icon Picker section.
- Auto-suggest/prefill brand color when selecting a brand icon if the user is using default color.

### Task 3: Update Tests in `frontend/src/utils/quickLinks.test.ts`
- Ensure all 60 icons (40 Lucide + 20 Simple Icons) in `QUICK_LINK_ICON_OPTIONS` are verified against `QUICK_LINK_ICON_MAP`.
- Verify unique keys and valid labels.

### Task 4: Comprehensive Verification
- Run `npm run type-check`.
- Run `npm run test` (Vitest).
