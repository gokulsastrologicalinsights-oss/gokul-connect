import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve("./screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runVerification() {
  console.log("🚀 Starting Phase 1 Runtime Verification...");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  // 1. Verify Login Page (Desktop: 1280x800)
  console.log("1️⃣ Verifying Login Page (Desktop)...");
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "01-login-desktop.png"), fullPage: true });

  // 2. Verify Login Page (Mobile: 375x812)
  console.log("2️⃣ Verifying Login Page (Mobile)...");
  await page.setViewport({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "02-login-mobile.png"), fullPage: true });

  // 3. Perform Functional Sign-in via Quick Sign-in Button
  console.log("3️⃣ Testing Login Functionality...");
  await page.setViewport({ width: 1280, height: 800 });
  
  // Find button by iterating through buttons
  const buttonClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const quickBtn = buttons.find(b => b.textContent && b.textContent.includes("Quick Sign-in as Owner"));
    if (quickBtn) {
      quickBtn.click();
      return true;
    }
    return false;
  });

  if (!buttonClicked) {
    await page.type("input[type='email']", "owner@gokulconnect.com");
    await page.type("input[type='password']", "MasterOwnerSecret2026!");
    await page.click("button[type='submit']");
  }

  // Wait for navigation to /select-business
  await page.waitForNavigation({ waitUntil: "networkidle0" });
  console.log("Current URL after login:", page.url());

  // 4. Verify Business Selection Screen (Desktop)
  console.log("4️⃣ Verifying Business Selection Screen (Desktop)...");
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "03-select-business-desktop.png"), fullPage: true });

  // 5. Verify Business Selection Screen (Mobile)
  console.log("5️⃣ Verifying Business Selection Screen (Mobile)...");
  await page.setViewport({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "04-select-business-mobile.png"), fullPage: true });

  // 6. Enter Workspace: Gokul's Astrological Insights
  console.log("6️⃣ Entering Workspace: Gokul's Astrological Insights...");
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/workspace/astrology/dashboard`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "05-astrology-dashboard-desktop.png"), fullPage: true });

  // Mobile Astrological Dashboard & Mobile Menu Toggle
  console.log("6️⃣b Testing Mobile Workspace Layout & Navigation Drawer...");
  await page.setViewport({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "06-astrology-dashboard-mobile.png"), fullPage: true });
  
  // Click hamburger menu to open drawer
  await page.evaluate(() => {
    const btn = document.querySelector("button[aria-label='Toggle navigation menu']");
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "06b-astrology-mobile-drawer.png"), fullPage: true });

  // 7. Verify Switch Business Action
  console.log("7️⃣ Testing Switch Business Functionality...");
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/workspace/astrology/dashboard`, { waitUntil: "networkidle0" });
  
  // Find Switch Business button via evaluate
  const switched = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const switchBtn = buttons.find(b => b.textContent && b.textContent.includes("Switch Business"));
    if (switchBtn) {
      switchBtn.click();
      return true;
    }
    return false;
  });

  if (switched) {
    await page.waitForNavigation({ waitUntil: "networkidle0" });
    console.log("Successfully switched back to:", page.url());
  } else {
    await page.goto(`${BASE_URL}/select-business`, { waitUntil: "networkidle0" });
  }
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "07-switched-back.png"), fullPage: true });

  // 8. Enter Workspace: Gokul Vivaham
  console.log("8️⃣ Entering Workspace: Gokul Vivaham...");
  await page.goto(`${BASE_URL}/workspace/vivaham/dashboard`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "08-vivaham-dashboard-desktop.png"), fullPage: true });

  await page.setViewport({ width: 375, height: 812 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "09-vivaham-dashboard-mobile.png"), fullPage: true });

  // 9. Verify Cross-Tenant Security Boundary Rejection
  console.log("9️⃣ Testing Invalid Workspace Rejection...");
  await page.goto(`${BASE_URL}/workspace/unauthorized-tenant/dashboard`, { waitUntil: "networkidle0" });
  console.log("Unauthorized attempt redirected to:", page.url());
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "10-security-boundary-rejection.png"), fullPage: true });

  await browser.close();

  console.log("\n================ VERIFICATION SUMMARY ================");
  console.log("Console Errors Detected:", consoleErrors.length);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e, i) => console.log(`  [${i+1}] ${e}`));
  }
  console.log("Page Errors Detected:", pageErrors.length);
  if (pageErrors.length > 0) {
    pageErrors.forEach((e, i) => console.log(`  [${i+1}] ${e}`));
  }
  console.log("Screenshots captured in ./screenshots:");
  fs.readdirSync(SCREENSHOTS_DIR).forEach((f) => console.log(`  - ${f}`));
  console.log("======================================================");
}

runVerification().catch((err) => {
  console.error("Runtime verification failed:", err);
  process.exit(1);
});
