import fs from "fs";
import path from "path";
import crypto from "crypto";
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

function tokenFingerprint(token) {
  if (!token) return "[EMPTY]";
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return `sha256:${hash.slice(0, 12)}`;
}

function getMasterKey(secretHex) {
  if (secretHex && secretHex.length === 64) {
    return Buffer.from(secretHex, "hex");
  }
  return crypto.createHash("sha256").update(secretHex || "gokul_connect_dev_master_key_32bytes!!_v1").digest();
}

function decryptToken(row, appSecretHex) {
  try {
    const key = getMasterKey(appSecretHex);
    const iv = Buffer.from(row.iv, "hex");
    const authTag = Buffer.from(row.auth_tag, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(row.ciphertext, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log("=== PHASE 6.3 TARGET IDENTIFICATION & LIVE SUPABASE INSPECTION ===");
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const appEncryptionSecret = env.APP_ENCRYPTION_SECRET;
  const envToken = env.META_TEST_ACCESS_TOKEN;

  console.log("Environment Token Fingerprint:", tokenFingerprint(envToken));

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Fetch businesses
  const { data: businesses, error: bErr } = await supabase.from("businesses").select("*");
  if (bErr) throw bErr;
  console.log("\n--- Businesses ---");
  console.table(businesses.map(b => ({ id: b.id, name: b.name, slug: b.slug, is_active: b.is_active })));

  // 2. Fetch wa_connections
  const { data: connections, error: cErr } = await supabase.from("wa_connections").select("*");
  if (cErr) throw cErr;
  console.log("\n--- WhatsApp Connections ---");
  console.table(connections.map(c => ({
    id: c.id,
    business_id: c.business_id,
    display_name: c.display_name,
    phone_number: c.phone_number,
    phone_number_id: c.phone_number_id,
    waba_id: c.waba_id,
    status: c.connection_status,
    enabled: c.is_enabled,
  })));

  // 3. Fetch wa_credentials
  const { data: credentials, error: credErr } = await supabase.from("wa_credentials").select("*");
  if (credErr) throw credErr;
  console.log("\n--- WhatsApp Credentials (Vault) ---");
  for (const cr of credentials) {
    const dec = decryptToken(cr, appEncryptionSecret);
    const fp = tokenFingerprint(dec);
    console.log({
      connection_id: cr.connection_id,
      key_version: cr.key_version,
      iv_length_hex: cr.iv ? cr.iv.length : 0,
      auth_tag_length_hex: cr.auth_tag ? cr.auth_tag.length : 0,
      ciphertext_length_hex: cr.ciphertext ? cr.ciphertext.length : 0,
      created_at: cr.created_at,
      updated_at: cr.updated_at,
      decrypted_fingerprint: fp,
      matches_env_token: dec === envToken
    });
  }

  // 4. Target Connection check: 44444444-4444-4444-4444-444444444444
  const targetConn = connections.find(c => c.id === "44444444-4444-4444-4444-444444444444");
  console.log("\n--- Target Connection Analysis ---");
  if (!targetConn) {
    console.log("❌ Target connection 44444444-4444-4444-4444-444444444444 NOT found in database!");
  } else {
    const targetBiz = businesses.find(b => b.id === targetConn.business_id);
    const targetCred = credentials.find(c => c.connection_id === targetConn.id);
    const decryptedTargetCred = targetCred ? decryptToken(targetCred, appEncryptionSecret) : null;

    console.log("Target Connection ID  :", targetConn.id);
    console.log("Display Name          :", targetConn.display_name);
    console.log("Associated Business ID:", targetConn.business_id);
    console.log("Associated Biz Slug   :", targetBiz ? targetBiz.slug : "UNKNOWN");
    console.log("Associated Biz Name   :", targetBiz ? targetBiz.name : "UNKNOWN");
    console.log("Phone Number ID       :", targetConn.phone_number_id);
    console.log("WABA ID               :", targetConn.waba_id);
    console.log("Is Enabled            :", targetConn.is_enabled);
    console.log("Connection Status     :", targetConn.connection_status);
    console.log("Credential Record Present:", Boolean(targetCred));
    if (targetCred) {
      console.log("Credential Row ID      :", targetCred.id);
      console.log("Credential Business ID:", targetCred.business_id);
      console.log("Credential Key Version:", targetCred.key_version);
      console.log("Existing Vault Fingerprint:", tokenFingerprint(decryptedTargetCred));
      console.log("New Env Token Fingerprint :", tokenFingerprint(envToken));
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
