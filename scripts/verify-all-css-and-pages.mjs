import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve("./screenshots/css-verification");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function verifyPage(page, urlPath, name, viewport = { width: 1280, height: 800 }) {
  await page.setViewport(viewport);
  const consoleErrors = [];
  const consoleWarnings = [];
  const failedRequests = [];

  const onConsole = (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    if (msg.type() === "warning" && msg.text().toLowerCase().includes("hydration")) {
      consoleWarnings.push(msg.text());
    }
  };
  const onRequestFailed = (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure() });
  };

  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);

  console.log(`\n--- Inspecting: ${name} (${urlPath}) at ${viewport.width}x${viewport.height} ---`);
  const response = await page.goto(`${BASE_URL}${urlPath}`, { waitUntil: "networkidle0" });
  const status = response ? response.status() : "no-response";

  const data = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets).map((s) => ({
      href: s.href,
      rules: s.cssRules ? s.cssRules.length : -1,
    }));
    const bodyComputed = window.getComputedStyle(document.body);
    const h1 = document.querySelector("h1, h2, h3");
    const h1Computed = h1 ? window.getComputedStyle(h1) : null;
    const btn = document.querySelector("button");
    const btnComputed = btn ? window.getComputedStyle(btn) : null;
    const svg = document.querySelector("svg");
    const svgBounding = svg ? svg.getBoundingClientRect() : null;

    return {
      sheets,
      bodyBg: bodyComputed.backgroundColor,
      bodyFont: bodyComputed.fontFamily,
      headingColor: h1Computed ? h1Computed.color : null,
      btnBg: btnComputed ? btnComputed.backgroundColor : null,
      svgWidth: svgBounding ? Math.round(svgBounding.width) : null,
      svgHeight: svgBounding ? Math.round(svgBounding.height) : null,
      hasTailwindReset: sheets.some((s) => s.rules > 50),
    };
  });

  const screenshotFile = path.join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotFile, fullPage: true });

  page.off("console", onConsole);
  page.off("requestfailed", onRequestFailed);

  console.log(`Status: ${status}`);
  console.log(`StyleSheets loaded: ${data.sheets.length} (Max rules: ${Math.max(...data.sheets.map((s) => s.rules), 0)})`);
  console.log(`Body Bg: ${data.bodyBg}, Font: ${data.bodyFont.slice(0, 30)}...`);
  if (data.btnBg) console.log(`Button Bg: ${data.btnBg}`);
  if (data.svgWidth) console.log(`First SVG Size: ${data.svgWidth}x${data.svgHeight}px`);
  console.log(`Failed requests: ${failedRequests.length}`);
  console.log(`Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) console.log(`  Errors:`, consoleErrors);
  if (consoleWarnings.length > 0) console.log(`  Hydration Warnings:`, consoleWarnings);

  return {
    name,
    status,
    hasStyles: data.hasTailwindReset && data.sheets.length > 0,
    failedRequests: failedRequests.length,
    consoleErrors: consoleErrors.length,
    data,
  };
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const results = [];

  // 1. Login Desktop & Mobile
  results.push(await verifyPage(page, "/login", "01-login-desktop", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/login", "02-login-mobile", { width: 390, height: 844 }));

  // 2. Forgot Password
  results.push(await verifyPage(page, "/forgot-password", "03-forgot-password-desktop", { width: 1280, height: 800 }));

  // 3. Perform login to reach authenticated areas
  console.log("\nLogging in as Owner for authenticated tests...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
  await page.type("#login-email", "owner@gokulconnect.com");
  await page.type("#login-password", "MasterOwnerSecret2026!");
  await page.click("button[type='submit']");
  await new Promise((r) => setTimeout(r, 1500));

  // 4. Select Business
  results.push(await verifyPage(page, "/select-business", "04-select-business-desktop", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/select-business", "05-select-business-mobile", { width: 390, height: 844 }));

  // 5. Astrology Workspace pages
  results.push(await verifyPage(page, "/workspace/astrology/dashboard", "06-astrology-dashboard", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/astrology/inbox", "07-astrology-inbox", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/astrology/connections", "08-astrology-connections", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/astrology/automations", "09-astrology-automations", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/astrology/settings", "10-astrology-settings", { width: 1280, height: 800 }));

  // 6. Vivaham Workspace pages
  results.push(await verifyPage(page, "/workspace/vivaham/dashboard", "11-vivaham-dashboard", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/vivaham/inbox", "12-vivaham-inbox", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/vivaham/connections", "13-vivaham-connections", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/vivaham/automations", "14-vivaham-automations", { width: 1280, height: 800 }));
  results.push(await verifyPage(page, "/workspace/vivaham/settings", "15-vivaham-settings", { width: 1280, height: 800 }));

  await browser.close();

  console.log("\n================ SUMMARY ================");
  let allPass = true;
  for (const r of results) {
    const pass = r.status === 200 && r.hasStyles && r.failedRequests === 0;
    if (!pass) allPass = false;
    console.log(`${r.name}: Status=${r.status}, Styled=${r.hasStyles}, FailedReqs=${r.failedRequests}, Errors=${r.consoleErrors} -> ${pass ? "PASS" : "FAIL"}`);
  }
  console.log("Overall CSS & Rendering Status:", allPass ? "ALL PASSED" : "FAILURES DETECTED");
}

main().catch(console.error);
