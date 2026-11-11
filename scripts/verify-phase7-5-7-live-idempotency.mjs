import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = path.resolve("./.env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ Fatal: .env.local file not found.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
const envVars = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const k = trimmed.slice(0, eqIdx).trim();
    let v = trimmed.slice(eqIdx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    envVars[k] = v;
    if (!process.env[k]) {
      process.env[k] = v;
    }
  }
}

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Fatal: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SYNTHETIC_CONN_ID = "e7570000-0000-0000-0000-000000000001";
const SYNTHETIC_PHONE_ID = "synthetic_phone_757_active";
const SYNTHETIC_SENDER_PHONE = "919999997570";
const SYNTHETIC_SENDER_NAME = "Synthetic Inbound Tester 7.5.7";
const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";

const createdTestIds = {
  connectionIds: [SYNTHETIC_CONN_ID],
  metaEventIds: ["synthetic_wamid_757_first", "synthetic_wamid_757_second"],
  contactIds: [],
  conversationIds: [],
  messageIds: [],
  jobIds: [],
};

const results = [];
function recordResult(testName, status, details = "") {
  results.push({ testName, status, details });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`  ${icon} [${status}] ${testName}${details ? " — " + details : ""}`);
}

async function runTest() {
  console.log("================================================================================");
  console.log("🚀 GOKUL CONNECT — PHASE 7.5.7: LIVE IDEMPOTENCY & RPC INTEGRATION VERIFICATION");
  console.log("================================================================================");
  console.log(`Target Supabase URL : ${SUPABASE_URL}`);
  console.log(`Execution Mode      : Synthetic Fixtures Only (No External Messaging)`);
  console.log("--------------------------------------------------------------------------------\n");

  // 1. Project ref verification
  const isTargetProject = SUPABASE_URL.includes("ansiwtwqgrfmzfrhkzuu");
  recordResult("1. Target Supabase Project Ref", isTargetProject ? "PASS" : "FAIL", SUPABASE_URL);
  if (!isTargetProject) throw new Error("Safety halt: Target project mismatch!");

  // 2. Baseline counts
  const [
    { count: baseContacts },
    { count: baseConversations },
    { count: baseMessages },
    { count: baseEvents },
    { count: baseJobs },
  ] = await Promise.all([
    adminClient.from("wa_contacts").select("*", { count: "exact", head: true }),
    adminClient.from("wa_conversations").select("*", { count: "exact", head: true }),
    adminClient.from("wa_messages").select("*", { count: "exact", head: true }),
    adminClient.from("wa_webhook_events").select("*", { count: "exact", head: true }),
    adminClient.from("wa_processing_jobs").select("*", { count: "exact", head: true }),
  ]);
  console.log(`   Baseline State: Contacts=${baseContacts}, Conversations=${baseConversations}, Messages=${baseMessages}, Events=${baseEvents}, Jobs=${baseJobs}\n`);

  try {
    // 3. Security Definer & Privilege check: anon MUST fail
    const { data: anonData, error: anonErr } = await anonClient.rpc("ingest_wa_inbound_message_v2", {
      p_phone_number_id: SYNTHETIC_PHONE_ID,
      p_meta_message_id: "synthetic_probe_anon",
      p_sender_phone: SYNTHETIC_SENDER_PHONE,
      p_sender_name: SYNTHETIC_SENDER_NAME,
      p_message_type: "text",
      p_content: "Probe",
      p_raw_payload: {},
    });
    const anonDenied = Boolean(anonErr && (anonErr.code === "42501" || anonErr.message.toLowerCase().includes("permission denied")));
    recordResult("2. Anon Access Explicitly Denied", anonDenied ? "PASS" : "FAIL", anonErr ? anonErr.message : "Unexpected success");

    // 4. Setup synthetic connection
    const { error: insertConnErr } = await adminClient.from("wa_connections").insert({
      id: SYNTHETIC_CONN_ID,
      business_id: ASTRO_BIZ_ID,
      display_name: "[SYNTHETIC-757] Test Connection",
      phone_number: "+1 555-019-7570",
      phone_number_id: SYNTHETIC_PHONE_ID,
      waba_id: "synthetic_waba_757",
      credential_ref: "vault:synthetic_757",
      connection_status: "connected",
      is_enabled: true,
    });
    if (insertConnErr) throw new Error(`Failed to insert synthetic connection: ${insertConnErr.message}`);
    recordResult("3. Synthetic Connection Created", "PASS", `ID: ${SYNTHETIC_CONN_ID}`);

    // 5. Initial message ingestion
    const { data: firstRes, error: firstErr } = await adminClient.rpc("ingest_wa_inbound_message_v2", {
      p_phone_number_id: SYNTHETIC_PHONE_ID,
      p_meta_message_id: "synthetic_wamid_757_first",
      p_sender_phone: SYNTHETIC_SENDER_PHONE,
      p_sender_name: SYNTHETIC_SENDER_NAME,
      p_message_type: "text",
      p_content: "Initial Inbound Message",
      p_raw_payload: { entry: [{ id: "test-757" }] },
    });
    const firstSuccess = !firstErr && firstRes?.status === "success" && firstRes?.contact_id && firstRes?.conversation_id && firstRes?.message_id && firstRes?.job_id;
    if (firstRes?.contact_id) createdTestIds.contactIds.push(firstRes.contact_id);
    if (firstRes?.conversation_id) createdTestIds.conversationIds.push(firstRes.conversation_id);
    if (firstRes?.message_id) createdTestIds.messageIds.push(firstRes.message_id);
    if (firstRes?.job_id) createdTestIds.jobIds.push(firstRes.job_id);

    recordResult("4. Initial Inbound Ingestion (Atomic RPC)", firstSuccess ? "PASS" : "FAIL", JSON.stringify(firstRes));

    // 6. Verify job was enqueued with idempotency key
    const { data: jobRow, error: jobErr } = await adminClient
      .from("wa_processing_jobs")
      .select("*")
      .eq("id", firstRes.job_id)
      .single();
    const jobValid = !jobErr && jobRow?.idempotency_key === "inbound_eval_synthetic_wamid_757_first" && jobRow?.status === "pending";
    recordResult("5. Background Job Atomically Enqueued", jobValid ? "PASS" : "FAIL", `Job ID: ${jobRow?.id}, Key: ${jobRow?.idempotency_key}`);

    // 7. Duplicate delivery: Call with EXACT SAME meta_message_id
    const { data: dupRes, error: dupErr } = await adminClient.rpc("ingest_wa_inbound_message_v2", {
      p_phone_number_id: SYNTHETIC_PHONE_ID,
      p_meta_message_id: "synthetic_wamid_757_first",
      p_sender_phone: SYNTHETIC_SENDER_PHONE,
      p_sender_name: SYNTHETIC_SENDER_NAME,
      p_message_type: "text",
      p_content: "Initial Inbound Message Duplicate Delivery",
      p_raw_payload: { entry: [{ id: "test-757-dup" }] },
    });
    const dupHandled = !dupErr && dupRes?.status === "duplicate" && dupRes?.message === "Webhook event already processed";
    recordResult("6. Duplicate Delivery Handled Gracefully", dupHandled ? "PASS" : "FAIL", JSON.stringify(dupRes));

    // 8. Verify no duplicate jobs or messages were created for duplicate call
    const [
      { count: checkMessages },
      { count: checkJobs },
    ] = await Promise.all([
      adminClient.from("wa_messages").select("*", { count: "exact", head: true }).eq("meta_message_id", "synthetic_wamid_757_first"),
      adminClient.from("wa_processing_jobs").select("*", { count: "exact", head: true }).eq("idempotency_key", "inbound_eval_synthetic_wamid_757_first"),
    ]);
    const countsPristine = checkMessages === 1 && checkJobs === 1;
    recordResult("7. Exactly One Message and One Job Persisted", countsPristine ? "PASS" : "FAIL", `Messages: ${checkMessages}, Jobs: ${checkJobs}`);

    // 9. Second unique message ingestion to test conversation update & contact count increment
    const { data: secondRes, error: secondErr } = await adminClient.rpc("ingest_wa_inbound_message_v2", {
      p_phone_number_id: SYNTHETIC_PHONE_ID,
      p_meta_message_id: "synthetic_wamid_757_second",
      p_sender_phone: SYNTHETIC_SENDER_PHONE,
      p_sender_name: SYNTHETIC_SENDER_NAME,
      p_message_type: "text",
      p_content: "Second Inbound Message",
      p_raw_payload: { entry: [{ id: "test-757-sec" }] },
    });
    const secondSuccess = !secondErr && secondRes?.status === "success" && secondRes?.conversation_id === firstRes.conversation_id;
    if (secondRes?.message_id) createdTestIds.messageIds.push(secondRes.message_id);
    if (secondRes?.job_id) createdTestIds.jobIds.push(secondRes.job_id);

    recordResult("8. Second Message Threaded into Same Conversation", secondSuccess ? "PASS" : "FAIL", `Conv ID: ${secondRes?.conversation_id}`);

    // Verify contact total_inbound_count incremented to 2
    const { data: contactRow } = await adminClient
      .from("wa_contacts")
      .select("total_inbound_count")
      .eq("id", firstRes.contact_id)
      .single();
    const countIncremented = contactRow?.total_inbound_count === 2;
    recordResult("9. Contact Inbound Counter Incremented", countIncremented ? "PASS" : "FAIL", `Count: ${contactRow?.total_inbound_count}`);

  } finally {
    // Teardown and Cleanup
    console.log("\n🧹 Cleaning up synthetic test fixtures...");

    if (createdTestIds.jobIds.length > 0) {
      await adminClient.from("wa_processing_jobs").delete().in("id", createdTestIds.jobIds);
    }
    await adminClient.from("wa_processing_jobs").delete().like("idempotency_key", "inbound_eval_synthetic_%");

    if (createdTestIds.messageIds.length > 0) {
      await adminClient.from("wa_messages").delete().in("id", createdTestIds.messageIds);
    }
    await adminClient.from("wa_messages").delete().like("meta_message_id", "synthetic_%");

    if (createdTestIds.conversationIds.length > 0) {
      await adminClient.from("wa_conversations").delete().in("id", createdTestIds.conversationIds);
    }

    await adminClient.from("wa_contacts").delete().eq("phone_number", SYNTHETIC_SENDER_PHONE);

    await adminClient.from("wa_webhook_events").delete().like("meta_event_id", "synthetic_%");

    await adminClient.from("wa_connections").delete().in("id", createdTestIds.connectionIds);

    // Verify pristine baseline parity
    const [
      { count: postContacts },
      { count: postConversations },
      { count: postMessages },
      { count: postEvents },
      { count: postJobs },
    ] = await Promise.all([
      adminClient.from("wa_contacts").select("*", { count: "exact", head: true }),
      adminClient.from("wa_conversations").select("*", { count: "exact", head: true }),
      adminClient.from("wa_messages").select("*", { count: "exact", head: true }),
      adminClient.from("wa_webhook_events").select("*", { count: "exact", head: true }),
      adminClient.from("wa_processing_jobs").select("*", { count: "exact", head: true }),
    ]);

    const cleanupPristine =
      postContacts === baseContacts &&
      postConversations === baseConversations &&
      postMessages === baseMessages &&
      postEvents === baseEvents &&
      postJobs === baseJobs;

    recordResult(
      "10. Fixture Cleanup & 100% Baseline Parity",
      cleanupPristine ? "PASS" : "FAIL",
      `Contacts: ${postContacts}/${baseContacts}, Convs: ${postConversations}/${baseConversations}, Msgs: ${postMessages}/${baseMessages}, Events: ${postEvents}/${baseEvents}, Jobs: ${postJobs}/${baseJobs}`
    );
  }

  const failCount = results.filter((r) => r.status === "FAIL").length;
  console.log(`\n🏁 Test complete: ${results.length - failCount} PASSED, ${failCount} FAILED.`);
  if (failCount > 0) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
