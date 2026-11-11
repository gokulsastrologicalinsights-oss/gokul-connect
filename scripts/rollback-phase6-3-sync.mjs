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

async function run() {
  const TARGET_CONNECTION_ID = "44444444-4444-4444-4444-444444444444";
  const TARGET_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";
  const backupFile = path.resolve(process.cwd(), "scripts", "backup", `wa_credentials_backup_${TARGET_CONNECTION_ID}.json`);

  if (!fs.existsSync(backupFile)) {
    throw new Error(`Backup file not found at: ${backupFile}`);
  }

  const raw = fs.readFileSync(backupFile, "utf8");
  const backupData = JSON.parse(raw);
  const rec = backupData.record;

  console.log("Restoring wa_credentials record from backup file:", backupFile);
  console.log("Verified existing fingerprint in backup:", backupData.verified_existing_fingerprint);

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("wa_credentials")
    .update({
      iv: rec.iv,
      auth_tag: rec.auth_tag,
      ciphertext: rec.ciphertext,
      key_version: rec.key_version,
      updated_at: rec.updated_at,
    })
    .eq("id", rec.id)
    .eq("connection_id", TARGET_CONNECTION_ID)
    .eq("business_id", TARGET_BUSINESS_ID)
    .select()
    .single();

  if (error) {
    throw new Error(`Rollback failed: ${error.message}`);
  }

  console.log("✅ Rollback successful. Restored record updated_at:", data.updated_at);
}

run().catch((err) => {
  console.error("❌ Rollback error:", err.message);
  process.exit(1);
});
