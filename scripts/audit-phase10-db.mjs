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

async function check() {
  const tables = [
    "businesses",
    "wa_connections",
    "wa_contacts",
    "wa_conversations",
    "wa_messages",
    "wa_automation_rules",
    "wa_automation_execution_logs",
    "wa_processing_jobs"
  ];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`${t}: ${count} rows ${error ? `(error: ${error.message})` : ""}`);
  }

  // Check counts per business
  const { data: businesses } = await supabase.from("businesses").select("id, slug, name");
  for (const b of businesses || []) {
    console.log(`\n--- Tenant: ${b.name} (${b.id}) ---`);
    for (const t of ["wa_contacts", "wa_conversations", "wa_messages", "wa_automation_rules", "wa_automation_execution_logs"]) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true }).eq("business_id", b.id);
      console.log(`  ${t}: ${count}`);
    }
  }
  // Check sample records
  const { data: contacts } = await supabase.from("wa_contacts").select("*").limit(2);
  console.log("\nSample contacts:", JSON.stringify(contacts, null, 2));

  const { data: msgs } = await supabase.from("wa_messages").select("*").limit(2);
  console.log("\nSample messages:", JSON.stringify(msgs, null, 2));
}

check();
