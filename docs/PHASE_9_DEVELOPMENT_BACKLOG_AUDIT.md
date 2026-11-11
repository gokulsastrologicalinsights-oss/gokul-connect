# Phase 9: Local Development Continuation Audit & Backlog Report

**Project:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Project Directory:** `E:\GAI\Whatsapp Automation`  
**Audit Date:** November 7, 2026  
**Auditor:** Antigravity AI Pair Partner  
**Target Environment:** Strictly Local Development (`http://localhost:3000`)  
**Backend:** Dedicated Supabase Project (`ansiwtwqgrfmzfrhkzuu`, AWS `ap-south-1`)  
**Current Test Baseline:** 29 Test Files, 350 Tests Passing (100% Clean)  
**TypeScript Typecheck:** 0 Errors (`npx tsc --noEmit`)  
**Security Status:** 0 Package Vulnerabilities (`npm audit`)  

---

## 1. Executive Summary

Following the completion of **Phase 8.2 / 8.4** (incorporating admin provisioning, mandatory password reset, and local functional verification), a comprehensive audit of the entire Gokul Connect application was conducted across source code, database migrations, server actions, client components, API routes, and test suites.

The objective was to identify all incomplete features, placeholder implementations, non-functional UI elements, missing database persistence operations, and functional gaps across **Inbox & Messaging**, **WhatsApp Connection Management**, **Automation Engine**, **Customer CRM**, **Analytics & Reporting**, and **Usability / Testing**.

This audit clearly distinguishes **genuinely unfinished work** from **features already implemented and verified**, ensuring completed modules (such as multi-tenant isolation, cryptographic webhook verification, background queue concurrency, and deterministic keyword matching) are preserved without redundant rewriting.

---

## 2. Inventory of Completed & Verified Modules (Preserved Baseline)

The following components have been fully developed, hardened, and verified with 350 automated tests. **These do NOT require reimplementation:**

1. **Multi-Tenant Workspace Isolation (Phase 1, 2.4, 7.5):**
   - 16 of 16 PostgreSQL tables enforced with strict Row-Level Security (RLS).
   - Server-side tenant validation guards (`src/lib/auth/tenant-guard.ts`).
   - Cross-tenant URL tampering prevention (e.g. Vivaham user accessing Astrology route returns `403` / redirects to business selection).
   - Tenant immutability triggers on `wa_connections`, `business_members`, and `business_settings`.
   - Client cache clearing on business switch (`SwitchBusinessButton`).

2. **Authentication & Session Lifecycle (Phase 1, 8.3, 8.4):**
   - Supabase GoTrue Auth integration (`@supabase/ssr`).
   - Rate-limited login with sliding-window brute-force defense.
   - Secure sign-out purging all `sb-` authentication cookies.
   - Password recovery flow with `/auth/callback` code exchange and `/update-password` page.
   - Mandatory first-time password reset enforcement (`must_change_password`) blocking workspace access until updated.

3. **Inbound Webhook Pipeline & Security (Phase 3, 3H, 7.5, 7.5.7):**
   - GET verification challenge handshake (`hub.mode === 'subscribe'`).
   - POST timing-safe HMAC-SHA256 signature verification (`crypto.timingSafeEqual`).
   - Fail-closed security when `META_APP_SECRET` is missing.
   - Fast-path deduplication via `meta_message_id`.
   - Sub-millisecond asynchronous ingestion decoupling enqueuing to `wa_processing_jobs`.
   - Live applied forward-only migrations 001–012 on dedicated Supabase cloud.

4. **Background Worker & Concurrency Engine (Phase 5, 7.5):**
   - Atomic job claiming with `SELECT ... FOR UPDATE SKIP LOCKED` (`claim_next_wa_jobs`).
   - Stuck job recovery for jobs running >5 minutes (`reclaim_stuck_wa_jobs`).
   - Exponential backoff with jitter and retry boundaries (max 5 attempts).
   - Timing-safe authenticated Cron trigger (`/api/cron/process-automation-jobs`).
   - Automated pruning RPC (`prune_stale_automation_records`).

