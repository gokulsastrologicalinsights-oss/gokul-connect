# Gokul Connect — Product Navigation & Information Architecture Audit

**Document Version:** 1.0.0  
**Status:** Architecture & Navigation Audit Report  
**Application:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Scope:** Information Architecture, Route Topology, Navigation Models, and User Workflows  

---

## 1. Executive Summary

Gokul Connect operates on a strict multi-tenant architecture designed to support two distinct businesses: **Gokul's Astrological Insights** and **Gokul Vivaham**. A robust navigation hierarchy is critical to ensuring operational speed, preventing cross-tenant accidental leakage, providing immediate situational awareness to human agents, and guiding users seamlessly between incoming WhatsApp messages, automation controls, and workspace management.

This audit evaluates the entire route hierarchy, analyzes existing vs. missing routes, identifies navigation dead ends, examines business switching flows, and proposes a comprehensive information architecture aligned with the product roadmap.

---

## 2. Current Route Inventory & Application Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CURRENT ROUTE HIERARCHY MAP                           │
└─────────────────────────────────────────────────────────────────────────────┘

  / (Root)
  └── [Redirect] ──► /select-business
  
  /(auth)
  ├── /login                   [Active - Dark Auth Surface]
  └── /forgot-password          [Active - Password Recovery]

  /select-business              [Active - Multi-Tenant Workspace Selector]

  /workspace/[businessSlug]     [Dynamic Tenant Root: 'astrology' | 'vivaham']
  │
  ├── /dashboard               [Active - Live KPI Metrics & Recent Enquiries]
  ├── /inbox                   [Active - 3-Panel WhatsApp Live Triage]
  ├── /connections             [Active - Meta Cloud API Phone Manager & Tests]
  └── /settings                [Active - Business Profile, Webhooks & Alerts]
