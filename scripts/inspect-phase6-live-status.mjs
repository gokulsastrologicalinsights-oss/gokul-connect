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

function mask(str) {
  if (!str) return "[MISSING]";
  if (str.length <= 8) return "[CONFIGURED-SHORT]";
  return `${str.slice(0, 4)}...${str.slice(-4)} (${str.length} chars)`;
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

async function inspectTokenAndConnections() {
  console.log("================================================================================");
  console.log("🔍 GOKUL CONNECT — PHASE 6.1: META ACCESS TOKEN & DATABASE INSPECTION");
  console.log("================================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://ansiwtwqgrfmzfrhkzuu.supabase.co";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  const envTestPhoneId = env.META_TEST_PHONE_NUMBER_ID;
  const envTestWabaId = env.META_TEST_WABA_ID;
  const envTestToken = env.META_TEST_ACCESS_TOKEN;
  const appEncryptionSecret = env.APP_ENCRYPTION_SECRET;

  console.log("\n--- 1. Environment Variable Summary (Masked) ---");
  console.log(`NEXT_PUBLIC_SUPABASE_URL : ${supabaseUrl}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY: ${mask(serviceKey)}`);
  console.log(`META_APP_ID              : ${mask(appId)}`);
  console.log(`META_APP_SECRET          : ${mask(appSecret)}`);
  console.log(`META_TEST_PHONE_NUMBER_ID: ${envTestPhoneId || "[MISSING]"}`);
  console.log(`META_TEST_WABA_ID        : ${envTestWabaId || "[MISSING]"}`);
  console.log(`META_TEST_ACCESS_TOKEN   : ${mask(envTestToken)}`);
  console.log(`APP_ENCRYPTION_SECRET    : ${mask(appEncryptionSecret)}`);
  console.log(`NEXT_PUBLIC_APP_URL      : ${env.NEXT_PUBLIC_APP_URL || "[MISSING]"}`);

  // Inspect Database Connections
  console.log("\n--- 2. Database Connection Assignments & Vault Inspection ---");
  const adminClient = createClient(supabaseUrl, serviceKey);

  const { data: businesses, error: bizErr } = await adminClient
    .from("businesses")
    .select("id, name, slug");
  if (bizErr) {
    console.error("Error fetching businesses:", bizErr.message);
  } else {
    console.log("Configured Businesses:", businesses);
  }

  const { data: connections, error: connErr } = await adminClient
    .from("wa_connections")
    .select(`
      id,
      business_id,
      display_name,
      phone_number,
      phone_number_id,
      waba_id,
      connection_status,
      quality_rating,
      is_enabled,
      created_at,
      updated_at
    `);

  if (connErr) {
    console.error("Error fetching connections:", connErr.message);
  } else {
    console.log(`Found ${connections.length} WhatsApp connections:`);
    for (const c of connections) {
      console.log(`- Connection ID: ${c.id}`);
      console.log(`  Business ID  : ${c.business_id}`);
      console.log(`  Display Name : ${c.display_name}`);
      console.log(`  Phone Number : ${c.phone_number}`);
      console.log(`  Phone Num ID : ${c.phone_number_id}`);
      console.log(`  WABA ID      : ${c.waba_id}`);
      console.log(`  Status       : ${c.connection_status}`);
      console.log(`  Quality      : ${c.quality_rating}`);
      console.log(`  Is Enabled   : ${c.is_enabled}`);
    }
  }

  const { data: creds, error: credErr } = await adminClient
    .from("wa_credentials")
    .select("connection_id, key_version, iv, auth_tag, ciphertext, created_at, updated_at");

  let vaultToken = null;
  if (credErr) {
    console.error("Error fetching wa_credentials:", credErr.message);
  } else {
    console.log(`Found ${creds.length} encrypted credentials in vault:`);
    for (const cr of creds) {
      console.log(`- Connection ID: ${cr.connection_id}, Key Version: ${cr.key_version}`);
      const decrypted = decryptToken(cr, appEncryptionSecret);
      if (decrypted) {
        console.log(`  Decryption: SUCCESS (length: ${decrypted.length} chars, masked: ${mask(decrypted)})`);
        vaultToken = decrypted;
      } else {
        console.log(`  Decryption: FAILED (Ciphertext or key mismatch)`);
      }
    }
  }

  // Choose token to test
  const tokenToTest = envTestToken || vaultToken;

  console.log("\n--- 3. Meta Access Token Inspection & Graph API Handshake ---");
  if (!tokenToTest) {
    console.log("❌ Result: No access token found in .env.local or wa_credentials!");
    return;
  }

  // 1) Debug Token Endpoint
  if (appId && appSecret) {
    try {
      console.log("Querying Meta /debug_token endpoint...");
      const debugUrl = `https://graph.facebook.com/v26.0/debug_token?input_token=${encodeURIComponent(tokenToTest)}&access_token=${encodeURIComponent(appId)}|${encodeURIComponent(appSecret)}`;
      const debugRes = await fetch(debugUrl);
      const debugData = await debugRes.json();

      if (debugData.data) {
        const d = debugData.data;
        console.log("✅ Meta Token Debug Info:");
        console.log(`  App ID            : ${d.app_id}`);
        console.log(`  Application       : ${d.application}`);
        console.log(`  Type              : ${d.type}`);
        console.log(`  Is Valid          : ${d.is_valid}`);
        console.log(`  Expires At        : ${d.expires_at === 0 ? "Never (Permanent)" : new Date(d.expires_at * 1000).toISOString()} (raw: ${d.expires_at})`);
        console.log(`  Data Access Exp   : ${d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000).toISOString() : "N/A"}`);
        console.log(`  Issued At         : ${d.issued_at ? new Date(d.issued_at * 1000).toISOString() : "N/A"}`);
        console.log(`  Scopes/Permissions: ${(d.scopes || []).join(", ") || "None"}`);
        console.log(`  Granular Scopes   : ${JSON.stringify(d.granular_scopes || [])}`);
        console.log(`  User ID           : ${d.user_id || "N/A"}`);
      } else {
        console.log("❌ Debug Token Error Response:", debugData.error || debugData);
      }
    } catch (e) {
      console.error("Error querying debug_token:", e.message);
    }
  } else {
    console.log("⚠️ Cannot call /debug_token because META_APP_ID or META_APP_SECRET is missing.");
  }

  // 2) Phone Number Details Endpoint
  const phoneToTest = envTestPhoneId || "1395663896970053";
  console.log(`\nQuerying Meta /v26.0/${phoneToTest} (Phone Number Details)...`);
  try {
    const phoneUrl = `https://graph.facebook.com/v26.0/${phoneToTest}?fields=id,verified_name,display_phone_number,quality_rating,code_verification_status,account_mode`;
    const phoneRes = await fetch(phoneUrl, {
      headers: { Authorization: `Bearer ${tokenToTest}` },
    });
    const phoneData = await phoneRes.json();
    if (phoneRes.ok && !phoneData.error) {
      console.log("✅ Meta Phone Number Details:");
      console.log(`  ID                : ${phoneData.id}`);
      console.log(`  Verified Name     : ${phoneData.verified_name}`);
      console.log(`  Display Phone     : ${phoneData.display_phone_number}`);
      console.log(`  Quality Rating    : ${phoneData.quality_rating}`);
      console.log(`  Verification Stat : ${phoneData.code_verification_status}`);
      console.log(`  Account Mode      : ${phoneData.account_mode || "LIVE"}`);
    } else {
      console.log("❌ Meta Phone Number Query Failed:", phoneData.error || phoneData);
    }
  } catch (e) {
    console.error("Error querying phone number details:", e.message);
  }

  // 3) WABA Details Endpoint
  const wabaToTest = envTestWabaId || "1153964060437882";
  console.log(`\nQuerying Meta /v26.0/${wabaToTest} (WABA Details)...`);
  try {
    const wabaUrl = `https://graph.facebook.com/v26.0/${wabaToTest}?fields=id,name,timezone_id,currency,message_template_namespace`;
    const wabaRes = await fetch(wabaUrl, {
      headers: { Authorization: `Bearer ${tokenToTest}` },
    });
    const wabaData = await wabaRes.json();
    if (wabaRes.ok && !wabaData.error) {
      console.log("✅ Meta WABA Details:");
      console.log(`  ID                : ${wabaData.id}`);
      console.log(`  Name              : ${wabaData.name}`);
      console.log(`  Timezone          : ${wabaData.timezone_id}`);
      console.log(`  Currency          : ${wabaData.currency}`);
      console.log(`  Namespace         : ${wabaData.message_template_namespace}`);
    } else {
      console.log("❌ Meta WABA Query Failed:", wabaData.error || wabaData);
    }
  } catch (e) {
    console.error("Error querying WABA details:", e.message);
  }
}

inspectTokenAndConnections().catch((err) => {
  console.error("Unhandled error:", err);
});

async function checkAppWebhookSubscriptions() {
  console.log("\n--- 4. Meta Webhook Subscription Inspection ---");
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  if (!appId || !appSecret) {
    console.log("❌ META_APP_ID or META_APP_SECRET missing");
    return;
  }
  const appToken = `${appId}|${appSecret}`;
  const url = `https://graph.facebook.com/v26.0/${appId}/subscriptions`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${appToken}` },
    });
    const data = await res.json();
    console.log(`Subscriptions Query Status: ${res.status}`);
    if (data.data) {
      console.log(`Subscriptions Found: ${data.data.length}`);
      for (const sub of data.data) {
        console.log(`- Object: ${sub.object}`);
        console.log(`  Callback URL: ${sub.callback_url}`);
        console.log(`  Active: ${sub.active}`);
        console.log(`  Fields: ${(sub.fields || []).map((f) => f.name).join(", ")}`);
      }
    } else {
      console.log("Subscriptions Query Response:", data);
    }
  } catch (err) {
    console.error("Error querying subscriptions:", err.message);
  }
}

checkAppWebhookSubscriptions().catch(console.error);
