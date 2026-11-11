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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDatabase() {
  console.log("================================================================================");
  console.log("🔍 SUPABASE DATABASE VERIFICATION — PROJECT: ansiwtwqgrfmzfrhkzuu");
  console.log("================================================================================");

  // 1. Check Tables from Migration 013
  console.log("\n[1] MIGRATION 013 (CRM & Contacts) Tables Check:");
  const tables = [
    { name: "crm_categories", desc: "Configurable business categories" },
    { name: "crm_segments", desc: "Saved contact filter segments" },
    { name: "contact_notes", desc: "Contact consultation notes" },
    { name: "contact_activity_logs", desc: "Contact activity timeline audit logs" }
  ];

  for (const t of tables) {
    const res = await supabase.from(t.name).select("*").limit(1);
    if (res.error) {
      console.log(`  ❌ ${t.name} (${t.desc}): NOT FOUND (${res.error.message})`);
    } else {
      console.log(`  ✅ ${t.name} (${t.desc}): EXISTS (${res.data?.length} rows)`);
    }
  }

  // 2. Check wa_contacts columns
  console.log("\n[2] MIGRATION 013 Column Alterations on wa_contacts:");
  const testCols = ["email", "status", "category", "source", "is_archived", "tags", "custom_fields"];
  for (const col of testCols) {
    const { data, error } = await supabase.from("wa_contacts").select(col).limit(1);
    if (error) {
      console.log(`  ❌ Column wa_contacts.${col}: MISSING (${error.message})`);
    } else {
      console.log(`  ✅ Column wa_contacts.${col}: PRESENT`);
    }
  }

  // 3. Check RPCs from Migration 014
  console.log("\n[3] MIGRATION 014 (Analytics RPCs) Check:");
  const rpcs = [
    { name: "get_business_analytics_summary", params: { p_business_id: "11111111-1111-1111-1111-111111111111", p_start_date: new Date(Date.now() - 86400000).toISOString(), p_end_date: new Date().toISOString() } },
    { name: "get_business_analytics_daily_trends", params: { p_business_id: "11111111-1111-1111-1111-111111111111", p_start_date: new Date(Date.now() - 86400000).toISOString(), p_end_date: new Date().toISOString() } }
  ];

  for (const r of rpcs) {
    const { data, error } = await supabase.rpc(r.name, r.params);
    if (error) {
      console.log(`  ❌ RPC ${r.name}: NOT FOUND or FAILED (${error.message})`);
    } else {
      console.log(`  ✅ RPC ${r.name}: EXISTS & EXECUTABLE`);
    }
  }

  // 4. Check existing migrations table if available
  console.log("\n[4] Database Migrations Status Check:");
  const { data: migs, error: migErr } = await supabase.from("schema_migrations").select("*");
  if (migErr) {
    console.log("  ℹ️ schema_migrations query:", migErr.message);
  } else {
    console.log("  Applied migrations in schema_migrations:", migs);
  }

  console.log("\n================================================================================");
}

checkDatabase().catch(console.error);
