# Gokul Connect — UI/UX Design System Specification

**Document Version:** 1.0.0  
**Status:** Approved Design System Specification  
**Application:** Gokul Connect — Multi-Business WhatsApp Automation & Customer Management Platform  
**Target Environment:** Next.js 15 (App Router), React 19, Tailwind CSS v3.4, Lucide React  

---

## 1. Executive Summary & Design Vision

Gokul Connect is a mission-critical multi-tenant SaaS application powering two distinct, professional service businesses owned and operated by Gokul:
1. **Gokul's Astrological Insights:** Premium Vedic and KP astrology consultation services, horoscopes, and appointment management.
2. **Gokul Vivaham:** High-trust, professional Tamil matrimonial matchmaking and membership onboarding service.

### Design Philosophy
- **Enterprise SaaS Professionalism:** Gokul Connect must look and feel like an enterprise-grade SaaS platform (comparable to Linear, Stripe, or Intercom) rather than an ad-hoc dashboard or generic marketing template.
- **Clarity Over Clutter:** Zero gratuitous gradients, heavy 3D glows, distracting bounce animations, or decorative visual noise. Form follows function.
- **Strict Business Identity Partitioning:** While sharing unified structural components, layouts, and ergonomic design tokens, each workspace must project an unmistakable, dedicated business visual identity. Astrology and Vivaham must never be confused or visually intermingled.
- **Data Density & Readability:** Optimized for high-throughput WhatsApp operations, rapid message triage, connection health monitoring, and customer context retrieval.
- **Accessibility by Default:** Built to satisfy WCAG 2.1 AA standards for color contrast, typography sizing, focus visibility, keyboard navigability, and touch target ergonomics.

---

## 2. Platform Brand vs. Business Workspaces Identity

```
                                  ┌──────────────────────────────┐
                                  │        GOKUL CONNECT         │
                                  │   (Shared Platform Shell)    │
                                  │   Slate-900 / Indigo Base    │
                                  └──────────────┬───────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
    ┌──────────────────────────────┐                            ┌──────────────────────────────┐
    │ Gokul's Astrological Insights│                            │        Gokul Vivaham         │
    ├──────────────────────────────┤                            ├──────────────────────────────┤
    │ Identity: Professional Vedic │                            │ Identity: Elite Tamil        │
    │ & KP Astrology Consultation  │                            │ Matrimonial Matchmaking      │
    │ Primary Hue: Royal Amethyst  │                            │ Primary Hue: Crimson Coral   │
    │ (Violet / Purple #9333EA)    │                            │ (Rose / Ruby #E11D48)        │
    │ Iconography: Sparkles / Star │                            │ Iconography: HeartHandshake  │
    │ Scope: Horoscopes, Birth     │                            │ Scope: Matrimony Profiles,   │
    │ Charts, Vedic Appointments   │                            │ Registrations, Memberships   │
    └──────────────────────────────┘                            └──────────────────────────────┘
```

### Shared Platform Identity (Gokul Connect)
- **Neutral Backbone:** Premium neutral Slate (`#0f172a` to `#f8fafc`).
- **Platform Primary Accent:** Precision Indigo (`#4f46e5` / `#6366f1`).
- **Role:** Used on pre-tenant surfaces (Login, Forgot Password, Account Recovery) and shared platform shell metadata (top brand markers, tenant isolation guards, global navigation cues).

### Business 1: Gokul's Astrological Insights
- **Brand Essence:** Wisdom, cosmic precision, scholarly Vedic authority, calm introspection.
- **Primary Accent Hue:** Deep Amethyst / Royal Violet (`#9333ea` / Tailwind `purple-600` / `purple-700`).
- **Surface Accents:** `bg-purple-50`, `border-purple-200`, `text-purple-700`.
- **Primary Glyph:** `Sparkles` (`lucide-react`).
- **Terminology Scope:** Consultations, Horoscopes, KP Analysis, Natal Charts, Astrological Remedies, Consultation Fees.

