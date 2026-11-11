# Phase 8.2 — Manual UAT & Functional Validation Checklist

**Project:** Gokul Connect  
**Environment:** Local Windows PC (`http://localhost:3000`)  
**Backend:** Dedicated Supabase Project (`ansiwtwqgrfmzfrhkzuu`, AWS `ap-south-1`)  
**Status Legend:** `Pending` | `Pass` | `Fail` | `Blocked`  

---

## Pre-Test Check Verification

- [x] Next.js dev server running on port 3000 (Process ID: 15516).
- [x] `http://localhost:3000` accessible and responsive (HTTP 307 -> `/select-business` -> `/login`).
- [x] Dedicated Supabase connectivity confirmed (`ansiwtwqgrfmzfrhkzuu`).
- [x] Server and console free of unhandled crashes.
- [x] Both business workspaces available (`astrology`: Gokul's Astrological Insights, `vivaham`: Gokul Vivaham).
- [x] Test credentials ready (configured in local `.env.local`):
  - **User A (Astrology):** `user_a_astro@gokulconnect.com` / `<TEST_ASTROLOGY_USER_PASSWORD>`
  - **User B (Vivaham):** `user_b_vivaham@gokulconnect.com` / `<TEST_VIVAHAM_USER_PASSWORD>`

---

## Test Execution Matrix

### Module 1: Login and Authentication

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-AUTH-01** | Login Page Display & Initial State | 1. Navigate to `http://localhost:3000/login` in browser.<br>2. Observe page layout, branding, input fields, labels, and buttons. | Login form renders cleanly with Gokul Connect branding, Email and Password inputs with accessible labels, "Remember me" checkbox, "Forgot password?" link, and "Sign In" button. No console errors. | Pending | Pending | Initial test |
| **UAT-AUTH-02** | Form Validation — Empty Submission | 1. Navigate to `http://localhost:3000/login`.<br>2. Click "Sign In" with both fields empty. | Client-side validation triggers. Field error messages display for both email and password ("Please enter a valid email address", "Password is required"). Form is not submitted. | Pending | Pending | |
| **UAT-AUTH-03** | Form Validation — Invalid Email Format | 1. Enter `invalid-email-format` in Email.<br>2. Enter test password in Password.<br>3. Click "Sign In". | Error appears indicating invalid email format. No network authentication request made. | Pending | Pending | |
| **UAT-AUTH-04** | Invalid Credentials Rejection | 1. Enter `user_a_astro@gokulconnect.com` in Email.<br>2. Enter `WrongPassword123!` in Password.<br>3. Click "Sign In". | Authentication fails. An alert banner appears displaying "Invalid login credentials". User remains on `/login`. | Pending | Pending | |
| **UAT-AUTH-05** | Successful Login — Astrology User | 1. Enter `user_a_astro@gokulconnect.com` in Email.<br>2. Enter `<TEST_ASTROLOGY_USER_PASSWORD>` in Password.<br>3. Click "Sign In". | Spinner appears during request. Upon success, browser redirects to `/select-business` or `/workspace/astrology/dashboard`. Session cookie is established. | Pending | Pending | |
| **UAT-AUTH-06** | Forgot Password Navigation & Form | 1. From `/login`, click "Forgot password?".<br>2. Check URL and form elements.<br>3. Submit with valid test email. | Redirects to `/forgot-password`. Renders email input and "Send Reset Link" button. Submitting shows confirmation banner. | Pending | Pending | Safe test |

---

### Module 2: Business Selection

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-BIZ-01** | Business Selection Screen Layout | 1. Log in as `user_a_astro@gokulconnect.com`.<br>2. Navigate to `http://localhost:3000/select-business`. | Screen displays "Select Business Workspace" header with available business card(s) displaying business name, role badge, quick stats, and "Open Workspace" button. | Pending | Pending | |
| **UAT-BIZ-02** | Membership Filtering & Tenant Gate | 1. Inspect cards visible to Astrology user on `/select-business`. | User A sees "Gokul's Astrological Insights". If User A has no membership in Vivaham, Vivaham card is either absent or clearly restricted according to role. | Pending | Pending | RLS check |
| **UAT-BIZ-03** | Direct Navigation from Business Card | 1. On `/select-business`, click "Open Workspace" on "Gokul's Astrological Insights". | Browser routes smoothly to `/workspace/astrology/dashboard`. | Pending | Pending | |

---

### Module 3: Astrology Workspace

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-ASTRO-01** | Astrology Dashboard Overview | 1. Navigate to `/workspace/astrology/dashboard`.<br>2. Check header, sidebar, KPI metric cards, and recent enquiries. | Header displays "Gokul's Astrological Insights" with active badge. Metrics show Astrology-specific counts (total conversations, unread, active contacts, automations). Recent inquiries display only Astrology records. | Pending | Pending | |
| **UAT-ASTRO-02** | Astrology Sidebar Navigation | 1. In Astrology workspace, test clicking Sidebar links: Dashboard, WhatsApp Inbox, WhatsApp Connections, Automation Rules, Settings. | Active link highlights properly. Each page loads with `/workspace/astrology/...` URL prefix. Disabled items show planned badges without causing 404s. | Pending | Pending | |
| **UAT-ASTRO-03** | Tenant Data Confinement | 1. In Astrology dashboard, observe conversation IDs, contact names, and stats. | Zero Vivaham contacts, conversations, or connection names appear in any widget. | Pending | Pending | Isolation check |

---

### Module 4: Vivaham Workspace

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-VIV-01** | Vivaham User Login & Access | 1. Sign out if needed.<br>2. Log in with `user_b_vivaham@gokulconnect.com` / `<TEST_VIVAHAM_USER_PASSWORD>`.<br>3. Open Vivaham workspace (`/workspace/vivaham/dashboard`). | Successfully lands on `/workspace/vivaham/dashboard`. Header displays "Gokul Vivaham". Vivaham-specific metrics load. | Pending | Pending | |
| **UAT-VIV-02** | Cross-Tenant Protection (URL Tampering) | 1. While logged in as Vivaham user, manually type `/workspace/astrology/dashboard` in browser URL bar.<br>2. Press Enter. | Tenant guard blocks access. Redirects to `/select-business?error=unauthorized_business_access` with clear unauthorized warning banner. | Pending | Pending | Security test |
| **UAT-VIV-03** | Vivaham Data Confinement | 1. Inspect Vivaham dashboard metrics, connections, and inbox. | All data is strictly Vivaham matrimonial data. Zero astrological enquiries appear. | Pending | Pending | Isolation check |

---

### Module 5: Business Switching

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-SWITCH-01** | Switch Business Button Operation | 1. From workspace header, click "Switch Business" button. | Client clears active workspace cache keys (`active_workspace_cache`, `active_conversation_id`, etc.) and redirects cleanly to `/select-business`. | Pending | Pending | |
| **UAT-SWITCH-02** | Cache Purge Verification | 1. After switching businesses, inspect localStorage/sessionStorage in DevTools. | Previous workspace conversation and connection cache keys are purged; no stale state leaks into subsequent selection. | Pending | Pending | |

---

### Module 6: WhatsApp Connections

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-CONN-01** | Connections Page Display | 1. Navigate to `/workspace/astrology/connections`.<br>2. Inspect connection cards, status indicators, and "Add Connection" button. | Lists existing WhatsApp connections for Astrology. Cards show phone number, Phone Number ID, WABA ID, status badge (Active/Inactive), default badge. | Pending | Pending | |
| **UAT-CONN-02** | Add Connection Modal Validation | 1. Click "+ Add Connection".<br>2. Test empty submission.<br>3. Test invalid phone number format.<br>4. Close modal without saving. | Modal opens with clean inputs. Submitting invalid values highlights errors (phone number 5-30 digits, WABA ID digits only). Closing modal dismisses cleanly without saving. | Pending | Pending | Safe test — do not save Meta creds |
| **UAT-CONN-03** | Credential Masking in UI | 1. Inspect the connection details card on `/connections`. | Meta Access Token is never rendered in plain text; only masked status or last-tested metadata is shown. | Pending | Pending | Security check |

---

### Module 7: Contacts

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-CONT-01** | Contact Profile Panel in Inbox | 1. Navigate to `/workspace/astrology/inbox`.<br>2. Select any active conversation.<br>3. Observe the right-side / header Contact Profile Card. | Displays contact name, formatted phone number, opt-in/opt-out status badge, business association, and conversation metadata. | Pending | Pending | |
| **UAT-CONT-02** | Contact Opt-Out Status Display | 1. Select a conversation marked as opted out (or simulate STOP).<br>2. Check contact status badge. | Badge shows "Opted Out" in red/amber. Free-form messaging composer is disabled or warned. | Pending | Pending | Opt-out check |
| **UAT-CONT-03** | Cross-Tenant Contact Isolation | 1. Check contact list and IDs under Astrology vs Vivaham. | Contacts from Astrology never appear in Vivaham inbox list or search. | Pending | Pending | Isolation check |

---

### Module 8: Inbox and Conversations

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-INBOX-01** | 3-Panel Inbox Structure & Layout | 1. Navigate to `/workspace/astrology/inbox`.<br>2. Verify Folder Navigation (left), Conversation List (middle), and Chat Window (right). | 3-panel layout renders cleanly with folder counts (All, Unread, Open, Closed, Human Support), search bar, and conversation cards. | Pending | Pending | |
| **UAT-INBOX-02** | Folder Filtering & Counter Sync | 1. Click "Unread" folder.<br>2. Click "Open" folder.<br>3. Click "Closed" folder.<br>4. Return to "All". | Conversation list updates dynamically to show only conversations matching the selected filter. Badge counts match displayed items. | Pending | Pending | |
| **UAT-INBOX-03** | Conversation Search Filter | 1. Type contact name or digits of phone number in search input. | Middle list filters in real time to matching conversations. Clearing search restores full list. | Pending | Pending | |
| **UAT-INBOX-04** | Status Toggle (Open/Closed/Human Support) | 1. In active chat header, click status dropdown or button (e.g. mark Closed / Reopen). | Conversation status updates optimistically in UI and persists to Supabase. Folder counters update immediately. | Pending | Pending | |
| **UAT-INBOX-05** | Mark as Read / Unread | 1. Click "Mark Unread" / "Mark Read" icon on selected conversation. | Unread badge indicator toggles on conversation card and updates left navigation counter. | Pending | Pending | |

---

### Module 9: Message Composer

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-COMP-01** | Message Composer Elements & State | 1. In active conversation, observe message composer at the bottom of Chat Window.<br>2. Check text area, character count/placeholder, template button, and Send button. | Input field is focused and accessible. "Send" button is initially disabled when text area is empty. Template button is available. | Pending | Pending | |
| **UAT-COMP-02** | Empty / Whitespace Message Validation | 1. Type spaces or tabs into message composer.<br>2. Try clicking Send or pressing Enter. | Send button remains disabled or validation error "Message text cannot be empty" displays. No blank message is sent. | Pending | Pending | |
| **UAT-COMP-03** | 4096-Character Boundary Validation | 1. Enter text exceeding 4096 characters in the composer. | Validation prevents submission and indicates length exceeded error. | Pending | Pending | |
| **UAT-COMP-04** | 24-Hour Customer Service Window Guard | 1. Select a conversation where last inbound message was >24 hours ago (or simulate expired window).<br>2. Observe composer banner. | System displays 24-Hour Window expired warning: Free-form text sending is blocked; prompt directs user to send an approved Meta template. | Pending | Pending | Compliance check |

---

### Module 10: Message Templates

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-TPL-01** | Template Selector Trigger | 1. In Chat Window composer, click "Templates" / "Use Template" button. | Template selector drawer or modal opens displaying available approved WhatsApp templates. | Pending | Pending | |
| **UAT-TPL-02** | Template List & Parameter Preview | 1. Browse template list.<br>2. Observe template name, language (en_US / ta), category (Utility/Marketing), and body text preview. | Templates display formatted body with variable placeholders (e.g., `{{1}}`). Category and language badges are clear. | Pending | Pending | |
| **UAT-TPL-03** | 24h Window Bypass Verification | 1. In an expired conversation window, open template selector. | Approved template option is explicitly permitted to initiate contact outside the 24-hour customer service window. | Pending | Pending | |

---

### Module 11: Automation Rule Builder

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-RULE-01** | Automation Rules List View | 1. Navigate to `/workspace/astrology/automations`.<br>2. View "Rules" tab. | Lists existing automation rules with rule name, trigger type, priority, active/paused switch, and action buttons (Edit, Delete, Simulate). | Pending | Pending | |
| **UAT-RULE-02** | Rule Builder Interface Navigation | 1. Click "+ Create Rule" or "Rule Builder" tab.<br>2. Inspect builder fields: Rule Name, Description, Trigger Type, Conditions, Actions, Priority, Cooldown. | Clean builder form renders with condition group configurator (Tamil & English keyword inputs, contains/equals operators) and action configurator (Send Text Message, Assign Agent). | Pending | Pending | |
| **UAT-RULE-03** | Rule Validation & Safe Creation | 1. In Rule Builder, fill: Name: `Test Pricing Rule`, Trigger: `keyword_match`, Keyword: `jathagam, horoscope, கட்டணம்`, Action: `send_text_message`.<br>2. Save rule. | Rule validates and saves to the business-scoped automation table. Form notifies success. List updates. (Do not toggle live activation). | Pending | Pending | Synthetic test data |

---

### Module 12: Automation Simulator

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-SIM-01** | Simulator Tab Display | 1. On `/workspace/astrology/automations`, click "Simulator" tab.<br>2. Check simulation controls: Inbound Message input, First-time contact toggle, Opted-out toggle, Conversation Status dropdown. | Simulator workbench loads with pre-filled sample text and interactive toggle controls. | Pending | Pending | |
| **UAT-SIM-02** | Keyword Match Dry-Run (English & Tamil) | 1. Enter message text: `"What is the horoscope consultation fees? கட்டணம் எவ்வளவு?"`<br>2. Click "Run Dry-Run Simulation". | Simulator evaluates active rules without sending actual WhatsApp messages. Output shows matched rule, evaluated condition details, and generated reply payload. | Pending | Pending | Zero real messages |
| **UAT-SIM-03** | STOP / Opt-Out Simulator Behavior | 1. In Simulator, enter `"STOP"` or `"நிறுத்து"`.<br>2. Click "Run Dry-Run Simulation". | Simulator detects mandatory opt-out keyword, flags contact for opt-out, and confirms automated replies are suppressed. | Pending | Pending | Deterministic compliance |

---

### Module 13: Business Settings

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-SET-01** | Business Settings Layout & Values | 1. Navigate to `/workspace/astrology/settings`.<br>2. Inspect Business Profile, Operating Hours, and Auto-reply Settings. | Form loads current Astrology settings: Business name, default timezone (`Asia/Kolkata`), business hours schedule, and out-of-office message text. | Pending | Pending | |
| **UAT-SET-02** | Operating Hours Configuration & Validation | 1. Check time picker inputs for weekdays/weekends.<br>2. Test saving updated hours. | Time boundaries validate properly (start time before end time). Successful save updates configuration with confirmation alert. | Pending | Pending | Safe update |
| **UAT-SET-03** | Settings Tenant Isolation | 1. Compare settings in Astrology vs Vivaham. | Settings are completely separate and saving changes in Astrology never alters Vivaham parameters. | Pending | Pending | Isolation check |

---

### Module 14: Mobile Responsiveness

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-MOB-01** | Mobile Viewport Navigation (390px) | 1. Open DevTools (F12) and toggle device mode (iPhone 12/14/15 or 390x844).<br>2. Check Header and mobile hamburger menu. | Hamburger menu button appears. Clicking it smoothly slides open the mobile drawer navigation. No horizontal page overflow (no sideways scrolling). | Pending | Pending | Responsive check |
| **UAT-MOB-02** | Mobile Inbox View & Chat Drawer | 1. In mobile viewport, navigate to `/workspace/astrology/inbox`.<br>2. Select a conversation from the conversation list.<br>3. Verify view transition.<br>4. Tap "< Back to list" arrow. | Conversation list fills screen. Selecting a conversation transitions to full-width Chat Window. Tapping Back returns cleanly to conversation list. | Pending | Pending | |

---

### Module 15: Logout and Session Handling

| Test ID | Feature | Exact Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|:---:|---|
| **UAT-LOG-01** | User Logout Execution | 1. Click user profile / Sign Out button in header or sidebar.<br>2. Observe redirection and session state. | Redirection immediately lands on `/login`. All Supabase auth cookies (`sb-...`) and session storage are cleared. | Pending | Pending | |
| **UAT-LOG-02** | Back Button After Logout Guard | 1. After logging out, click the browser "Back" button to try returning to `/workspace/astrology/dashboard`. | Browser is intercepted; protected route guard redirects back to `/login` with HTTP 307. No sensitive business data is shown. | Pending | Pending | Security test |
| **UAT-LOG-03** | Password Recovery Flow End-to-End | 1. Navigate to `/forgot-password`.<br>2. Verify email reset submission.<br>3. Verify `/update-password` page renders password and confirm password inputs with 8+ character validation. | Form validates password strength and exact match. Submitting without active recovery session displays clear error. | Pending | Pending | |

---

## Testing Progress Summary

- **Total Planned Tests:** 38
- **Passed:** 0
- **Failed:** 0
- **Blocked:** 0
- **Pending:** 38
