# ART Workspace Project Analysis

**Last updated:** October 1, 2026  
**Scope:** Full-stack repository review, local validation, and system-wide refresh  
**Repository path:** `D:\Program\Project\PROJECT_ART`

## Executive Summary

ART Workspace is a Thai-language personal productivity dashboard built as a modern full-stack web application. The architecture consists of a Next.js 16 frontend (App Router + Turbopack), a FastAPI backend, and a PostgreSQL database target (Neon in production, in-memory SQLite for tests).

The full stack has been verified locally and is in a clean, fully passing state:
- **Backend Tests:** 52/52 pytest tests passing 100%.
- **Backend Linting:** Flake8 passes with 0 errors across all app modules.
- **Frontend Type Check:** TypeScript type check passes with 0 errors.
- **Frontend Linting:** ESLint passes with 0 errors.
- **Frontend Production Build:** Next.js production build succeeds cleanly with 0 errors and 0 warnings.

## Current Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Frontend | Next.js 16 App Router, React 18, TypeScript 5 | Main web application |
| Styling | Tailwind CSS, Liquid Glass Design Tokens | Dashboard, login, profile, widgets |
| UI libraries | Lucide React, Radix Dialog, SweetAlert2 | Icons, dialogs, notifications |
| Backend | FastAPI, SQLAlchemy async, Alembic | REST API and database access |
| Auth | JWT access/refresh tokens in HTTP-only cookies | Standard login and Google OAuth |
| Database | PostgreSQL target, SQLite for tests | Render PostgreSQL in production |
| External data | Open-Meteo weather API, EPPO oil price page | Weather widget and oil price widget |

## System Improvements Applied (October 1, 2026)

1. **Idempotent Alembic Migrations on PostgreSQL:**
   - Updated all Alembic migrations (`004`, `ed73...`, etc.) to use `sa.inspect` to check for column/table existence before executing DDL commands. This prevents `InFailedSqlTransaction` errors on Render's strict PostgreSQL environment.

2. **Async SQLAlchemy MissingGreenlet Fix:**
   - Configured `expire_on_commit=False` in `async_sessionmaker` to prevent 500 errors when accessing relationship attributes after transaction commits.

3. **Frontend Page Access & Defaults:**
   - Modified `Sidebar.tsx` and `profile/page.tsx` default permission logic. When a normal user has `NULL` `accessible_pages` (never edited by admin), it now correctly defaults to `['dashboard', 'profile']` instead of allowing everything, ensuring restricted pages like `camera` remain hidden.

4. **Frontend Animation & Performance Optimizations:**
   - Removed `template.tsx` to stop redundant DOM unmounting of the Sidebar layout on every route change.
   - Refactored `DashboardLayout` `framer-motion` to use simple `opacity` fades with `mode="wait"`. This prevents Next.js from rendering two concurrent pages which caused heavy CPU spikes and UI lag on low-end devices.

5. **Toast Notification Styling:**
   - Removed aggressive `[role="alert"]` selectors from global CSS that were overriding Tailwind glassmorphism styles with an ugly red background.

6. **Admin Panel UI Overhaul:**
   - Replaced native select dropdowns and checkboxes with Liquid Glass style selectable cards and Lucide icons in `UserManagement.tsx`.
