import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execSync } from "child_process";
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

// Resolver implementation matching src/lib/whatsapp/service.ts getDecryptedConnectionCredentials
async function resolveConnectionCredentials(supabase, businessId, connectionId, appSecretHex) {
  const { data: conn, error: connError } = await supabase
    .from("wa_connections")
    .select("id, business_id, display_name, phone_number_id, is_enabled, wa_credentials(*)")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();

  if (connError || !conn) {
    throw new Error("Connection not found or cross-tenant access denied.");
  }

  if (!conn.is_enabled) {
    throw new Error(`WhatsApp connection "${conn.display_name}" is currently disabled.`);
  }

  const credRow = Array.isArray(conn.wa_credentials) ? conn.wa_credentials[0] : conn.wa_credentials;

  // If credentials exist in the vault, decrypt them
  if (credRow && credRow.ciphertext && credRow.iv && credRow.auth_tag) {
    const token = decryptToken(credRow, appSecretHex);
    return {
      source: "DATABASE_VAULT",
      phoneNumberId: conn.phone_number_id,
      accessToken: token,
      displayName: conn.display_name,
    };
  }

  // Fallback for Phase 3 test sandbox if connection matches test Phone Number ID
  const testPhoneId = process.env.META_TEST_PHONE_NUMBER_ID || env.META_TEST_PHONE_NUMBER_ID;
  const testToken = process.env.META_TEST_ACCESS_TOKEN || env.META_TEST_ACCESS_TOKEN;
  if (testPhoneId && testToken && conn.phone_number_id === testPhoneId) {
    return {
      source: "ENVIRONMENT_FALLBACK",
      phoneNumberId: testPhoneId,
      accessToken: testToken,
      displayName: conn.display_name,
    };
  }

  throw new Error("Missing or corrupted credentials in vault for this connection.");
}

