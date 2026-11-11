# Gokul Connect
### Multi-Business WhatsApp Automation & Customer Management Platform

Gokul Connect is an enterprise-grade, multi-tenant WhatsApp automation and customer management platform designed to operate two distinct businesses independently within a single, secure architecture:

1. **Gokul's Astrological Insights** (`astrology`)
   - Horoscope enquiries & Vedic/KP analysis
   - Consultation bookings & calendar scheduling
   - Payment follow-ups & communication

2. **Gokul Vivaham** (`vivaham`)
   - Tamil matrimony enquiries
   - New registration enquiries & member verification
   - Profile-related enquiries & payment follow-ups

---

## 🔒 Strict Business Separation (Multi-Tenant Architecture)

- **Dedicated Business Selection Screen:** Upon authenticating at the common login, users are presented with two distinct business cards.
- **Independent Workspaces:** Each business operates with its own dashboard, inbox, CRM, WhatsApp connections, automations, templates, scheduled messages, and analytics.
- **Zero Cross-Tenant Leakage:** Business separation is enforced across all 5 layers:
  1. **Database Level:** Every business-owned record contains a `business_id` foreign key.
  2. **Row Level Security (RLS) Level:** PostgreSQL policies ensure tenants only access records matching authorized membership.
  3. **API Level:** Server-side guards inspect user sessions and reject unauthorized requests.
  4. **Server Authorization Level:** Client-supplied business IDs are never trusted blindly.
  5. **Frontend Level:** Cache is explicitly cleared when switching businesses; no combined dashboard or inbox is ever shown.

---

## 🛡️ Security Architecture & Phase 2.2 Patches

### 1. Hardened PostgreSQL Migrations (Local Schema Files)
- **Safe `search_path` on SECURITY DEFINER Functions:** `public.check_user_business_access()`, `public.is_superadmin()`, and `public.handle_new_user()` explicitly declare `SET search_path = public, pg_temp` to prevent schema-hijacking vulnerabilities.
- **Restricted EXECUTE Privileges:** Privileged functions revoke `EXECUTE` from `PUBLIC` and grant access strictly to `authenticated` and `service_role`.
- **Tenant Immutability Triggers:** `wa_connections` and `business_settings` have triggers (`trg_wa_connections_immutable_business_id`) that forbid modifying `business_id` during updates, preventing cross-tenant transfer attacks.
- **Composite Foreign Key Integrity:** `business_settings.default_connection_id` uses a composite foreign key `(default_connection_id, business_id) REFERENCES public.wa_connections(id, business_id)` to ensure default numbers cannot point to another tenant.

### 2. Envelope Encryption Architecture (AES-256-GCM)
- Meta Access Tokens are encrypted server-side using **AES-256-GCM** with a unique 12-byte initialization vector (IV) per encryption and a 16-byte authentication tag.
- Tokens are never exposed in browser bundles, DOM attributes, HTML payloads, or client DTOs.
- `toSafeConnection()` outputs only a masked reference hint (`Ref: ••••••••0192`).
- Safe logging utilities ensure tokens are never dumped into console or server logs.

### 3. Pre-Production Security Hardening (Phase 3H)
- **Dependency Vulnerabilities Remediated (0 Vulnerabilities):** Patched `tinypool` (prototype pollution RCE), `postcss` (source map path traversal / XSS), and `zod` (memory exhaustion). Zero vulnerabilities reported in `npm audit`.
- **Webhook Fail-Closed Architecture:** Meta webhook POST handler strictly fails closed (HTTP 500) if `META_APP_SECRET` is unset in production. Validates HMAC signatures using `crypto.timingSafeEqual`. Insecure dev mode strictly requires explicit `ALLOW_INSECURE_WEBHOOKS=true`.
- **Hardened Webhook Events RLS (Migration 008):** Unassigned inbound webhook payloads (`business_id IS NULL`) are restricted exclusively to superadmins and service role. Ordinary business members can read only verified business-owned events.
- **Full Session Revocation & Sign-Out:** Real `signOutAction` and `/api/auth/signout` route invalidate Supabase JWTs, purge client caches, delete all `sb-*-auth-token` cookies with `Max-Age=0`, and bounce back-navigation to `/login`.
- **Server-Side Sliding-Window Rate Limiting:** Zero-cost in-memory rate limiting throttles login attempts (5/min), outbound WhatsApp messages (30/min), sensitive actions (15/min), and blocks repeated invalid webhook signature attempts for 5 minutes.

---

## ⚡ Zero-AI Deterministic Rule Automation

Gokul Connect does **NOT** use any AI models (no OpenAI, no Gemini API, no Claude, no local LLMs).  
All automations are 100% deterministic, rule-based, and human-in-the-loop:
- Exact and multi-keyword matching in Tamil and English
- Numbered menu navigation with state machines
- Predefined fallback responses
- Instant manual takeover and automation pause for human agents

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
- Node.js 18+ (tested on Node v24.14.0)
- npm 10+
- Git

### 2. Installation
```bash
# Clone or navigate to the repository
cd "Whatsapp Automation"

# Install dependencies
npm install
```

