import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/crypto/encryption";
import { getMetaPhoneNumberDetails } from "@/lib/whatsapp/client";

function loadEnv() {
  const envPath = path.resolve("./.env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
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

loadEnv();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("❌ Configuration Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables must be set.");
  process.exit(1);
}

if (!process.env.TEST_ASTROLOGY_USER_EMAIL || !process.env.TEST_ASTROLOGY_USER_PASSWORD) {
  console.error("❌ Configuration Error: TEST_ASTROLOGY_USER_EMAIL and TEST_ASTROLOGY_USER_PASSWORD must be configured in .env.local.");
  process.exit(1);
}

if (!process.env.TEST_VIVAHAM_USER_EMAIL || !process.env.TEST_VIVAHAM_USER_PASSWORD) {
  console.error("❌ Configuration Error: TEST_VIVAHAM_USER_EMAIL and TEST_VIVAHAM_USER_PASSWORD must be configured in .env.local.");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ASTRO_EMAIL = process.env.TEST_ASTROLOGY_USER_EMAIL!;
const ASTRO_PASSWORD = process.env.TEST_ASTROLOGY_USER_PASSWORD!;
const VIVAHAM_EMAIL = process.env.TEST_VIVAHAM_USER_EMAIL!;
const VIVAHAM_PASSWORD = process.env.TEST_VIVAHAM_USER_PASSWORD!;

const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
const VIVAHAM_CONN_ID = "44444444-4444-4444-4444-444444444444";
const ASTRO_CONN_ID = "33333333-3333-3333-3333-333333333333";
const EXPECTED_PHONE_NUMBER_ID = "1395663896970053";
const EXPECTED_WABA_ID = "1153964060437882";

async function verify() {
  console.log("================================================================================");
  console.log("🔍 GOKUL CONNECT — META SANDBOX VIVAHAM ASSIGNMENT VERIFICATION");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function report(name: string, ok: boolean, details?: string) {
    if (ok) {
      console.log(`✅ [PASS] ${name}${details ? ` -> ${details}` : ""}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}${details ? ` -> ${details}` : ""}`);
      failed++;
    }
  }

  // 1. Authenticate as User B (Vivaham Owner)
  const clientVivaham = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authB, error: authBErr } = await clientVivaham.auth.signInWithPassword({
    email: VIVAHAM_EMAIL,
    password: VIVAHAM_PASSWORD,
  });
  if (authBErr || !authB.user) {
    throw new Error(`User B authentication failed: ${authBErr?.message}`);
  }

  // 2. Authenticate as User A (Astrology Owner)
  const clientAstro = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authA, error: authAErr } = await clientAstro.auth.signInWithPassword({
    email: ASTRO_EMAIL,
    password: ASTRO_PASSWORD,
  });
  if (authAErr || !authA.user) {
    throw new Error(`User A authentication failed: ${authAErr?.message}`);
  }

  // 3. User B queries wa_connections
  const { data: bConns, error: bConnsErr } = await clientVivaham
    .from("wa_connections")
    .select("id, business_id, display_name, phone_number, phone_number_id, waba_id, connection_status, quality_rating, is_enabled");

  if (bConnsErr) throw bConnsErr;

  const vivConn = bConns?.find((c) => c.id === VIVAHAM_CONN_ID);
  report("1. Vivaham connection exists and is readable by Vivaham tenant", Boolean(vivConn));
  report("2. Connection belongs strictly to Vivaham business_id", vivConn?.business_id === VIVAHAM_BIZ_ID, vivConn?.business_id);
  report("3. Phone Number ID matches 1395663896970053", vivConn?.phone_number_id === EXPECTED_PHONE_NUMBER_ID, vivConn?.phone_number_id);
  report("4. WABA ID matches 1153964060437882", vivConn?.waba_id === EXPECTED_WABA_ID, vivConn?.waba_id);
  report("5. Connection status is 'connected'", vivConn?.connection_status === "connected", vivConn?.connection_status);
  report("6. Quality rating is GREEN", vivConn?.quality_rating === "GREEN", vivConn?.quality_rating);

  // 4. Verify Vivaham user cannot see Astrology connections (RLS tenant isolation)
  const bSeesAstroConn = bConns?.some((c) => c.business_id === ASTRO_BIZ_ID || c.id === ASTRO_CONN_ID);
  report("7. Vivaham tenant CANNOT see Astrology connection (RLS isolation)", !bSeesAstroConn);

  // 5. Verify Astrology user cannot see Vivaham connection
  const { data: aConns, error: aConnsErr } = await clientAstro
    .from("wa_connections")
    .select("id, business_id, display_name, phone_number, phone_number_id, waba_id, connection_status");
  if (aConnsErr) throw aConnsErr;

  const aSeesVivConn = aConns?.some((c) => c.business_id === VIVAHAM_BIZ_ID || c.id === VIVAHAM_CONN_ID);
  report("8. Astrology tenant CANNOT see Vivaham connection (RLS isolation)", !aSeesVivConn);

  const astroConn = aConns?.find((c) => c.id === ASTRO_CONN_ID);
  report(
    "9. Astrology connection remains completely unchanged",
    astroConn?.phone_number_id === "109283746501928" && astroConn?.waba_id === "293847561029384",
    `Phone: ${astroConn?.phone_number_id}, WABA: ${astroConn?.waba_id}`
  );

  // 6. Cross-tenant mutation blocked: Astrology user attempts to modify Vivaham connection
  const { data: attackData, error: attackErr } = await clientAstro
    .from("wa_connections")
    .update({ display_name: "Hacked by Astrology" })
    .eq("id", VIVAHAM_CONN_ID)
    .select();
  report("10. Cross-tenant UPDATE by Astrology user rejected (0 rows updated)", !attackData || attackData.length === 0);

  // 7. Verify Vivaham user can read encrypted credential and decrypt it
  const { data: credRows, error: credErr } = await clientVivaham
    .from("wa_credentials")
    .select("id, connection_id, business_id, key_version, iv, auth_tag, ciphertext")
    .eq("connection_id", VIVAHAM_CONN_ID);

  if (credErr) throw credErr;
  report("11. wa_credentials record exists for Vivaham connection", Boolean(credRows && credRows.length === 1));

  let decryptedToken = "";
  if (credRows && credRows[0]) {
    try {
      decryptedToken = decryptSecret({
        key_version: credRows[0].key_version,
        iv: credRows[0].iv,
        auth_tag: credRows[0].auth_tag,
        ciphertext: credRows[0].ciphertext,
      });
      report("12. AES-256-GCM vault decryption succeeds without errors", Boolean(decryptedToken && decryptedToken.length > 50));
    } catch (e: any) {
      report("12. AES-256-GCM vault decryption succeeds without errors", false, e.message);
    }
  }

  // 8. Astrology user cannot read Vivaham credentials
  const { data: aCreds } = await clientAstro
    .from("wa_credentials")
    .select("id, connection_id")
    .eq("connection_id", VIVAHAM_CONN_ID);
  report("13. Astrology tenant CANNOT read Vivaham wa_credentials (RLS credential isolation)", !aCreds || aCreds.length === 0);

  // 9. Read-only Meta Handshake using decrypted token
  if (decryptedToken) {
    try {
      const details = await getMetaPhoneNumberDetails(EXPECTED_PHONE_NUMBER_ID, decryptedToken);
      report(
        "14. Read-only Meta Graph API v26.0 phone-number handshake succeeds",
        details.id === EXPECTED_PHONE_NUMBER_ID,
        `Verified Name: "${details.verified_name}", Phone: ${details.display_phone_number}, Quality: ${details.quality_rating}`
      );
    } catch (apiErr: any) {
      report("14. Read-only Meta Graph API v26.0 phone-number handshake succeeds", false, apiErr.message);
    }
  }

  // 10. Verify Business Settings for Vivaham
  const { data: bSettings } = await clientVivaham
    .from("business_settings")
    .select("business_id, default_connection_id, display_name")
    .eq("business_id", VIVAHAM_BIZ_ID)
    .single();

  report(
    "15. Gokul Vivaham business_settings routes to default_connection_id",
    bSettings?.default_connection_id === VIVAHAM_CONN_ID,
    `default_connection_id: ${bSettings?.default_connection_id}`
  );

  console.log("================================================================================");
  console.log(`📊 FINAL RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
