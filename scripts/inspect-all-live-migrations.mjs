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

const adminClient = createClient(supabaseUrl, serviceKey);

async function inspectSchema() {
  console.log("================================================================================");
  console.log("LIVE SUPABASE MIGRATION & SCHEMA INSPECTION");
  console.log("Project:", supabaseUrl);
  console.log("Timestamp:", new Date().toISOString());
  console.log("================================================================================\n");

  const results = {};

  // Check 015: wa_message_templates columns
  const { data: m15Data, error: m15Err } = await adminClient
    .from("wa_message_templates")
    .select("meta_template_id, rejection_reason, is_archived, last_synced_at")
    .limit(1);
  results["015_template_management"] = !m15Err;

  // Check 016: team management tables
  const { error: m16Err1 } = await adminClient.from("conversation_assignment_logs").select("id").limit(1);
  const { error: m16Err2 } = await adminClient.from("team_invitations").select("id").limit(1);
  const { error: m16Err3 } = await adminClient.from("business_audit_logs").select("id").limit(1);
  results["016_team_management"] = !m16Err1 && !m16Err2 && !m16Err3;
  if (m16Err1) console.log("016 error:", m16Err1.message);

  // Check 017: media messaging
  const { error: m17Err1 } = await adminClient.from("wa_media_files").select("id").limit(1);
  const { error: m17Err2 } = await adminClient.from("wa_messages").select("media_id, storage_path, download_status").limit(1);
  results["017_media_messaging"] = !m17Err1 && !m17Err2;
  if (m17Err1) console.log("017 error:", m17Err1.message);

  // Check 018: scheduled messages
  const { error: m18Err } = await adminClient.from("wa_scheduled_messages").select("id").limit(1);
  results["018_scheduled_messages"] = !m18Err;
  if (m18Err) console.log("018 error:", m18Err.message);

  // Check 019: campaign management
  const { error: m19Err1 } = await adminClient.from("wa_campaigns").select("id").limit(1);
  const { error: m19Err2 } = await adminClient.from("wa_campaign_recipients").select("id").limit(1);
  results["019_campaign_management"] = !m19Err1 && !m19Err2;
  if (m19Err1) console.log("019 error:", m19Err1.message);

  // Check 020: crm lifecycle & followups
  const { error: m20Err1 } = await adminClient.from("crm_lifecycle_stages").select("id").limit(1);
  const { error: m20Err2 } = await adminClient.from("crm_follow_ups").select("id").limit(1);
  results["020_crm_lifecycle"] = !m20Err1 && !m20Err2;
  if (m20Err1) console.log("020 error:", m20Err1.message);

  // Check 021: notification center
  const { error: m21Err1 } = await adminClient.from("internal_notifications").select("id").limit(1);
  const { error: m21Err2 } = await adminClient.from("user_notification_preferences").select("id").limit(1);
  results["021_notification_center"] = !m21Err1 && !m21Err2;
  if (m21Err1) console.log("021 error:", m21Err1.message);

  // Check 022: visual flows
  const { error: m22Err } = await adminClient.from("wa_visual_flows").select("id").limit(1);
  results["022_visual_flows"] = !m22Err;
  if (m22Err) console.log("022 error:", m22Err.message);

  // Check 023: operational reliability
  const { error: m23Err } = await adminClient.from("system_health_metrics").select("id").limit(1);
  results["023_operational_reliability"] = !m23Err;
  if (m23Err) console.log("023 error:", m23Err.message);

  console.log("MIGRATION STATUS SUMMARY (Live Database):");
  for (const [key, applied] of Object.entries(results)) {
    console.log(`  ${key}: ${applied ? "✅ APPLIED" : "❌ UNAPPLIED / MISSING"}`);
  }
}

inspectSchema().catch(console.error);
