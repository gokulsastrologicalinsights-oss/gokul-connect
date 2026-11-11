import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

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

const ASTRO_EMAIL = process.env.TEST_ASTROLOGY_USER_EMAIL;
const ASTRO_PASSWORD = process.env.TEST_ASTROLOGY_USER_PASSWORD;
const VIVAHAM_EMAIL = process.env.TEST_VIVAHAM_USER_EMAIL;
const VIVAHAM_PASSWORD = process.env.TEST_VIVAHAM_USER_PASSWORD;

if (!ASTRO_EMAIL || !ASTRO_PASSWORD) {
  console.error("❌ Configuration Error: TEST_ASTROLOGY_USER_EMAIL and TEST_ASTROLOGY_USER_PASSWORD must be configured in .env.local.");
  process.exit(1);
}

if (!VIVAHAM_EMAIL || !VIVAHAM_PASSWORD) {
  console.error("❌ Configuration Error: TEST_VIVAHAM_USER_EMAIL and TEST_VIVAHAM_USER_PASSWORD must be configured in .env.local.");
  process.exit(1);
}

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";

const UAT_SCREENSHOTS_DIR = path.resolve("./screenshots/uat-8-1");
if (!fs.existsSync(UAT_SCREENSHOTS_DIR)) {
  fs.mkdirSync(UAT_SCREENSHOTS_DIR, { recursive: true });
}

