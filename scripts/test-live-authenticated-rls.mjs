import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "../src/lib/crypto/encryption.ts";

// Read .env.local manually if not in process.env
function loadEnvLocal() {
  try {
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
  } catch (err) {
    console.warn("Could not read .env.local:", err.message);
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ASTRO_EMAIL = process.env.TEST_ASTROLOGY_USER_EMAIL;
const ASTRO_PASSWORD = process.env.TEST_ASTROLOGY_USER_PASSWORD;
const VIVAHAM_EMAIL = process.env.TEST_VIVAHAM_USER_EMAIL;
const VIVAHAM_PASSWORD = process.env.TEST_VIVAHAM_USER_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Configuration Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables must be set.");
  process.exit(1);
}

if (!ASTRO_EMAIL || !ASTRO_PASSWORD) {
  console.error("❌ Configuration Error: TEST_ASTROLOGY_USER_EMAIL and TEST_ASTROLOGY_USER_PASSWORD must be configured in .env.local.");
  process.exit(1);
}

if (!VIVAHAM_EMAIL || !VIVAHAM_PASSWORD) {
  console.error("❌ Configuration Error: TEST_VIVAHAM_USER_EMAIL and TEST_VIVAHAM_USER_PASSWORD must be configured in .env.local.");
  process.exit(1);
}

const ASTROLOGY_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

async function runLiveAudit() {
  console.log("================================================================================");
  console.log("🛡️  GOKUL CONNECT — PHASE 2.4: AUTHENTICATED MULTI-TENANT AUDIT (LIVE CLOUD)");
  console.log("================================================================================");
  console.log(`Target Project: ${SUPABASE_URL}`);
  console.log(`PostgreSQL Engine: Supabase Cloud (v17.11)`);
  console.log("--------------------------------------------------------------------------------\n");

  let passed = 0;
  let failed = 0;

  function report(name, success, details = "") {
    if (success) {
      console.log(`✅ [PASS] ${name} ${details ? "(" + details + ")" : ""}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] ${name} ${details ? "(" + details + ")" : ""}`);
      failed++;
    }
  }

  // 1. Authenticate Test Users
  console.log("🔑 Authenticating Test User Sessions via Supabase GoTrue Auth...");
  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: ASTRO_EMAIL,
    password: ASTRO_PASSWORD,
  });
  if (errA || !authA.user) {
    throw new Error(`Failed to authenticate User A: ${errA?.message}`);
  }

  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: VIVAHAM_EMAIL,
    password: VIVAHAM_PASSWORD,
  });
  if (errB || !authB.user) {
    throw new Error(`Failed to authenticate User B: ${errB?.message}`);
  }
  console.log(`   User A Authenticated: ${authA.user.id} (Astrology Tenant)`);
  console.log(`   User B Authenticated: ${authB.user.id} (Vivaham Tenant)\n`);

  // 2. Astrology User reads Astrology data (ALLOWED)
  const { data: aBusinesses } = await clientA.from("businesses").select("slug");
  const aReadsAstro = aBusinesses?.some((b) => b.slug === "astrology");
  const aReadsVivaham = aBusinesses?.some((b) => b.slug === "vivaham");
  report(
    "TC-01: Astrology user reads Astrology data",
    aReadsAstro && !aReadsVivaham,
    `Returned: [${aBusinesses?.map((b) => b.slug).join(", ")}]`
  );

  // 3. Astrology User reads Vivaham data (BLOCKED)
  const { data: aExplicitVivaham } = await clientA
    .from("businesses")
    .select("slug")
    .eq("slug", "vivaham");
  report(
    "TC-02: Astrology user reads Vivaham data (BLOCKED)",
    aExplicitVivaham?.length === 0,
    `Explicit query returned ${aExplicitVivaham?.length} rows`
  );

  // 4. Vivaham User reads Vivaham data (ALLOWED)
  const { data: bBusinesses } = await clientB.from("businesses").select("slug");
  const bReadsVivaham = bBusinesses?.some((b) => b.slug === "vivaham");
  const bReadsAstro = bBusinesses?.some((b) => b.slug === "astrology");
  report(
    "TC-03: Vivaham user reads Vivaham data",
    bReadsVivaham && !bReadsAstro,
    `Returned: [${bBusinesses?.map((b) => b.slug).join(", ")}]`
  );

  // 5. Vivaham User reads Astrology data (BLOCKED)
  const { data: bExplicitAstro } = await clientB
    .from("businesses")
    .select("slug")
    .eq("slug", "astrology");
  report(
    "TC-04: Vivaham user reads Astrology data (BLOCKED)",
    bExplicitAstro?.length === 0,
    `Explicit query returned ${bExplicitAstro?.length} rows`
  );

  // 6. Astrology User updates Vivaham records (BLOCKED)
  const { data: aUpdateVivaham } = await clientA
    .from("business_settings")
    .update({ display_name: "Hacked by User A" })
    .eq("business_id", VIVAHAM_ID)
    .select();
  report(
    "TC-05: Astrology user updates Vivaham records (BLOCKED)",
    !aUpdateVivaham || aUpdateVivaham.length === 0,
    `Updated rows: ${aUpdateVivaham?.length || 0}`
  );

  // 7. Vivaham User updates Astrology records (BLOCKED)
  const { data: bUpdateAstro } = await clientB
    .from("business_settings")
    .update({ display_name: "Hacked by User B" })
    .eq("business_id", ASTROLOGY_ID)
    .select();
  report(
    "TC-06: Vivaham user updates Astrology records (BLOCKED)",
    !bUpdateAstro || bUpdateAstro.length === 0,
    `Updated rows: ${bUpdateAstro?.length || 0}`
  );

  // 8. Cross-business INSERT on wa_connections (BLOCKED)
  const { data: aInsertVivaham, error: aInsertErr } = await clientA
    .from("wa_connections")
    .insert({
      business_id: VIVAHAM_ID,
      display_name: "Astro Injected Line",
      phone_number: "+91 99999 88888",
      phone_number_id: "ROGUE_CROSS_01",
      waba_id: "WABA_ROGUE",
      credential_ref: "vault:rogue",
    })
    .select();
  report(
    "TC-07: Cross-business INSERT on wa_connections (BLOCKED)",
    Boolean(aInsertErr),
    aInsertErr?.message
  );

  // 9. Legitimate INSERT by Astrology User on Astrology (ALLOWED)
  const testPhoneId = `PHONE_TEST_${Date.now()}`;
  const { data: aInsertLegit, error: aLegitErr } = await clientA
    .from("wa_connections")
    .insert({
      business_id: ASTROLOGY_ID,
      display_name: "Astro Integration Line",
      phone_number: "+91 98400 99887",
      phone_number_id: testPhoneId,
      waba_id: "WABA_ASTRO_LIVE",
      credential_ref: `vault:sec_${testPhoneId}`,
    })
    .select()
    .single();
  report(
    "TC-08: Authorized INSERT on wa_connections (ALLOWED)",
    Boolean(aInsertLegit && !aLegitErr),
    aInsertLegit ? `ID: ${aInsertLegit.id}` : aLegitErr?.message
  );

  // 10. Cross-business DELETE: Vivaham User attempts to delete Astrology connection (BLOCKED)
  if (aInsertLegit) {
    const { data: bDelAstro } = await clientB
      .from("wa_connections")
      .delete()
      .eq("id", aInsertLegit.id)
      .select();
    report(
      "TC-09: Cross-business DELETE on wa_connections (BLOCKED)",
      !bDelAstro || bDelAstro.length === 0,
      `Deleted rows: ${bDelAstro?.length || 0}`
    );
  }

  // 11. Immutability Trigger: User A attempts to reassign connection business_id (BLOCKED)
  if (aInsertLegit) {
    const { error: aMutateErr } = await clientA
      .from("wa_connections")
      .update({ business_id: VIVAHAM_ID })
      .eq("id", aInsertLegit.id);
    report(
      "TC-10: Tenant reassignment forbidden by database trigger (BLOCKED)",
      Boolean(aMutateErr),
      aMutateErr?.message
    );
  }

  // 12. Membership Escalation: User A attempts to add themselves to Vivaham (BLOCKED)
  const { error: aEscalateErr } = await clientA
    .from("business_members")
    .insert({
      business_id: VIVAHAM_ID,
      user_id: authA.user.id,
      role: "owner",
      is_active: true,
    });
  report(
    "TC-11: Unauthorized business membership escalation (BLOCKED)",
    Boolean(aEscalateErr),
    aEscalateErr?.message
  );

  // 13. Privilege Escalation: User A attempts to set is_superadmin = true (BLOCKED)
  const { error: aSuperErr } = await clientA
    .from("user_profiles")
    .update({ is_superadmin: true })
    .eq("id", authA.user.id);
  report(
    "TC-12: Superadmin self-privilege escalation (BLOCKED)",
    Boolean(aSuperErr),
    aSuperErr?.message
  );

  // 14. Clean up test connection created during audit
  if (aInsertLegit) {
    await clientA.from("wa_connections").delete().eq("id", aInsertLegit.id);
    console.log("   🧹 Cleaned up temporary test record from Astrology.");
  }

  console.log("\n================================================================================");
  console.log(`📊 AUDIT SUMMARY: ${passed} PASSED | ${failed} FAILED | 0 SKIPPED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveAudit().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
