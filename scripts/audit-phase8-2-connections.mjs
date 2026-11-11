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
  if (!token) return "[NONE/EMPTY]";
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return `sha256:${hash.slice(0, 16)} (len: ${token.length})`;
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

async function audit() {
  console.log("=== PHASE 8.2: READ-ONLY AUDIT OF WHATSAPP CONNECTIONS & ISOLATION ===");
  console.log("Timestamp:", new Date().toISOString());

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const appEncryptionSecret = env.APP_ENCRYPTION_SECRET;
  const metaAppId = env.META_APP_ID;
  const metaAppSecret = env.META_APP_SECRET;

  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Businesses
  const { data: businesses, error: bizErr } = await adminClient
    .from("businesses")
    .select("id, name, slug, is_active, created_at")
    .order("slug");
  if (bizErr) throw bizErr;

  console.log("\n1. Businesses Table:");
  console.table(businesses);

  // 2. WhatsApp Connections
  const { data: connections, error: connErr } = await adminClient
    .from("wa_connections")
    .select("*")
    .order("created_at");
  if (connErr) throw connErr;

  console.log("\n2. wa_connections Table:");
  console.log(JSON.stringify(connections, null, 2));

  // 3. WhatsApp Credentials (Vault)
  const { data: credentials, error: credErr } = await adminClient
    .from("wa_credentials")
    .select("id, connection_id, business_id, key_version, iv, auth_tag, ciphertext, created_at, updated_at")
    .order("created_at");
  if (credErr) throw credErr;

  console.log("\n3. wa_credentials Table (Non-secret metadata):");
  const credSummaries = credentials.map((cr) => {
    const decrypted = decryptToken(cr, appEncryptionSecret);
    return {
      id: cr.id,
      connection_id: cr.connection_id,
      business_id: cr.business_id,
      key_version: cr.key_version,
      iv_len_bytes: cr.iv ? cr.iv.length / 2 : 0,
      auth_tag_len_bytes: cr.auth_tag ? cr.auth_tag.length / 2 : 0,
      ciphertext_len_bytes: cr.ciphertext ? cr.ciphertext.length / 2 : 0,
      decryption_status: decrypted ? "SUCCESS" : "FAILED",
      credential_fingerprint: tokenFingerprint(decrypted),
      created_at: cr.created_at,
      updated_at: cr.updated_at,
    };
  });
  console.table(credSummaries);

  // 4. Business Settings
  const { data: settings, error: settErr } = await adminClient
    .from("business_settings")
    .select("id, business_id, display_name, default_connection_id, timezone, default_language, opt_out_keywords")
    .order("display_name");
  if (settErr) throw settErr;

  console.log("\n4. business_settings Table:");
  console.table(settings);

  // 5. Test Meta Graph API calls for both connections
  console.log("\n5. Testing Meta Graph API Handshakes (Read-Only):");

  for (const conn of connections) {
    console.log(`\n--- Testing Connection: ${conn.display_name} (${conn.id}) ---`);
    console.log(`Business ID: ${conn.business_id}`);
    console.log(`Phone Number ID: ${conn.phone_number_id}`);
    console.log(`WABA ID: ${conn.waba_id}`);
    console.log(`Connection Status in DB: ${conn.connection_status}`);

    // Check credential for this connection
    const credRow = credentials.find((c) => c.connection_id === conn.id);
    if (!credRow) {
      console.log(`❌ No credential found in wa_credentials vault for connection ${conn.id}`);
      continue;
    }

    const token = decryptToken(credRow, appEncryptionSecret);
    if (!token) {
      console.log(`❌ Failed to decrypt vault token for connection ${conn.id}`);
      continue;
    }

    console.log(`Credential Fingerprint: ${tokenFingerprint(token)}`);

    // Graph API: Phone Number endpoint
    try {
      const phoneUrl = `https://graph.facebook.com/v26.0/${conn.phone_number_id}?fields=id,verified_name,display_phone_number,quality_rating,code_verification_status,account_mode`;
      const res = await fetch(phoneUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log(`Graph API /${conn.phone_number_id} Response Code: ${res.status}`);
      if (res.ok) {
        console.log("✅ Success:", data);
      } else {
        console.log("❌ Error response:", JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error("Fetch error:", e.message);
    }

    // Graph API: WABA endpoint
    try {
      const wabaUrl = `https://graph.facebook.com/v26.0/${conn.waba_id}?fields=id,name,currency,timezone_id,message_template_namespace`;
      const res = await fetch(wabaUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log(`Graph API /${conn.waba_id} Response Code: ${res.status}`);
      if (res.ok) {
        console.log("✅ Success:", data);
      } else {
        console.log("❌ Error response:", JSON.stringify(data, null, 2));
      }
    } catch (e) {
      console.error("Fetch error:", e.message);
    }
  }

  // Also check if Astrology's phone ID can be queried with ANY token or debug_token
  console.log("\n--- Checking Astrology Phone ID (109283746501928) against Meta ---");
  const anyToken = env.META_TEST_ACCESS_TOKEN;
  if (anyToken) {
    try {
      const url = `https://graph.facebook.com/v26.0/109283746501928`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${anyToken}` } });
      const data = await res.json();
      console.log("Astrology Phone ID query response:", res.status, data);
    } catch (e) {
      console.log("Error querying Astrology phone ID:", e.message);
    }
  }

  // 6. Cross-Tenant Sharing Checks
  console.log("\n6. Cross-Tenant Sharing Analysis:");
  // Check if any connection is referenced by multiple businesses
  const connMap = new Map();
  connections.forEach(c => {
    if (connMap.has(c.id)) {
      console.error(`🚨 COLLISION: Connection ${c.id} appears multiple times!`);
    }
    connMap.set(c.id, c.business_id);
  });
  console.log(`Total Connections: ${connections.length}. Unique IDs: ${connMap.size}`);

  // Check Phone Number IDs across connections
  const phoneMap = new Map();
  connections.forEach(c => {
    if (phoneMap.has(c.phone_number_id)) {
      console.error(`🚨 SHARED PHONE NUMBER ID: ${c.phone_number_id} shared between ${phoneMap.get(c.phone_number_id)} and ${c.business_id}`);
    } else {
      phoneMap.set(c.phone_number_id, c.business_id);
    }
  });
  console.log(`Total Phone IDs: ${phoneMap.size}. Cross-business sharing: ${phoneMap.size === connections.length ? "NONE (Isolated)" : "DETECTED"}`);

  // Check WABA IDs across connections
  const wabaMap = new Map();
  connections.forEach(c => {
    if (wabaMap.has(c.waba_id)) {
      console.log(`ℹ️ WABA ID: ${c.waba_id} is associated with business ${c.business_id} and ${wabaMap.get(c.waba_id)}`);
    } else {
      wabaMap.set(c.waba_id, c.business_id);
    }
  });

  // Check Credentials Vault sharing
  const credConnectionMap = new Map();
  const credBusinessMap = new Map();
  credentials.forEach(cr => {
    credConnectionMap.set(cr.connection_id, cr.business_id);
    credBusinessMap.set(cr.id, cr.business_id);
  });
  console.log(`Vault Credentials Count: ${credentials.length}`);
  credentials.forEach(cr => {
    const matchingConn = connections.find(c => c.id === cr.connection_id);
    if (!matchingConn) {
      console.warn(`⚠️ Credential ${cr.id} points to non-existent connection ${cr.connection_id}`);
    } else if (matchingConn.business_id !== cr.business_id) {
      console.error(`🚨 TENANT MISMATCH: Credential ${cr.id} has business_id ${cr.business_id} but connection ${matchingConn.id} has business_id ${matchingConn.business_id}`);
    } else {
      console.log(`✅ Credential ${cr.id} correctly bound to connection ${matchingConn.id} and business ${cr.business_id}`);
    }
  });

  // 7. Check Webhook Subscriptions on Meta Developer App
  console.log("\n7. Checking Webhook Subscriptions via Meta Graph API (Read-Only)...");
  if (metaAppId && metaAppSecret) {
    try {
      const subUrl = `https://graph.facebook.com/v26.0/${metaAppId}/subscriptions?access_token=${metaAppId}|${metaAppSecret}`;
      const res = await fetch(subUrl);
      const data = await res.json();
      console.log("App Subscriptions response:", res.status, JSON.stringify(data, null, 2));
    } catch (e) {
      console.log("Error checking app subscriptions:", e.message);
    }
  }

  console.log("\n=== AUDIT COMPLETE ===");
}

audit().catch(e => {
  console.error("Audit error:", e);
  process.exit(1);
});
