import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const envPath = path.resolve("./.env.local");
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, "utf8");
    const env = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      }
    }
    return env;
  } catch (err) {
    console.warn("Could not read .env.local:", err.message);
    return {};
  }
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ASTRO_EMAIL = env.TEST_ASTROLOGY_USER_EMAIL;
const ASTRO_PASSWORD = env.TEST_ASTROLOGY_USER_PASSWORD;
const VIVAHAM_EMAIL = env.TEST_VIVAHAM_USER_EMAIL;
const VIVAHAM_PASSWORD = env.TEST_VIVAHAM_USER_PASSWORD;

const ASTRO_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

async function runLiveVerification() {
  console.log("================================================================================");
  console.log("🚀 GOKUL CONNECT — PHASE 10.2: LIVE CLOUD VERIFICATION FOR MIGRATIONS 013 & 014");
  console.log("================================================================================");
  console.log(`Target Supabase URL : ${SUPABASE_URL}`);
  console.log(`Target Project Ref  : ansiwtwqgrfmzfrhkzuu`);
  console.log("--------------------------------------------------------------------------------\n");

  let passed = 0;
  let failed = 0;

  function report(testId, name, success, details = "") {
    if (success) {
      console.log(`  ✅ [PASS] ${testId}: ${name} ${details ? "(" + details + ")" : ""}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${testId}: ${name} ${details ? "(" + details + ")" : ""}`);
      failed++;
    }
  }

  // 1. Authenticate Dedicated Test Users
  console.log("🔑 Authenticating dedicated test accounts...");
  const clientAstro = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authA, error: errA } = await clientAstro.auth.signInWithPassword({
    email: ASTRO_EMAIL,
    password: ASTRO_PASSWORD,
  });
  if (errA || !authA?.user) {
    throw new Error(`Failed to authenticate Astrology test user: ${errA?.message}`);
  }

  const clientVivaham = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authB, error: errB } = await clientVivaham.auth.signInWithPassword({
    email: VIVAHAM_EMAIL,
    password: VIVAHAM_PASSWORD,
  });
  if (errB || !authB?.user) {
    throw new Error(`Failed to authenticate Vivaham test user: ${errB?.message}`);
  }

  const clientAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log(`   User Astrology: ${authA.user.id}`);
  console.log(`   User Vivaham  : ${authB.user.id}\n`);

  // --- PART 1: CRM & CONTACTS RLS ISOLATION (MIGRATION 013) ---
  console.log("--- PART 1: Migration 013 (CRM & Contacts RLS) ---");

  // 1. Astrology user queries Astrology CRM categories
  const { data: aCategories, error: aCatErr } = await clientAstro
    .from("crm_categories")
    .select("id, name, slug, business_id")
    .eq("business_id", ASTRO_ID);
  report(
    "CRM-01",
    "Astrology user queries Astrology CRM categories",
    !aCatErr && aCategories?.length === 6 && aCategories.every((c) => c.business_id === ASTRO_ID),
    `Count: ${aCategories?.length || 0}`
  );

  // 2. Astrology user queries Vivaham CRM categories (BLOCKED)
  const { data: aVivCategories, error: aVivCatErr } = await clientAstro
    .from("crm_categories")
    .select("id, name, slug, business_id")
    .eq("business_id", VIVAHAM_ID);
  report(
    "CRM-02",
    "Astrology user CANNOT query Vivaham CRM categories (RLS)",
    !aVivCatErr && aVivCategories?.length === 0,
    `Returned: ${aVivCategories?.length || 0} rows`
  );

  // 3. Vivaham user queries Vivaham CRM categories
  const { data: vCategories, error: vCatErr } = await clientVivaham
    .from("crm_categories")
    .select("id, name, slug, business_id")
    .eq("business_id", VIVAHAM_ID);
  report(
    "CRM-03",
    "Vivaham user queries Vivaham CRM categories",
    !vCatErr && vCategories?.length === 6 && vCategories.every((c) => c.business_id === VIVAHAM_ID),
    `Count: ${vCategories?.length || 0}`
  );

  // 4. Vivaham user queries Astrology CRM categories (BLOCKED)
  const { data: vAstroCategories, error: vAstroCatErr } = await clientVivaham
    .from("crm_categories")
    .select("id, name, slug, business_id")
    .eq("business_id", ASTRO_ID);
  report(
    "CRM-04",
    "Vivaham user CANNOT query Astrology CRM categories (RLS)",
    !vAstroCatErr && vAstroCategories?.length === 0,
    `Returned: ${vAstroCategories?.length || 0} rows`
  );

  // 5. Contacts CRM columns accessible to Astrology user for Astrology tenant
  const { data: aContacts, error: aContErr } = await clientAstro
    .from("wa_contacts")
    .select("id, business_id, display_name, phone_number, status, source, is_archived, tags, custom_fields")
    .eq("business_id", ASTRO_ID);
  report(
    "CRM-05",
    "Astrology user queries Astrology contacts with CRM columns",
    !aContErr && aContacts?.length > 0 && aContacts.every((c) => c.business_id === ASTRO_ID && c.status === "lead"),
    `Count: ${aContacts?.length || 0}`
  );

  // 6. Astrology user CANNOT query Vivaham contacts
  const { data: aVivContacts, error: aVivContErr } = await clientAstro
    .from("wa_contacts")
    .select("id, business_id, display_name, phone_number, status")
    .eq("business_id", VIVAHAM_ID);
  report(
    "CRM-06",
    "Astrology user CANNOT query Vivaham contacts (RLS)",
    !aVivContErr && aVivContacts?.length === 0,
    `Returned: ${aVivContacts?.length || 0} rows`
  );

  // 7. Vivaham user queries Vivaham contacts with CRM columns
  const { data: vContacts, error: vContErr } = await clientVivaham
    .from("wa_contacts")
    .select("id, business_id, display_name, phone_number, status, source, is_archived, tags, custom_fields")
    .eq("business_id", VIVAHAM_ID);
  report(
    "CRM-07",
    "Vivaham user queries Vivaham contacts with CRM columns",
    !vContErr && vContacts?.length > 0 && vContacts.every((c) => c.business_id === VIVAHAM_ID && c.status === "lead"),
    `Count: ${vContacts?.length || 0}`
  );

  // 8. Vivaham user CANNOT query Astrology contacts
  const { data: vAstroContacts, error: vAstroContErr } = await clientVivaham
    .from("wa_contacts")
    .select("id, business_id, display_name, phone_number, status")
    .eq("business_id", ASTRO_ID);
  report(
    "CRM-08",
    "Vivaham user CANNOT query Astrology contacts (RLS)",
    !vAstroContErr && vAstroContacts?.length === 0,
    `Returned: ${vAstroContacts?.length || 0} rows`
  );

  // --- PART 2: ANALYTICS RPCs & TENANT ENFORCEMENT (MIGRATION 014) ---
  console.log("\n--- PART 2: Migration 014 (Analytics RPCs & Isolation) ---");

  const startDate = new Date(Date.now() - 30 * 86400000).toISOString();
  const endDate = new Date().toISOString();

  // 9. Astrology user calls get_business_analytics_summary for Astrology
  const { data: aSummary, error: aSumErr } = await clientAstro.rpc("get_business_analytics_summary", {
    p_business_id: ASTRO_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-01",
    "Astrology user executes get_business_analytics_summary for Astrology",
    !aSumErr && aSummary && aSummary.business_id === ASTRO_ID && typeof aSummary.messaging === "object",
    `Total Inbound: ${aSummary?.messaging?.total_inbound}, Total Contacts: ${aSummary?.contacts?.total_contacts}`
  );

  // 10. Astrology user calls get_business_analytics_summary for Vivaham (BLOCKED)
  const { data: aCrossSummary, error: aCrossSumErr } = await clientAstro.rpc("get_business_analytics_summary", {
    p_business_id: VIVAHAM_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-02",
    "Astrology user CANNOT execute get_business_analytics_summary for Vivaham",
    aCrossSumErr !== null && aCrossSumErr.message.includes("Unauthorized"),
    `Error: ${aCrossSumErr?.message}`
  );

  // 11. Vivaham user calls get_business_analytics_summary for Vivaham
  const { data: vSummary, error: vSumErr } = await clientVivaham.rpc("get_business_analytics_summary", {
    p_business_id: VIVAHAM_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-03",
    "Vivaham user executes get_business_analytics_summary for Vivaham",
    !vSumErr && vSummary && vSummary.business_id === VIVAHAM_ID && typeof vSummary.messaging === "object",
    `Total Inbound: ${vSummary?.messaging?.total_inbound}, Total Contacts: ${vSummary?.contacts?.total_contacts}`
  );

  // 12. Vivaham user calls get_business_analytics_summary for Astrology (BLOCKED)
  const { data: vCrossSummary, error: vCrossSumErr } = await clientVivaham.rpc("get_business_analytics_summary", {
    p_business_id: ASTRO_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-04",
    "Vivaham user CANNOT execute get_business_analytics_summary for Astrology",
    vCrossSumErr !== null && vCrossSumErr.message.includes("Unauthorized"),
    `Error: ${vCrossSumErr?.message}`
  );

  // 13. Daily trends for Astrology user on Astrology
  const { data: aTrends, error: aTrendErr } = await clientAstro.rpc("get_business_analytics_daily_trends", {
    p_business_id: ASTRO_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-05",
    "Astrology user executes get_business_analytics_daily_trends for Astrology",
    !aTrendErr && Array.isArray(aTrends) && aTrends.length > 0,
    `Trend Days: ${aTrends?.length || 0}`
  );

  // 14. Astrology user calls get_business_analytics_daily_trends for Vivaham (BLOCKED)
  const { data: aCrossTrends, error: aCrossTrendErr } = await clientAstro.rpc("get_business_analytics_daily_trends", {
    p_business_id: VIVAHAM_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-06",
    "Astrology user CANNOT execute get_business_analytics_daily_trends for Vivaham",
    aCrossTrendErr !== null && aCrossTrendErr.message.includes("Unauthorized"),
    `Error: ${aCrossTrendErr?.message}`
  );

  // 15. Daily trends for Vivaham user on Vivaham
  const { data: vTrends, error: vTrendErr } = await clientVivaham.rpc("get_business_analytics_daily_trends", {
    p_business_id: VIVAHAM_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-07",
    "Vivaham user executes get_business_analytics_daily_trends for Vivaham",
    !vTrendErr && Array.isArray(vTrends) && vTrends.length > 0,
    `Trend Days: ${vTrends?.length || 0}`
  );

  // 16. Vivaham user calls get_business_analytics_daily_trends for Astrology (BLOCKED)
  const { data: vCrossTrends, error: vCrossTrendErr } = await clientVivaham.rpc("get_business_analytics_daily_trends", {
    p_business_id: ASTRO_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "ANL-08",
    "Vivaham user CANNOT execute get_business_analytics_daily_trends for Astrology",
    vCrossTrendErr !== null && vCrossTrendErr.message.includes("Unauthorized"),
    `Error: ${vCrossTrendErr?.message}`
  );

  // 17. Unauthenticated client calls RPCs (BLOCKED)
  const { data: anonSum, error: anonSumErr } = await clientAnon.rpc("get_business_analytics_summary", {
    p_business_id: ASTRO_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "SEC-01",
    "Unauthenticated (anon) caller rejected from get_business_analytics_summary",
    anonSumErr !== null,
    `Rejection: ${anonSumErr?.message}`
  );

  const { data: anonTrend, error: anonTrendErr } = await clientAnon.rpc("get_business_analytics_daily_trends", {
    p_business_id: ASTRO_ID,
    p_start_date: startDate,
    p_end_date: endDate,
  });
  report(
    "SEC-02",
    "Unauthenticated (anon) caller rejected from get_business_analytics_daily_trends",
    anonTrendErr !== null,
    `Rejection: ${anonTrendErr?.message}`
  );

  // --- PART 3: RPC VS DIRECT AGGREGATE PARITY CHECK ---
  console.log("\n--- PART 3: RPC vs Direct Table Aggregation Parity ---");

  // Direct table counts for Astrology
  const { count: directAstroMsgsInbound } = await clientAstro
    .from("wa_messages")
    .select("*", { count: "exact", head: true })
    .eq("business_id", ASTRO_ID)
    .eq("direction", "inbound")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const { count: directAstroMsgsOutbound } = await clientAstro
    .from("wa_messages")
    .select("*", { count: "exact", head: true })
    .eq("business_id", ASTRO_ID)
    .eq("direction", "outbound")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const { count: directAstroContactsTotal } = await clientAstro
    .from("wa_contacts")
    .select("*", { count: "exact", head: true })
    .eq("business_id", ASTRO_ID);

  const rpcAstroInbound = aSummary?.messaging?.total_inbound;
  const rpcAstroOutbound = aSummary?.messaging?.total_outbound;
  const rpcAstroContacts = aSummary?.contacts?.total_contacts;

  const astroParity =
    directAstroMsgsInbound === rpcAstroInbound &&
    directAstroMsgsOutbound === rpcAstroOutbound &&
    directAstroContactsTotal === rpcAstroContacts;

  report(
    "PAR-01",
    "Astrology RPC aggregates match direct table queries 100%",
    astroParity,
    `Direct: [In: ${directAstroMsgsInbound}, Out: ${directAstroMsgsOutbound}, Contacts: ${directAstroContactsTotal}] | RPC: [In: ${rpcAstroInbound}, Out: ${rpcAstroOutbound}, Contacts: ${rpcAstroContacts}]`
  );

  // Direct table counts for Vivaham
  const { count: directVivMsgsInbound } = await clientVivaham
    .from("wa_messages")
    .select("*", { count: "exact", head: true })
    .eq("business_id", VIVAHAM_ID)
    .eq("direction", "inbound")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const { count: directVivMsgsOutbound } = await clientVivaham
    .from("wa_messages")
    .select("*", { count: "exact", head: true })
    .eq("business_id", VIVAHAM_ID)
    .eq("direction", "outbound")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  const { count: directVivContactsTotal } = await clientVivaham
    .from("wa_contacts")
    .select("*", { count: "exact", head: true })
    .eq("business_id", VIVAHAM_ID);

  const rpcVivInbound = vSummary?.messaging?.total_inbound;
  const rpcVivOutbound = vSummary?.messaging?.total_outbound;
  const rpcVivContacts = vSummary?.contacts?.total_contacts;

  const vivahamParity =
    directVivMsgsInbound === rpcVivInbound &&
    directVivMsgsOutbound === rpcVivOutbound &&
    directVivContactsTotal === rpcVivContacts;

  report(
    "PAR-02",
    "Vivaham RPC aggregates match direct table queries 100%",
    vivahamParity,
    `Direct: [In: ${directVivMsgsInbound}, Out: ${directVivMsgsOutbound}, Contacts: ${directVivContactsTotal}] | RPC: [In: ${rpcVivInbound}, Out: ${rpcVivOutbound}, Contacts: ${rpcVivContacts}]`
  );

  console.log("\n================================================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveVerification().catch((err) => {
  console.error("FATAL ERROR in live verification:", err);
  process.exit(1);
});
