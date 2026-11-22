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

async function main() {
  const { data: events, error } = await supabase
    .from("meta_social_events")
    .select("id, platform, event_type, status, reply_type, reply_content, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching events:", error.message);
    return;
  }

  console.log(`\n📊 Latest ${events.length} Social Events:`);
  events.forEach((e, idx) => {
    console.log(`\n[${idx + 1}] ID: ${e.id} | Platform: ${e.platform} | Type: ${e.event_type} | Status: ${e.status}`);
    console.log(`    Time: ${e.created_at}`);
    if (e.reply_content) console.log(`    Reply Content: ${e.reply_content}`);
    if (e.error_message) console.log(`    Error Message: ${e.error_message}`);
  });
}

main().catch(console.error);