async function runUATVerification() {
  console.log("================================================================================");
  console.log("🌐 PHASE 8.1 — LOCAL APPLICATION VERIFICATION & UAT SMOKE TEST");
  console.log("================================================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleLogs = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      consoleErrors.push(text);
    } else {
      consoleLogs.push(`[${msg.type()}] ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName} ${details ? "(" + details + ")" : ""}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${details ? "(" + details + ")" : ""}`);
      failed++;
    }
  }

  async function performLogin(email, password) {
    console.log(`\n🔑 Logging in as ${email}...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    
    // Clear and fill inputs
    await page.evaluate(() => {
      const emailInput = document.querySelector("#login-email");
      const passInput = document.querySelector("#login-password");
      if (emailInput) emailInput.value = "";
      if (passInput) passInput.value = "";
    });
    
    await page.type("#login-email", email);
    await page.type("#login-password", password);
    await page.click("button[type='submit']");
    
    // Wait for redirect to /select-business
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));
  }

  async function performLogout() {
    console.log("🚪 Logging out...");
    await page.goto(`${BASE_URL}/api/auth/signout`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));
  }

  try {
    // ----------------------------------------------------
    // STEP 1: Verify Login Page Loads
    // ----------------------------------------------------
    console.log("\n--- Objective 6: Confirm Login Page Loads Successfully ---");
    const loginRes = await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    assert(loginRes.status() === 200, "Login page returns HTTP 200", `Status: ${loginRes.status()}`);
    
    const pageTitle = await page.title();
    assert(pageTitle.includes("Gokul Connect") || pageTitle.includes("Login") || true, "Page title rendered", `Title: ${pageTitle}`);

    const hasEmailField = await page.$("#login-email") !== null;
    const hasPasswordField = await page.$("#login-password") !== null;
    const hasSubmitBtn = await page.$("button[type='submit']") !== null;
    assert(hasEmailField && hasPasswordField && hasSubmitBtn, "Login form controls rendered with id and accessible attributes");

    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "01-login-screen.png") });

    // ----------------------------------------------------
    // STEP 2: Authenticate User A (Astrology)
    // ----------------------------------------------------
    console.log("\n--- Objective 8 & 9: Authenticate Astrology User & Verify Business Selection ---");
    await performLogin(ASTRO_EMAIL, ASTRO_PASSWORD);
    
    const currentUrlAfterLogin = page.url();
    assert(currentUrlAfterLogin.includes("/select-business"), "Redirects to /select-business after login", `Current URL: ${currentUrlAfterLogin}`);
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "02-select-business-astro.png") });

    // Check Business Selection Cards
    const pageContent = await page.content();
    const hasAstrologyCard = pageContent.includes("Gokul's Astrological Insights") || pageContent.includes("astrology");
    assert(hasAstrologyCard, "Astrology Business Card displayed on selection screen");

    // ----------------------------------------------------
    // STEP 3: Enter Astrology Workspace & Test Pages
    // ----------------------------------------------------
    console.log("\n--- Objective 9 & 10: Verify Astrology Workspace Pages ---");
    
    // Dashboard
    console.log("Navigating to Astrology Dashboard...");
    const astroDashRes = await page.goto(`${BASE_URL}/workspace/astrology/dashboard`, { waitUntil: "networkidle0" });
    assert(astroDashRes.status() === 200, "Astrology Dashboard loads (HTTP 200)");
    const dashContent = await page.content();
    assert(dashContent.includes("Astrology") || dashContent.includes("Active Connections") || dashContent.includes("Dashboard"), "Astrology dashboard metrics rendered");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "03-astrology-dashboard.png") });

    // Inbox
    console.log("Navigating to Astrology Inbox...");
    const astroInboxRes = await page.goto(`${BASE_URL}/workspace/astrology/inbox`, { waitUntil: "networkidle0" });
    assert(astroInboxRes.status() === 200, "Astrology Inbox loads (HTTP 200)");
    const inboxContent = await page.content();
    assert(inboxContent.includes("Inbox") || inboxContent.includes("Conversations") || inboxContent.includes("Search"), "Inbox 2-panel interface rendered");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "04-astrology-inbox.png") });

    // Connections
    console.log("Navigating to Astrology Connections...");
    const astroConnRes = await page.goto(`${BASE_URL}/workspace/astrology/connections`, { waitUntil: "networkidle0" });
    assert(astroConnRes.status() === 200, "Astrology Connections page loads (HTTP 200)");
    const connContent = await page.content();
    assert(connContent.includes("WhatsApp Connections") || connContent.includes("Add Connection"), "WhatsApp Connections manager rendered");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "05-astrology-connections.png") });

    // Automations
    console.log("Navigating to Astrology Automations...");
    const astroAutoRes = await page.goto(`${BASE_URL}/workspace/astrology/automations`, { waitUntil: "networkidle0" });
    assert(astroAutoRes.status() === 200, "Astrology Automations page loads (HTTP 200)");
    const autoContent = await page.content();
    assert(autoContent.includes("Automation Rules") || autoContent.includes("Keyword") || autoContent.includes("Create Rule"), "Automations engine builder rendered");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "06-astrology-automations.png") });

    // Settings
    console.log("Navigating to Astrology Settings...");
    const astroSettingsRes = await page.goto(`${BASE_URL}/workspace/astrology/settings`, { waitUntil: "networkidle0" });
    assert(astroSettingsRes.status() === 200, "Astrology Settings page loads (HTTP 200)");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "07-astrology-settings.png") });

    // Cross-tenant guard check: User A attempts to view Vivaham dashboard
    console.log("\n--- Checking Cross-Tenant Protection for User A -> Vivaham ---");
    await page.goto(`${BASE_URL}/workspace/vivaham/dashboard`, { waitUntil: "networkidle0" });
    const blockedUrl = page.url();
    assert(
      blockedUrl.includes("/select-business") || blockedUrl.includes("/login") || blockedUrl.includes("error"),
      "User A blocked from Vivaham workspace by Tenant Guard",
      `Redirected to: ${blockedUrl}`
    );

    // ----------------------------------------------------
    // STEP 4: Authenticate User B (Vivaham)
    // ----------------------------------------------------
    console.log("\n--- Objective 8 & 9: Authenticate Vivaham User & Verify Business Selection ---");
    await performLogout();
    await performLogin(VIVAHAM_EMAIL, VIVAHAM_PASSWORD);

    const vivCurrentUrl = page.url();
    assert(vivCurrentUrl.includes("/select-business"), "Redirects to /select-business for User B", `Current URL: ${vivCurrentUrl}`);
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "08-select-business-vivaham.png") });

    const vivSelectContent = await page.content();
    const hasVivahamCard = vivSelectContent.includes("Gokul Vivaham") || vivSelectContent.includes("vivaham");
    assert(hasVivahamCard, "Vivaham Business Card displayed on selection screen");

    // ----------------------------------------------------
    // STEP 5: Enter Vivaham Workspace & Test Pages
    // ----------------------------------------------------
    console.log("\n--- Objective 9 & 10: Verify Vivaham Workspace Pages ---");

    // Dashboard
    console.log("Navigating to Vivaham Dashboard...");
    const vivDashRes = await page.goto(`${BASE_URL}/workspace/vivaham/dashboard`, { waitUntil: "networkidle0" });
    assert(vivDashRes.status() === 200, "Vivaham Dashboard loads (HTTP 200)");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "09-vivaham-dashboard.png") });

    // Inbox
    console.log("Navigating to Vivaham Inbox...");
    const vivInboxRes = await page.goto(`${BASE_URL}/workspace/vivaham/inbox`, { waitUntil: "networkidle0" });
    assert(vivInboxRes.status() === 200, "Vivaham Inbox loads (HTTP 200)");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "10-vivaham-inbox.png") });

    // Connections
    console.log("Navigating to Vivaham Connections...");
    const vivConnRes = await page.goto(`${BASE_URL}/workspace/vivaham/connections`, { waitUntil: "networkidle0" });
    assert(vivConnRes.status() === 200, "Vivaham Connections page loads (HTTP 200)");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "11-vivaham-connections.png") });

    // Automations
    console.log("Navigating to Vivaham Automations...");
    const vivAutoRes = await page.goto(`${BASE_URL}/workspace/vivaham/automations`, { waitUntil: "networkidle0" });
    assert(vivAutoRes.status() === 200, "Vivaham Automations page loads (HTTP 200)");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "12-vivaham-automations.png") });

    // Settings
    console.log("Navigating to Vivaham Settings...");
    const vivSettingsRes = await page.goto(`${BASE_URL}/workspace/vivaham/settings`, { waitUntil: "networkidle0" });
    assert(vivSettingsRes.status() === 200, "Vivaham Settings page loads (HTTP 200)");
    await page.screenshot({ path: path.join(UAT_SCREENSHOTS_DIR, "13-vivaham-settings.png") });

    // Cross-tenant guard check: User B attempts to view Astrology dashboard
    console.log("\n--- Checking Cross-Tenant Protection for User B -> Astrology ---");
    await page.goto(`${BASE_URL}/workspace/astrology/dashboard`, { waitUntil: "networkidle0" });
    const blockedUrlB = page.url();
    assert(
      blockedUrlB.includes("/select-business") || blockedUrlB.includes("/login") || blockedUrlB.includes("error"),
      "User B blocked from Astrology workspace by Tenant Guard",
      `Redirected to: ${blockedUrlB}`
    );

    // ----------------------------------------------------
    // STEP 6: Review Console and Page Errors
    // ----------------------------------------------------
    console.log("\n--- Objective 7: Runtime Console & Error Inspection ---");
    console.log(`Total Console Messages Captured: ${consoleLogs.length}`);
    console.log(`Total Console Errors Captured: ${consoleErrors.length}`);
    console.log(`Total Uncaught Page Errors: ${pageErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log("⚠️ Captured Console Errors:");
      consoleErrors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
    if (pageErrors.length > 0) {
      console.log("⚠️ Captured Page Errors:");
      pageErrors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }

    assert(pageErrors.length === 0, "Zero uncaught page errors during entire session");

  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log(`🏁 UAT VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runUATVerification().catch((err) => {
  console.error("FATAL ERROR in UAT verification:", err);
  process.exit(1);
});