5. **Rule-Based Automation Engine Core (Phase 5):**
   - 100% deterministic (zero non-deterministic AI dependencies).
   - Bilingual keyword normalization (Tamil Unicode NFC glyph composition and English case folding).
   - Business hours evaluation in `Asia/Kolkata` timezone.
   - Mandatory opt-out keyword detection (`STOP`, `UNSUBSCRIBE`, `நிறுத்து`) and opt-in handling (`START`, `தொடங்கு`).
   - Human handover escalation keyword detection (`AGENT`, `HUMAN`, `உதவி`, `மனிதர்`).
   - In-memory dry-run simulator on `/workspace/[slug]/automations`.

6. **Credential Security & Encryption Vault (Phase 2, 2.2):**
   - AES-256-GCM authenticated encryption with NIST SP 800-38D compliant 12-byte random IVs and 16-byte auth tags.
   - Safe DTO projection completely scrubbing raw or encrypted tokens from frontend payloads.

---

## 3. Comprehensive Gap & Backlog Analysis

### 3.1. Dashboards & Workspace Selection Gaps
- **Hardcoded Dashboard KPI Metrics:** In `src/app/workspace/[businessSlug]/dashboard/page.tsx` (lines 48–94), all 8 KPI cards (*Total Customers*, *New Enquiries Today*, *Unread Conversations*, *Pending Replies*, *Automated Replies*, *Manual Replies*, *Scheduled Follow-ups*, *Avg Response Time*) are static, hardcoded numbers (e.g. `142` for Astrology, `318` for Vivaham). Live messages are fetched only for the recent message list, while KPI statistics never reflect real database records.
- **Disconnected Business Selection Stats:** In `src/app/select-business/page.tsx` (lines 141–180), business cards query `businesses(*)` from Supabase. The `stats` object is not a column in `businesses`, so cards fall back to `"Not Connected"`, `"0 Unread Enquiries"`, and `"0 Pending Replies"` for all live accounts.
- **Hardcoded Recent Enquiries Fallback:** In `BusinessDashboardPage`, if live messages are empty, it renders static mock inquiries (`K. R. Vignesh`, `Meenakshi Sundaram`, etc.) rather than an empty state.

### 3.2. Inbox & Customer Conversation Management Gaps
- **Static Conversation List (No Polling or Realtime):** In `src/components/inbox/InboxClient.tsx` (lines 81–125), polling every 4 seconds only refreshes messages for the *currently selected conversation*. The conversation list, unread counters, and incoming new threads never update unless the user manually refreshes the browser.
- **Hardcoded Assigned Agent ("agent-gokul"):** 
  - In `ChatWindowPanel.tsx` (lines 443–457), the agent assignment dropdown hardcodes only `"Unassigned"` and `"Gokul Murugan"` (`agent-gokul`).
  - In `InboxClient.tsx` (line 193 and 234), the `"Assigned to Me"` folder filter hardcodes `c.assigned_agent_id === "agent-gokul"`. Any real logged-in team member cannot see conversations assigned to their user ID.
  - The inbox does not query real members from `business_members` or `user_profiles`.
- **Missing Conversation Label / Tagging UI:** Conversation tags (`labels`) are rendered in `ChatWindowPanel.tsx` and `ConversationListPanel.tsx`, but there are no controls or server actions to add, edit, or remove tags.
- **Missing Conversation Pagination / Infinite Scroll:** `getConversationsForBusiness` retrieves an initial window. `ConversationListPanel.tsx` has no infinite scroll or "Load More Conversations" button.
- **Missing In-Thread Message Search:** Search in the inbox only filters the conversation list by contact name or snippet; there is no search within message transcripts.
- **Missing Internal Notes / Private Comments:** Support agents cannot leave private internal notes on customer conversations.
- **No Media Support in Chat:**
  - `ChatWindowPanel.tsx` only renders plain text bubbles (`msg.content`).
  - Composer has no file attachment, image upload, audio recorder, or PDF sending capabilities.
  - Inbound media (images, PDFs, voice notes) are not rendered with previews or download links.

### 3.3. WhatsApp Connection Management Gaps
- **Missing Access Token Update / Rotation:**
  - In `src/components/workspace/ConnectionsManagerClient.tsx` and `src/app/actions/connections.ts`, the edit modal only updates `display_name`, `phone_number`, and `description`.
  - `UpdateWhatsAppConnectionSchema` does not allow updating `access_token`.
  - When a Meta access token expires or requires rotation, the administrator has no UI path to update the token without deleting and recreating the connection.
