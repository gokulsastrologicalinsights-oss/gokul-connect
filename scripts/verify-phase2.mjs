import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import http from "http";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve("./screenshots");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      const req = http.get(url, (res) => {
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Server startup timed out"));
        } else {
          setTimeout(check, 500);
        }
      });
    }
    check();
  });
}

async function runVerification() {
  console.log("🚀 Spawning Next.js production server for Phase 2 verification...");
  
  const serverProcess = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["next", "start", "-p", "3000"],
    {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, PORT: "3000" },
    }
  );

  try {
    console.log("⏳ Waiting for http://localhost:3000 to become responsive...");
    await waitForServer(`${BASE_URL}/login`);
    console.log("✅ Next.js server is responsive on port 3000!");

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

    // 1. Astrology Connections Dashboard (Desktop)
    console.log("1️⃣ Capturing Astrology Connections (Desktop: 1280x800)...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/workspace/astrology/connections`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "07-astrology-connections-desktop.png"),
      fullPage: true,
    });

    // 2. Astrology Connections Dashboard (Mobile)
    console.log("2️⃣ Capturing Astrology Connections (Mobile: 375x812)...");
    await page.setViewport({ width: 375, height: 812 });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "08-astrology-connections-mobile.png"),
      fullPage: true,
    });

    // 3. Add WhatsApp Number Modal Interaction
    console.log("3️⃣ Testing Add WhatsApp Number Guided Modal...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const addBtn = buttons.find((b) => b.textContent && b.textContent.includes("Add WhatsApp Number"));
      if (addBtn) addBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "09-astrology-add-connection-modal.png"),
      fullPage: true,
    });

    // Close modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const cancelBtn = buttons.find((b) => b.textContent && b.textContent.trim() === "Cancel");
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 4. Test Connection Diagnostic Modal
    console.log("4️⃣ Testing Connection Diagnostic Trigger...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const testBtn = buttons.find((b) => b.textContent && b.textContent.trim() === "Test");
      if (testBtn) testBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "10-connection-diagnostic-modal.png"),
      fullPage: true,
    });

    // Close diagnostic modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const dismissBtn = buttons.find((b) => b.textContent && b.textContent.includes("Dismiss"));
      if (dismissBtn) dismissBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 5. Vivaham Connections Dashboard (Desktop)
    console.log("5️⃣ Capturing Vivaham Connections (Desktop: 1280x800)...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/workspace/vivaham/connections`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "11-vivaham-connections-desktop.png"),
      fullPage: true,
    });

    // 6. Vivaham Connections Dashboard (Mobile)
    console.log("6️⃣ Capturing Vivaham Connections (Mobile: 375x812)...");
    await page.setViewport({ width: 375, height: 812 });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "12-vivaham-connections-mobile.png"),
      fullPage: true,
    });

    // 7. Astrology Business Settings (Desktop)
    console.log("7️⃣ Capturing Astrology Business Settings (Desktop: 1280x800)...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/workspace/astrology/settings`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "13-astrology-settings-desktop.png"),
      fullPage: true,
    });

    // 8. Vivaham Business Settings (Desktop)
    console.log("8️⃣ Capturing Vivaham Business Settings (Desktop: 1280x800)...");
    await page.goto(`${BASE_URL}/workspace/vivaham/settings`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "14-vivaham-settings-desktop.png"),
      fullPage: true,
    });

    await browser.close();

    console.log("==========================================");
    console.log("✅ Runtime Verification Complete!");
    console.log(`📸 Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log(`Errors encountered: Console (${consoleErrors.length}), Page (${pageErrors.length})`);
    if (consoleErrors.length > 0) {
      console.log("Console errors:", consoleErrors);
    }
    if (pageErrors.length > 0) {
      console.log("Page errors:", pageErrors);
    }
  } finally {
    console.log("🛑 Stopping spawned server process...");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", serverProcess.pid, "/f", "/t"]);
    } else {
      serverProcess.kill("SIGTERM");
    }
  }
}

runVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
