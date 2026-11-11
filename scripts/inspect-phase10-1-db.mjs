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
console.log("Supabase Project URL:", env.NEXT_PUBLIC_SUPABASE_URL);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("\n--- 1. Checking Migration Tables & CRM Schema (Migration 013) ---");
  const crmTables = ["crm_categories", "crm_segments", "contact_notes", "contact_activity_logs", "wa_contacts"];
  for (const table of crmTables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.error(`❌ Table ${table} check failed:`, error.message);
    } else {
      console.log(`✅ Table ${table} exists. Row count: ${count}`);
    }
  }

  // Check columns on wa_contacts
  const { data: sampleContact, error: contactErr } = await supabase
    .from("wa_contacts")
    .select("id, status, category, source, is_archived, tags, custom_fields, email")
    .limit(1);
  if (contactErr) {
    console.error("❌ wa_contacts CRM columns check failed:", contactErr.message);
  } else {
    console.log("✅ wa_contacts CRM columns verified: status, category, source, is_archived, tags, custom_fields, email are present.");
  }

  // Check seeded categories
  const { data: categories, error: catErr } = await supabase
    .from("crm_categories")
    .select("business_id, name, slug, is_default, color")
    .order("sort_order", { ascending: true });

  if (catErr) {
    console.error("❌ crm_categories query failed:", catErr.message);
  } else {
    console.log(`✅ crm_categories has ${categories.length} seeded categories:`);
    const astroCats = categories.filter(c => c.business_id === "11111111-1111-1111-1111-111111111111");
    const vivahamCats = categories.filter(c => c.business_id === "22222222-2222-2222-2222-222222222222");
    console.log(`   - Astrology: ${astroCats.length} categories:`, astroCats.map(c => c.name).join(", "));
    console.log(`   - Vivaham: ${vivahamCats.length} categories:`, vivahamCats.map(c => c.name).join(", "));
  }

  console.log("\n--- 2. Checking Analytics RPCs (Migration 014) ---");
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // Test RPC 1: get_business_analytics_summary
  const { data: astroSummary, error: rpc1Err } = await supabase.rpc("get_business_analytics_summary", {
    p_business_id: "11111111-1111-1111-1111-111111111111",
    p_start_date: sevenDaysAgo.toISOString(),
    p_end_date: now.toISOString()
  });

  if (rpc1Err) {
    console.error("❌ RPC get_business_analytics_summary failed:", rpc1Err.message);
  } else {
    console.log("✅ RPC get_business_analytics_summary executed successfully. Keys returned:", Object.keys(astroSummary));
    console.log("   Astrology messaging:", JSON.stringify(astroSummary.messaging));
    console.log("   Astrology contacts:", JSON.stringify(astroSummary.contacts));
    console.log("   Astrology conversations:", JSON.stringify(astroSummary.conversations));
  }

  // Test RPC 2: get_business_analytics_daily_trends
  const { data: astroTrends, error: rpc2Err } = await supabase.rpc("get_business_analytics_daily_trends", {
    p_business_id: "11111111-1111-1111-1111-111111111111",
    p_start_date: sevenDaysAgo.toISOString(),
    p_end_date: now.toISOString()
  });

  if (rpc2Err) {
    console.error("❌ RPC get_business_analytics_daily_trends failed:", rpc2Err.message);
  } else {
    console.log(`✅ RPC get_business_analytics_daily_trends executed successfully. ${astroTrends.length} day buckets returned.`);
    if (astroTrends.length > 0) {
      console.log("   Sample bucket:", JSON.stringify(astroTrends[0]));
    }
  }

  console.log("\n--- 3. Testing Cross-Tenant Access & Multi-Tenant Separation ---");
  const { data: vivahamSummary, error: vivErr } = await supabase.rpc("get_business_analytics_summary", {
    p_business_id: "22222222-2222-2222-2222-222222222222",
    p_start_date: sevenDaysAgo.toISOString(),
    p_end_date: now.toISOString()
  });

  if (vivErr) {
    console.error("❌ Vivaham summary failed:", vivErr.message);
  } else {
    console.log("✅ Vivaham summary executed successfully.");
    console.log("   Astrology total messages:", astroSummary.messaging.total_inbound + astroSummary.messaging.total_outbound);
    console.log("   Vivaham total messages:", vivahamSummary.messaging.total_inbound + vivahamSummary.messaging.total_outbound);
  }

  // Check Supabase schema_migrations or applied migrations if accessible
  const { data: migrations, error: migErr } = await supabase
    .from("supabase_migrations")
    .select("*")
    .catch(() => ({ data: null, error: null }));
  if (migrations) {
    console.log("\nSupabase migrations table:", migrations);
  }
}

run().catch(console.error);
