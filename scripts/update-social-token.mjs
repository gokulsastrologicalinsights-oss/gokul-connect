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

function getMasterKey(secretHex) {
  if (secretHex && secretHex.length === 64) {
    return Buffer.from(secretHex, "hex");
  }
  return crypto.createHash("sha256").update(secretHex || "gokul_connect_dev_master_key_32bytes!!_v1").digest();
}

function encryptToken(plaintext, appSecretHex, keyVersion = "v1") {
  const key = getMasterKey(appSecretHex);
  const iv = crypto.randomBytes(12);
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

async function main() {
  console.log("================================================================================");
  console.log("🔐 GOKUL CONNECT — META SOCIAL (FACEBOOK & INSTAGRAM) TOKEN ROTATION UTILITY");
  console.log("================================================================================\n");

  const args = process.argv.slice(2);
  let newToken = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token" && args[i + 1]) {
      newToken = args[i + 1].trim();
      i++;
    }
  }

  if (!newToken) {
    newToken = env.META_PAGE_ACCESS_TOKEN || env.META_SOCIAL_ACCESS_TOKEN;
  }

  if (!newToken) {
    console.log("❌ ERROR: No token provided.");
    console.log("Usage: node scripts/update-social-token.mjs --token <NEW_PAGE_OR_SYSTEM_USER_TOKEN>\n");
    console.log("To generate this token:");
    console.log("1. Open Meta Business Suite / Meta Developers (https://developers.facebook.com).");
    console.log("2. Create or select a System User or Page Token with scopes:");
    console.log("   - pages_show_list, pages_read_engagement, pages_manage_posts, pages_manage_engagement, pages_messaging");
    console.log("   - instagram_basic, instagram_manage_comments, instagram_manage_messages");
    process.exit(1);
  }

  // 1. Verify token with Meta Graph API
  console.log("🔍 Validating token against Meta Graph API...");
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  let debugData = null;

  if (appId && appSecret) {
    const appToken = `${appId}|${appSecret}`;
    try {
      const dbgRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${newToken}&access_token=${appToken}`);
      const dbgJson = await dbgRes.json();
      if (dbgJson.data) {
        debugData = dbgJson.data;
        console.log(`✅ Token is valid! Type: ${debugData.type || "PAGE/USER"}, App: ${debugData.application || appId}`);
        console.log("   Scopes found:", (debugData.scopes || []).join(", ") || "(none listed)");
      }
    } catch (e) {
      console.warn("⚠️ Could not debug token with App Secret:", e.message);
    }
  }

  // Test /me call
  const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${newToken}`);
  const meData = await meRes.json();
  if (meData.error) {
    console.error("❌ Meta API Error validating token:", meData.error.message);
    process.exit(1);
  }
  console.log(`✅ Identified as: ${meData.name} (ID: ${meData.id})`);

  // 2. Encrypt token
  const appEncryptionSecret = env.APP_ENCRYPTION_SECRET;
  if (!appEncryptionSecret) {
    console.error("❌ APP_ENCRYPTION_SECRET missing in .env.local");
    process.exit(1);
  }
  const encrypted = encryptToken(newToken, appEncryptionSecret);

  // 3. Update Supabase
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: connections, error: connErr } = await supabase
    .from("meta_social_connections")
    .select("id, platform, account_name, account_id, business_id");

  if (connErr || !connections?.length) {
    console.error("❌ Could not load meta_social_connections:", connErr?.message || "None found");
    process.exit(1);
  }

  console.log(`\n💾 Updating encrypted token for ${connections.length} social connections...`);
  for (const conn of connections) {
    const { error: upsertErr } = await supabase
      .from("meta_social_credentials")
      .upsert(
        {
          connection_id: conn.id,
          business_id: conn.business_id,
          key_version: encrypted.key_version,
          iv: encrypted.iv,
          auth_tag: encrypted.auth_tag,
          ciphertext: encrypted.ciphertext,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "connection_id" }
      );

    if (upsertErr) {
      console.error(`❌ Failed to update credentials for ${conn.platform} (${conn.account_name}):`, upsertErr.message);
    } else {
      console.log(`✅ Successfully updated credentials for ${conn.platform.toUpperCase()} (${conn.account_name})!`);
    }
  }

  console.log("\n🎉 All social connections have been updated with the new token!");
}

main().catch(console.error);
