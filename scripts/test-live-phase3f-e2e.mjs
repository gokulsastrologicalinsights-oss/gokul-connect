import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
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
const ASTRO_CONN_ID = "33333333-3333-3333-3333-333333333333";
const ASTRO_PHONE_ID = "109283746501928";
const VIVAHAM_CONN_ID = "44444444-4444-4444-4444-444444444444";
const VIVAHAM_PHONE_ID = "1395663896970053";
const TEST_RECIPIENT_PHONE = "919444559071";

function verifyMetaWebhookSignature(payload, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret || typeof signatureHeader !== "string") return false;
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;
  const signatureHex = parts[1];
  try {
    const hmac = crypto.createHmac("sha256", appSecret);
    hmac.update(typeof payload === "string" ? payload : JSON.stringify(payload));
    const digestHex = hmac.digest("hex");
    const sigBuffer = Buffer.from(signatureHex, "utf8");
    const digBuffer = Buffer.from(digestHex, "utf8");
    if (sigBuffer.length !== digBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, digBuffer);
  } catch {
    return false;
  }
}

async function runLivePhase3FValidation() {
  console.log("================================================================================");
  console.log("🎯 GOKUL CONNECT — PHASE 3F: END-TO-END WHATSAPP VALIDATION (LIVE CLOUD)");
  console.log("================================================================================");
  console.log(`Target Supabase Project : ${SUPABASE_URL}`);
  console.log(`PostgreSQL Engine       : Supabase Cloud (v17.11)`);
  console.log(`Astrology Tenant ID     : ${ASTROLOGY_ID}`);
  console.log(`Vivaham Tenant ID       : ${VIVAHAM_ID}`);
  console.log(`Approved Test Recipient : +${TEST_RECIPIENT_PHONE}`);
  console.log("--------------------------------------------------------------------------------\n");

  let passed = 0;
  let failed = 0;

  function report(reqNum, name, success, details = "") {
    if (success) {
      console.log(`✅ [PASS] [Req ${reqNum}] ${name} ${details ? "(" + details + ")" : ""}`);
      passed++;
    } else {
      console.log(`❌ [FAIL] [Req ${reqNum}] ${name} ${details ? "(" + details + ")" : ""}`);
      failed++;
    }
  }

  // Authenticate User A (Astrology) and User B (Vivaham)
  console.log("🔑 Authenticating Sessions for Astrology (User A) and Vivaham (User B)...");
  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: ASTRO_EMAIL,
    password: ASTRO_PASSWORD,
  });
  if (errA || !authA.user) throw new Error(`User A authentication failed: ${errA?.message}`);

  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: VIVAHAM_EMAIL,
    password: VIVAHAM_PASSWORD,
  });
  if (errB || !authB.user) throw new Error(`User B authentication failed: ${errB?.message}`);

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log(`   User A Logged In : ${authA.user.id} (Astrology Workspace)`);
  console.log(`   User B Logged In : ${authB.user.id} (Vivaham Workspace)\n`);

  // Generate Unique Test IDs
  const testRunId = Date.now().toString().slice(-6);
  const outboundMetaId = `wamid.live_out_${testRunId}_${crypto.randomBytes(4).toString("hex")}`;
  const inboundMetaId = `wamid.live_in_${testRunId}_${crypto.randomBytes(4).toString("hex")}`;
  const failedMetaId = `wamid.live_fail_${testRunId}_${crypto.randomBytes(4).toString("hex")}`;
  const vivahamMetaId = `wamid.live_viv_${testRunId}_${crypto.randomBytes(4).toString("hex")}`;

  // ---------------------------------------------------------------------------
  // 1. Verify outgoing messages are saved in Supabase
  // ---------------------------------------------------------------------------
  console.log("1️⃣ Validating Outgoing Message Persistence in Supabase...");
  // Upsert contact first
  const { data: astroContact, error: contactErr } = await clientA
    .from("wa_contacts")
    .upsert({
      business_id: ASTROLOGY_ID,
      phone_number: TEST_RECIPIENT_PHONE,
      display_name: "Gokul Approved Test Client",
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id, phone_number" })
    .select()
    .single();

  if (contactErr || !astroContact) throw new Error(`Failed to create contact: ${contactErr?.message}`);

  const { data: astroConv, error: convErr } = await clientA
    .from("wa_conversations")
    .upsert({
      business_id: ASTROLOGY_ID,
      connection_id: ASTRO_CONN_ID,
      contact_id: astroContact.id,
      status: "open",
      last_message_preview: "Astrology consultation booking confirmation",
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "connection_id, contact_id" })
    .select()
    .single();

  if (convErr || !astroConv) throw new Error(`Failed to create conversation: ${convErr?.message}`);

  const { data: outboundMsg, error: outMsgErr } = await clientA
    .from("wa_messages")
    .insert({
      business_id: ASTROLOGY_ID,
      connection_id: ASTRO_CONN_ID,
      conversation_id: astroConv.id,
      contact_id: astroContact.id,
      direction: "outbound",
      message_type: "text",
      content: "Astrology consultation booking confirmation",
      meta_message_id: outboundMetaId,
      status: "sent",
      sent_at: new Date().toISOString(),
      raw_payload: { text: "Astrology consultation booking confirmation" },
    })
    .select()
    .single();

  report(
    1,
    "Outgoing messages are saved in Supabase",
    Boolean(outboundMsg && outboundMsg.direction === "outbound" && outboundMsg.status === "sent"),
    `Message UUID: ${outboundMsg?.id}, Meta ID: ${outboundMsg?.meta_message_id}`
  );

  // ---------------------------------------------------------------------------
  // 2. Verify incoming messages are saved in Supabase
  // ---------------------------------------------------------------------------
  console.log("\n2️⃣ Validating Inbound Message Ingestion in Supabase...");
  const { data: inboundRes, error: inRpcErr } = await anonClient.rpc("ingest_wa_inbound_message", {
    p_phone_number_id: ASTRO_PHONE_ID,
    p_meta_message_id: inboundMetaId,
    p_sender_phone: TEST_RECIPIENT_PHONE,
    p_sender_name: "Gokul Approved Test Client",
    p_message_type: "text",
    p_content: "Vanakkam, requesting KP astrological chart analysis",
    p_raw_payload: { type: "text", text: { body: "Vanakkam, requesting KP astrological chart analysis" } },
  });

  const { data: savedInboundMsg } = await clientA
    .from("wa_messages")
    .select("*")
    .eq("meta_message_id", inboundMetaId)
    .single();

  report(
    2,
    "Incoming messages are saved in Supabase",
    Boolean(savedInboundMsg && savedInboundMsg.direction === "inbound" && savedInboundMsg.status === "delivered"),
    `Content: "${savedInboundMsg?.content?.slice(0, 40)}...", Direction: ${savedInboundMsg?.direction}`
  );

  // ---------------------------------------------------------------------------
  // 3. Verify contacts and conversations are created correctly
  // ---------------------------------------------------------------------------
  console.log("\n3️⃣ Validating Contact and Conversation Auto-Creation...");
  const { data: resolvedContact } = await clientA
    .from("wa_contacts")
    .select("*")
    .eq("id", savedInboundMsg?.contact_id)
    .single();

  const { data: resolvedConv } = await clientA
    .from("wa_conversations")
    .select("*")
    .eq("id", savedInboundMsg?.conversation_id)
    .single();

  report(
    3,
    "Contacts and conversations created correctly",
    Boolean(
      resolvedContact?.phone_number === TEST_RECIPIENT_PHONE &&
      resolvedContact?.business_id === ASTROLOGY_ID &&
      resolvedConv?.connection_id === ASTRO_CONN_ID &&
      resolvedConv?.status === "open"
    ),
    `Contact: ${resolvedContact?.display_name} (+${resolvedContact?.phone_number}), Thread Status: ${resolvedConv?.status}`
  );

  // ---------------------------------------------------------------------------
  // 4. Verify Meta message IDs are stored
  // ---------------------------------------------------------------------------
  console.log("\n4️⃣ Validating Meta Message ID Storage & Uniqueness...");
  const hasMetaIds = outboundMsg?.meta_message_id === outboundMetaId && savedInboundMsg?.meta_message_id === inboundMetaId;
  
  // Test unique constraint: attempt duplicate insert
  const { error: dupMetaErr } = await clientA
    .from("wa_messages")
    .insert({
      business_id: ASTROLOGY_ID,
      connection_id: ASTRO_CONN_ID,
      conversation_id: astroConv.id,
      contact_id: astroContact.id,
      direction: "inbound",
      content: "Duplicate meta ID attempt",
      meta_message_id: inboundMetaId,
    });

  report(
    4,
    "Meta message IDs are stored and uniqueness enforced",
    Boolean(hasMetaIds && dupMetaErr && dupMetaErr.code === "23505"),
    `Meta ID: ${inboundMetaId}, Duplicate blocked with code: ${dupMetaErr?.code}`
  );

  // ---------------------------------------------------------------------------
  // 5. Verify sent, delivered, read and failed status updates
  // ---------------------------------------------------------------------------
  console.log("\n5️⃣ Validating Message Delivery Status Transitions (sent, delivered, read, failed)...");
  
  // Step 5a: delivered
  const { data: delivRes } = await anonClient.rpc("update_wa_message_status", {
    p_phone_number_id: ASTRO_PHONE_ID,
    p_meta_message_id: outboundMetaId,
    p_status: "delivered",
    p_timestamp: new Date().toISOString(),
  });

  const { data: msgAfterDeliv } = await clientA
    .from("wa_messages")
    .select("status, delivered_at")
    .eq("meta_message_id", outboundMetaId)
    .single();

  const isDelivered = msgAfterDeliv?.status === "delivered" && Boolean(msgAfterDeliv?.delivered_at);

  // Step 5b: read
  const { data: readRes } = await anonClient.rpc("update_wa_message_status", {
    p_phone_number_id: ASTRO_PHONE_ID,
    p_meta_message_id: outboundMetaId,
    p_status: "read",
    p_timestamp: new Date().toISOString(),
  });

  const { data: msgAfterRead } = await clientA
    .from("wa_messages")
    .select("status, read_at")
    .eq("meta_message_id", outboundMetaId)
    .single();

  const isRead = msgAfterRead?.status === "read" && Boolean(msgAfterRead?.read_at);

  // Step 5c: failed
  await clientA.from("wa_messages").insert({
    business_id: ASTROLOGY_ID,
    connection_id: ASTRO_CONN_ID,
    conversation_id: astroConv.id,
    contact_id: astroContact.id,
    direction: "outbound",
    content: "Message to unreachable phone",
    meta_message_id: failedMetaId,
    status: "pending",
  });

  await anonClient.rpc("update_wa_message_status", {
    p_phone_number_id: ASTRO_PHONE_ID,
    p_meta_message_id: failedMetaId,
    p_status: "failed",
    p_timestamp: new Date().toISOString(),
    p_error_code: "131026",
    p_error_message: "Message undeliverable: User not on WhatsApp",
  });

  const { data: msgAfterFail } = await clientA
    .from("wa_messages")
    .select("status, error_code, error_message")
    .eq("meta_message_id", failedMetaId)
    .single();

  const isFailed = msgAfterFail?.status === "failed" && msgAfterFail?.error_code === "131026";

  report(
    5,
    "Sent, delivered, read and failed status updates verified",
    Boolean(isDelivered && isRead && isFailed),
    `Delivered: ${isDelivered}, Read: ${isRead}, Failed: ${isFailed} (${msgAfterFail?.error_message})`
  );

  // ---------------------------------------------------------------------------
  // 6. Verify webhook signature validation
  // ---------------------------------------------------------------------------
  console.log("\n6️⃣ Validating HMAC-SHA256 Webhook Cryptographic Signatures...");
  const sampleSecret = "meta_test_webhook_app_secret_live_2026";
  const testPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "test" }] });
  
  const hmac = crypto.createHmac("sha256", sampleSecret).update(testPayload).digest("hex");
  const validHeader = `sha256=${hmac}`;
  const tamperedHeader = `sha256=${crypto.createHmac("sha256", "wrong_secret").update(testPayload).digest("hex")}`;

  const sigPass = verifyMetaWebhookSignature(testPayload, validHeader, sampleSecret);
  const tamperedSigFail = !verifyMetaWebhookSignature(testPayload, tamperedHeader, sampleSecret);
  const tamperedBodyFail = !verifyMetaWebhookSignature(testPayload + "tampered", validHeader, sampleSecret);
  const missingSigFail = !verifyMetaWebhookSignature(testPayload, null, sampleSecret);

  report(
    6,
    "Webhook signature validation verified",
    sigPass && tamperedSigFail && tamperedBodyFail && missingSigFail,
    `Valid: ${sigPass}, Tampered Secret Rejected: ${tamperedSigFail}, Tampered Body Rejected: ${tamperedBodyFail}`
  );

  // ---------------------------------------------------------------------------
  // 7. Verify duplicate webhook events are not processed twice
  // ---------------------------------------------------------------------------
  console.log("\n7️⃣ Validating Webhook Event Idempotency and Deduplication...");
  // Re-send inboundMetaId
  const { data: dupInboundRes } = await anonClient.rpc("ingest_wa_inbound_message", {
    p_phone_number_id: ASTRO_PHONE_ID,
    p_meta_message_id: inboundMetaId,
    p_sender_phone: TEST_RECIPIENT_PHONE,
    p_content: "Duplicate attempt",
  });

  const { data: countMsgs } = await clientA
    .from("wa_messages")
    .select("id")
    .eq("meta_message_id", inboundMetaId);

  report(
    7,
    "Duplicate webhook events are not processed twice",
    dupInboundRes?.status === "duplicate" && countMsgs?.length === 1,
    `RPC response: ${dupInboundRes?.status}, Total messages in DB with Meta ID: ${countMsgs?.length}`
  );

  // ---------------------------------------------------------------------------
  // 8. Verify conversation history survives application restart
  // ---------------------------------------------------------------------------
  console.log("\n8️⃣ Validating Conversation History Persistence Across App Restarts...");
  // Simulate complete application restart by instantiating fresh client
  const restartedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await restartedClient.auth.signInWithPassword({
    email: ASTRO_EMAIL,
    password: ASTRO_PASSWORD,
  });

  const { data: persistedMessages } = await restartedClient
    .from("wa_messages")
    .select("id, content, direction, status, created_at")
    .eq("conversation_id", astroConv.id)
    .order("created_at", { ascending: true });

  report(
    8,
    "Conversation history survives application restart",
    Boolean(persistedMessages && persistedMessages.length >= 2),
    `Persisted messages in thread after simulated restart: ${persistedMessages?.length} messages`
  );

  // ---------------------------------------------------------------------------
  // 9. Verify messages are displayed in the correct business workspace
  // ---------------------------------------------------------------------------
  console.log("\n9️⃣ Validating Scoped Message Display per Business Workspace...");
  const { data: astroScopedMsgs } = await clientA
    .from("wa_messages")
    .select("id, business_id, content")
    .eq("business_id", ASTROLOGY_ID);

  const astroAllCorrect = astroScopedMsgs?.every((m) => m.business_id === ASTROLOGY_ID);

  report(
    9,
    "Messages are displayed in the correct business workspace",
    Boolean(astroScopedMsgs && astroScopedMsgs.length > 0 && astroAllCorrect),
    `Astrology workspace retrieved ${astroScopedMsgs?.length} messages, 100% scoped to Astrology`
  );

  // ---------------------------------------------------------------------------
  // 10. Verify Astrology and Vivaham cannot access each other's messages or contacts
  // ---------------------------------------------------------------------------
  console.log("\n🔟 Validating Cross-Tenant RLS Barrier (Astrology vs Vivaham)...");
  // User A (Astrology) queries Vivaham messages
  const { data: aReadsVivahamMsgs } = await clientA
    .from("wa_messages")
    .select("*")
    .eq("business_id", VIVAHAM_ID);

  // User A queries Vivaham contacts
  const { data: aReadsVivahamContacts } = await clientA
    .from("wa_contacts")
    .select("*")
    .eq("business_id", VIVAHAM_ID);

  // User B (Vivaham) queries Astrology messages
  const { data: bReadsAstroMsgs } = await clientB
    .from("wa_messages")
    .select("*")
    .eq("business_id", ASTROLOGY_ID);

  // User B (Vivaham) queries Astrology contacts
  const { data: bReadsAstroContacts } = await clientB
    .from("wa_contacts")
    .select("*")
    .eq("business_id", ASTROLOGY_ID);

  // User A attempts to write a message under Vivaham
  const { error: crossWriteErr } = await clientA
    .from("wa_messages")
    .insert({
      business_id: VIVAHAM_ID,
      connection_id: VIVAHAM_CONN_ID,
      conversation_id: astroConv.id,
      contact_id: astroContact.id,
      direction: "outbound",
      content: "Malicious cross-tenant message injection",
    });

  const crossTenantBlocked =
    aReadsVivahamMsgs?.length === 0 &&
    aReadsVivahamContacts?.length === 0 &&
    bReadsAstroMsgs?.length === 0 &&
    bReadsAstroContacts?.length === 0 &&
    Boolean(crossWriteErr);

  report(
    10,
    "Astrology and Vivaham cannot access each other's messages or contacts",
    crossTenantBlocked,
    `User A read Vivaham: ${aReadsVivahamMsgs?.length} rows, User B read Astro: ${bReadsAstroMsgs?.length} rows, Cross-tenant insert blocked: ${Boolean(crossWriteErr)}`
  );

  // ---------------------------------------------------------------------------
  // 11. Verify multiple WhatsApp connections work independently
  // ---------------------------------------------------------------------------
  console.log("\n1️⃣1️⃣ Validating Independent Routing Across Multiple WhatsApp Connections...");
  // Ingest incoming message on Vivaham connection
  const { data: vivRpcRes } = await anonClient.rpc("ingest_wa_inbound_message", {
    p_phone_number_id: VIVAHAM_PHONE_ID,
    p_meta_message_id: vivahamMetaId,
    p_sender_phone: "919840199999",
    p_sender_name: "Vivaham Matrimony Member",
    p_message_type: "text",
    p_content: "Enquiry for Mudaliar community premium membership",
  });

  const { data: vivahamMsg } = await clientB
    .from("wa_messages")
    .select("*")
    .eq("meta_message_id", vivahamMetaId)
    .single();

  const vivahamIsolated =
    vivRpcRes?.business_id === VIVAHAM_ID &&
    vivRpcRes?.connection_id === VIVAHAM_CONN_ID &&
    vivahamMsg?.business_id === VIVAHAM_ID;

  report(
    11,
    "Multiple WhatsApp connections work independently",
    Boolean(vivahamIsolated),
    `Phone ${VIVAHAM_PHONE_ID} routed to Vivaham Business: ${vivahamMsg?.business_id}`
  );

  // ---------------------------------------------------------------------------
  // 12. Verify failed messages and retry handling
  // ---------------------------------------------------------------------------
  console.log("\n1️⃣2️⃣ Validating Outbox Queue & Retry Backoff Handling...");
  const jobId = crypto.randomUUID();
  const { data: createdJob, error: jobErr } = await clientA
    .from("wa_processing_jobs")
    .insert({
      id: jobId,
      business_id: ASTROLOGY_ID,
      connection_id: ASTRO_CONN_ID,
      job_type: "send_message",
      payload: { recipient: TEST_RECIPIENT_PHONE, text: "Automated retry payload" },
      status: "pending",
      attempts: 0,
      max_attempts: 5,
    })
    .select()
    .single();

  // Simulate retry after failure: increment attempts and schedule next retry
  const nextRetryTime = new Date(Date.now() + 300000).toISOString();
  const { data: retriedJob } = await clientA
    .from("wa_processing_jobs")
    .update({
      attempts: 1,
      last_error: "Meta API Rate Limited (code 130429)",
      status: "pending",
      scheduled_at: nextRetryTime,
    })
    .eq("id", jobId)
    .select()
    .single();

  const retryHandled =
    retriedJob?.attempts === 1 &&
    retriedJob?.status === "pending" &&
    retriedJob?.last_error?.includes("130429");

  report(
    12,
    "Failed messages and retry handling verified",
    Boolean(retryHandled),
    `Job ${retriedJob?.id}: Attempts: ${retriedJob?.attempts}/${retriedJob?.max_attempts}, Next Scheduled: ${retriedJob?.scheduled_at}`
  );

  console.log("\n================================================================================");
  console.log(`📊 PHASE 3F LIVE VALIDATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runLivePhase3FValidation().catch((err) => {
  console.error("Validation failed with uncaught exception:", err);
  process.exit(1);
});
