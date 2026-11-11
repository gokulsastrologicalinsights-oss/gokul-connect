import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve("./.env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TARGET_EMAIL = "gokulsastrologicalinsights@gmail.com";
const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

async function main() {
  console.log("================================================================================");
  console.log("👑 GOKUL CONNECT — MAIN ADMIN ACCOUNT SETUP");
  console.log("================================================================================");
  console.log(`Target Email: ${TARGET_EMAIL}`);
  console.log(`Redirect Target: ${APP_URL}/auth/callback?next=/update-password\n`);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. Check if user already exists
  console.log("1. Checking existing Supabase Auth users...");
  const { data: usersList, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  let user = usersList.users.find((u) => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase());

  if (!user) {
    console.log("2. Inviting user via Supabase Auth Admin API (inviteUserByEmail)...");
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      TARGET_EMAIL,
      {
        data: {
          full_name: "Gokul (Platform Admin)",
        },
        redirectTo: `${APP_URL}/auth/callback?next=/update-password`,
      }
    );

    if (inviteError) {
      console.error(`❌ Supabase invitation failed: ${inviteError.message} (status: ${inviteError.status})`);
      console.error("Email invitation delivery is unavailable. Stopping as required by safety protocol.");
      process.exit(1);
    }

    user = inviteData.user;
    console.log("✅ Invitation email successfully dispatched by Supabase Auth!");
    console.log(`   User ID: ${user.id}`);
    console.log(`   Invited At: ${user.invited_at || new Date().toISOString()}`);
  } else {
    console.log(`ℹ️  User already exists with ID: ${user.id}`);
    console.log(`   Email Confirmed: ${Boolean(user.email_confirmed_at || user.confirmed_at)}`);
  }

  const userId = user.id;

  // 3. Ensure user_profile exists and grant superadmin privileges
  console.log("\n3. Setting up user profile and superadmin authorization...");
  const { data: existingProfile } = await adminClient
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!existingProfile) {
    console.log("   Creating user_profile row...");
    const { error: profileInsertErr } = await adminClient.from("user_profiles").insert({
      id: userId,
      email: TARGET_EMAIL,
      full_name: "Gokul (Platform Admin)",
      is_superadmin: true,
    });
    if (profileInsertErr) {
      console.error("Failed to create profile:", profileInsertErr.message);
      process.exit(1);
    }
  } else {
    console.log("   Updating user_profile row with is_superadmin = true...");
    const { error: profileUpdateErr } = await adminClient
      .from("user_profiles")
      .update({
        full_name: "Gokul (Platform Admin)",
        is_superadmin: true,
      })
      .eq("id", userId);
    if (profileUpdateErr) {
      console.error("Failed to update profile:", profileUpdateErr.message);
      process.exit(1);
    }
  }
  console.log("✅ User profile updated: is_superadmin = true");

  // 4. Assign membership in both businesses
  console.log("\n4. Assigning authorized membership to both businesses...");

  // Astrology membership
  const { error: astroErr } = await adminClient.from("business_members").upsert(
    {
      business_id: ASTROLOGY_ID,
      user_id: userId,
      role: "owner",
      is_active: true,
    },
    { onConflict: "business_id,user_id" }
  );
  if (astroErr) {
    console.error("Failed to assign Astrology membership:", astroErr.message);
    process.exit(1);
  }
  console.log("✅ Astrology (11111111-1111-1111-1111-111111111111) membership assigned: role 'owner', active: true");

  // Vivaham membership
  const { error: vivahamErr } = await adminClient.from("business_members").upsert(
    {
      business_id: VIVAHAM_ID,
      user_id: userId,
      role: "owner",
      is_active: true,
    },
    { onConflict: "business_id,user_id" }
  );
  if (vivahamErr) {
    console.error("Failed to assign Vivaham membership:", vivahamErr.message);
    process.exit(1);
  }
  console.log("✅ Vivaham (22222222-2222-2222-2222-222222222222) membership assigned: role 'owner', active: true");

  console.log("\n================================================================================");
  console.log("🎉 MAIN ADMIN ACCOUNT PROVISIONING COMPLETE");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL SCRIPT ERROR:", err.message);
  process.exit(1);
});