```

### Complete Route Status Inventory Table

| Route Path | Module Name | Implementation Status | Backing Components | Screenshot Reference |
|---|---|---|---|---|
| `/login` | Authentication Portal | ✅ Implemented | `src/app/(auth)/login/page.tsx` | `screenshots/01-login-desktop.png`, `02-login-mobile.png` |
| `/forgot-password` | Password Recovery | ✅ Implemented | `src/app/(auth)/forgot-password/page.tsx` | — |
| `/select-business` | Business Workspace Hub | ✅ Implemented | `src/app/select-business/page.tsx` | `screenshots/03-select-business-desktop.png`, `04-select-business-mobile.png` |
| `/workspace/astrology/dashboard` | Astrology Dashboard | ✅ Implemented | `src/app/workspace/[businessSlug]/dashboard/page.tsx` | `screenshots/05-astrology-dashboard-desktop.png`, `06-astrology-dashboard-mobile.png` |
| `/workspace/vivaham/dashboard` | Vivaham Dashboard | ✅ Implemented | `src/app/workspace/[businessSlug]/dashboard/page.tsx` | `screenshots/08-vivaham-dashboard-desktop.png`, `09-vivaham-dashboard-mobile.png` |
| `/workspace/[slug]/inbox` | WhatsApp Live Inbox | ✅ Implemented (Phase 4A) | `src/app/workspace/[businessSlug]/inbox/page.tsx`, `InboxClient.tsx` | Live Phase 4A UI |
| `/workspace/astrology/connections` | Astrology WhatsApp Connections | ✅ Implemented (Phase 2) | `src/app/workspace/[businessSlug]/connections/page.tsx`, `ConnectionsManagerClient.tsx` | `screenshots/07-astrology-connections-desktop.png`, `09-astrology-add-connection-modal.png` |
| `/workspace/vivaham/connections` | Vivaham WhatsApp Connections | ✅ Implemented (Phase 2) | `src/app/workspace/[businessSlug]/connections/page.tsx`, `ConnectionsManagerClient.tsx` | `screenshots/11-vivaham-connections-desktop.png` |
| `/workspace/astrology/settings` | Astrology Workspace Settings | ✅ Implemented (Phase 2) | `src/app/workspace/[businessSlug]/settings/page.tsx`, `BusinessSettingsClient.tsx` | `screenshots/13-astrology-settings-desktop.png` |
| `/workspace/vivaham/settings` | Vivaham Workspace Settings | ✅ Implemented (Phase 2) | `src/app/workspace/[businessSlug]/settings/page.tsx`, `BusinessSettingsClient.tsx` | `screenshots/14-vivaham-settings-desktop.png` |
| `/workspace/[slug]/customers` | Customer CRM | ❌ Missing (Dead Link in Sidebar) | None | Links to non-existent route |
| `/workspace/[slug]/automations` | Automation Rules Engine | ❌ Missing (Dead Link in Sidebar) | None | Links to non-existent route |
| `/workspace/[slug]/flows` | Flow Builder | ❌ Missing (Dead Link in Sidebar) | None | Links to non-existent route |
| `/workspace/[slug]/templates` | Meta Message Templates | ❌ Missing (Dead Link in Sidebar) | None | Links to non-existent route |
| `/workspace/[slug]/scheduled` | Scheduled Messages Queue | ❌ Missing (Dead Link in Sidebar) | None | Links to non-existent route |
| `/workspace/[slug]/analytics` | Business Analytics | ❌ Missing (Dead Link in Sidebar) | None | Links to non-existent route |
| `/workspace/[slug]/campaigns` | Broadcast Campaigns | ❌ Missing (Dead Link in Sidebar) | None | Links to non-existent route |

---

## 3. Detailed Page-by-Page Audit

### 3.1 Authentication & Pre-Tenant Navigation

#### Login Page (`/login`)
- **Current Behavior:** Centralized sign-in. Provides email and password inputs, error/info alerts, link to `/forgot-password`, and demo sign-in button for local development. On successful authentication, redirects to `/select-business`.
- **Identified Navigation Gaps:**
  - Lacks a direct destination redirection parameter (`?next=/workspace/astrology/inbox`). After logging in, the user is always dumped at `/select-business`, losing context if they originally followed a specific deep-link.
  - Sign-out links across the app navigate directly to `/login` without invalidating session tokens through Supabase Auth, creating potential stale session issues.

#### Forgot Password Page (`/forgot-password`)
- **Current Behavior:** Captures email to trigger Supabase password reset. Provides link back to `/login`.
- **Identified Navigation Gaps:**
  - After dispatching the reset email, there is no direct link to return to the login screen other than the bottom footer link.
  - Does not indicate which email domain or workspace the user is requesting access to.

#### Business Selection Hub (`/select-business`)
- **Current Behavior:** Central fork between Astrology and Vivaham. Shows security status pills, unread count metrics, and prominent "Enter Workspace" buttons. Rejects invalid business attempts with security banners.
- **Identified Navigation Gaps:**
  - There is no option to set a "Default Workspace" for automated login bypass.
  - Clicking "Sign Out" uses an ordinary `<Link href="/login">` instead of a secured logout action.

---

### 3.2 Workspace Navigation & Shell

#### Header (`WorkspaceHeader.tsx`)
- **Current Components:**
  - Left: Hamburger toggle (mobile), Business icon badge (`Sparkles` or `HeartHandshake`), Business Name, Database Scope subtitle (`Isolated Database Scope: [slug]`).
  - Right: Tenant Guard RLS badge, "Switch Business" button, User pill ("Platform Owner").
- **Identified Issues:**
  1. **Disruptive Switch Business Workflow:** The "Switch Business" button purges local session storage and forces a hard redirect to `/select-business`. There is no seamless inline dropdown switcher (e.g., clicking the business name to reveal a menu with "Switch to Gokul Vivaham").
  2. **Static User Pill:** The user avatar and name ("Gokul Murugan / Platform Owner") is an inert `div`. It has no click behavior, no profile view, no preferences, and no explicit "Log Out" action. A user inside a workspace has no direct way to log out without switching to the business selector first.
  3. **No Breadcrumbs:** Deep pages (e.g. Settings, Connections diagnostics, specific customer chats) have no breadcrumb trails.

#### Sidebar (`WorkspaceSidebar.tsx`)
- **Current Organization:**
  - **Core Modules:** Dashboard, WhatsApp Inbox (Active), Customer CRM (Phase 5).
  - **Automation & Engine:** WhatsApp Connections, Automation Rules (Phase 4), Flow Builder (Phase 4), Message Templates (Phase 4), Scheduled Messages (Phase 6).
  - **Intelligence & Settings:** Analytics (Phase 7), Campaigns (Phase 7), Workspace Settings.
  - **Bottom Card:** Strict Tenant Scope security reminder.
- **Identified Issues & Dead Links:**
  1. **6 Out of 10 Links Lead to 404:** Clicking Customer CRM, Automation Rules, Flow Builder, Message Templates, Scheduled Messages, Analytics, or Campaigns triggers a standard Next.js 404 page or unhandled route error. Although they display badges like "Phase 4" or "Phase 5", they remain active HTML anchor tags (`<Link>`), causing user confusion and dead clicks.
  2. **No Collapsible States:** Sidebar cannot be collapsed into an icon-only rail on intermediate desktop viewports (1024px–1280px), reducing horizontal workspace for the 3-panel WhatsApp inbox.
  3. **Inconsistent Module Phasing:** Module readiness on the Dashboard indicates Phase 2 is "Next", whereas WhatsApp Connections (Phase 2) and Inbox (Phase 4A) are already fully operational in the sidebar.

---

### 3.3 Module-Specific Navigation Workflows

#### Dashboard (`/workspace/[slug]/dashboard`)
- **Current Links:** 8 KPI metric cards and Recent Enquiries list.
- **Navigation Deficiencies:**
  - None of the 8 KPI cards are clickable. Clicking "Unread Conversations (5)" does not navigate to `/workspace/[slug]/inbox?folder=unread`. Clicking "Pending Replies (3)" does not navigate to `/workspace/[slug]/inbox?folder=pending`. Clicking "Total Customers" does not open the customer list.
  - Items in the "Recent Enquiries" table do not link directly to the corresponding chat in the WhatsApp Inbox. Human operators must manually switch to the inbox and search for the customer by name.

#### WhatsApp Inbox (`/workspace/[slug]/inbox`)
- **Current Panels:**
  - Panel 1: `ConversationNavPanel` (Folder navigation: All, Unread, Unassigned, Assigned to Me, Open, Pending, Resolved, Archived; Active Line selector).
  - Panel 2: `ConversationListPanel` (Conversation search and card list).
  - Panel 3: `ChatWindowPanel` (Conversation header, message history, agent selector, resolve/reopen, composer).
- **Navigation Deficiencies:**
  - **Folder Trapping on Tablet & Mobile:** On screens `< 1024px`, the entire `ConversationNavPanel` is hidden (`hidden lg:flex`). There is no hamburger, sheet, or tab bar on mobile/tablet to change folders or switch the active WhatsApp line. Users on mobile devices are trapped in whichever folder was previously active.
  - **No Deep URL Linking for Conversations:** Clicking a conversation updates local React state (`selectedConversationId`), but does not sync with the browser URL (e.g. `/workspace/[slug]/inbox?c=conv-id` or `/workspace/[slug]/inbox/[id]`). Consequently:
    - Users cannot bookmark or share conversation links.
    - Refreshing the browser resets the view to the top conversation.
    - Browser back button exits the workspace rather than returning to the previous conversation.

#### WhatsApp Connections (`/workspace/[slug]/connections`)
- **Current Workflow:** Listing of numbers, Add Number modal, Diagnostic modal, Details modal, Disconnect dialog.
- **Navigation Deficiencies:**
  - Modals update local state rather than query params or route interceptors.
  - After adding a new number, there is no direct link to test it or route to the inbox with that number pre-selected.

#### Workspace Settings (`/workspace/[slug]/settings`)
- **Current Workflow:** Vertical scroll form with 3 distinct sections (Profile, WhatsApp Routing, Notifications).
- **Navigation Deficiencies:**
  - Single monolithic scrolling page without internal anchor navigation, sticky secondary sub-nav, or section tabs.
  - No visual indication of unsaved changes when navigating away.

---

## 4. Proposed Information Architecture & Navigation Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 PROPOSED ENTERPRISE SAAS NAVIGATION MODEL                  │
└─────────────────────────────────────────────────────────────────────────────┘

  PLATFORM TOP BAR
  ├── [Brand Mark] Gokul Connect
  ├── [Workspace Switcher Dropdown]
  │   ├── Active: Gokul's Astrological Insights  ✓
  │   ├── Switch to: Gokul Vivaham
  │   └── Manage Workspaces (Hub)
  ├── [Tenant Guard Badge] RLS Active
  └── [User Profile Dropdown]
      ├── Profile Details
      ├── Switch Business
      └── Sign Out

  WORKSPACE SIDEBAR
  ├── SECTION 1: OPERATIONS
  │   ├── Dashboard              (/workspace/[slug]/dashboard)
  │   ├── Live Inbox             (/workspace/[slug]/inbox)
  │   │   ├── Deep routes:       (/workspace/[slug]/inbox?folder=unread&c=id)
  │   └── Customers (CRM)        (/workspace/[slug]/customers)  [Phase 5 Planned]
  │
  ├── SECTION 2: WHATSAPP ENGINE
  │   ├── WhatsApp Numbers       (/workspace/[slug]/connections)
  │   ├── Message Templates      (/workspace/[slug]/templates)  [Phase 4B Planned]
  │   ├── Automation Rules       (/workspace/[slug]/automations)[Phase 4C Planned]
  │   └── Scheduled Follow-ups   (/workspace/[slug]/scheduled)  [Phase 6 Planned]
  │
  ├── SECTION 3: INTELLIGENCE
  │   ├── Analytics & Reports    (/workspace/[slug]/analytics)  [Phase 7 Planned]
  │   └── Broadcast Campaigns    (/workspace/[slug]/campaigns)  [Phase 7 Planned]
  │
  └── SECTION 4: ADMINISTRATION
      └── Workspace Settings     (/workspace/[slug]/settings)
          ├── Tabs: Profile | Routing | Notifications | Team Access
```

