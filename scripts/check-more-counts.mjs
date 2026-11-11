import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8")
    .split("\n")
    .filter(l => l.trim() && !l.startsWith("#"))
    .map(l => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "")];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRest() {
  const tables = [
    "businesses",
    "business_settings",
    "business_members",
    "wa_connections",
    "wa_phone_numbers",
    "wa_credentials",
    "wa_conversations",
    "wa_messages",
    "wa_webhook_events",
    "wa_processing_jobs",
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
  for (const t of tables) {
    const { count, error } = await admin.from(t).select("*", { count: "exact", head: true });
    console.log(`${t.padEnd(25)}: count=${count}, err=${error?.message ?? "none"}`);
  }
}

checkRest().catch(console.error);
