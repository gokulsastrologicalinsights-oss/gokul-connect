import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envContent = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of envContent.split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
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
const SCREENSHOT_DIR = path.resolve("./screenshots/uat-phase10-1/analytics-deep");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testAnalyticsDeep() {
  console.log("=== PHASE 10.1 — DEEP ANALYTICS FUNCTIONAL TEST ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const analyticsReport = {
    astrology: {},
    vivaham: {},
    crossTenantChecks: {},
  };

  try {
    // 1. Astrology Login
    console.log("Logging in as Astrology user...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type("#login-email", ASTRO_EMAIL);
    await page.type("#login-password", ASTRO_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    if (page.url().includes("/select-business")) {
      await page.waitForSelector("a[href*='/workspace/astrology']");
      await page.click("a[href*='/workspace/astrology']");
      await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    await page.goto(`${BASE_URL}/workspace/astrology/analytics`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-analytics-full.png"), fullPage: true });

    // 1. All KPI Cards
    const kpiData = await page.$$eval(".grid > div", (cards) =>
      cards
        .map((c) => c.textContent?.trim()?.replace(/\s+/g, " "))
        .filter((t) => t && (t.includes("Messaging Volume") || t.includes("Delivery Performance") || t.includes("Contacts") || t.includes("Conversations") || t.includes("Automation")))
    );
    console.log("Astrology KPI cards found:", kpiData.length);
    analyticsReport.astrology.kpiCards = kpiData;

    // 2. Charts Verification (SVG charts)
    const charts = await page.$$eval("div.rounded-2xl", (containers) =>
      containers
        .map((c) => ({
          title: c.querySelector("h3, h4")?.textContent?.trim(),
          hasSvg: !!c.querySelector("svg"),
        }))
        .filter((c) => c.title)
    );
    console.log("Astrology Chart containers found:", charts);
    analyticsReport.astrology.charts = charts;

    // 3. Timezone correctness
    const istVisible = await page.evaluate(() => document.body.textContent?.includes("Asia/Kolkata"));
    console.log(`Astrology IST Timezone indicator: ${istVisible}`);
    analyticsReport.astrology.istTimezone = istVisible;

    // 4. Date Presets Interaction
    console.log("Testing Date Presets in Astrology...");
    const presetNames = ["Today", "Yesterday", "Last 7 Days", "Last 30 Days", "This Month", "Previous Month"];
    const presetResults = {};

    for (const preset of presetNames) {
      const clicked = await page.evaluate((name) => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === name);
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, preset);

      if (clicked) {
        await new Promise((r) => setTimeout(r, 600));
        const activeText = await page.evaluate(() => document.querySelector(".bg-indigo-600, .bg-slate-900, [aria-pressed='true']")?.textContent?.trim() || "");
        presetResults[preset] = true;
      } else {
        presetResults[preset] = false;
      }
    }
    console.log("Preset click results:", presetResults);
    analyticsReport.astrology.presets = presetResults;

    // 5. Test Custom Date Range Modal
    const customClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Custom Range");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (customClicked) {
      await new Promise((r) => setTimeout(r, 500));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-custom-date-modal.png") });
      const modalOpen = await page.evaluate(() => !!document.querySelector("div[role='dialog']"));
      console.log(`Custom date range modal opened: ${modalOpen}`);
      analyticsReport.astrology.customDateModal = modalOpen;

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll("div[role='dialog'] button")).find((b) => b.textContent?.trim() === "Cancel");
        if (cancelBtn) cancelBtn.click();
      });
      await new Promise((r) => setTimeout(r, 500));
    }

    // 6. Test CSV Export in Astrology
    console.log("Testing Analytics CSV Export...");
    // Let's test the export endpoint directly using fetch from page context
    const csvExportResult = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/workspace/astrology/analytics?format=csv&preset=7d");
        const status = res.status;
        const contentType = res.headers.get("content-type");
        const disposition = res.headers.get("content-disposition");
        const text = await res.text();
        return {
          status,
          contentType,
          disposition,
          hasBom: text.startsWith("\uFEFF"),
          hasHeaders: text.includes("Date,Total Messages,Inbound,Outbound"),
          snippet: text.slice(0, 150),
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log("Analytics CSV Export API Result:", csvExportResult);
    analyticsReport.astrology.csvExport = csvExportResult;

    // 7. Vivaham Test
    console.log("\nSwitching to Vivaham user...");
    const client = await page.createCDPSession();
    await client.send("Network.clearBrowserCookies");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type("#login-email", VIVAHAM_EMAIL);
    await page.type("#login-password", VIVAHAM_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    if (page.url().includes("/select-business")) {
      await page.waitForSelector("a[href*='/workspace/vivaham']");
      await page.click("a[href*='/workspace/vivaham']");
      await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    await page.goto(`${BASE_URL}/workspace/vivaham/analytics`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "vivaham-analytics-full.png"), fullPage: true });

    const vivahamKpi = await page.$$eval(".grid > div", (cards) =>
      cards
        .map((c) => c.textContent?.trim()?.replace(/\s+/g, " "))
        .filter((t) => t && (t.includes("Messaging Volume") || t.includes("Delivery Performance") || t.includes("Contacts") || t.includes("Conversations") || t.includes("Automation")))
    );
    console.log("Vivaham KPI cards found:", vivahamKpi.length);
    analyticsReport.vivaham.kpiCards = vivahamKpi;

    // Vivaham Business Report Card check
    const reportText = await page.evaluate(() => document.body.textContent || "");
    const hasVivahamMatrimony = reportText.includes("Groom") || reportText.includes("Bride") || reportText.includes("Matrimony") || reportText.includes("Vivaham");
    console.log(`Vivaham-specific Matrimony categories present: ${hasVivahamMatrimony}`);
    analyticsReport.vivaham.matrimonyEnquiries = hasVivahamMatrimony;

    // Cross-tenant check: Vivaham user attempting to fetch Astrology analytics CSV
    const crossExportCheck = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/workspace/astrology/analytics?export=csv&preset=7d");
        return {
          status: res.status,
          statusText: res.statusText,
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log("Cross-tenant Analytics CSV request (Vivaham requesting Astrology):", crossExportCheck);
    analyticsReport.crossTenantChecks.vivahamCallingAstroApi = crossExportCheck;

    console.log("\n=== DEEP ANALYTICS TEST COMPLETED ===");
  } catch (err) {
    console.error("Deep Analytics Test Error:", err);
  } finally {
    await browser.close();
  }
}

testAnalyticsDeep();
