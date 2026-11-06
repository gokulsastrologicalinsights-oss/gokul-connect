# Gokul Connect
### Multi-Business WhatsApp Automation & Customer Management Platform

Gokul Connect is an enterprise-grade, multi-tenant WhatsApp automation and customer management platform designed to operate two distinct businesses independently within a single, secure architecture:

1. **Gokul's Astrological Insights**
   - Horoscope enquiries & Vedic/KP analysis
   - Consultation bookings & calendar scheduling
   - Payment follow-ups & communication

2. **Gokul Vivaham**
   - Tamil matrimony enquiries
   - New registration enquiries & member verification
   - Profile-related enquiries & payment follow-ups

---

## 🔒 Strict Business Separation (Multi-Tenant Architecture)

- **Dedicated Business Selection Screen:** Upon authenticating at the common login, users are presented with two distinct business cards.
- **Independent Workspaces:** Each business operates with its own dashboard, inbox, CRM, WhatsApp connections, automations, templates, scheduled messages, and analytics.
- **Zero Data Leakage:** Business separation is enforced across all 5 layers:
  1. **Database Level:** Every business-owned record contains a `business_id` foreign key.
  2. **Row Level Security (RLS) Level:** PostgreSQL policies ensure tenants only access records matching authorized membership.
  3. **API Level:** Server-side guards inspect user sessions and reject unauthorized requests.
  4. **Server Authorization Level:** Client-supplied business IDs are never trusted blindly.
  5. **Frontend Level:** Cache is explicitly cleared when switching businesses; no combined dashboard or inbox is ever shown.

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

> **Note on Infrastructure Independence:**
> Gokul Connect is completely decoupled from any prior projects. When dedicated Supabase, Vercel, and Meta accounts are provisioned, update `.env.local` with those credentials.

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Running Automated Tenant Isolation Tests
```bash
npm run test
```

---

## 📁 Repository Structure

```
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx                # Common Application Login
│   │   │   └── forgot-password/page.tsx      # Password Recovery
│   │   ├── select-business/page.tsx          # Dedicated Business Selection Screen
│   │   ├── workspace/[businessSlug]/
│   │   │   ├── layout.tsx                    # Scoped Workspace Layout & Tenant Guard
│   │   │   ├── dashboard/page.tsx            # Isolated Business Dashboard
│   │   │   └── settings/page.tsx             # Business Workspace Settings
│   │   ├── layout.tsx
│   │   ├── page.tsx                          # Root Redirect to Business Hub
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                               # Button, Card, Badge, Input
│   │   └── workspace/                        # WorkspaceHeader, Sidebar, SwitchBusinessButton
│   ├── lib/
│   │   ├── auth/tenant-guard.ts              # Server-side tenant membership authorization
│   │   ├── supabase/                         # Client, Server, and Admin Supabase clients
│   │   └── mock-data.ts                      # Local initial seed data
│   └── types/
│       └── database.ts                       # TypeScript schemas
├── supabase/
│   └── migrations/
│       └── 20261106_001_phase1_foundation.sql # DB migration for dedicated Supabase project
└── tests/
    └── tenant-isolation.test.ts              # Automated tests verifying strict tenant boundaries
```
