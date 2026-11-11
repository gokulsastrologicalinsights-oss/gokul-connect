import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

// 1. Load env variables
function loadEnv() {
  const envPath = path.resolve("./.env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[trimmed.slice(0, eqIdx).trim()] = val;
    }
  }
  return env;
}

const env = loadEnv();
const ASTRO_EMAIL = env.TEST_ASTROLOGY_USER_EMAIL;
const ASTRO_PASSWORD = env.TEST_ASTROLOGY_USER_PASSWORD;
const VIVAHAM_EMAIL = env.TEST_VIVAHAM_USER_EMAIL;
const VIVAHAM_PASSWORD = env.TEST_VIVAHAM_USER_PASSWORD;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve("./screenshots/uat-phase10-1");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runUat() {
  console.log("=== PHASE 10.1 — CRM & ANALYTICS LOCAL BROWSER UAT ===");
  console.log(`Astrology User: ${ASTRO_EMAIL}`);
  console.log(`Vivaham User: ${VIVAHAM_EMAIL}`);
  console.log(`Target URL: ${BASE_URL}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const testResults = {
    crm: {},
    analytics: {},
    tenantIsolation: {},
    responsive: {},
    errors: [],
  };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error]: ${msg.text()}`);
      testResults.errors.push(`Console: ${msg.text()}`);
    }
  });

  page.on("pageerror", (err) => {
    console.error(`[Browser Page Error]: ${err.message}`);
    testResults.errors.push(`PageError: ${err.message}`);
  });

  try {
    // ----------------------------------------------------
    // STEP 1: LOGIN AS ASTROLOGY USER
    // ----------------------------------------------------
    console.log("\n--- STEP 1: Login as Astrology User ---");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type("#login-email", ASTRO_EMAIL);
    await page.type("#login-password", ASTRO_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`Current URL after login: ${page.url()}`);

    // If redirected to select-business, select astrology
    if (page.url().includes("/select-business")) {
      console.log("On select-business, clicking Astrology workspace...");
      await page.waitForSelector("a[href*='/workspace/astrology']", { timeout: 5000 });
      await page.click("a[href*='/workspace/astrology']");
      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    // ----------------------------------------------------
    // STEP 2: TEST ASTROLOGY CRM
    // ----------------------------------------------------
    console.log("\n--- STEP 2: Testing Astrology CRM ---");
    await page.goto(`${BASE_URL}/workspace/astrology/crm`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-astrology-crm-initial-1920.png"), fullPage: true });

    // Verify Title and Subtitle
    const crmHeading = await page.$eval("h1", (el) => el.textContent?.trim());
    console.log(`CRM Heading: "${crmHeading}"`);
    testResults.crm.astroHeading = crmHeading?.includes("Gokul's Astrological Insights");

    // Check KPI metric cards in CRM
    const crmKpis = await page.$$eval(".grid > div", (cards) =>
      cards.map((c) => ({
        text: c.textContent?.trim()?.replace(/\s+/g, " "),
      }))
    );
    console.log("CRM Top Metrics count:", crmKpis.length);

    // Check Categories rendered in Astrology
    const categoriesText = await page.$$eval("select option", (opts) => opts.map((o) => o.textContent?.trim()));
    console.log("Select options sample:", categoriesText.slice(0, 10));

    // Test Contact Creation
    console.log("Testing Contact Creation Modal...");
    const allButtons = await page.$$eval("button", (btns) => btns.map((b) => b.textContent?.trim()));
    console.log("Available CRM buttons:", allButtons.filter(Boolean));

    // Look for button that contains 'Add Contact' or click button with text
    const createBtnHandle = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.find((b) => b.textContent.includes("Add Contact") || b.textContent.includes("New Contact"));
    });

    if (createBtnHandle.asElement()) {
      await createBtnHandle.asElement().click();
      await new Promise((r) => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-astrology-crm-add-modal.png") });
      console.log("Opened Add Contact modal.");

      // Fill in contact form
      const modalInputs = await page.$$eval("div[role='dialog'] input, form input", (inputs) =>
        inputs.map((i) => ({ id: i.id, name: i.name, placeholder: i.placeholder, type: i.type }))
      );
      console.log("Add Contact Modal inputs:", modalInputs);

      // Fill inputs: Name, Phone, Email
      const nameInput = await page.$("input[placeholder*='Full Name'], input[placeholder*='name' i]");
      if (nameInput) await nameInput.type("UAT Synthetic Client");

      const phoneInput = await page.$("input[placeholder*='98765' i], input[placeholder*='phone' i], input[type='tel']");
      if (phoneInput) await phoneInput.type("919876543210");

      const emailInput = await page.$("input[type='email']");
      if (emailInput) await emailInput.type("uat-synthetic@example.com");

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-astrology-crm-add-form-filled.png") });

      // Click submit
      const submitBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("div[role='dialog'] button, form button"));
        return btns.find((b) => b.textContent.includes("Create Contact"));
      });

      if (submitBtn.asElement()) {
        await submitBtn.asElement().click();
        await new Promise((r) => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-astrology-crm-after-create.png") });
        console.log("Submitted Add Contact form.");
      }
    }

    // ----------------------------------------------------
    // STEP 3: TEST ASTROLOGY ANALYTICS
    // ----------------------------------------------------
    console.log("\n--- STEP 3: Testing Astrology Analytics ---");
    await page.goto(`${BASE_URL}/workspace/astrology/analytics`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-astrology-analytics-initial-1920.png"), fullPage: true });

    const analyticsHeading = await page.$eval("h1", (el) => el.textContent?.trim());
    console.log(`Analytics Heading: "${analyticsHeading}"`);
    testResults.analytics.astroHeading = analyticsHeading?.includes("Gokul's Astrological Insights");

    // Check IST Timezone badge
    const istBadge = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("*")).some((el) => el.textContent?.includes("Asia/Kolkata"));
    });
    console.log(`Asia/Kolkata timezone badge present: ${istBadge}`);
    testResults.analytics.istBadge = istBadge;

    // Check KPI summary cards
    const kpiCards = await page.$$eval(".grid div", (divs) =>
      divs
        .map((d) => d.textContent?.trim()?.replace(/\s+/g, " "))
        .filter((t) => t && (t.includes("Inbound") || t.includes("Delivery Rate") || t.includes("Contacts") || t.includes("Conversations")))
    );
    console.log("KPI Cards Sample:", kpiCards.slice(0, 5));

    // Check SVG Charts rendered
    const svgCount = await page.$$eval("svg", (svgs) => svgs.length);
    console.log(`Total SVG elements rendered in Analytics: ${svgCount}`);
    testResults.analytics.svgCount = svgCount;

    // Test Date Preset buttons
    const datePresets = await page.$$eval("button", (btns) =>
      btns
        .map((b) => b.textContent?.trim())
        .filter((t) => ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Previous Month", "Custom Range"].includes(t))
    );
    console.log("Date preset buttons found:", datePresets);
    testResults.analytics.datePresets = datePresets;

    // Test CSV Export in Analytics
    const exportCsvBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.find((b) => b.textContent.includes("Export CSV") || b.textContent.includes("Download"));
    });
    if (exportCsvBtn.asElement()) {
      console.log("Found Analytics CSV export button.");
      testResults.analytics.exportButtonFound = true;
    }

    // ----------------------------------------------------
    // STEP 4: TEST TENANT ISOLATION (URL Tampering)
    // ----------------------------------------------------
    console.log("\n--- STEP 4: Testing Tenant Isolation (Astrology user accessing Vivaham) ---");
    await page.goto(`${BASE_URL}/workspace/vivaham/crm`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    const isolationCrmUrl = page.url();
    const isolationCrmContent = await page.content();
    const blockedFromVivahamCrm =
      isolationCrmUrl.includes("/select-business") ||
      isolationCrmUrl.includes("/login") ||
      isolationCrmContent.includes("Unauthorized") ||
      isolationCrmContent.includes("Access Denied") ||
      isolationCrmContent.includes("Return to Business Selection");
    console.log(`Astrology accessing Vivaham CRM: URL=${isolationCrmUrl}, Blocked=${blockedFromVivahamCrm}`);
    testResults.tenantIsolation.astroBlockedFromVivahamCrm = blockedFromVivahamCrm;

    await page.goto(`${BASE_URL}/workspace/vivaham/analytics`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    const isolationAnalyticsUrl = page.url();
    const isolationAnalyticsContent = await page.content();
    const blockedFromVivahamAnalytics =
      isolationAnalyticsUrl.includes("/select-business") ||
      isolationAnalyticsUrl.includes("/login") ||
      isolationAnalyticsContent.includes("Unauthorized") ||
      isolationAnalyticsContent.includes("Access Denied") ||
      isolationAnalyticsContent.includes("Return to Business Selection");
    console.log(`Astrology accessing Vivaham Analytics: URL=${isolationAnalyticsUrl}, Blocked=${blockedFromVivahamAnalytics}`);
    testResults.tenantIsolation.astroBlockedFromVivahamAnalytics = blockedFromVivahamAnalytics;

    // ----------------------------------------------------
    // STEP 5: LOGOUT AND LOGIN AS VIVAHAM USER
    // ----------------------------------------------------
    console.log("\n--- STEP 5: Logging out and Logging in as Vivaham User ---");
    // Clear cookies / storage
    const client = await page.createCDPSession();
    await client.send("Network.clearBrowserCookies");
    await client.send("Network.clearBrowserCache");

    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type("#login-email", VIVAHAM_EMAIL);
    await page.type("#login-password", VIVAHAM_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    console.log(`Current URL after Vivaham login: ${page.url()}`);

    if (page.url().includes("/select-business")) {
      console.log("On select-business, clicking Vivaham workspace...");
      await page.waitForSelector("a[href*='/workspace/vivaham']", { timeout: 5000 });
      await page.click("a[href*='/workspace/vivaham']");
      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    // ----------------------------------------------------
    // STEP 6: TEST VIVAHAM CRM & ANALYTICS
    // ----------------------------------------------------
    console.log("\n--- STEP 6: Testing Vivaham CRM & Analytics ---");
    await page.goto(`${BASE_URL}/workspace/vivaham/crm`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-vivaham-crm-initial-1920.png"), fullPage: true });

    const vivahamCrmHeading = await page.$eval("h1", (el) => el.textContent?.trim());
    console.log(`Vivaham CRM Heading: "${vivahamCrmHeading}"`);
    testResults.crm.vivahamHeading = vivahamCrmHeading?.includes("Gokul Vivaham");

    await page.goto(`${BASE_URL}/workspace/vivaham/analytics`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-vivaham-analytics-initial-1920.png"), fullPage: true });

    const vivahamAnalyticsHeading = await page.$eval("h1", (el) => el.textContent?.trim());
    console.log(`Vivaham Analytics Heading: "${vivahamAnalyticsHeading}"`);
    testResults.analytics.vivahamHeading = vivahamAnalyticsHeading?.includes("Gokul Vivaham");

    // Vivaham trying to access Astrology
    await page.goto(`${BASE_URL}/workspace/astrology/crm`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    const vivBlockedFromAstroCrm =
      page.url().includes("/select-business") ||
      page.url().includes("/login") ||
      (await page.content()).includes("Return to Business Selection");
    console.log(`Vivaham accessing Astrology CRM blocked: ${vivBlockedFromAstroCrm}`);
    testResults.tenantIsolation.vivahamBlockedFromAstroCrm = vivBlockedFromAstroCrm;

    // ----------------------------------------------------
    // STEP 7: RESPONSIVE UI AUDIT (1920, 1366, 768, 390, 360)
    // ----------------------------------------------------
    console.log("\n--- STEP 7: Responsive UI Audit across 5 resolutions ---");
    const viewports = [
      { name: "1920px", width: 1920, height: 1080 },
      { name: "1366px", width: 1366, height: 768 },
      { name: "768px", width: 768, height: 1024 },
      { name: "390px", width: 390, height: 844 },
      { name: "360px", width: 360, height: 800 },
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      // Test Vivaham CRM
      await page.goto(`${BASE_URL}/workspace/vivaham/crm`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 800));
      const crmOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `08-vivaham-crm-${vp.name}.png`) });

      // Test Vivaham Analytics
      await page.goto(`${BASE_URL}/workspace/vivaham/analytics`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 800));
      const analyticsOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `09-vivaham-analytics-${vp.name}.png`) });

      console.log(`Viewport ${vp.name}: CRM Overflow=${crmOverflow}, Analytics Overflow=${analyticsOverflow}`);
      testResults.responsive[vp.name] = {
        crmNoOverflow: !crmOverflow,
        analyticsNoOverflow: !analyticsOverflow,
      };
    }

    console.log("\n=== TEST RUN COMPLETED ===");
    console.log("Summary:", JSON.stringify(testResults, null, 2));
  } catch (err) {
    console.error("FATAL UAT ERROR:", err);
  } finally {
    await browser.close();
  }
}

runUat();
