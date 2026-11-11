import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const baselineTables = [
  "business_members",
  "business_settings",
  "businesses",
  "contact_activity_logs",
  "contact_notes",
  "crm_categories",
  "crm_segments",
  "user_profiles",
  "wa_automation_execution_logs",
  "wa_automation_rules",
  "wa_connections",
  "wa_contacts",
  "wa_conversations",
  "wa_credentials",
  "wa_message_templates",
  "wa_messages",
  "wa_processing_jobs",
  "wa_rule_actions",
  "wa_rule_conditions",
  "wa_webhook_events"
];

async function run() {
  console.log('=== LIVE SUPABASE BASELINE TABLE COUNTS (READ-ONLY) ===');
  let total = 0;
  for (const table of baselineTables) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`${table.padEnd(30)}: ERROR: ${error.message}`);
    } else {
      console.log(`${table.padEnd(30)}: ${count} rows`);
      total += count;
    }
  }
  console.log(`TOTAL LIVE ROWS IN BASELINE TABLES: ${total}`);
}

run().catch(console.error);
