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
  console.error("Missing Supabase URL or Service Role Key");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function runAudit() {
  console.log("================================================================================");
  console.log("LIVE DATABASE PREFLIGHT AUDIT: GOKUL CONNECT");
  console.log("Project URL:", supabaseUrl);
  console.log("Timestamp:", new Date().toISOString());
  console.log("================================================================================\n");

  // 1. Storage Buckets
  console.log("--- 1. STORAGE BUCKETS ---");
  const { data: buckets, error: bucketErr } = await adminClient.storage.listBuckets();
  if (bucketErr) {
    console.log("Error fetching storage buckets:", bucketErr.message);
  } else {
    console.log(`Found ${buckets.length} storage buckets:`);
    buckets.forEach(b => console.log(`  - ${b.name} (id: ${b.id}, public: ${b.public})`));
  }

  // 2. Baseline Tables (001-015)
  console.log("\n--- 2. BASELINE TABLES (001-015) ROW COUNTS & EXISTENCE ---");
  const baselineTables = [
    "businesses",
    "users",
    "user_roles",
    "wa_phone_numbers",
    "wa_credentials",
    "wa_conversations",
    "wa_messages",
    "wa_webhook_events",
    "wa_flows",
    "wa_flow_nodes",
    "wa_flow_edges",
    "wa_flow_executions",
    "wa_contacts",
    "crm_categories",
    "crm_segments",
    "contact_notes",
    "contact_activity_logs",
    "wa_message_templates"
  ];

  for (const table of baselineTables) {
    try {
      const { count, error } = await adminClient
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) {
        console.log(`  ❌ ${table}: ERROR - ${error.message}`);
      } else {
        console.log(`  ✅ ${table}: EXISTS - ${count} rows`);
      }
    } catch (e) {
      console.log(`  ❌ ${table}: EXCEPTION - ${e.message}`);
    }
  }

  // 3. Check Tenant Records in Baseline Tables
  console.log("\n--- 3. TENANT ISOLATION & RECORD VERIFICATION ---");
  const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

  for (const [tenantName, businessId] of [["Astrology", ASTROLOGY_ID], ["Vivaham", VIVAHAM_ID]]) {
    console.log(`\nTenant: ${tenantName} (${businessId})`);
    
    // Check businesses table
    const { data: bData } = await adminClient.from("businesses").select("id, name, created_at").eq("id", businessId);
    console.log(`  Business record: ${bData && bData.length > 0 ? bData[0].name : "NOT FOUND"}`);

    // Check credentials
    const { count: credCount } = await adminClient.from("wa_credentials").select("*", { count: "exact", head: true }).eq("business_id", businessId);
    console.log(`  wa_credentials: ${credCount ?? 0} rows`);

    // Check conversations
    const { count: convCount } = await adminClient.from("wa_conversations").select("*", { count: "exact", head: true }).eq("business_id", businessId);
    console.log(`  wa_conversations: ${convCount ?? 0} rows`);

    // Check messages
    const { count: msgCount } = await adminClient.from("wa_messages").select("*", { count: "exact", head: true }).eq("business_id", businessId);
    console.log(`  wa_messages: ${msgCount ?? 0} rows`);

    // Check contacts
    const { count: contactCount } = await adminClient.from("wa_contacts").select("*", { count: "exact", head: true }).eq("business_id", businessId);
    console.log(`  wa_contacts: ${contactCount ?? 0} rows`);

    // Check templates
    const { count: tmplCount } = await adminClient.from("wa_message_templates").select("*", { count: "exact", head: true }).eq("business_id", businessId);
    console.log(`  wa_message_templates: ${tmplCount ?? 0} rows`);

    // Check flows
    const { count: flowCount } = await adminClient.from("wa_flows").select("*", { count: "exact", head: true }).eq("business_id", businessId);
    console.log(`  wa_flows: ${flowCount ?? 0} rows`);
  }

  // 4. Check for Upcoming Migration Tables (016-024)
  console.log("\n--- 4. UPCOMING MIGRATION TABLES (016-024) CHECK ---");
  const upcomingTables = [
    "team_invitations",
    "conversation_assignment_logs",
    "business_audit_logs",
    "wa_media_files",
    "wa_scheduled_messages",
    "wa_campaigns",
    "wa_campaign_recipients",
    "crm_lifecycle_stages",
    "crm_follow_ups",
    "internal_notifications",
    "user_notification_preferences",
    "wa_visual_flows",
    "system_health_metrics",
    "worker_telemetry",
    "wa_conversation_labels",
    "wa_cron_locks"
  ];

  for (const table of upcomingTables) {
    const res = await adminClient.from(table).select("*").limit(1);
    if (res.error) {
      console.log(`  ⚪ ${table}: NOT PRESENT -> ${res.error.message} (code: ${res.error.code})`);
    } else {
      console.log(`  ⚠️ ${table}: ALREADY EXISTS! (${res.data?.length} rows returned)`);
    }
  }

  // 5. Check RPC functions from baseline
  console.log("\n--- 5. BASELINE RPC FUNCTIONS AUDIT ---");
  const baselineRpcTests = [
    {
      name: "get_business_analytics_summary",
      args: { p_business_id: ASTROLOGY_ID, p_start_date: new Date(Date.now() - 86400000).toISOString(), p_end_date: new Date().toISOString() }
    },
    {
      name: "get_business_analytics_daily_trends",
      args: { p_business_id: ASTROLOGY_ID, p_start_date: new Date(Date.now() - 86400000).toISOString(), p_end_date: new Date().toISOString() }
    },
    {
      name: "enqueue_webhook_payload_atomic",
      args: { p_event_id: "00000000-0000-0000-0000-000000000000", p_source: "test", p_payload: {} },
      expectFailArg: true
    }
  ];

  for (const rpc of baselineRpcTests) {
    try {
      const { data, error } = await adminClient.rpc(rpc.name, rpc.args);
      if (error) {
        console.log(`  RPC ${rpc.name}: Response -> ${error.message} (code: ${error.code})`);
      } else {
        console.log(`  ✅ RPC ${rpc.name}: Callable, returned data`);
      }
    } catch (e) {
      console.log(`  RPC ${rpc.name}: Exception -> ${e.message}`);
    }
  }

  // 6. Check columns on wa_contacts (Migration 013)
  console.log("\n--- 6. VERIFY COLUMN ALTERATIONS ON wa_contacts ---");
  const contactCols = ["email", "status", "category", "source", "is_archived", "tags", "custom_fields"];
  for (const col of contactCols) {
    const { error } = await adminClient.from("wa_contacts").select(col).limit(1);
    if (error) {
      console.log(`  ❌ Column wa_contacts.${col}: MISSING (${error.message})`);
    } else {
      console.log(`  ✅ Column wa_contacts.${col}: PRESENT`);
    }
  }

  // 7. Check columns on wa_message_templates (Migration 015)
  console.log("\n--- 7. VERIFY COLUMN ALTERATIONS ON wa_message_templates ---");
  const templateCols = ["meta_template_id", "rejection_reason", "is_archived", "last_synced_at"];
  for (const col of templateCols) {
    const { error } = await adminClient.from("wa_message_templates").select(col).limit(1);
    if (error) {
      console.log(`  ❌ Column wa_message_templates.${col}: MISSING (${error.message})`);
    } else {
      console.log(`  ✅ Column wa_message_templates.${col}: PRESENT`);
    }
  }

  console.log("\n================================================================================");
  console.log("AUDIT COMPLETE");
  console.log("================================================================================");
}

runAudit().catch(console.error);
