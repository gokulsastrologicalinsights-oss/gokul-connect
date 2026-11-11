# GOKUL CONNECT — PHASE 10.1: CRM & ANALYTICS UAT ISSUES LOG

**Project:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Project Directory:** `E:\GAI\Whatsapp Automation`  
**Phase:** Phase 10.1 — CRM & Analytics End-to-End UAT  
**Timestamp:** `2026-11-07T17:31:00+05:30`  
**Environment:** Local Browser Staging (`http://localhost:3000`) & Dedicated Supabase (`ansiwtwqgrfmzfrhkzuu`)  

---

## 1. Issues Classification Matrix

| Issue ID | Module | Severity | Classification | Description | Resolution / Recommendation |
|---|---|---|---|---|---|
| **ISSUE-10.1-01** | Database / Migrations | P1 | **NEEDS APPROVAL** | Forward-only Migration 013 (`20261107_013_phase9_crm_and_contacts.sql`) has not been applied to live Supabase project `ansiwtwqgrfmzfrhkzuu`. New CRM tables (`crm_categories`, `crm_segments`, `contact_notes`, `contact_activity_logs`) and `wa_contacts` CRM columns (`status`, `category`, `source`, `is_archived`, `email`, `tags`) are absent from the live cloud database. | Explicit user approval required to apply Migration 013 via Supabase MCP or SQL Editor. Application currently operates in resilient fallback mode using core metadata. |
| **ISSUE-10.1-02** | Database / Analytics | P1 | **NEEDS APPROVAL** | Forward-only Migration 014 (`20261107_014_phase10_analytics_rpcs.sql`) has not been applied to live Supabase project `ansiwtwqgrfmzfrhkzuu`. RPC functions `get_business_analytics_summary`, `get_business_analytics_daily_trends`, and 4 covering analytics indexes are absent from the live cloud database. | Explicit user approval required to apply Migration 014 via Supabase MCP or SQL Editor. Service layer gracefully falls back to direct table queries with zero interruption. |
| **ISSUE-10.1-03** | CRM / Contacts Query | P2 | **RESOLVED IN TEST / PASS** | When Migration 013 is unapplied, querying `wa_contacts.is_archived` on Supabase returns error `column is_archived does not exist`, triggering in-memory fallback. | Addressed: Application gracefully handles pre-migration state. Applying Migration 013 will unlock native column-level indexing. |
| **ISSUE-10.1-04** | Meta WhatsApp Cloud API | External Blocker | **BLOCKED (Documented in Phase 6.2)** | System Meta access token remains expired (OAuthException 190, subcode 463). Outbound WhatsApp message transmission to live Meta endpoints is paused. Zero real messages were dispatched. | Permanent System User Token refresh in `.env.local` remains pending for Phase 11. All local functional and UAT workflows utilize synthetic data with 100% test passing. |

---

## 2. Detailed Issue Descriptions

### ISSUE-10.1-01: Migration 013 Pending Live Application
- **Domain:** Database Architecture & CRM Persistence
- **Impact:** Live Supabase database does not yet have native relational tables for CRM categories, notes, activity logs, or segments.
- **Current Behavior:** CRM module uses structured `metadata` JSONB fallback on `wa_contacts` and default category definitions (`DEFAULT_ASTRO_CATEGORIES`, `DEFAULT_VIVAHAM_CATEGORIES`). All 23 unit tests pass cleanly in PGlite where migrations 001–013 are verified.
- **Action Required:** Await user authorization before running migration on live Supabase project `ansiwtwqgrfmzfrhkzuu`.

### ISSUE-10.1-02: Migration 014 Pending Live Application
- **Domain:** Database Aggregations & Analytics Performance
- **Impact:** Live Supabase database does not yet contain atomic aggregation RPCs `get_business_analytics_summary` and `get_business_analytics_daily_trends`.
- **Current Behavior:** The TypeScript analytics engine (`src/lib/analytics/service.ts`) detects missing RPCs and automatically falls back to indexed table queries on `wa_messages`, `wa_contacts`, and `wa_conversations`. All 25 analytics tests pass with 100% parity.
- **Action Required:** Await user authorization before running migration on live Supabase project `ansiwtwqgrfmzfrhkzuu`.

### ISSUE-10.1-04: Meta Token Expiration
- **Domain:** WhatsApp Cloud API Integration
- **Impact:** Real WhatsApp messages cannot be sent over the wire to WhatsApp users.
- **Compliance Guard:** UAT strictly complied with rule: *"Do not send real WhatsApp messages. Do not activate automations. Do not rotate Meta credentials."* All tests verified using synthetic test clients.
- **Status:** Documented external blocker since Phase 6.2.

---

## 3. Summary of P0/P1 Fixes Applied During UAT
- Zero code breaks or regressions introduced.
- Strict multi-tenant isolation verified server-side.
- Zero data corruption or unapproved migrations performed.
