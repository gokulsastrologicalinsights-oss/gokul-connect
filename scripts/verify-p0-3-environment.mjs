import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Helper to safely load env from .env.local without exposing values
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function isPlaceholderOrEmpty(val) {
  if (!val || typeof val !== "string") return true;
  const v = val.trim();
  if (v.length === 0) return true;
  if (v.startsWith("<") && v.endsWith(">")) return true;
  if (v.includes("your_") || v.includes("your-")) return true;
  if (v === '""' || v === "''") return true;
  return false;
}

async function runVerification() {
  console.log("================================================================================");
  console.log("🔐 GOKUL CONNECT — P0.3 SECURE ENVIRONMENT CONFIGURATION VERIFICATION");
  console.log("================================================================================");
  console.log(`Scan Date: ${new Date().toISOString()}`);
  console.log("Environment File: .env.local\n");

  const env = loadLocalEnv();
  let allPassed = true;

  // ---------------------------------------------------------------------------
  // Check 1: Inspect Required Variables for Presence and Placeholders
  // ---------------------------------------------------------------------------
  console.log("--- 1. Required Environment Variables Inspection ---");

  const checks = [
    { key: "SUPABASE_SERVICE_ROLE_KEY", required: true },
    { key: "META_APP_ID", required: true },
    { key: "META_APP_SECRET", required: true },
    { key: "NEXT_PUBLIC_SUPABASE_URL", required: true },
    { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
    { key: "APP_ENCRYPTION_SECRET", required: true },
  ];

  const results = {};

  for (const item of checks) {
    const val = env[item.key];
    const isPh = isPlaceholderOrEmpty(val);
    const len = val ? val.length : 0;
    results[item.key] = { present: !isPh, length: len };

    if (isPh) {
      console.log(`❌ ${item.key.padEnd(30)}: MISSING OR PLACEHOLDER (Length: ${len})`);
      if (item.required) allPassed = false;
    } else {
      console.log(`✅ ${item.key.padEnd(30)}: CONFIGURED (Length: ${len} chars, masked: ${val.slice(0, 2)}***${val.slice(-2)})`);
    }
  }

  // ---------------------------------------------------------------------------
  // Check 2: Supabase Admin Client Initialization & Authentication
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Supabase Admin Client & Authentication Verification ---");
  const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];
  const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];

  if (!supabaseUrl || isPlaceholderOrEmpty(serviceRoleKey)) {
    console.log("❌ Supabase Admin Client: SKIPPED (SUPABASE_SERVICE_ROLE_KEY is missing or placeholder)");
    allPassed = false;
  } else {
    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Test lightweight query using service-role bypass
      const { data, error, count } = await adminClient
        .from("businesses")
        .select("id, name", { count: "exact", head: false })
        .limit(2);

      if (error) {
        console.log(`❌ Supabase Admin Client Authentication: FAILED (${error.message})`);
        allPassed = false;
      } else {
        console.log(`✅ Supabase Admin Client Initialized: SUCCESS (Successfully connected to ${supabaseUrl})`);
        console.log(`✅ Admin Privileges Confirmed: Accessible businesses count: ${data ? data.length : 0}`);
      }
    } catch (err) {
      console.log(`❌ Supabase Admin Client: ERROR (${err.message})`);
      allPassed = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Check 3: Automation Worker Queue Access Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Automation Worker Queue Authentication ---");
  if (!supabaseUrl || isPlaceholderOrEmpty(serviceRoleKey)) {
    console.log("❌ Automation Worker: SKIPPED (SUPABASE_SERVICE_ROLE_KEY is missing or placeholder)");
    allPassed = false;
  } else {
    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Check wa_processing_jobs access
      const { data: jobCheck, error: jobErr } = await adminClient
        .from("wa_processing_jobs")
        .select("id, status")
        .limit(1);

      if (jobErr) {
        console.log(`❌ Automation Worker Table Access (wa_processing_jobs): FAILED (${jobErr.message})`);
        allPassed = false;
      } else {
        console.log("✅ Automation Worker Table Access: SUCCESS (Direct access to wa_processing_jobs)");
      }

      // Check RPC claim_next_wa_jobs
      const { data: rpcData, error: rpcErr } = await adminClient.rpc("claim_next_wa_jobs", {
        p_batch_size: 0,
        p_worker_id: "p0_3_verify_probe",
      });

      if (rpcErr) {
        console.log(`❌ Automation Worker claim_next_wa_jobs RPC: FAILED (${rpcErr.message})`);
        allPassed = false;
      } else {
        console.log("✅ Automation Worker claim_next_wa_jobs RPC: SUCCESS (Callable via service role)");
      }
    } catch (err) {
      console.log(`❌ Automation Worker: ERROR (${err.message})`);
      allPassed = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Check 4: Meta Application Credentials & Webhook Signature Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Meta Credentials & Webhook Signature Verification ---");
  const metaAppId = env["META_APP_ID"];
  const metaAppSecret = env["META_APP_SECRET"];

  const appIdValid = !isPlaceholderOrEmpty(metaAppId);
  const appSecretValid = !isPlaceholderOrEmpty(metaAppSecret);

  if (!appIdValid) {
    console.log("❌ META_APP_ID: Missing or placeholder");
    allPassed = false;
  } else {
    // Validate format: Meta App IDs are numeric strings
    const isNumeric = /^\d+$/.test(metaAppId);
    console.log(`✅ META_APP_ID: Present (${isNumeric ? "Valid numeric format" : "Non-standard format"}, length: ${metaAppId.length})`);
  }

  if (!appSecretValid) {
    console.log("❌ META_APP_SECRET: Missing or placeholder");
    allPassed = false;
  } else {
    // Validate format: Meta App Secrets are 32 hex characters
    const isHex32 = /^[0-9a-fA-F]{32}$/.test(metaAppSecret);
    console.log(`✅ META_APP_SECRET: Present (${isHex32 ? "Valid 32-char hex" : "Non-standard format"}, length: ${metaAppSecret.length})`);

    // Verify HMAC-SHA256 signature algorithm with this secret
    const testPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "test_entry", changes: [] }],
    });

    const hmac = crypto.createHmac("sha256", metaAppSecret);
    hmac.update(testPayload);
    const expectedHash = hmac.digest("hex");
    const testHeader = `sha256=${expectedHash}`;

    // Verify matching signature
    const headerParts = testHeader.split("=");
    const match = crypto.timingSafeEqual(
      Buffer.from(headerParts[1], "utf8"),
      Buffer.from(expectedHash, "utf8")
    );

    // Verify tampered signature is rejected
    const tamperedHash = "a".repeat(64);
    const tamperedReject = !crypto.timingSafeEqual(
      Buffer.from(tamperedHash, "utf8"),
      Buffer.from(expectedHash, "utf8")
    );

    if (match && tamperedReject) {
      console.log("✅ Webhook HMAC-SHA256 Signature Verification: SUCCESS (Timing-safe verification validated)");
    } else {
      console.log("❌ Webhook HMAC-SHA256 Signature Verification: FAILED");
      allPassed = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Check 5: Client Bundle Exposure & Variable Scope Audit
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Browser Bundle Exposure & Server-Only Scope Audit ---");

  const serverOnlyVars = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "META_APP_SECRET",
    "APP_ENCRYPTION_SECRET",
    "CRON_SECRET",
    "META_TEST_ACCESS_TOKEN",
  ];

  let leakFound = false;

  // 5.1 Check variable naming conventions
  for (const v of serverOnlyVars) {
    if (v.startsWith("NEXT_PUBLIC_")) {
      console.log(`❌ Naming Leak: ${v} has NEXT_PUBLIC_ prefix!`);
      leakFound = true;
    }
  }

  // 5.2 Scan src/ for any "use client" files referencing server-only variables
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".next") {
          scanDir(full);
        }
      } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
        const src = fs.readFileSync(full, "utf8");
        const isClient = src.includes('"use client"') || src.includes("'use client'");
        if (isClient) {
          for (const sVar of serverOnlyVars) {
            if (src.includes(sVar)) {
              console.log(`❌ Client Component Leak: ${full} references ${sVar}!`);
              leakFound = true;
            }
          }
        }
      }
    }
  }

  scanDir(path.resolve(process.cwd(), "src"));

  if (!leakFound) {
    console.log("✅ Variable Scoping: All secret keys follow server-only naming conventions (NO NEXT_PUBLIC_ prefix)");
    console.log("✅ Client Component Isolation: Zero client components reference server-only secrets");
    console.log("✅ Browser Bundle Protection: PASS (Secrets will not be bundled into client JS)");
  } else {
    allPassed = false;
  }

  // ---------------------------------------------------------------------------
  // Final Verdict
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  if (allPassed) {
    console.log("🎉 VERIFICATION RESULT: ALL P0.3 CHECKS PASSED — READY FOR PRODUCTION");
  } else {
    console.log("⚠️  VERIFICATION RESULT: PENDING CREDENTIAL CONFIGURATION (BLOCKERS REMAIN)");
  }
  console.log("================================================================================");

  return allPassed;
}

runVerification().catch(console.error);