async function run() {
  const isExecute = process.argv.includes("--execute");

  console.log("================================================================================");
  console.log("🔐 GOKUL CONNECT — PHASE 6.3: ENCRYPTED META CREDENTIAL SYNCHRONIZATION");
  console.log(`Mode: ${isExecute ? "🚨 EXECUTE (LIVE WRITE)" : "🛡️ DRY-RUN / SAFEGUARD VALIDATION"}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("================================================================================");

  // Constants & Approved Target Spec
  const TARGET_CREDENTIAL_ID = "64b36ca4-0ced-4b98-81be-321aa0486f17";
  const TARGET_CONNECTION_ID = "44444444-4444-4444-4444-444444444444";
  const TARGET_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";
  const TARGET_BUSINESS_NAME = "Gokul Vivaham";
  const APPROVED_NEW_TOKEN_FP = "sha256:8166a1011cf4";
  const PREVIOUS_VAULT_TOKEN_FP = "sha256:e9edb2953985";

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const appEncryptionSecret = env.APP_ENCRYPTION_SECRET;
  const envToken = env.META_TEST_ACCESS_TOKEN;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase configuration in .env.local");
  }
  if (!appEncryptionSecret) {
    throw new Error("Missing APP_ENCRYPTION_SECRET in .env.local");
  }
  if (!envToken) {
    throw new Error("Missing META_TEST_ACCESS_TOKEN in .env.local");
  }

  // --- SAFEGUARD 2: Verify new token fingerprint against approved Phase 6.2 fingerprint ---
  const newEnvFingerprint = tokenFingerprint(envToken);
  console.log(`[SAFEGUARD 2] New Environment Token Fingerprint: ${newEnvFingerprint}`);
  if (newEnvFingerprint !== APPROVED_NEW_TOKEN_FP) {
    throw new Error(`[SAFEGUARD 2 FAILED] Token fingerprint ${newEnvFingerprint} does not match approved Phase 6.2 fingerprint ${APPROVED_NEW_TOKEN_FP}!`);
  }
  console.log(`✅ [SAFEGUARD 2 PASSED] Fingerprint matches approved Phase 6.2 token: ${APPROVED_NEW_TOKEN_FP}`);

  // --- SAFEGUARD 3: Verify backup directory is Git-ignored and backup file is not committed ---
  const backupDir = path.resolve(process.cwd(), "scripts", "backup");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    const gitCheck = execSync("git check-ignore scripts/backup", { encoding: "utf8" }).trim();
    if (!gitCheck.includes("backup")) {
      throw new Error("git check-ignore did not report scripts/backup as ignored.");
    }
  } catch (err) {
    throw new Error(`[SAFEGUARD 3 FAILED] scripts/backup is NOT Git-ignored: ${err.message}`);
  }

  const gitStatusOutput = execSync("git status --porcelain scripts/backup", { encoding: "utf8" }).trim();
  if (gitStatusOutput.length > 0) {
    throw new Error(`[SAFEGUARD 3 FAILED] Backup directory has tracked/unignored files: ${gitStatusOutput}`);
  }
  console.log("✅ [SAFEGUARD 3 PASSED] scripts/backup/ is verified Git-ignored and not committed.");

  const supabase = createClient(supabaseUrl, serviceKey);

  // Baseline audit of public.wa_credentials before any action
  const { data: allCredsBefore, error: allCredsErr } = await supabase.from("wa_credentials").select("id, connection_id, business_id, updated_at");
  if (allCredsErr) throw new Error(`Failed to audit wa_credentials: ${allCredsErr.message}`);
  console.log(`[AUDIT] Total wa_credentials records in database: ${allCredsBefore.length}`);

  // --- SAFEGUARD 1: Verify target record and its business/connection ownership immediately before writing ---
  const { data: conn, error: connErr } = await supabase
    .from("wa_connections")
    .select("*, businesses(id, name, slug)")
    .eq("id", TARGET_CONNECTION_ID)
    .single();

  if (connErr || !conn) {
    throw new Error(`Target connection ${TARGET_CONNECTION_ID} not found: ${connErr?.message}`);
  }

  if (conn.business_id !== TARGET_BUSINESS_ID) {
    throw new Error(`[SAFEGUARD 1 FAILED] Connection business_id ${conn.business_id} !== ${TARGET_BUSINESS_ID}`);
  }
  if (conn.businesses?.name !== TARGET_BUSINESS_NAME) {
    throw new Error(`[SAFEGUARD 1 FAILED] Business name ${conn.businesses?.name} !== ${TARGET_BUSINESS_NAME}`);
  }

  const { data: existingCred, error: credErr } = await supabase
    .from("wa_credentials")
    .select("*")
    .eq("id", TARGET_CREDENTIAL_ID)
    .single();

  if (credErr || !existingCred) {
    throw new Error(`Target credential ${TARGET_CREDENTIAL_ID} not found: ${credErr?.message}`);
  }

  if (existingCred.connection_id !== TARGET_CONNECTION_ID) {
    throw new Error(`[SAFEGUARD 1 FAILED] Credential connection_id ${existingCred.connection_id} !== ${TARGET_CONNECTION_ID}`);
  }
  if (existingCred.business_id !== TARGET_BUSINESS_ID) {
    throw new Error(`[SAFEGUARD 1 FAILED] Credential business_id ${existingCred.business_id} !== ${TARGET_BUSINESS_ID}`);
  }

  const existingDecrypted = decryptToken(existingCred, appEncryptionSecret);
  const existingFingerprint = tokenFingerprint(existingDecrypted);

  console.log("\n--- [SAFEGUARD 1 VERIFIED] Target Ownership ---");
  console.log(`Connection ID         : ${conn.id} (Matches TARGET)`);
  console.log(`Connection Name       : ${conn.display_name}`);
  console.log(`Business ID           : ${conn.business_id} (Matches TARGET)`);
  console.log(`Business Name         : ${conn.businesses?.name}`);
  console.log(`Business Slug         : ${conn.businesses?.slug}`);
  console.log(`Phone Number ID       : ${conn.phone_number_id}`);
  console.log(`WABA ID               : ${conn.waba_id}`);
  console.log(`Status / Enabled      : ${conn.connection_status} / ${conn.is_enabled}`);
  console.log(`Credential Record ID  : ${existingCred.id} (Matches TARGET)`);
  console.log(`Current Vault FP      : ${existingFingerprint}`);

  // Safeguard 9: Verify current vault state has not unexpectedly drifted
  if (existingFingerprint !== PREVIOUS_VAULT_TOKEN_FP) {
    throw new Error(`[SAFEGUARD 9 FAILED] Current vault token fingerprint ${existingFingerprint} does not match expected baseline ${PREVIOUS_VAULT_TOKEN_FP}! Halting.`);
  }

  // Create local snapshot backup file
  const backupFile = path.resolve(backupDir, `wa_credentials_backup_${TARGET_CONNECTION_ID}.json`);
  const backupData = {
    backup_timestamp: new Date().toISOString(),
    connection_id: TARGET_CONNECTION_ID,
    business_id: existingCred.business_id,
    record: existingCred,
    verified_existing_fingerprint: existingFingerprint,
  };
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`\n[BACKUP] Existing credential backup snapshot saved to:`);
  console.log(`         ${backupFile}`);

  // --- SAFEGUARDS 4, 5, 6: Preserve AES-256-GCM format, 12-byte IV, 16-byte Auth Tag ---
  console.log("\n--- [SAFEGUARDS 4, 5, 6] Cryptographic Preparation ---");
  const encryptedPayload = encryptToken(envToken, appEncryptionSecret, "v1");
  const ivBuffer = Buffer.from(encryptedPayload.iv, "hex");
  const authTagBuffer = Buffer.from(encryptedPayload.auth_tag, "hex");

  if (ivBuffer.length !== 12) {
    throw new Error(`[SAFEGUARD 5 FAILED] IV length is ${ivBuffer.length} bytes, expected 12 bytes!`);
  }
  if (authTagBuffer.length !== 16) {
    throw new Error(`[SAFEGUARD 6 FAILED] Auth tag length is ${authTagBuffer.length} bytes, expected 16 bytes!`);
  }

  console.log(`Algorithm             : AES-256-GCM`);
  console.log(`Key Version           : ${encryptedPayload.key_version}`);
  console.log(`Fresh IV (hex len)    : ${encryptedPayload.iv.length} chars (${ivBuffer.length} bytes)`);
  console.log(`Auth Tag (hex len)    : ${encryptedPayload.auth_tag.length} chars (${authTagBuffer.length} bytes)`);
  console.log(`Ciphertext (hex len)  : ${encryptedPayload.ciphertext.length} chars`);

  // In-memory round-trip decryption verification
  const testDecrypt = decryptToken(encryptedPayload, appEncryptionSecret);
  const testFingerprint = tokenFingerprint(testDecrypt);
  if (testFingerprint !== APPROVED_NEW_TOKEN_FP) {
    throw new Error(`Roundtrip decryption validation failed! ${testFingerprint} !== ${APPROVED_NEW_TOKEN_FP}`);
  }
  console.log(`Round-trip Validation : SUCCESS (Fingerprint verified: ${testFingerprint})`);

  if (!isExecute) {
    console.log("\n================================================================================");
    console.log("🛑 DRY-RUN COMPLETE: ALL SAFEGUARDS VERIFIED. NO WRITES PERFORMED.");
    console.log("================================================================================");
    console.log("Target Record ID      : " + existingCred.id);
    console.log("Target Connection ID  : " + TARGET_CONNECTION_ID);
    console.log("Target Business ID    : " + TARGET_BUSINESS_ID);
    console.log("Existing Vault FP     : " + existingFingerprint);
    console.log("Approved New Token FP : " + APPROVED_NEW_TOKEN_FP);
    console.log("Rollback Backup File  : " + backupFile);
    console.log("To execute live write, pass --execute flag.");
    return;
  }

  // --- SAFEGUARDS 7 & 8: Conditional Database Update ---
  console.log("\n--- [STEP 4: EXECUTE] Performing Conditional Database Update ---");
  const updatePayload = {
    iv: encryptedPayload.iv,
    auth_tag: encryptedPayload.auth_tag,
    ciphertext: encryptedPayload.ciphertext,
    key_version: encryptedPayload.key_version,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedRows, error: updateErr } = await supabase
    .from("wa_credentials")
    .update(updatePayload)
    .eq("id", TARGET_CREDENTIAL_ID)
    .eq("connection_id", TARGET_CONNECTION_ID)
    .eq("business_id", TARGET_BUSINESS_ID)
    .eq("ciphertext", existingCred.ciphertext)
    .eq("key_version", existingCred.key_version)
    .select();

  if (updateErr) {
    throw new Error(`Database conditional update failed: ${updateErr.message}`);
  }

  if (!updatedRows || updatedRows.length !== 1) {
    throw new Error(`[SAFEGUARD 7/8/9 FAILED] Expected exactly 1 updated record, but received ${updatedRows?.length ?? 0}. Aborting!`);
  }

  const updatedRecord = updatedRows[0];
  console.log("✅ Database record updated successfully.");
  console.log("Updated Record ID    :", updatedRecord.id);
  console.log("Updated Record Time  :", updatedRecord.updated_at);

  // --- POST-UPDATE VERIFICATIONS ---
  console.log("\n================================================================================");
  console.log("🔍 POST-UPDATE VERIFICATION PROTOCOL");
  console.log("================================================================================");

  // 1. Verify exactly 1 record updated & no other records touched
  const { data: allCredsAfter, error: allCredsAfterErr } = await supabase.from("wa_credentials").select("id, connection_id, business_id, updated_at");
  if (allCredsAfterErr) throw allCredsAfterErr;

  console.log(`1. Total credential count check: ${allCredsAfter.length} === ${allCredsBefore.length}`);
  if (allCredsAfter.length !== allCredsBefore.length) {
    throw new Error("Credential count mismatch after update!");
  }

  for (const cr of allCredsAfter) {
    if (cr.id !== TARGET_CREDENTIAL_ID) {
      const beforeCr = allCredsBefore.find((b) => b.id === cr.id);
      if (!beforeCr || beforeCr.updated_at !== cr.updated_at) {
        throw new Error(`Unintended mutation detected on non-target credential record ${cr.id}!`);
      }
    }
  }
  console.log("   ✅ Confirmed: Zero other credential records were modified.");

  // 2. Decrypt new record and verify fingerprint
  const reDecrypted = decryptToken(updatedRecord, appEncryptionSecret);
  const reDecryptedFp = tokenFingerprint(reDecrypted);
  console.log("2. Decryption integrity check   :", reDecrypted ? "SUCCESS" : "FAILED");
  console.log("   Stored Token Fingerprint     :", reDecryptedFp);
  console.log("   Matches Approved Token FP    :", reDecryptedFp === APPROVED_NEW_TOKEN_FP);

  if (reDecryptedFp !== APPROVED_NEW_TOKEN_FP) {
    throw new Error("Decrypted token fingerprint does not match approved new token fingerprint!");
  }

  // 3. Credential resolver verification: Test resolver chooses vault over environment fallback
  console.log("\n3. Credential Resolver Verification:");
  // Set fallback env token to dummy sentinel to prove resolver selects database vault
  const originalEnvToken = process.env.META_TEST_ACCESS_TOKEN;
  process.env.META_TEST_ACCESS_TOKEN = "TEST_SENTINEL_ENVIRONMENT_FALLBACK_TOKEN_12345";

  const resolvedVaultCred = await resolveConnectionCredentials(supabase, TARGET_BUSINESS_ID, TARGET_CONNECTION_ID, appEncryptionSecret);
  // Restore original env token
  process.env.META_TEST_ACCESS_TOKEN = originalEnvToken;

  console.log("   Resolver Source              :", resolvedVaultCred.source);
  console.log("   Resolver Phone Number ID     :", resolvedVaultCred.phoneNumberId);
  console.log("   Resolver Token Fingerprint   :", tokenFingerprint(resolvedVaultCred.accessToken));
  console.log("   Resolver Used DB Vault       :", resolvedVaultCred.source === "DATABASE_VAULT");
  console.log("   Ignored Env Fallback Sentinel:", resolvedVaultCred.accessToken !== "TEST_SENTINEL_ENVIRONMENT_FALLBACK_TOKEN_12345");

  if (resolvedVaultCred.source !== "DATABASE_VAULT" || tokenFingerprint(resolvedVaultCred.accessToken) !== APPROVED_NEW_TOKEN_FP) {
    throw new Error("Credential resolver did not prioritize or return the refreshed vault credential!");
  }
  console.log("   ✅ Credential resolver correctly prioritizes refreshed vault credential.");

  // 4. Meta Graph API Verification using decrypted token
  console.log("\n4. Meta Graph API Verification:");
  const apiVersion = env.WHATSAPP_API_VERSION || "v26.0";
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;

  const debugUrl = `https://graph.facebook.com/${apiVersion}/debug_token?input_token=${encodeURIComponent(
    reDecrypted
  )}&access_token=${encodeURIComponent(appId)}|${encodeURIComponent(appSecret)}`;

  const debugRes = await fetch(debugUrl);
  const debugData = await debugRes.json();

  if (debugData.error) {
    throw new Error(`Meta debug_token error: ${debugData.error.message}`);
  }

  console.log("   Meta debug_token is_valid    :", debugData.data?.is_valid);
  console.log("   Meta debug_token App ID      :", debugData.data?.app_id);
  console.log("   Meta debug_token Application :", debugData.data?.application);
  console.log("   Meta debug_token Scopes      :", debugData.data?.scopes?.join(", "));

  if (debugData.data?.is_valid !== true) {
    throw new Error("Meta debug_token reported is_valid !== true");
  }
  if (debugData.data?.app_id !== "1102646469266479") {
    throw new Error(`Meta app_id mismatch: ${debugData.data?.app_id} !== 1102646469266479`);
  }
  const scopes = debugData.data?.scopes || [];
  const hasMessaging = scopes.includes("whatsapp_business_messaging");
  const hasManagement = scopes.includes("whatsapp_business_management");
  if (!hasMessaging || !hasManagement) {
    throw new Error("Missing required WhatsApp permissions in debug_token!");
  }
  console.log("   ✅ Meta debug_token confirmed valid with Gokul Connect app and required WhatsApp permissions.");

  // 5. Phone Number ID verification
  const phoneUrl = `https://graph.facebook.com/${apiVersion}/${conn.phone_number_id}?access_token=${encodeURIComponent(
    reDecrypted
  )}`;
  const phoneRes = await fetch(phoneUrl);
  const phoneData = await phoneRes.json();
  if (phoneData.error) {
    throw new Error(`Phone number verification failed: ${phoneData.error.message}`);
  }
  console.log("   Phone Number Validation      : SUCCESS", {
    id: phoneData.id,
    display_phone_number: phoneData.display_phone_number,
    verified_name: phoneData.verified_name,
    status: phoneData.status,
  });

  // 6. WABA ID verification
  const wabaUrl = `https://graph.facebook.com/${apiVersion}/${conn.waba_id}?access_token=${encodeURIComponent(
    reDecrypted
  )}`;
  const wabaRes = await fetch(wabaUrl);
  const wabaData = await wabaRes.json();
  if (wabaData.error) {
    throw new Error(`WABA verification failed: ${wabaData.error.message}`);
  }
  console.log("   WABA Validation              : SUCCESS", {
    id: wabaData.id,
    name: wabaData.name,
    timezone: wabaData.timezone,
  });

  // 7. Verify no changes to wa_connections
  const { data: connsAfter, error: connsAfterErr } = await supabase
    .from("wa_connections")
    .select("id, business_id, phone_number_id, waba_id, connection_status, is_enabled");
  if (connsAfterErr) throw connsAfterErr;

  const vivConnAfter = connsAfter.find((c) => c.id === TARGET_CONNECTION_ID);
  const astroConnAfter = connsAfter.find((c) => c.id === "33333333-3333-3333-3333-333333333333");

  if (vivConnAfter?.business_id !== TARGET_BUSINESS_ID || astroConnAfter?.business_id !== "11111111-1111-1111-1111-111111111111") {
    throw new Error("Connection tenant assignment alteration detected!");
  }
  console.log("   ✅ wa_connections business assignments verified 100% intact.");

  console.log("\n================================================================================");
  console.log("🎉 PHASE 6.3 DATABASE SYNCHRONIZATION AND VERIFICATION COMPLETE!");
  console.log("================================================================================");
}

run().catch((err) => {
  console.error("❌ Synchronization execution error:", err.message);
  process.exit(1);
});
