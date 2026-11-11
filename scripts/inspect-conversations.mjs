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

async function run() {
  const { data: businesses } = await supabase.from("businesses").select("id, name, slug");
  console.log("Businesses:", businesses);

  for (const b of businesses || []) {
    const { data: convs, error } = await supabase
      .from("wa_conversations")
      .select("id, status, unread_count, last_message_preview, is_automation_paused, contact:wa_contacts(display_name, phone_number)")
      .eq("business_id", b.id);
    console.log(`\n=== ${b.name} (${b.slug}) ===`);
    console.log(`Count: ${convs ? convs.length : 0}`);
    if (convs && convs.length > 0) {
      console.log(JSON.stringify(convs, null, 2));

      for (const conv of convs) {
        const { data: msgs } = await supabase
          .from("wa_messages")
          .select("id, direction, message_type, content, status, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true });
        console.log(`Messages for conv ${conv.id} (${conv.contact?.display_name}): ${msgs?.length || 0}`);
        if (msgs && msgs.length > 0) {
          console.log(msgs.map(m => `[${m.direction}] (${m.status}): ${m.content?.text || m.content?.body || JSON.stringify(m.content)}`));
        }
      }
    }
  }
}

run();