- **Missing Default Connection Designation:**
  - Neither `ConnectionsManagerClient.tsx` nor `BusinessSettingsClient.tsx` provides an action or button to set or switch the default WhatsApp connection line.
- **Missing Meta WABA Information Fetching:**
  - The connection test only checks stored parameter presence; it does not query live WABA profile details, messaging tier, or phone quality rating from Graph API.

### 3.4. Message Templates & Parameter Handling Gaps
- **No Message Templates Manager (`/workspace/[slug]/templates`):** Sidebar link is marked `isImplemented: false` and returns 404. There is no UI to view approved templates, sync templates from Meta Graph API, or submit new templates.
- **Missing Dynamic Template Variable Inputs:** In `ChatWindowPanel.tsx` (lines 213–230), the template modal sends templates with `languageCode: "en_US"` and an empty components array. There is no form UI to provide dynamic parameters (e.g. `{{1}}`, `{{2}}`), causing parameterized templates to fail delivery.

### 3.5. Customer CRM & Contact Management Gaps
- **Zero Contact Directory Screen (`/workspace/[slug]/customers`):** Sidebar link is marked `isImplemented: false` and returns 404.
- **No Contact Creation / Edit UI:** Contacts can only be created automatically via inbound webhooks. An agent cannot manually register a new customer or edit existing customer info.
- **Missing Business-Specific Custom Metadata:**
  - Astrology requires: Date of Birth, Time of Birth, Place of Birth, Rasi, Nakshatra, Lagna, Consultation Notes.
  - Vivaham requires: Profile ID, Caste/Subsect, Education, Profession, Horoscope Matching Status, Family Details.
  - Currently, `wa_contacts.metadata` is unused by the UI.
- **No Contact Export / Import:** No CSV or Excel export/import capabilities for contacts.
- **No Manual Opt-Out / Opt-In Override:** Agents cannot manually toggle a customer's opt-in/opt-out status from the UI.

### 3.6. Automation Engine & Follow-up Scheduler Gaps
- **No Scheduled Messages Workbench (`/workspace/[slug]/scheduled`):** Sidebar link is marked `isImplemented: false` and returns 404. There is no dashboard to view queued follow-up messages, inspect execution times, or cancel pending jobs.
- **Missing `send_template_message` Action in Rule Builder:** In `AutomationsClient.tsx` (lines 690–694), the action type dropdown only includes `send_text_message`, `schedule_follow_up`, `update_conversation_status`, and `apply_contact_label`. `send_template_message` is missing, preventing automated re-engagement outside the 24-hour service window.
- **No Webhook Retry Policy Enforcement:** In `BusinessSettingsClient.tsx`, the `webhook_retry_policy` setting is stored in DB but never used by the worker or webhook pipeline.

### 3.7. Business Analytics & Reporting Gaps
- **Zero Analytics Dashboard (`/workspace/[slug]/analytics`):** Sidebar link is marked `isImplemented: false` and returns 404.
- **Missing Historical Trends:** No tracking or display of daily inbound/outbound volumes, delivery rates, response times, or automation containment rate.
- **Missing Exportable Reports:** No mechanism to export conversation or enquiry data for business accounting.

### 3.8. Team & Workspace Member Management Gaps
- **No Member Management UI:** Workspace owners/admins have no screen to view team members, invite new staff, or update roles (`owner`, `admin`, `agent`).
- **No Agent Roster in Workspace Context:** Multi-agent collaboration in Inbox cannot function dynamically without loading real members.

---

## 4. Priority Ranking Matrix