### Business 2: Gokul Vivaham
- **Brand Essence:** Trust, cultural reverence, marital sanctity, warm familial celebration, security.
- **Primary Accent Hue:** Crimson Coral / Traditional Vermilion (`#e11d48` / Tailwind `rose-600` / `rose-700`).
- **Surface Accents:** `bg-rose-50`, `border-rose-200`, `text-rose-700`.
- **Primary Glyph:** `HeartHandshake` (`lucide-react`).
- **Terminology Scope:** Matrimony Profiles, Member Registrations, Horoscope Matching, Bride/Groom Family Enquiries, Premium Subscriptions.

---

## 3. Design System Foundations & Tokens

### 3.1 Color Palette & Semantic Roles

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           COLOR TOKEN SYSTEM                              │
├─────────────────┬─────────────────┬───────────────────┬───────────────────┤
│ Role            │ Token           │ Hex Code          │ Tailwind Class    │
├─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Canvas (App Bg) │ --bg-app        │ #f8fafc           │ bg-slate-50       │
│ Surface (Cards) │ --surface       │ #ffffff           │ bg-white          │
│ Elevated Card   │ --surface-elev  │ #ffffff (shadow)  │ bg-white shadow-sm│
│ Border Subtle   │ --border-subtle │ #e2e8f0           │ border-slate-200  │
│ Border Strong   │ --border-strong │ #cbd5e1           │ border-slate-300  │
│ Text Primary    │ --text-primary  │ #0f172a           │ text-slate-900    │
│ Text Secondary  │ --text-secondary│ #475569           │ text-slate-600    │
│ Text Muted      │ --text-muted    │ #64748b           │ text-slate-500    │
│ Text Faint      │ --text-faint    │ #94a3b8           │ text-slate-400    │
├─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Platform Indigo │ --indigo-500    │ #6366f1           │ text-indigo-500   │
│                 │ --indigo-600    │ #4f46e5           │ bg-indigo-600     │
│                 │ --indigo-700    │ #4338ca           │ bg-indigo-700     │
├─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Astrology Hue   │ --astro-50      │ #faf5ff           │ bg-purple-50      │
│                 │ --astro-100     │ #f3e8ff           │ bg-purple-100     │
│                 │ --astro-500     │ #a855f7           │ bg-purple-500     │
│                 │ --astro-600     │ #9333ea           │ bg-purple-600     │
│                 │ --astro-700     │ #7e22ce           │ bg-purple-700     │
├─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Vivaham Hue     │ --vivaham-50    │ #fff1f2           │ bg-rose-50        │
│                 │ --vivaham-100   │ #ffe4e6           │ bg-rose-100       │
│                 │ --vivaham-500   │ #f43f5e           │ bg-rose-500       │
│                 │ --vivaham-600   │ #e11d48           │ bg-rose-600       │
│                 │ --vivaham-700   │ #be123c           │ bg-rose-700       │
├─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Status Success  │ --success-50    │ #f0fdf4           │ bg-emerald-50     │
│                 │ --success-600   │ #059669           │ text-emerald-600  │
│                 │ --success-700   │ #047857           │ text-emerald-700  │
├─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Status Warning  │ --warning-50    │ #fffbeb           │ bg-amber-50       │
│                 │ --warning-600   │ #d97706           │ text-amber-600    │
│                 │ --warning-700   │ #b45309           │ text-amber-700    │
├─────────────────┼─────────────────┼───────────────────┼───────────────────┤
│ Status Danger   │ --danger-50     │ #fef2f2           │ bg-red-50         │
│                 │ --danger-600    │ #dc2626           │ text-red-600      │
│                 │ --danger-700    │ #b91c1c           │ text-red-700      │
└─────────────────┴─────────────────┴───────────────────┴───────────────────┘
```

### 3.2 Typography System

The application must use a clean, geometric sans-serif font stack.

- **Primary Font Family:** Inter or Plus Jakarta Sans (with system fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Monospace Family (for Phone numbers, WABA IDs, Meta Message IDs, tokens):** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.

```
┌───────────────────┬───────────┬────────────┬─────────────┬──────────────────────────┐
│ Style             │ Size      │ Weight     │ Line Height │ Primary Use Case         │
├───────────────────┼───────────┼────────────┼─────────────┼──────────────────────────┤
│ Display / H1      │ 24px (1.5)│ Bold (700) │ 32px (2rem) │ Main Page Titles         │
│ Title / H2        │ 18px (1.1)│ Semi (600) │ 26px (1.6)  │ Card Titles, Section H2  │
│ Subtitle / H3     │ 14px (0.8)│ Semi (600) │ 20px (1.2)  │ Component Headers, Table │
│ Body Default      │ 13px (0.8)│ Reg (400)  │ 18px (1.1)  │ Standard Content, Chats  │
│ Body Small        │ 12px (0.7)│ Reg (400)  │ 16px (1.0)  │ Secondary Descriptions   │
│ Caption / Label   │ 11px (0.6)│ Semi (600) │ 14px (0.9)  │ Badges, Meta Timestamps  │
│ Microcode / ID    │ 11px (0.6)│ Med (500)  │ 14px (0.9)  │ Phone numbers, WABA IDs  │
└───────────────────┴───────────┴────────────┴─────────────┴──────────────────────────┘
```

> [!WARNING]
> **Sub-pixel text rule:** Avoid arbitrary sub-11px font sizes such as `text-[9px]` or `text-[10px]` in regular body text. Micro text below 11px fails accessibility contrast guidelines and produces severe eye fatigue on mobile viewports. All badges and timestamps must standardize on `11px` (`text-[11px]`) with medium/semibold weights.

### 3.3 Spacing Scale & Layout Grid

Strictly anchored to an **8-point grid** with a **4-point micro-step**:

- `space-1` = 4px (`0.25rem`) — Micro spacing (icon to text gap)
- `space-2` = 8px (`0.5rem`) — Dense component padding, button icon gap
- `space-3` = 12px (`0.75rem`) — Form field inner padding, list item vertical gap
- `space-4` = 16px (`1.0rem`) — Card padding on mobile, table cell padding
- `space-6` = 24px (`1.5rem`) — Card padding on desktop, section spacing
- `space-8` = 32px (`2.0rem`) — Major page module spacing

### 3.4 Border Radii & Elevation (Shadows)

- **Input / Button Radius:** `8px` (`rounded-lg` / `rounded-md`)
- **Card / Panel Radius:** `12px` (`rounded-xl`)
- **Modal / Floating Drawer Radius:** `16px` (`rounded-2xl`)
- **Badge / Pill Radius:** `9999px` (`rounded-full`)

**Shadow Scale:**
- `shadow-xs`: `0 1px 2px 0 rgb(0 0 0 / 0.05)` (Buttons, compact pills)
- `shadow-sm`: `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` (Cards, panels)
- `shadow-md`: `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` (Dropdowns, popovers)
- `shadow-xl`: `0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)` (Modals, drawers)

---

## 4. Comprehensive Component Specifications

### 4.1 Buttons & Action Controls

Buttons must provide deterministic, interactive visual states (Rest, Hover, Active/Pressed, Focus, Disabled, Loading).

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             BUTTON HIERARCHY                               │
├─────────────┬──────────────────────────────────────────────────────────────┤
│ Variant     │ Visual Styling & Specifications                              │
├─────────────┼──────────────────────────────────────────────────────────────┤
│ Primary     │ bg-slate-900 text-white hover:bg-slate-800 shadow-xs         │
│             │ Active: scale-[0.98]. Focus: ring-2 ring-indigo-500/30       │
├─────────────┼──────────────────────────────────────────────────────────────┤
│ Astrology   │ bg-purple-600 text-white hover:bg-purple-700 shadow-xs       │
│ Action      │ Active: scale-[0.98]. Focus: ring-2 ring-purple-500/30       │
├─────────────┼──────────────────────────────────────────────────────────────┤
│ Vivaham     │ bg-rose-600 text-white hover:bg-rose-700 shadow-xs           │
│ Action      │ Active: scale-[0.98]. Focus: ring-2 ring-rose-500/30         │
├─────────────┼──────────────────────────────────────────────────────────────┤
│ Secondary / │ bg-white border border-slate-200 text-slate-700 shadow-xs    │
│ Outline     │ Hover: bg-slate-50 hover:text-slate-900                      │
├─────────────┼──────────────────────────────────────────────────────────────┤
│ Ghost       │ bg-transparent text-slate-600 hover:bg-slate-100             │
│             │ Hover: text-slate-900                                        │
├─────────────┼──────────────────────────────────────────────────────────────┤
│ Destructive │ bg-red-600 text-white hover:bg-red-700 shadow-xs             │
│             │ Active: scale-[0.98]. Focus: ring-2 ring-red-500/30          │
└─────────────┴──────────────────────────────────────────────────────────────┘
```

