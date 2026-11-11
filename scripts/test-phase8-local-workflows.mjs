import http from "http";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

// Load .env.local into process.env if present
if (fs.existsSync(".env.local")) {
  const envContent = fs.readFileSync(".env.local", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...rest] = trimmed.split("=");
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

console.log("================================================================================");
console.log("🌐 GOKUL CONNECT — PHASE 8 LOCAL SERVER WORKFLOW & ENDPOINT VALIDATION");
console.log("================================================================================");

// Helper for HTTP requests
function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, {
      method: options.method || "GET",
      headers: options.headers || {},
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function waitForServer(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request("/login");
      if (res.status === 200) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

async function run() {
  console.log("🚀 Starting Next.js production server on port 3000...");
  const server = spawn("npm", ["start"], {
    cwd: process.cwd(),
    shell: true,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe",
  });

  server.stdout.on("data", (d) => {
    // console.log("[Next stdout]", d.toString().trim());
  });
  server.stderr.on("data", (d) => {
    // console.error("[Next stderr]", d.toString().trim());
  });

  const isReady = await waitForServer();
  if (!isReady) {
    console.error("❌ Failed to start Next.js server on port 3000 within timeout.");
    server.kill();
    process.exit(1);
  }
  console.log("✅ Next.js server is online and responding at", BASE_URL);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Root redirect
    console.log("\n--- Testing Root Route & Navigation ---");
    const resRoot = await request("/");
    assert(resRoot.status === 307 || resRoot.status === 308, "GET / redirects (Status: " + resRoot.status + ")");
    assert(resRoot.headers.location?.includes("/select-business"), "GET / redirects to /select-business");

    // 2. Unauthenticated access to /select-business
    console.log("\n--- Testing Unauthenticated Access Guards ---");
    const resSelect = await request("/select-business");
    assert(resSelect.status === 307 || resSelect.status === 308 || resSelect.status === 200, "GET /select-business responds with redirect or page (Status: " + resSelect.status + ")");

    // 3. Login page
    console.log("\n--- Testing Auth Pages Rendering ---");
    const resLogin = await request("/login");
    assert(resLogin.status === 200, "GET /login returns HTTP 200");
    assert(resLogin.body.includes("Sign in to your account"), "GET /login contains sign-in heading");
    assert(resLogin.body.includes("login-email"), "GET /login contains accessible login-email input");

    // 4. Forgot Password page
    const resForgot = await request("/forgot-password");
    assert(resForgot.status === 200, "GET /forgot-password returns HTTP 200");
    assert(resForgot.body.includes("Password Recovery"), "GET /forgot-password contains recovery heading");
    assert(resForgot.body.includes("reset-email"), "GET /forgot-password contains accessible reset-email input");

    // 5. Update Password page
    const resUpdate = await request("/update-password");
    assert(resUpdate.status === 200, "GET /update-password returns HTTP 200");
    assert(resUpdate.body.includes("Set New Password"), "GET /update-password contains set password heading");
    assert(resUpdate.body.includes("update-password-input"), "GET /update-password contains accessible password input");

    // 6. Direct workspace protection
    console.log("\n--- Testing Unauthenticated Workspace Isolation ---");
    const resAstro = await request("/workspace/astrology/dashboard");
    assert(resAstro.status === 307 || resAstro.status === 308, "GET /workspace/astrology/dashboard redirects unauthenticated user (Status: " + resAstro.status + ")");
    assert(resAstro.headers.location?.includes("/login"), "Unauthenticated astrology access redirects to /login");

    const resVivaham = await request("/workspace/vivaham/dashboard");
    assert(resVivaham.status === 307 || resVivaham.status === 308, "GET /workspace/vivaham/dashboard redirects unauthenticated user (Status: " + resVivaham.status + ")");
    assert(resVivaham.headers.location?.includes("/login"), "Unauthenticated vivaham access redirects to /login");

    // 7. Webhook Verification GET
    console.log("\n--- Testing Webhook Route Handshake & Cryptography ---");
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || "test_token";
    const resWebhookGet = await request(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=chall_123456`);
    assert(resWebhookGet.status === 200, "GET /api/webhooks/whatsapp handshake returns HTTP 200");
    assert(resWebhookGet.body === "chall_123456", "GET /api/webhooks/whatsapp returns expected challenge text");

    const resWebhookGetBad = await request("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=chall_123456");
    assert(resWebhookGetBad.status === 403, "GET /api/webhooks/whatsapp handshake rejects wrong token with HTTP 403");

    // 8. Webhook POST signature validation
    const resWebhookPostNoSig = await request("/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ object: "whatsapp_business_account" }),
    });
    assert(resWebhookPostNoSig.status === 401, "POST /api/webhooks/whatsapp without signature returns HTTP 401");

    // 9. Cron API Authorization
    console.log("\n--- Testing Cron API Route Security ---");
    const resCronUnauthorized = await request("/api/cron/process-automation-jobs");
    assert(resCronUnauthorized.status === 401, "GET /api/cron/process-automation-jobs without token returns HTTP 401");

    const cronSecret = process.env.CRON_SECRET;
    const resCronAuthorized = await request("/api/cron/process-automation-jobs", {
      headers: {
        authorization: `Bearer ${cronSecret}`,
      },
    });
    assert(resCronAuthorized.status === 200, "GET /api/cron/process-automation-jobs with valid Bearer returns HTTP 200");
    const cronData = JSON.parse(resCronAuthorized.body);
    assert(cronData.success === true, "Cron job execution returns success: true");
    assert(typeof cronData.queue?.claimedCount === "number", "Cron job execution returns claimed queue count");

    // 10. Auth Callback route
    console.log("\n--- Testing Auth Callback Route ---");
    const resCallbackMissingCode = await request("/auth/callback");
    assert(resCallbackMissingCode.status === 307 || resCallbackMissingCode.status === 308, "GET /auth/callback without code redirects (Status: " + resCallbackMissingCode.status + ")");
    assert(resCallbackMissingCode.headers.location?.includes("/login?error=auth_callback_failed"), "Missing code redirects to /login?error=auth_callback_failed");

  } finally {
    console.log("\n🛑 Gracefully shutting down Next.js local server...");
    try {
      // On Windows, kill process tree cleanly
      spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { shell: true, stdio: "ignore" });
    } catch {}
  }

  console.log(`\n================================================================================`);
  console.log(`📊 LOCAL WORKFLOW RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log(`================================================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
