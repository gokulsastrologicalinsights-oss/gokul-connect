import { createClient } from "@supabase/supabase-js";
import { getMetaPhoneNumberDetails, sendMetaTemplateMessage } from "../src/lib/whatsapp/client.ts";
import fs from "fs";
import path from "path";

// Read .env.local manually if not in process.env
function loadEnvLocal() {
  try {
    const envPath = path.resolve("./.env.local");
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ansiwtwqgrfmzfrhkzuu.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PHONE_NUMBER_ID = process.env.META_TEST_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_TEST_ACCESS_TOKEN;
const RECIPIENT_PHONE = "919444559071";

async function runLivePhase3Tests() {
  console.log("================================================================================");
  console.log("🚀 GOKUL CONNECT — PHASE 3: LIVE CLOUD API & SCHEMA VERIFICATION");
  console.log("================================================================================");
  console.log(`Target Supabase: ${SUPABASE_URL}`);
  console.log(`Target Phone Number ID: ${PHONE_NUMBER_ID}`);
  console.log(`Target Recipient Phone: +${RECIPIENT_PHONE}`);
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

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Verify RLS Blocks Anon Access to New Phase 3 Tables
  console.log("1️⃣ Verifying Row-Level Security on Phase 3 Tables...");
  const { data: anonContacts } = await anonClient.from("wa_contacts").select("*");
  report("TC-RLS-01: Anonymous access to wa_contacts blocked", !anonContacts || anonContacts.length === 0);

  const { data: anonConversations } = await anonClient.from("wa_conversations").select("*");
  report("TC-RLS-02: Anonymous access to wa_conversations blocked", !anonConversations || anonConversations.length === 0);

  const { data: anonMessages } = await anonClient.from("wa_messages").select("*");
  report("TC-RLS-03: Anonymous access to wa_messages blocked", !anonMessages || anonMessages.length === 0);

  const { data: anonTemplates } = await anonClient.from("wa_message_templates").select("*");
  report("TC-RLS-04: Anonymous access to wa_message_templates blocked", !anonTemplates || anonTemplates.length === 0);

  const { data: anonJobs } = await anonClient.from("wa_processing_jobs").select("*");
  report("TC-RLS-05: Anonymous access to wa_processing_jobs blocked", !anonJobs || anonJobs.length === 0);

  // 2. Test Live Meta Graph API: Phone Number Verification
  console.log("\n2️⃣ Querying Meta Graph API for Phone Number Details...");
  try {
    const details = await getMetaPhoneNumberDetails(PHONE_NUMBER_ID, ACCESS_TOKEN);
    report(
      "TC-META-01: Meta Phone Number verification handshake",
      Boolean(details.id === PHONE_NUMBER_ID),
      `Verified Number: ${details.display_phone_number || details.id}, Quality: ${details.quality_rating || "UNKNOWN"}`
    );
  } catch (err) {
    report("TC-META-01: Meta Phone Number verification handshake", false, err.message);
  }

  // 3. Test Live Outbound Message Dispatch via Official Meta Cloud API
  console.log("\n3️⃣ Dispatching Live Test Template Message ('hello_world') via Meta Cloud API...");
  try {
    const sendResponse = await sendMetaTemplateMessage(
      PHONE_NUMBER_ID,
      ACCESS_TOKEN,
      RECIPIENT_PHONE,
      "hello_world",
      "en_US"
    );

    const messageId = sendResponse.messages?.[0]?.id;
    report(
      "TC-META-02: Outbound template message dispatched to verified recipient",
      Boolean(messageId && messageId.startsWith("wamid.")),
      `Meta Message ID: ${messageId}`
    );
  } catch (err) {
    report("TC-META-02: Outbound template message dispatched to verified recipient", false, err.message);
  }

  console.log("\n================================================================================");
  console.log(`📊 PHASE 3 VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runLivePhase3Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