**Button Sizes:**
- `sm`: `h-8 px-3 text-xs` (Inline table actions, chat toolbar controls)
- `default`: `h-10 px-4 text-xs font-semibold` (Standard forms, modal primary actions)
- `lg`: `h-12 px-6 text-sm font-semibold` (Auth submit buttons, Business Workspace entry CTA)
- `icon`: `h-8 w-8` or `h-9 w-9` (Square action buttons with tooltip)

### 4.2 Forms & Inputs

- **Label:** `text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5`
- **Default Input Field:** `h-10 bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20`
- **Error State:** `border-red-500 focus:border-red-500 focus:ring-red-500/20 bg-red-50/20`
- **Helper / Error Text:** `text-[11px] text-slate-500 mt-1` (or `text-red-600 font-medium` on validation failure)
- **Password Input:** Must include integrated show/hide password toggle button (`Eye` / `EyeOff`) with accessible label.

### 4.3 Cards & Content Containers

- **Standard Card:** `rounded-xl border border-slate-200 bg-white shadow-sm`
- **Header:** `px-6 py-4 border-b border-slate-100 flex items-center justify-between`
- **Content:** `p-6` (or `p-0` for flush lists/tables)
- **Footer:** `px-6 py-3 bg-slate-50/60 border-t border-slate-100 rounded-b-xl`

