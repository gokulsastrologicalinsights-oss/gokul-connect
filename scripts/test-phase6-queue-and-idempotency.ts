import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
  return env;
}

// Load env into process.env before importing worker
const env = loadLocalEnv();

async function runQueueAndIdempotencyTests() {
  const { calculateBackoffDelaySeconds, processQueueBatch } = await import("../src/lib/automation/worker");

  console.log("================================================================================");
  console.log("⚙️ GOKUL CONNECT — PHASE 6.1: QUEUE WORKER, RETRY & IDEMPOTENCY TESTS");
  console.log("================================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminClient = createClient(supabaseUrl, serviceKey);

  const testBizId = "22222222-2222-2222-2222-222222222222"; // Gokul Vivaham
  const testConnId = "44444444-4444-4444-4444-444444444444";

  let passed = 0;
  let failed = 0;

  function report(name: string, ok: boolean, details: string = "") {
    if (ok) {
      console.log(`✅ [PASS] ${name} ${details ? `(${details})` : ""}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ""}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // Clean up any lingering processing jobs from previous runs
  // ---------------------------------------------------------------------------
  await adminClient.from("wa_processing_jobs").delete().ilike("idempotency_key", "p6_%");

  // ---------------------------------------------------------------------------
  // TEST A1: Direct RPC Locking Verification (claim_next_wa_jobs)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST A1: Direct RPC Locking & Exclusivity (claim_next_wa_jobs) ---");
  const jobKey1 = `p6_lock_${Date.now()}`;
  const { data: job1 } = await adminClient
    .from("wa_processing_jobs")
    .insert({
      business_id: testBizId,
      connection_id: testConnId,
      job_type: "evaluate_automation_rules",
      payload: { test_source: "locking_check" },
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      scheduled_at: new Date(Date.now() - 5000).toISOString(),
      idempotency_key: jobKey1,
    })
    .select()
    .single();

  report("Job 1 inserted for RPC claim test", Boolean(job1));

  const worker1Tag = `worker_alpha_${Date.now()}`;
  const { data: claimedBatch1 } = await adminClient.rpc("claim_next_wa_jobs", {
    p_batch_size: 5,
    p_worker_id: worker1Tag,
  });

  const claimedJob1 = claimedBatch1?.find((j: any) => j.id === job1?.id);
  report(
    "Worker Alpha claims job exclusively and marks status 'processing'",
    claimedJob1 && claimedJob1.status === "processing" && claimedJob1.locked_by === worker1Tag,
    `Status: ${claimedJob1?.status}, locked_by: ${claimedJob1?.locked_by}`
  );

  // Attempt duplicate claim by Worker Beta while Worker Alpha holds lock
  const worker2Tag = `worker_beta_${Date.now()}`;
  const { data: claimedBatch2 } = await adminClient.rpc("claim_next_wa_jobs", {
    p_batch_size: 5,
    p_worker_id: worker2Tag,
  });

  const job1DoubleClaimed = claimedBatch2?.some((j: any) => j.id === job1?.id);
  report(
    "Worker Beta cannot claim already locked job (SKIP LOCKED concurrency protection)",
    !job1DoubleClaimed,
    "No double claim"
  );

  await adminClient.from("wa_processing_jobs").delete().eq("id", job1?.id);

  // ---------------------------------------------------------------------------
  // TEST A2: End-to-End Worker Batch Lifecycle (processQueueBatch)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST A2: End-to-End Worker Processing (processQueueBatch) ---");
  const jobKey2 = `p6_worker_${Date.now()}`;
  const { data: job2 } = await adminClient
    .from("wa_processing_jobs")
    .insert({
      business_id: testBizId,
      connection_id: testConnId,
      job_type: "evaluate_automation_rules", // Unsupported direct dispatch type -> safely marks skipped
      payload: { test_worker: true },
      status: "pending",
      attempts: 0,
      max_attempts: 3,
      scheduled_at: new Date(Date.now() - 5000).toISOString(),
      idempotency_key: jobKey2,
    })
    .select()
    .single();

  report("Job 2 inserted for processQueueBatch lifecycle test", Boolean(job2));

  // Run the actual queue worker
  const batchRes = await processQueueBatch(10, `cron_test_${Date.now()}`);
  report(
    "processQueueBatch executed without errors",
    batchRes.errors.length === 0,
    `Claimed: ${batchRes.claimedCount}, Processed: ${batchRes.processedCount}, Skipped: ${batchRes.skippedCount}, Succeeded: ${batchRes.succeededCount}`
  );

  // Check the job's final state in the database
  const { data: job2Final } = await adminClient
    .from("wa_processing_jobs")
    .select("id, status, last_error")
    .eq("id", job2?.id)
    .single();

  report(
    "Job 2 completed/skipped with documented outcome",
    job2Final?.status === "completed" && job2Final?.last_error?.includes("Skipped"),
    `Status: ${job2Final?.status}, Error: ${job2Final?.last_error}`
  );

  await adminClient.from("wa_processing_jobs").delete().eq("id", job2?.id);

  // ---------------------------------------------------------------------------
  // TEST B: Exponential Backoff & Retry Logic
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST B: Retry & Backoff Schedule Verification ---");
  const delay0 = calculateBackoffDelaySeconds(0);
  const delay1 = calculateBackoffDelaySeconds(1);
  const delay2 = calculateBackoffDelaySeconds(2);
  const delay3 = calculateBackoffDelaySeconds(3);

  report(
    "Exponential backoff calculation grows predictably (attempts 0..3)",
    delay0 >= 30 && delay1 >= 60 && delay2 >= 120 && delay3 >= 240,
    `d0: ${delay0}s, d1: ${delay1}s, d2: ${delay2}s, d3: ${delay3}s`
  );

  // Test stuck job reaper (reclaim_stuck_wa_jobs)
  const stuckJobKey = `p6_stuck_${Date.now()}`;
  const { data: stuckJob } = await adminClient
    .from("wa_processing_jobs")
    .insert({
      business_id: testBizId,
      connection_id: testConnId,
      job_type: "evaluate_automation_rules",
      payload: { stuck_test: true },
      status: "processing", // Simulate crashed worker
      locked_by: "crashed_worker_pid_9999",
      locked_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
      scheduled_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      attempts: 1,
      max_attempts: 3,
      idempotency_key: stuckJobKey,
    })
    .select()
    .single();

  if (stuckJob) {
    const { data: reclaimedCount, error: reclaimErr } = await adminClient.rpc("reclaim_stuck_wa_jobs", {
      p_timeout_minutes: 5,
    });
    report(
      "reclaim_stuck_wa_jobs RPC reclaims crashed worker job",
      !reclaimErr && typeof reclaimedCount === "number" && reclaimedCount >= 1,
      `Reclaimed count: ${reclaimedCount}`
    );

    const { data: reclaimedJob } = await adminClient
      .from("wa_processing_jobs")
      .select("id, status, attempts, locked_at, locked_by")
      .eq("id", stuckJob.id)
      .single();

    report(
      "Reclaimed job reset to 'pending' with incremented attempts & cleared locks",
      reclaimedJob?.status === "pending" && reclaimedJob?.attempts === 2 && reclaimedJob?.locked_at === null,
      `Status: ${reclaimedJob?.status}, attempts: ${reclaimedJob?.attempts}, locked_by: ${reclaimedJob?.locked_by}`
    );

    await adminClient.from("wa_processing_jobs").delete().eq("id", stuckJob.id);
  }

  // ---------------------------------------------------------------------------
  // TEST C: Database Idempotency & Replay Prevention
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST C: Database Idempotency & Replay Prevention ---");
  const sharedKey = `idempotent_test_key_${Date.now()}`;

  // 1. Unique index on wa_processing_jobs (idempotency_key)
  const { data: firstInsert, error: firstErr } = await adminClient
    .from("wa_processing_jobs")
    .insert({
      business_id: testBizId,
      job_type: "evaluate_automation_rules",
      payload: { test: 1 },
      status: "pending",
      idempotency_key: sharedKey,
    })
    .select()
    .single();

  report("Initial job insert with unique idempotency_key succeeds", Boolean(!firstErr && firstInsert));

  const { error: duplicateErr } = await adminClient
    .from("wa_processing_jobs")
    .insert({
      business_id: testBizId,
      job_type: "evaluate_automation_rules",
      payload: { test: 2 },
      status: "pending",
      idempotency_key: sharedKey,
    });

  report(
    "Duplicate idempotency_key is rejected with PostgreSQL unique violation (code 23505)",
    Boolean(duplicateErr && (duplicateErr.code === "23505" || duplicateErr.message.includes("unique"))),
    `PG Code: ${duplicateErr?.code}`
  );

  if (firstInsert) {
    await adminClient.from("wa_processing_jobs").delete().eq("id", firstInsert.id);
  }

  // 2. Inbound Webhook RPC Idempotency (ingest_wa_inbound_message duplicate detection)
  console.log("\n--- Inbound Webhook RPC Replay Deduplication Test ---");
  const testMetaMsgId = `wamid.p6_test_${Date.now()}`;
  const vivPhoneId = "1395663896970053";

  // Ingest synthetic message 1st time
  const { data: rpc1 } = await adminClient.rpc("ingest_wa_inbound_message", {
    p_phone_number_id: vivPhoneId,
    p_meta_message_id: testMetaMsgId,
    p_sender_phone: "919444559071",
    p_sender_name: "Gokul Test",
    p_message_type: "text",
    p_content: "Testing idempotency deduplication",
    p_raw_payload: { test: true },
  });

  report(
    "ingest_wa_inbound_message initial ingestion succeeds",
    rpc1?.status === "success",
    `Status: ${rpc1?.status}, message_id: ${rpc1?.message_id}`
  );

  // Replay identical meta_message_id
  const { data: rpc2 } = await adminClient.rpc("ingest_wa_inbound_message", {
    p_phone_number_id: vivPhoneId,
    p_meta_message_id: testMetaMsgId,
    p_sender_phone: "919444559071",
    p_sender_name: "Gokul Test",
    p_message_type: "text",
    p_content: "Testing idempotency deduplication",
    p_raw_payload: { test: true },
  });

  report(
    "ingest_wa_inbound_message replay is recognized as duplicate (idempotent)",
    rpc2?.status === "duplicate",
    `Status: ${rpc2?.status}`
  );

  // Verify only 1 record exists in wa_messages
  const { data: persistedMsgs } = await adminClient
    .from("wa_messages")
    .select("id, meta_message_id")
    .eq("meta_message_id", testMetaMsgId);

  report(
    "wa_messages maintains exactly 1 record for meta_message_id (Zero Duplication)",
    persistedMsgs?.length === 1,
    `Count: ${persistedMsgs?.length}`
  );

  // Clean up synthetic test records
  if (rpc1?.message_id) {
    await adminClient.from("wa_messages").delete().eq("id", rpc1.message_id);
  }
  await adminClient.from("wa_webhook_events").delete().eq("meta_event_id", testMetaMsgId);

  console.log("\n================================================================================");
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log("================================================================================");
}

runQueueAndIdempotencyTests().catch(console.error);
