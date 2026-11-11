import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  const failedRequests = [];
  const consoleMessages = [];

  page.on("requestfailed", (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure() });
  });
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    console.error("PAGE ERROR:", err.message);
  });

  await page.setViewport({ width: 1280, height: 800 });
  const response = await page.goto("http://localhost:3000/login", { waitUntil: "networkidle0" });
  console.log("HTTP status:", response.status());

  const evaluation = await page.evaluate(() => {
    const body = document.body;
    const bodyStyle = window.getComputedStyle(body);
    const container = document.querySelector(".min-h-screen.bg-slate-900");
    const containerStyle = container ? window.getComputedStyle(container) : null;
    const h1 = document.querySelector("h1");
    const h1Style = h1 ? window.getComputedStyle(h1) : null;
    const btn = document.querySelector("button[type='submit']");
    const btnStyle = btn ? window.getComputedStyle(btn) : null;
    const styleSheets = Array.from(document.styleSheets).map((s) => ({
      href: s.href,
      rulesCount: s.cssRules ? s.cssRules.length : -1,
    }));

    return {
      bodyBg: bodyStyle.backgroundColor,
      containerBg: containerStyle ? containerStyle.backgroundColor : null,
      h1Color: h1Style ? h1Style.color : null,
      btnBg: btnStyle ? btnStyle.backgroundColor : null,
      styleSheets,
    };
  });

  console.log("Evaluation:", JSON.stringify(evaluation, null, 2));
  console.log("Failed requests:", failedRequests);
  console.log("Console messages:", consoleMessages);

  await page.screenshot({ path: "screenshots/current-login-check.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
