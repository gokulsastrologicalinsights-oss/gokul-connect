import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadLocalEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey);

async function runReadOnlyAudit() {
  console.log("=== PHASE 11.6 READ-ONLY DATABASE AUDIT ===");
  console.log("Target:", supabaseUrl);
  console.log("Timestamp:", new Date().toISOString());

  // 1. Businesses
  const { data: businesses, error: bizErr } = await adminClient
    .from("businesses")
    .select("id, name, slug, is_active, created_at")
    .order("slug");
  console.log("\n[1] Businesses:", businesses, bizErr || "");

  // 2. Memberships
  const { data: members, error: memErr } = await adminClient
    .from("business_members")
    .select("id, business_id, user_id, role, created_at");
  console.log("\n[2] Business Memberships count:", members?.length, memErr || "");
  if (members) {
    for (const m of members) {
      console.log(`  - User ${m.user_id} in Biz ${m.business_id} as ${m.role}`);
    }
  }

  // 3. WhatsApp Connections
  const { data: connections, error: connErr } = await adminClient
    .from("wa_connections")
    .select("id, business_id, display_name, phone_number, phone_number_id, waba_id, connection_status, quality_rating, is_enabled, created_at");
  console.log("\n[3] WhatsApp Connections:", connections, connErr || "");

  // 4. WhatsApp Credentials metadata
  const { data: creds, error: credErr } = await adminClient
    .from("wa_credentials")
    .select("id, connection_id, business_id, key_version, created_at, updated_at");
  console.log("\n[4] WhatsApp Credentials metadata:", creds, credErr || "");

  // 5. Business Settings
  const { data: settings, error: settErr } = await adminClient
    .from("business_settings")
    .select("id, business_id, display_name, default_connection_id, timezone, default_language, opt_out_keywords");
  console.log("\n[5] Business Settings:", settings, settErr || "");

  // 6. Templates
  const { data: templates, error: tempErr } = await adminClient
    .from("wa_message_templates")
    .select("id, business_id, connection_id, template_name, category, language, status, is_archived, meta_template_id");
  console.log("\n[6] Message Templates count:", templates?.length, tempErr || "");
  if (templates) {
    for (const t of templates) {
      console.log(`  - ${t.template_name} (Biz: ${t.business_id}, Status: ${t.status}, Archived: ${t.is_archived})`);
    }
  }

  // 7. Automation Rules
  const { data: rules, error: ruleErr } = await adminClient
    .from("wa_automation_rules")
    .select("id, business_id, name, trigger_type, is_active");
  console.log("\n[7] Automation Rules count:", rules?.length, ruleErr || "");
  if (rules) {
    for (const r of rules) {
      console.log(`  - Rule ${r.name} (Biz: ${r.business_id}, Trigger: ${r.trigger_type}, Active: ${r.is_active})`);
    }
  }

  // 8. Queue Jobs (wa_processing_jobs)
  const { data: queueJobs, error: qErr } = await adminClient
    .from("wa_processing_jobs")
    .select("id, business_id, job_type, status, attempts, max_attempts")
    .limit(10);
  console.log("\n[8] Queue Jobs sample count:", queueJobs?.length, qErr || "");

  // 9. Contacts summary
  const { data: contacts, error: contactErr } = await adminClient
    .from("wa_contacts")
    .select("id, business_id, display_name, phone_number, status, category, is_archived");
  console.log("\n[9] Contacts count:", contacts?.length, contactErr || "");
  if (contacts) {
    for (const c of contacts) {
      console.log(`  - Contact ${c.display_name} (${c.phone_number}) in Biz ${c.business_id}, Status: ${c.status}, Archived: ${c.is_archived}`);
    }
  }

  // 10. Conversations summary
  const { data: convos, error: convErr } = await adminClient
    .from("wa_conversations")
    .select("id, business_id, status, unread_count, last_message_preview");
  console.log("\n[10] Conversations count:", convos?.length, convErr || "");
  if (convos) {
    for (const cv of convos) {
      console.log(`  - Convo ${cv.id} in Biz ${cv.business_id}, Status: ${cv.status}, Unread: ${cv.unread_count}`);
    }
  }
}

runReadOnlyAudit().catch(console.error);