---

## 5. Identified Navigation Issues & Recommended Improvements

| # | Current Flaw | Impact | Recommended Solution | Priority |
|---|---|---|---|---|
| **1** | **Dead Links in Sidebar** (6 links lead to 404 pages) | High frustration, unprofessional appearance | Convert unimplemented links into **disabled items** with a distinct "Coming in Phase X" tooltip, or hide them until routes are created. | **High** |
| **2** | **Disruptive Workspace Switcher** (forces full cache wipe & redirect) | Slows down dual-business management | Implement an **in-header dropdown switcher** allowing direct switching between `/workspace/astrology/*` and `/workspace/vivaham/*` with automatic cache re-keying. | **High** |
| **3** | **No Conversation URL Sync** (inbox relies purely on local state) | Cannot bookmark, share, or use browser back/forward buttons | Update inbox to use URL query parameters: `/workspace/[slug]/inbox?c=[convId]&folder=[folder]`. | **High** |
| **4** | **Unclickable Dashboard Metric Cards & Enquiries** | Broken operator triage workflow | Make all 8 KPI cards and Recent Enquiry rows clickable, routing directly to the Inbox filtered by corresponding criteria. | **Medium** |
| **5** | **Mobile Inbox Folder Trapping** | Mobile users cannot switch folders or numbers | Add a mobile drawer or sliding sheet triggered by a folder icon in the conversation list header. | **High** |
| **6** | **Static User Profile in Header** | No direct logout or profile controls | Add an accessible dropdown menu with User Details, Switch Business, and Authenticated Logout action. | **Medium** |
| **7** | **Monolithic Settings Page** | Difficult navigation on long settings form | Introduce sub-tabs (`Tabs` primitive): General Profile, WhatsApp Routing, and Alerts & Notifications. | **Low** |

