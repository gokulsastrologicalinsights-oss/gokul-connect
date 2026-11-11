import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data, error } = await supabase.from("wa_contacts").select("id, business_id, phone_number, display_name, metadata, created_at");
  if (error) {
    console.error("Error fetching contacts:", error.message);
  } else {
    console.log("Contacts count:", data.length);
    console.log("Contacts:", JSON.stringify(data, null, 2));
  }
}

inspect();
