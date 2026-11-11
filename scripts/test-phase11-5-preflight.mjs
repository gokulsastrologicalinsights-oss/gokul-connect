import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
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
}

const env = loadEnvLocal();
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ASTRO_EMAIL = env.TEST_ASTROLOGY_USER_EMAIL;
const ASTRO_PASSWORD = env.TEST_ASTROLOGY_USER_PASSWORD;
const VIVAHAM_EMAIL = env.TEST_VIVAHAM_USER_EMAIL;
const VIVAHAM_PASSWORD = env.TEST_VIVAHAM_USER_PASSWORD;

const ASTRO_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

async function check() {
  console.log("=== PREFLIGHT LIVE SUPABASE CHECK ===");

  // Query templates with service role
  const { data: adminTemplates, error: adminErr } = await adminClient
    .from("wa_message_templates")
    .select("id, business_id, template_name, status, is_archived");

  if (adminErr) {
    console.error("Admin query error on wa_message_templates:", adminErr);
  } else {
    console.log(`Total templates in DB across all tenants: ${adminTemplates.length}`);
    const astro = adminTemplates.filter(t => t.business_id === ASTRO_ID);
    const vivaham = adminTemplates.filter(t => t.business_id === VIVAHAM_ID);
    console.log(`Initial Astrology template count: ${astro.length}`, astro);
    console.log(`Initial Vivaham template count: ${vivaham.length}`, vivaham);
  }

  // Check columns added in Migration 015
  const { data: cols, error: colErr } = await adminClient
    .from("wa_message_templates")
    .select("id, meta_template_id, rejection_reason, is_archived, last_synced_at")
    .limit(1);

  if (colErr) {
    console.error("Column verification error:", colErr);
  } else {
    console.log("Migration 015 columns present and verified:", Object.keys(cols[0] || { meta_template_id: 1, rejection_reason: 1, is_archived: 1, last_synced_at: 1 }));
  }

  // Check authenticated test users
  const clientAstro = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: authA, error: errA } = await clientAstro.auth.signInWithPassword({
    email: ASTRO_EMAIL,
    password: ASTRO_PASSWORD,
  });
  console.log("Astrology test user login:", errA ? `FAIL: ${errA.message}` : `SUCCESS (uid: ${authA?.user?.id})`);

  const clientVivaham = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: authB, error: errB } = await clientVivaham.auth.signInWithPassword({
    email: VIVAHAM_EMAIL,
    password: VIVAHAM_PASSWORD,
  });
  console.log("Vivaham test user login:", errB ? `FAIL: ${errB.message}` : `SUCCESS (uid: ${authB?.user?.id})`);
  // Check memberships
  const { data: members, error: memErr } = await adminClient
    .from("business_members")
    .select("user_id, business_id, role, is_active, businesses(slug, name)");
  console.log("Business memberships:", members);
  // Check conversations
  const { data: convsA } = await adminClient
    .from("wa_conversations")
    .select("id, business_id, contact_id, status")
    .eq("business_id", ASTRO_ID);
  console.log(`Astrology conversations count: ${convsA?.length || 0}`);

  const { data: convsV } = await adminClient
    .from("wa_conversations")
    .select("id, business_id, contact_id, status")
    .eq("business_id", VIVAHAM_ID);
  console.log(`Vivaham conversations count: ${convsV?.length || 0}`);
}

check();
