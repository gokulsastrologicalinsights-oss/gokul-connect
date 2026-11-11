import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

async function verifyLiveSecurity() {
  console.log("================================================================================");
  console.log("🛡️  PHASE 3H: LIVE SUPABASE RLS VERIFICATION (wa_webhook_events)");
  console.log("================================================================================");

  // 1. Authenticate User A (Astrology)
  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: ASTRO_EMAIL,
    password: ASTRO_PASSWORD,
  });
  if (errA) throw new Error(`User A login failed: ${errA.message}`);

  // 2. Authenticate User B (Vivaham)
  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: VIVAHAM_EMAIL,
    password: VIVAHAM_PASSWORD,
  });
  if (errB) throw new Error(`User B login failed: ${errB.message}`);

  console.log(`✅ Authenticated User A (Astrology): ${authA.user.id}`);
  console.log(`✅ Authenticated User B (Vivaham): ${authB.user.id}\n`);

  // 3. User A queries wa_webhook_events for business_id IS NULL
  console.log("🔍 Checking User A access to unassigned webhook events (business_id IS NULL)...");
  const { data: aUnassigned, error: aUnassignedErr } = await clientA
    .from("wa_webhook_events")
    .select("id, meta_event_id, business_id")
    .is("business_id", null);

  if (aUnassignedErr) {
    console.log(`   ❌ Query error: ${aUnassignedErr.message}`);
  } else {
    console.log(`   User A received ${aUnassigned.length} unassigned rows.`);
    if (aUnassigned.length === 0) {
      console.log("   ✅ SUCCESS: Unassigned webhook events blocked by hardened RLS for User A!");
    } else {
      console.log("   ❌ FAILED: User A was able to read unassigned webhook events!");
    }
  }

  // 4. User B queries wa_webhook_events for business_id IS NULL
  console.log("\n🔍 Checking User B access to unassigned webhook events (business_id IS NULL)...");
  const { data: bUnassigned, error: bUnassignedErr } = await clientB
    .from("wa_webhook_events")
    .select("id, meta_event_id, business_id")
    .is("business_id", null);

  if (bUnassignedErr) {
    console.log(`   ❌ Query error: ${bUnassignedErr.message}`);
  } else {
    console.log(`   User B received ${bUnassigned.length} unassigned rows.`);
    if (bUnassigned.length === 0) {
      console.log("   ✅ SUCCESS: Unassigned webhook events blocked by hardened RLS for User B!");
    } else {
      console.log("   ❌ FAILED: User B was able to read unassigned webhook events!");
    }
  }

  // 5. Cross-tenant check: User A queries wa_webhook_events for Vivaham
  console.log("\n🔍 Checking User A access to Vivaham webhook events...");
  const { data: aVivahamEvents } = await clientA
    .from("wa_webhook_events")
    .select("id, meta_event_id, business_id")
    .eq("business_id", VIVAHAM_ID);

  if ((aVivahamEvents || []).length === 0) {
    console.log("   ✅ SUCCESS: User A received 0 Vivaham webhook rows (Strict Cross-Tenant Isolation).");
  } else {
    console.log(`   ❌ FAILED: User A read ${aVivahamEvents.length} Vivaham rows!`);
  }

  // 6. Cross-tenant check: User B queries wa_webhook_events for Astrology
  console.log("\n🔍 Checking User B access to Astrology webhook events...");
  const { data: bAstroEvents } = await clientB
    .from("wa_webhook_events")
    .select("id, meta_event_id, business_id")
    .eq("business_id", ASTROLOGY_ID);

  if ((bAstroEvents || []).length === 0) {
    console.log("   ✅ SUCCESS: User B received 0 Astrology webhook rows (Strict Cross-Tenant Isolation).");
  } else {
    console.log(`   ❌ FAILED: User B read ${bAstroEvents.length} Astrology rows!`);
  }

  console.log("\n================================================================================");
  console.log("🎉 ALL LIVE SUPABASE RLS CHECKS PASSED!");
  console.log("================================================================================");
}

verifyLiveSecurity().catch((err) => {
  console.error("FATAL ERROR in live verification:", err);
  process.exit(1);
});
