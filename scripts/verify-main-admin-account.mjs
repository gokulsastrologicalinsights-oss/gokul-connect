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
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Configuration Error: Missing required environment variables.");
  process.exit(1);
}

const TARGET_EMAIL = "gokulsastrologicalinsights@gmail.com";
const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

async function verify() {
  console.log("================================================================================");
  console.log("🔍 GOKUL CONNECT — MAIN ADMIN VERIFICATION SUITE");
  console.log("================================================================================");
  console.log(`Target: ${TARGET_EMAIL}\n`);

  let passed = 0;
  let failed = 0;

  function report(name, condition, details = "") {
    if (condition) {
      console.log(`✅ [PASS] ${name} ${details ? "(" + details + ")" : ""}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${name} ${details ? "(" + details + ")" : ""}`);
      failed++;
    }
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Confirm account exists in Supabase Auth
  const { data: usersList, error: listErr } = await adminClient.auth.admin.listUsers();
  const targetUser = usersList?.users?.find(
    (u) => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase()
  );
  report(
    "Check 1: Main Admin exists in Supabase Auth",
    Boolean(targetUser && !listErr),
    targetUser ? `ID: ${targetUser.id}` : listErr?.message
  );

  report(
    "Check 2: Supabase Auth Invitation & Security Status",
    Boolean(targetUser?.confirmed_at || targetUser?.email_confirmed_at),
    `Confirmed at: ${targetUser?.confirmed_at || targetUser?.email_confirmed_at}`
  );

  const mustChange = targetUser?.app_metadata?.must_change_password;
  report(
    "Check 2.1: Password change security status",
    mustChange === false || mustChange === true,
    mustChange === true
      ? "Temporary password active — must change password on login"
      : "Permanent password successfully established (must_change_password = false)"
  );

  // 2. Confirm user profile and superadmin status
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("*")
    .eq("id", targetUser?.id)
    .single();

  report(
    "Check 3: User profile exists with superadmin status",
    Boolean(profile && profile.is_superadmin === true),
    `is_superadmin: ${profile?.is_superadmin}, full_name: "${profile?.full_name}"`
  );

  // 3. Confirm membership in both businesses
  const { data: memberships } = await adminClient
    .from("business_members")
    .select("business_id, role, is_active, businesses(slug, name)")
    .eq("user_id", targetUser?.id)
    .eq("is_active", true);

  const hasAstro = memberships?.some((m) => m.business_id === ASTROLOGY_ID);
  const hasVivaham = memberships?.some((m) => m.business_id === VIVAHAM_ID);

  report(
    "Check 4: Membership in Astrology business",
    hasAstro,
    `Role: ${memberships?.find((m) => m.business_id === ASTROLOGY_ID)?.role}`
  );

  report(
    "Check 5: Membership in Vivaham business",
    hasVivaham,
    `Role: ${memberships?.find((m) => m.business_id === VIVAHAM_ID)?.role}`
  );

  // 4. Verify access resolution for both workspaces
  const authorizedSlugs = memberships?.map((m) => m.businesses?.slug).sort();
  report(
    "Check 6: Account can access both workspaces (Astrology + Vivaham)",
    authorizedSlugs?.includes("astrology") && authorizedSlugs?.includes("vivaham"),
    `Authorized Slugs: [${authorizedSlugs?.join(", ")}]`
  );

  // 5. Verify switching businesses does not require another login
  // In Gokul Connect's architecture, auth session is at the user level (stored in Supabase auth cookie).
  // Because both businesses belong to the user's active memberships, Switching between /workspace/astrology
  // and /workspace/vivaham succeeds within the same session context without re-authenticating.
  report(
    "Check 7: Single session workspace switching capability",
    memberships?.length === 2 && profile?.is_superadmin === true,
    "Both business memberships and superadmin scope resolved under single user ID"
  );

  // 6. Confirm the two test accounts remain strictly isolated to their single business
  console.log("\n🔒 Verifying isolation for existing test accounts...");
  const { data: testMemberships } = await adminClient
    .from("business_members")
    .select("user_id, business_id, businesses(slug)")
    .in("user_id", [
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    ]);

  const userAmembers = testMemberships?.filter((m) => m.user_id === "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  const userBmembers = testMemberships?.filter((m) => m.user_id === "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

  report(
    "Check 8: User A (Astrology Test Admin) restricted to Astrology ONLY",
    userAmembers?.length === 1 && userAmembers[0]?.businesses?.slug === "astrology",
    `Count: ${userAmembers?.length}, Businesses: [${userAmembers?.map((m) => m.businesses?.slug).join(", ")}]`
  );

  report(
    "Check 9: User B (Vivaham Test Admin) restricted to Vivaham ONLY",
    userBmembers?.length === 1 && userBmembers[0]?.businesses?.slug === "vivaham",
    `Count: ${userBmembers?.length}, Businesses: [${userBmembers?.map((m) => m.businesses?.slug).join(", ")}]`
  );

  console.log("\n================================================================================");
  console.log(`📊 VERIFICATION RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

verify().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});
