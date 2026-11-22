import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[trimmed.slice(0, eqIdx).trim()] = val;
  }
  return env;
}

const env = loadEnv();
const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyMigration028Live() {
  console.log("================================================================================");
  console.log("🔍 LIVE STAGING VERIFICATION: MIGRATION 028");
  console.log("Target Project URL:", env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("Timestamp:", new Date().toISOString());
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function report(checkNum, description, success, details = "") {
    if (success) {
      console.log(`  ✅ [PASS] Check ${checkNum}: ${description} ${details ? "(" + details + ")" : ""}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] Check ${checkNum}: ${description} ${details ? "(" + details + ")" : ""}`);
      failed++;
    }
  }

  // 1. claim_meta_social_events RPC exists and is callable by service_role
  const { data: claimData, error: claimErr } = await adminClient.rpc("claim_meta_social_events", {
    p_worker_id: "test-verifier",
    p_batch_size: 1,
    p_lease_seconds: 60,
  });
  report(1, "claim_meta_social_events RPC callable by service_role", !claimErr, claimErr ? claimErr.message : `Returned ${claimData?.length ?? 0} rows`);

  // 2. claim_meta_social_events blocked for anon
  const { data: anonClaimData, error: anonClaimErr } = await anonClient.rpc("claim_meta_social_events", {
    p_worker_id: "anon-attacker",
    p_batch_size: 1,
    p_lease_seconds: 60,
  });
  report(2, "claim_meta_social_events RPC execution blocked for anon", anonClaimErr !== null, anonClaimErr ? `Error: ${anonClaimErr.code || anonClaimErr.message}` : "UNEXPECTED ACCESS");

  // 3. reclaim_stuck_meta_social_events RPC exists and is callable by service_role
  const { data: reclaimData, error: reclaimErr } = await adminClient.rpc("reclaim_stuck_meta_social_events", {
    p_timeout_seconds: 300,
  });
  report(3, "reclaim_stuck_meta_social_events RPC callable by service_role", !reclaimErr, reclaimErr ? reclaimErr.message : `Result: ${JSON.stringify(reclaimData)}`);

  // 4. reclaim_stuck_meta_social_events blocked for anon
  const { data: anonReclaimData, error: anonReclaimErr } = await anonClient.rpc("reclaim_stuck_meta_social_events", {
    p_timeout_seconds: 300,
  });
  report(4, "reclaim_stuck_meta_social_events RPC execution blocked for anon", anonReclaimErr !== null, anonReclaimErr ? `Error: ${anonReclaimErr.code || anonReclaimErr.message}` : "UNEXPECTED ACCESS");

  // 5. Worker lease & retry columns on meta_social_events
  const { data: evtCols, error: evtColsErr } = await adminClient.from("meta_social_events").select("claimed_by, claimed_at, lease_expires_at, attempt_count, max_attempts, next_retry_at, updated_at").limit(1);
  const hasEvtCols = !evtColsErr && evtCols !== null && evtCols.length > 0 && "claimed_by" in evtCols[0] && "lease_expires_at" in evtCols[0] && "attempt_count" in evtCols[0];
  report(5, "Worker lease & retry columns on meta_social_events", hasEvtCols, evtColsErr ? evtColsErr.message : "All columns accessible");

  // 6. Worker lease columns on meta_social_deliveries
  const { data: delCols, error: delColsErr } = await adminClient.from("meta_social_deliveries").select("claimed_by, claimed_at, lease_expires_at, attempt_count, max_attempts, next_retry_at, updated_at").limit(0);
  report(6, "Worker lease columns on meta_social_deliveries", !delColsErr, delColsErr ? delColsErr.message : "All columns accessible");

  // 7. Social connections count intact
  const { count: connsCount, error: connErr } = await adminClient.from("meta_social_connections").select("id", { count: "exact", head: true });
  report(7, "meta_social_connections record count preserved", !connErr && connsCount === 2, `Count: ${connsCount}`);

  // 8. Social credentials count intact
  const { count: credsCount, error: credErr } = await adminClient.from("meta_social_credentials").select("id", { count: "exact", head: true });
  report(8, "meta_social_credentials record count preserved", !credErr && credsCount === 2, `Count: ${credsCount}`);

  // 9. Social rules count intact
  const { count: rulesCount, error: ruleErr } = await adminClient.from("meta_social_rules").select("id", { count: "exact", head: true });
  report(9, "meta_social_rules record count preserved", !ruleErr && rulesCount === 16, `Count: ${rulesCount}`);

  // 10. Social events count intact
  const { count: evtsCount, error: evtErr } = await adminClient.from("meta_social_events").select("id", { count: "exact", head: true });
  report(10, "meta_social_events record count preserved", !evtErr && evtsCount === 1, `Count: ${evtsCount}`);

  // 11. Social deliveries count intact
  const { count: delsCount, error: delErr } = await adminClient.from("meta_social_deliveries").select("id", { count: "exact", head: true });
  report(11, "meta_social_deliveries record count preserved", !delErr && delsCount === 0, `Count: ${delsCount}`);

  // 12. WhatsApp connections count intact
  const { count: waConnsCount, error: waConnErr } = await adminClient.from("wa_connections").select("id", { count: "exact", head: true });
  report(12, "wa_connections record count preserved", !waConnErr && waConnsCount === 3, `Count: ${waConnsCount}`);

  // 13. WhatsApp conversations count intact
  const { count: waConvCount, error: waConvErr } = await adminClient.from("wa_conversations").select("id", { count: "exact", head: true });
  report(13, "wa_conversations record count preserved", !waConvErr && waConvCount === 6, `Count: ${waConvCount}`);

  // 14. WhatsApp messages count intact
  const { count: waMsgCount, error: waMsgErr } = await adminClient.from("wa_messages").select("id", { count: "exact", head: true });
  report(14, "wa_messages record count preserved", !waMsgErr && waMsgCount === 29, `Count: ${waMsgCount}`);

  // 15. WhatsApp contacts count intact
  const { count: waCntCount, error: waCntErr } = await adminClient.from("wa_contacts").select("id", { count: "exact", head: true });
  report(15, "wa_contacts record count preserved", !waCntErr && waCntCount === 6, `Count: ${waCntCount}`);

  console.log("\n================================================================================");
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");
}

verifyMigration028Live().catch(console.error);
