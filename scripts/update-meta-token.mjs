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

function encryptToken(plaintext, appSecretHex, keyVersion = "v1") {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty token.");
  }
  const key = getMasterKey(appSecretHex);
  const iv = crypto.randomBytes(12); // NIST 800-38D standard 12 bytes
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    key_version: keyVersion,
    iv: iv.toString("hex"),
    auth_tag: authTag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

async function verifyTokenWithMeta(phoneNumberId, token) {
  const url = `https://graph.facebook.com/v26.0/${encodeURIComponent(phoneNumberId)}?fields=id,verified_name,display_phone_number,quality_rating`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  if (!res.ok) {
    const err = body.error || {};
    throw new Error(`Meta API Validation Failed (${err.code}${err.error_subcode ? `:${err.error_subcode}` : ""}): ${err.message}`);
  }
  return body;
}

async function main() {
  console.log("================================================================================");
  console.log("🔐 GOKUL CONNECT — META ACCESS TOKEN ROTATION & SYNC UTILITY");
  console.log("================================================================================");

  // Parse arguments or fallback to .env.local
  const args = process.argv.slice(2);
  let newToken = null;
  let targetPhoneId = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token" && args[i + 1]) {
      newToken = args[i + 1].trim();
      i++;
    } else if (args[i] === "--phone-id" && args[i + 1]) {
      targetPhoneId = args[i + 1].trim();
      i++;
    }
  }

  if (!newToken) {
    newToken = env.META_TEST_ACCESS_TOKEN || process.env.META_TEST_ACCESS_TOKEN;
  }
  if (!targetPhoneId) {
    targetPhoneId = env.META_TEST_PHONE_NUMBER_ID || process.env.META_TEST_PHONE_NUMBER_ID || "1395663896970053";
  }

  if (!newToken) {
    console.error("❌ ERROR: No token provided.");
    console.log("Usage: node scripts/update-meta-token.mjs --token <NEW_PERMANENT_META_TOKEN>");
    console.log("   OR: Set META_TEST_ACCESS_TOKEN in .env.local and run: node scripts/update-meta-token.mjs");
    process.exit(1);
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appEncryptionSecret = env.APP_ENCRYPTION_SECRET || process.env.APP_ENCRYPTION_SECRET;

  if (!supabaseUrl || !serviceKey) {
    console.error("❌ ERROR: Missing Supabase credentials in .env.local");
    process.exit(1);
  }
  if (!appEncryptionSecret) {
    console.error("❌ ERROR: Missing APP_ENCRYPTION_SECRET in .env.local");
    process.exit(1);
  }

  console.log(`Target Phone Number ID : ${targetPhoneId}`);
  console.log(`New Token Fingerprint  : ${tokenFingerprint(newToken)}`);

  // Step 1: Live verify against Meta Graph API
  console.log("\n[1/4] Verifying token live against Meta Cloud API (v26.0)...");
  let metaDetails;
  try {
    metaDetails = await verifyTokenWithMeta(targetPhoneId, newToken);
    console.log("✅ Meta Cloud API verification successful!");
    console.log(`   Verified Name : "${metaDetails.verified_name || 'N/A'}"`);
    console.log(`   Phone Number  : ${metaDetails.display_phone_number || targetPhoneId}`);
    console.log(`   Quality Rating: ${metaDetails.quality_rating || 'GREEN'}`);
  } catch (metaErr) {
    console.error(`❌ Meta API Verification Failed: ${metaErr.message}`);
    console.error("\nPlease check that:");
    console.error("  1. The token is valid and unexpired (prefer a System User Permanent Token).");
    console.error("  2. Permissions 'whatsapp_business_messaging' and 'whatsapp_business_management' are granted.");
    console.error("  3. The token has access to Phone Number ID:", targetPhoneId);
    process.exitCode = 1;
    return;
  }

  // Step 2: Encrypt token with AES-256-GCM
  console.log("\n[2/4] Encrypting token with AES-256-GCM (NIST 800-38D standard)...");
  const encrypted = encryptToken(newToken, appEncryptionSecret);
  console.log(`✅ Token encrypted (IV: 12 bytes, Tag: 16 bytes, Ciphertext: ${encrypted.ciphertext.length / 2} bytes)`);

  // Step 3: Locate connection in Supabase
  console.log("\n[3/4] Finding target connection in Supabase...");
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: conn, error: connErr } = await supabase
    .from("wa_connections")
    .select("id, business_id, display_name, phone_number_id, connection_status")
    .eq("phone_number_id", targetPhoneId)
    .single();

  if (connErr || !conn) {
    console.error(`❌ Connection with phone_number_id '${targetPhoneId}' not found in database:`, connErr?.message);
    process.exit(1);
  }

  console.log(`   Found Connection: "${conn.display_name}" (ID: ${conn.id})`);

  // Step 4: Upsert wa_credentials and update wa_connections status
  console.log("\n[4/4] Writing encrypted credential and updating connection status...");
  const now = new Date().toISOString();

  // Check if wa_credentials already exists for this connection
  const { data: existingCred } = await supabase
    .from("wa_credentials")
    .select("id")
    .eq("connection_id", conn.id)
    .maybeSingle();

  if (existingCred) {
    const { error: updateCredErr } = await supabase
      .from("wa_credentials")
      .update({
        key_version: encrypted.key_version,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        ciphertext: encrypted.ciphertext,
        updated_at: now,
      })
      .eq("id", existingCred.id);

    if (updateCredErr) {
      console.error("❌ Failed to update wa_credentials:", updateCredErr.message);
      process.exit(1);
    }
  } else {
    const { error: insertCredErr } = await supabase
      .from("wa_credentials")
      .insert({
        connection_id: conn.id,
        business_id: conn.business_id,
        key_version: encrypted.key_version,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        ciphertext: encrypted.ciphertext,
      });

    if (insertCredErr) {
      console.error("❌ Failed to insert wa_credentials:", insertCredErr.message);
      process.exit(1);
    }
  }

  // Update connection status to connected
  const { error: updateConnErr } = await supabase
    .from("wa_connections")
    .update({
      connection_status: "connected",
      quality_rating: metaDetails.quality_rating || "GREEN",
      last_connected_at: now,
      last_checked_at: now,
      updated_at: now,
    })
    .eq("id", conn.id);

  if (updateConnErr) {
    console.error("❌ Failed to update wa_connections status:", updateConnErr.message);
    process.exit(1);
  }

  console.log("\n================================================================================");
  console.log("🎉 SUCCESS! META ACCESS TOKEN ROTATED AND VERIFIED SUCCESSFULLY");
  console.log("================================================================================");
  console.log(`Connection        : ${conn.display_name} (${conn.id})`);
  console.log(`Status            : connected`);
  console.log(`Quality Rating    : ${metaDetails.quality_rating || 'GREEN'}`);
  console.log(`Phone Number ID   : ${targetPhoneId}`);
  console.log(`Token Fingerprint : ${tokenFingerprint(newToken)}`);
  console.log("================================================================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