| Priority | Item ID | Area | Gap Description | Impact |
|:---:|:---:|---|---|---|
| **P0 (Critical)** | **GAP-01** | Dashboard | Hardcoded demo stats on Dashboard & Select Business pages | Prevents viewing real system metrics; misleading operational data |
| **P0 (Critical)** | **GAP-02** | Inbox | Missing live conversation list polling & unread badge sync | Requires full page reload to see incoming customer messages |
| **P0 (Critical)** | **GAP-03** | Inbox | Hardcoded `"agent-gokul"` assignment and filtering | Breaks multi-agent workflow; team members cannot see assigned chats |
| **P0 (Critical)** | **GAP-04** | Connections | Cannot update/rotate Meta access token on existing connection | Forces admin to delete connection upon token expiry |
| **P0 (Critical)** | **GAP-05** | Connections | Cannot designate or switch the default WhatsApp connection line | Blocks multi-number routing control |
| **P1 (High)** | **GAP-06** | Composer | Template modal lacks dynamic variable parameter inputs | Parameterized Meta templates cannot be dispatched |
| **P1 (High)** | **GAP-07** | CRM | Missing Customer Directory (`/customers`), contact detail view & edit | Cannot manage customer profiles or search contacts outside inbox |
| **P1 (High)** | **GAP-08** | CRM | Missing business-specific metadata (Astrology birth details, Vivaham profile ID) | Inability to record consultation or matchmaking data |
| **P1 (High)** | **GAP-09** | Inbox | Missing conversation tagging / label management UI | Inability to organize or categorize enquiries |
| **P1 (High)** | **GAP-10** | Inbox | Missing conversation list pagination / infinite scroll | Inability to browse older customer conversations |
| **P2 (Medium)** | **GAP-11** | Automations | Missing Scheduled Messages UI (`/scheduled`) to inspect/cancel pending jobs | Operators cannot see or manage queued follow-ups |
| **P2 (Medium)** | **GAP-12** | Automations | Rule builder lacks `send_template_message` action | Cannot automate 24h window re-engagement |
| **P2 (Medium)** | **GAP-13** | Templates | Missing Template Management screen (`/templates`) & WABA sync | Cannot view or manage approved templates |
| **P2 (Medium)** | **GAP-14** | Analytics | Missing Analytics Dashboard (`/analytics`) with charts & delivery rates | No visibility into customer volume trends or SLA response times |
| **P2 (Medium)** | **GAP-15** | Team | Missing Team Members management screen under Settings | Cannot invite or manage agents without direct DB access |
| **P3 (Low)** | **GAP-16** | Media | Missing image/document/audio attachments in inbox composer | Limited to plain text communication |
| **P3 (Low)** | **GAP-17** | Settings | Notification checkboxes have no backend delivery mechanism | Cosmetic setting only |
| **P3 (Low)** | **GAP-18** | CRM | Missing CSV/Excel contact import and export | Bulk operations unavailable |
| **P3 (Low)** | **GAP-19** | Inbox | Missing canned responses / quick replies picker | Agents re-type repetitive messages |
| **P3 (Low)** | **GAP-20** | Flows | Missing Visual Flow Builder (`/flows`) | Advanced branching requires code configuration |

---

## 5. Recommended Next Phase: Phase 9.1 — Core Data Persistence & Operational Gaps Remediation

To advance local development efficiently without rewriting stable modules, it is recommended to execute **Phase 9.1** addressing the **Critical (P0)** and top **High (P1)** operational gaps.

### Phase 9.1 Scope of Work

1. **Task 1: Dynamic Dashboard & Business Selection Metrics Aggregation**
   - Create a dedicated database query / RPC (`get_business_dashboard_metrics`) computing:
     - Real total contacts scoped to business.
     - New enquiries today (IST timezone).
     - Unread conversation count.
     - Pending replies within 24-hour service window.
     - Automated vs manual reply counts from `wa_messages`.
     - Scheduled pending jobs count from `wa_processing_jobs`.
   - Update `src/app/workspace/[businessSlug]/dashboard/page.tsx` to render real calculated metrics.
   - Update `src/app/select-business/page.tsx` to display live unread and connection status for each tenant.

2. **Task 2: Dynamic Team Roster & Multi-Agent Inbox Assignment**
   - Query active members from `business_members` joined with `user_profiles` for the active business.
   - Pass real member list to `InboxClient` and `ChatWindowPanel`.
   - Replace hardcoded `"agent-gokul"` select options with dynamic member list.
   - Update `"Assigned to Me"` folder filtering to compare against the authenticated session user ID (`user.id`).