### 4.4 Tables & Data Grids

- **Header Row (`thead`):** `bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500`
- **Data Rows (`tbody tr`):** `border-b border-slate-100 hover:bg-slate-50/70 transition-colors`
- **Cells (`td`):** `py-3 px-4 text-xs text-slate-700`
- **Row Actions:** Grouped at rightmost column, pinned or right-aligned.

### 4.5 Modals & Dialogs

- **Backdrop:** `fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50`
- **Modal Container:** Centered flex, `w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-6 z-50`
- **Accessibility:** Must implement focus trap, `aria-modal="true"`, `role="dialog"`, auto-focus first interactive field, close on `Escape` key and outside click.

### 4.6 Dropdowns & Menus

- **Container:** `bg-white border border-slate-200 rounded-xl shadow-md p-1.5 min-w-[200px] z-50`
- **Items:** `px-3 py-2 text-xs font-medium text-slate-700 rounded-lg hover:bg-slate-100 hover:text-slate-900 flex items-center gap-2 cursor-pointer`
- **Separator:** `h-px bg-slate-100 my-1`

### 4.7 Notifications & Feedback Toasts

- **Position:** Fixed top-right or bottom-right with slide-in animation.
- **Success Toast:** `bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl p-3.5 shadow-md flex items-center gap-2.5`
- **Error Toast:** `bg-red-50 border border-red-200 text-red-800 text-xs font-medium rounded-xl p-3.5 shadow-md flex items-center gap-2.5`
- **Persistent Warning Banner:** `bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl p-3`

### 4.8 Empty, Loading & Error States

- **Empty State Component:** Centered illustration or icon container (`w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3`), clear title (`text-sm font-semibold text-slate-800`), descriptive subtitle (`text-xs text-slate-500 max-w-xs mx-auto`), and optional action button.
- **Loading Skeleton:** `animate-pulse bg-slate-200 rounded` replacing text blocks, buttons, and table rows during hydration/fetching.
- **Error State Component:** Alert icon in soft red circle, human-readable error description, retry button (`RefreshCw`), and contact support/admin link.

---

## 5. Current Implementation vs. Identified Issues