---

## 6. Implementation Priorities & Next Steps

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    NAVIGATION REFACTORING ROADMAP                          │
├───────────────┬────────────────────────────────────────────────────────────┤
│ Priority 1    │ Immediate Navigation Fixes (Sprint 4A Follow-up)           │
│ (Critical)    │ 1. Disable unimplemented sidebar links to eliminate 404s.  │
│               │ 2. Sync active conversation ID with browser URL query.     │
│               │ 3. Add mobile folder drawer trigger in WhatsApp inbox.     │
├───────────────┼────────────────────────────────────────────────────────────┤
│ Priority 2    │ Workflow Accelerators (Sprint 4B)                          │
│ (High)        │ 1. Make Dashboard metric cards link to filtered inbox views│
│               │ 2. Make Recent Enquiry table rows link to specific chats.  │
│               │ 3. Add interactive user dropdown with proper logout.       │
├───────────────┼────────────────────────────────────────────────────────────┤
│ Priority 3    │ Shell Architecture Enhancements (Sprint 5)                 │
│ (Medium)      │ 1. Implement inline Workspace Switcher dropdown in header. │
│               │ 2. Add collapsible sidebar icon rail mode for laptops.     │
│               │ 3. Implement tabbed layout for Workspace Settings.         │
└───────────────┴────────────────────────────────────────────────────────────┘
```