3. **Task 3: Live Conversation List Synchronization**
   - Implement periodic polling or server action sync for the conversation list in `InboxClient.tsx` (refreshing every 6–8 seconds when tab is active).
   - Ensure incoming new conversations and unread counters dynamically appear without full page reloads.

4. **Task 4: WhatsApp Connection Token Rotation & Default Connection Switcher**
   - Add `access_token` (optional) to `UpdateWhatsAppConnectionSchema`.
   - Add a "Rotate / Update Access Token" section in the Connection Edit modal.
   - Add a server action and UI button to mark a connection as the `default_connection_id` for the business.

5. **Task 5: Template Dynamic Parameter Form in Message Composer**
   - Enhance the template selection modal in `ChatWindowPanel.tsx` to detect variable placeholders (e.g. `{{1}}`, `{{2}}`) from template components.
   - Render dynamic input fields for each placeholder so the operator can provide values (e.g. customer name, date).
   - Pass formatted components array to `sendWhatsAppMessageAction`.

6. **Task 6: Conversation Label & Tagging Management**
   - Add server action `updateConversationLabelsAction(businessSlug, conversationId, labels)`.
   - Add interactive tag editor badge with add/remove dropdown in `ChatWindowPanel.tsx` header.

---

## 6. Acceptance Criteria for Phase 9.1

- [ ] **AC-1 (Live Dashboard Metrics):** Navigating to `/workspace/astrology/dashboard` and `/workspace/vivaham/dashboard` displays metrics computed from live database rows. Zero hardcoded stats exist. If no messages exist, counters show `0` with clean empty states.
- [ ] **AC-2 (Live Business Selection Stats):** The cards on `/select-business` display actual connected line counts and unread enquiry counts for each tenant.
- [ ] **AC-3 (Dynamic Agent Assignment):** The Assigned Agent dropdown in the inbox lists all real team members of that business. Selecting an agent persists to `wa_conversations.assigned_agent_id` and `assigned_agent_name`.
- [ ] **AC-4 (Assigned to Me Filter):** Filtering by "Assigned to Me" accurately displays only conversations assigned to the currently logged-in user.
- [ ] **AC-5 (Live Inbox Polling):** Simulating an inbound message or new conversation causes the conversation list to update automatically within 8 seconds without page reload.
- [ ] **AC-6 (Token Rotation):** An administrator can edit an existing connection, enter a new Meta access token, and have it re-encrypted via AES-256-GCM in `wa_credentials` without recreating the connection.
- [ ] **AC-7 (Default Connection Switcher):** An administrator can set or change the default WhatsApp line, updating `business_settings.whatsapp_preferences.default_connection_id`.
- [ ] **AC-8 (Template Variables):** Selecting a template with variables renders inputs for each parameter, and submitting dispatches the payload with structured components.
- [ ] **AC-9 (Conversation Labels):** Agents can add and remove labels on an active conversation, updating both the chat header and the conversation list badge.
- [ ] **AC-10 (Test & Quality Gate):** All 350 existing tests continue to pass without regression; new unit/integration tests added covering token rotation, parameter formatting, and dynamic metrics; TypeScript typecheck has 0 errors; build compiles cleanly.

---

## 7. Subsequent Phases Roadmap Preview

- **Phase 9.2: Customer CRM & Contact Directory** (`/workspace/[slug]/customers`)
  - Full contact management directory with search, filter, and pagination.
  - Contact detail panel with edit capabilities.
  - Business-specific custom metadata (Astrology birth charts, Vivaham matrimonial profiles).
  - Manual contact creation & opt-in/opt-out toggling.
- **Phase 9.3: Scheduled Messages & Follow-Up Manager** (`/workspace/[slug]/scheduled`)
  - Workbench to view, filter, reschedule, and cancel queued follow-up messages.
  - Manual follow-up scheduler in inbox composer ("Send Later").
  - Automated rule builder enhancement for `send_template_message`.
- **Phase 9.4: Business Analytics & Reporting** (`/workspace/[slug]/analytics`)
  - Analytics dashboards with time-series charts (daily volume, inbound/outbound).
  - Delivery performance tracking (sent, delivered, read, failed).
  - SLA & first-response time monitoring.
  - Exportable summary reports (CSV).

---

*Report authored strictly in local development context. No deployment, external messaging, or database mutations executed.*