| Category | Current Implementation | Identified Issues | Severity |
|---|---|---|---|
| **Theme Cohesion** | Auth & Business Selection pages are pitch-dark (`bg-slate-900` / `bg-slate-950`). Workspace dashboards are light (`bg-slate-50` / `bg-white`). | Inverted visual paradigm creates an abrupt, jarring flash when entering workspaces. Platform lacks an intentional dark/light mode toggle. | Medium |
| **Color Tokens** | `globals.css` specifies `--primary: #2563eb` (Blue), while `tailwind.config.ts` extends `primary.500: #6366f1` (Indigo). In-code components hardcode `bg-indigo-600`, `bg-purple-600`, and `bg-rose-600`. | Token dissociation. CSS variables are out-of-sync with Tailwind utility classes. | Medium |
| **Micro-typography** | Extensively uses `text-[9px]`, `text-[10px]`, and `text-[11px]` across badges, timestamps, table cells, and button labels. | Fails WCAG minimum font legibility standards. Severe strain on mobile devices and high-DPI displays. | High |
| **UI Primitives** | Only 4 basic UI primitives exist in `src/components/ui/` (`badge`, `button`, `card`, `input`). | Missing standard primitives: `Dialog`, `DropdownMenu`, `Tabs`, `Table`, `Toast`, `Tooltip`, `Skeleton`. As a result, modal dialogs and dropdowns are re-coded from scratch with raw HTML elements. | High |
| **Modal Accessibility** | Custom modal overlays in `ConnectionsManagerClient.tsx` use fixed `div`s without ARIA attributes. | No focus trap, no Escape key listeners, screen readers cannot detect modal context. | High |
| **Form UX** | Password field has no toggle to view plain text; buttons show raw text "Authenticating..." without spinner; error banners lack focus cues. | Inferior user experience compared to modern SaaS standards. | Low |
| **Business Switcher** | Button triggers `window.sessionStorage.removeItem()` and redirects back to `/select-business`. | Forces full round-trip page reload instead of allowing in-header direct workspace switching. | Low |

---

## 6. Recommended Improvements

1. **Unify Theme Strategy:**
   - Standardize the Business Selection and Authentication screens on the crisp, high-trust SaaS light theme (`bg-slate-50` with clean white cards and slate-900 text), matching the inner workspace layouts.
   - Alternatively, implement true CSS variable-driven Dark Mode support (`class="dark"`) that applies across both auth and workspace contexts consistently.
2. **Standardize Font Sizing:**
   - Enforce a strict minimum font floor of `11px` for micro-labels and badges (`text-[11px]`), `12px` for captions/secondary info (`text-xs`), and `13px`/`14px` for primary body copy (`text-sm`).
3. **Build Core Primitive Library in `src/components/ui/`:**
   - Introduce accessible headless primitives (Radix UI or native accessible equivalents):
     - `dialog.tsx` (Focus-trapping modal with backdrop and transitions)
     - `dropdown-menu.tsx` (Keyboard navigable menus)
     - `table.tsx` (Semantic `<Table>`, `<TableHeader>`, `<TableRow>`, `<TableCell>`)
     - `skeleton.tsx` (Consistent pulsing placeholders)
     - `toast.tsx` (Queued notification system)
4. **Synchronize Tokens in `tailwind.config.ts` and `globals.css`:**
   - Align `--primary` with Indigo (`#4f46e5`) or establish deliberate distinct roles (`--color-platform-indigo`, `--color-astrology-purple`, `--color-vivaham-rose`).

---

## 7. Implementation Roadmap & Priorities

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    DESIGN SYSTEM ROLLOUT PHASES                            │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Phase A       │ Foundation Alignment                                       │
│ (Priority 1)  │ • Synchronize CSS variables and Tailwind tokens            │
│               │ • Raise font floor to 11px/12px across all badges          │
│               │ • Add Accessible Password input with Eye/EyeOff toggle     │
├───────────────┼────────────────────────────────────────────────────────────┤
│ Phase B       │ Core UI Primitives                                         │
│ (Priority 2)  │ • Create `dialog.tsx`, `dropdown-menu.tsx`, `table.tsx`    │
│               │ • Refactor bespoke connection modals to standard Dialog    │
│               │ • Standardize Empty State & Loading Skeleton components    │
├───────────────┼────────────────────────────────────────────────────────────┤
│ Phase C       │ Business Branding Refinements                              │
│ (Priority 3)  │ • Deliver custom SVG marks for Astrology & Vivaham         │
│               │ • Harmonize Auth & Selection screens with SaaS aesthetic   │
│               │ • Add in-header instant workspace dropdown switcher        │
└───────────────┴────────────────────────────────────────────────────────────┘
```