### 3. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env.local
```

> [!IMPORTANT]
> **Infrastructure Independence:**
> Gokul Connect is completely decoupled from any prior projects. When dedicated Supabase, Vercel, and Meta accounts are provisioned, update `.env.local` with those credentials.
> **DO NOT** connect to any existing Supabase projects.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running Automated Tests
```bash
npm run test
```
All 92 unit, multi-tenant isolation, webhook security, and database integration tests will run via Vitest.

---

## ⏱️ Background Scheduling & Cron Jobs (cron-job.org)

To bypass Vercel Hobby plan limitations (which restricts native crons to a maximum of 2 jobs running only once per day), scheduled background jobs are externally triggered via **[cron-job.org](https://cron-job.org)**.

All cron endpoints are secured using fail-closed Bearer token authentication matching the server-side `CRON_SECRET` environment variable and protected against concurrency overlap with PostgreSQL distributed locks.

### Scheduled Endpoints & Intervals

| Endpoint | Schedule / Interval | Purpose |
| :--- | :--- | :--- |
| `/api/cron/process-automation-jobs` | Every 2 minutes (`*/2 * * * *`) | Processes due automation queue jobs, runs message follow-ups, and prunes stale records |
| `/api/cron/process-scheduled-messages` | Every 5 minutes (`*/5 * * * *`) | Dispatches due pre-scheduled WhatsApp messages |
| `/api/cron/process-campaigns` | Every 10 minutes (`*/10 * * * *`) | Processes broadcast campaigns and batch delivery pipelines |
| `/api/cron/process-crm-reminders` | Every 15 minutes (`*/15 * * * *`) | Generates scheduled CRM reminders and lead follow-up notifications |

### Security & Header Setup

Every job configured on cron-job.org includes the authorization header:
```http
Authorization: Bearer <CRON_SECRET>
```

- **Fail-Closed Verification:** Constant-time SHA-256 buffer comparison (`verifyCronAuthorization`) rejects any unauthenticated requests with `401 Unauthorized`.
- **Distributed Lock Guard:** PostgreSQL RPC lock acquisition ensures multi-instance concurrency safety across serverless invocations.
- **Execution Limits:** Configured in `vercel.json` with `maxDuration: 60` for serverless execution stability.

---

## 📁 Repository Structure

```
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx                # Common Application Login
│   │   │   └── forgot-password/page.tsx      # Password Recovery
│   │   ├── actions/
│   │   │   ├── connections.ts                # Server Actions for connections & settings
│   │   │   ├── inbox.ts                      # Server Actions for inbox status, read & messages
│   │   │   └── messaging.ts                  # Server Action for outbound WhatsApp sending
│   │   ├── api/
│   │   │   └── webhooks/whatsapp/route.ts    # Meta Cloud API Webhooks (GET & POST)
│   │   ├── select-business/page.tsx          # Dedicated Business Selection Screen
│   │   ├── workspace/[businessSlug]/
│   │   │   ├── layout.tsx                    # Scoped Workspace Layout & Tenant Guard
│   │   │   ├── connections/page.tsx          # WhatsApp Connection Manager
│   │   │   ├── dashboard/page.tsx            # Isolated Business Dashboard
│   │   │   ├── inbox/page.tsx                # Live 3-Panel WhatsApp Inbox
│   │   │   └── settings/page.tsx             # Business Workspace Settings
│   │   ├── layout.tsx
│   │   ├── page.tsx                          # Root Redirect to Business Hub
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                               # Button, Card, Badge, Input
│   │   ├── inbox/                            # NavPanel, ListPanel, ChatWindowPanel, InboxClient
│   │   └── workspace/                        # Header, Sidebar, SwitchButton, Client Managers
│   ├── lib/
│   │   ├── auth/tenant-guard.ts              # Server-side tenant authorization
│   │   ├── connections/store.ts              # Secure server vault & connection service
│   │   ├── crypto/encryption.ts              # AES-256-GCM encryption & safe logging
│   │   ├── inbox/                            # database.ts (live Supabase queries) & store.ts
│   │   ├── supabase/                         # Client, Server, and Admin Supabase clients
│   │   └── whatsapp/                         # Official Meta client v26.0, service & signatures
│   └── types/
│       └── database.ts                       # TypeScript schemas
├── supabase/
│   └── migrations/
│       ├── 20261106_001_phase1_foundation.sql    # Phase 1 Migration with safe search_path & non-recursive RLS
│       ├── 20261106_002_phase2_wa_connections.sql # Phase 2 Migration with triggers & composite FK
│       ├── 20261106_003_phase2_wa_credentials.sql # Phase 2.3 Migration for AES-256-GCM credential vault
│       ├── 20261106_004_phase2_privilege_escalation_guard.sql # Phase 2.4 Migration for privilege escalation guard
│       ├── 20261106_005_phase3_messaging_schema.sql # Phase 3 Migration for contacts, convs & messages
│       └── 20261106_006_phase3_webhook_persistence_rpcs.sql # Phase 3 Migration for atomic webhook RPCs
└── tests/
    ├── fixtures/inbox-mock-data.ts           # Isolated test fixtures (never leaked to production)
    ├── tenant-isolation.test.ts              # Phase 1 isolation tests (7 tests)
    ├── phase2-connections.test.ts            # Phase 2 connections manager tests (9 tests)
    ├── phase2-security-patches.test.ts       # Phase 2.2 security patches tests (6 tests)
    ├── phase2-authenticated-rls.test.ts      # Phase 2.4 authenticated multi-tenant tests (10 tests)
    ├── phase2-credential-security.test.ts    # Phase 2.4 AES-256-GCM vault security tests (8 tests)
    ├── phase2-persistence.test.ts            # Phase 2.4 persistence lifecycle tests (6 tests)
    ├── phase2-server-authorization.test.ts   # Phase 2.4 server-side authorization tests (6 tests)
    ├── phase3-whatsapp-architecture.test.ts  # Phase 3 Meta client & service tests (10 tests)
    ├── phase3-webhooks.test.ts               # Phase 3D Webhook verification tests (5 tests)
    ├── phase3f-end-to-end-validation.test.ts # Phase 3F E2E validation tests (11 tests)
    └── phase4-inbox.test.ts                  # Phase 4A.1 Live Supabase inbox integration tests (14 tests)
```
