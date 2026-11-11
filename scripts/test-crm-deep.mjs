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
const SCREENSHOT_DIR = path.resolve("./screenshots/uat-phase10-1/crm-deep");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testCrmDeep() {
  console.log("=== PHASE 10.1 — DEEP CRM FUNCTIONAL TEST ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const crmReport = {
    astrology: {},
    vivaham: {},
    failures: [],
  };

  try {
    // 1. Login as Astrology
    console.log("Logging in as Astrology user...");
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
    await page.type("#login-email", ASTRO_EMAIL);
    await page.type("#login-password", ASTRO_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1200));

    if (page.url().includes("/select-business")) {
      await page.waitForSelector("a[href*='/workspace/astrology']");
      await page.click("a[href*='/workspace/astrology']");
      await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    await page.goto(`${BASE_URL}/workspace/astrology/crm`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1500));
    console.log("Current page URL:", page.url());
    console.log("Buttons on page:", await page.$$eval("button", btns => btns.map(b => b.textContent?.trim()).filter(Boolean)));

    // A. Contact creation test
    console.log("\n[A] Testing Contact Creation in Astrology...");
    const addBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.includes("Add Contact")
      );
    });
    if (addBtn.asElement()) {
      await addBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 600));

      // Fill valid contact
      const inputs = await page.$$("div[role='dialog'] input");
      console.log(`Found ${inputs.length} inputs in Add modal.`);
      // Form: 0: Name, 1: Phone, 2: Email, 3: Tags
      if (inputs.length >= 2) {
        await inputs[0].type("Karthik Astrologer Client");
        await inputs[1].type("+91 98888 11111");
        if (inputs[2]) await inputs[2].type("karthik.client@example.com");
        if (inputs[3]) await inputs[3].type("KP Astrology, Chennai");
      }

      // Select category
      await page.evaluate(() => {
        const select = document.querySelector("div[role='dialog'] select");
        if (select) {
          select.value = "Astrology Consultation";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });

      // Submit
      const createSubmit = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll("div[role='dialog'] button")).find(
          (b) => b.textContent.includes("Create Contact")
        );
      });
      if (createSubmit.asElement()) {
        await createSubmit.asElement().click();
        await new Promise((r) => setTimeout(r, 2000));
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-after-create.png") });

      // Verify contact shows in table or state
      const tableText = await page.evaluate(() => document.querySelector("table")?.textContent || "");
      const createdPresent = tableText.includes("98888 11111") || tableText.includes("Karthik Astrologer Client");
      console.log(`Contact created and visible in table: ${createdPresent}`);
      crmReport.astrology.contactCreation = createdPresent;
    }

    // B. Test Duplicate Contact Detection
    console.log("\n[B] Testing Duplicate Contact Detection...");
    const addBtnDup = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Add Contact"));
    });
    if (addBtnDup.asElement()) {
      await addBtnDup.asElement().click();
      await new Promise((r) => setTimeout(r, 600));

      const inputs = await page.$$("div[role='dialog'] input");
      if (inputs.length >= 2) {
        await inputs[0].type("Duplicate Attempt");
        // Use existing phone
        await inputs[1].type("+91 98888 11111");
      }

      const createSubmit = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll("div[role='dialog'] button")).find(
          (b) => b.textContent.includes("Create Contact")
        );
      });
      if (createSubmit.asElement()) {
        await createSubmit.asElement().click();
        await new Promise((r) => setTimeout(r, 1500));
      }

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-duplicate-detection.png") });
      const modalText = await page.evaluate(() => document.querySelector("div[role='dialog']")?.textContent || "");
      const dupBlocked = modalText.includes("already exists") || modalText.includes("Duplicate");
      console.log(`Duplicate detected & blocked with clear error: ${dupBlocked}`);
      crmReport.astrology.duplicateDetection = dupBlocked;

      // Close modal
      const closeBtn = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll("div[role='dialog'] button")).find(
          (b) => b.textContent.includes("Cancel") || b.textContent.includes("✕")
        );
      });
      if (closeBtn.asElement()) await closeBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // C. Search & Filter
    console.log("\n[C] Testing Search & Filter...");
    const searchInput = await page.$("input[placeholder*='Search']");
    if (searchInput) {
      await searchInput.type("Karthik");
      await new Promise((r) => setTimeout(r, 800));
      const filteredText = await page.evaluate(() => document.querySelector("table")?.textContent || "");
      console.log(`Search for 'Karthik' filtered table successfully: ${filteredText.includes("Karthik")}`);
      crmReport.astrology.searchFilter = filteredText.includes("Karthik");
      // Clear search
      await page.evaluate(() => {
        const inp = document.querySelector("input[placeholder*='Search']");
        if (inp) {
          inp.value = "";
          inp.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      await new Promise((r) => setTimeout(r, 500));
    }

    // D. View Contact Details, Notes, and Activity Timeline
    console.log("\n[D] Testing Contact Detail Slide-Over, Notes & Timeline...");
    // Click on a contact row
    const contactRow = await page.$("table tbody tr");
    if (contactRow) {
      await contactRow.click();
      await new Promise((r) => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-contact-slideover.png") });

      const slideoverText = await page.evaluate(() => document.body.textContent || "");
      const hasTimeline = slideoverText.includes("Activity Timeline") || slideoverText.includes("Activity History");
      const hasNotes = slideoverText.includes("Internal Notes") || slideoverText.includes("Consultation Notes") || slideoverText.includes("Notes");
      const hasCompliance = slideoverText.includes("Service Window") || slideoverText.includes("24-Hour") || slideoverText.includes("Opted In") || slideoverText.includes("Opt-out");

      console.log(`Slide-over displayed: timeline=${hasTimeline}, notes=${hasNotes}, compliance=${hasCompliance}`);
      crmReport.astrology.detailSlideover = { hasTimeline, hasNotes, hasCompliance };

      // Add a note
      const noteInput = await page.$("textarea[placeholder*='note' i], input[placeholder*='note' i]");
      if (noteInput) {
        await noteInput.type("Client requested expedited horoscope matching by Sunday.");
        const addNoteBtn = await page.evaluateHandle(() => {
          return Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Add Note"));
        });
        if (addNoteBtn.asElement()) {
          await addNoteBtn.asElement().click();
          await new Promise((r) => setTimeout(r, 1500));
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-note-added.png") });
          const updatedSlideover = await page.evaluate(() => document.body.textContent || "");
          const noteVisible = updatedSlideover.includes("expedited horoscope matching");
          console.log(`Note successfully added and visible: ${noteVisible}`);
          crmReport.astrology.noteAddition = noteVisible;
        }
      }

      // Check "Open in Inbox" integration
      const inboxBtn = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll("button, a")).find(
          (el) => el.textContent.includes("Open in Inbox") || el.textContent.includes("Chat in Inbox")
        );
      });
      if (inboxBtn.asElement()) {
        console.log("Found 'Open in Inbox' action button in contact slide-over.");
        crmReport.astrology.inboxIntegration = true;
      }

      // Close slide-over
      const closeDrawer = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("✕") || b.getAttribute("aria-label") === "Close");
      });
      if (closeDrawer.asElement()) await closeDrawer.asElement().click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // E. CSV Import Modal & Validation Preview
    console.log("\n[E] Testing CSV Import Preview & Validation...");
    const importBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Import CSV"));
    });
    if (importBtn.asElement()) {
      await importBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 800));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-import-modal.png") });

      // Create a temporary synthetic CSV file
      const syntheticCsvPath = path.resolve("./screenshots/uat-phase10-1/synthetic_contacts.csv");
      const csvData = [
        "name,phone,email,category,source,tags",
        "Meena Krishnan,+91 97777 22222,meena@example.com,Horoscope Matching,website,\"VIP, Chennai\"",
        "Suresh Babu,+91 97777 33333,suresh@example.com,Numerology,referral,\"Fast-track\"",
        "Duplicate Guy,+91 98888 11111,dup@example.com,New Enquiry,manual,\"Duplicate\"", // duplicate with Karthik
      ].join("\n");
      fs.writeFileSync(syntheticCsvPath, csvData, "utf8");

      // Upload file to file input
      const fileInput = await page.$("input[type='file']");
      if (fileInput) {
        await fileInput.uploadFile(syntheticCsvPath);
        await new Promise((r) => setTimeout(r, 1200));
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-import-preview.png") });

        const importModalText = await page.evaluate(() => document.querySelector("div[role='dialog']")?.textContent || "");
        console.log("Import Modal Preview text summary:", importModalText.slice(0, 300).replace(/\s+/g, " "));

        const hasValidCount = importModalText.includes("Valid") || importModalText.includes("Ready to Import");
        const hasDuplicateDetected = importModalText.includes("Duplicate") || importModalText.includes("Already exists");
        console.log(`CSV preview validation: Valid=${hasValidCount}, DuplicateDetection=${hasDuplicateDetected}`);
        crmReport.astrology.csvImportPreview = { hasValidCount, hasDuplicateDetected };
      }

      // Close modal without committing
      const cancelImport = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll("div[role='dialog'] button")).find((b) => b.textContent.includes("Cancel"));
      });
      if (cancelImport.asElement()) await cancelImport.asElement().click();
      await new Promise((r) => setTimeout(r, 500));
    }

    // F. Saved Segments Test
    console.log("\n[F] Testing Saved Segments...");
    const segmentBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Save Segment"));
    });
    if (segmentBtn.asElement()) {
      await segmentBtn.asElement().click();
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-save-segment-modal.png") });

      const segNameInput = await page.$("div[role='dialog'] input[placeholder*='Segment' i], div[role='dialog'] input[type='text']");
      if (segNameInput) {
        await segNameInput.type("High-Priority Astrology Leads");
      }
      const saveSegBtn = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll("div[role='dialog'] button")).find(
          (b) => b.textContent.includes("Save") || b.textContent.includes("Create")
        );
      });
      if (saveSegBtn.asElement()) {
        await saveSegBtn.asElement().click();
        await new Promise((r) => setTimeout(r, 1500));
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "astro-after-save-segment.png") });
      const pageTextAfterSeg = await page.evaluate(() => document.body.textContent || "");
      const segSaved = pageTextAfterSeg.includes("High-Priority Astrology Leads");
      console.log(`Segment saved and displayed: ${segSaved}`);
      crmReport.astrology.savedSegments = segSaved;
    }

    console.log("\n=== DEEP CRM TEST COMPLETED ===");
    console.log("CRM Report:", JSON.stringify(crmReport, null, 2));
  } catch (err) {
    console.error("Deep CRM Test Error:", err);
    crmReport.failures.push(err.message);
  } finally {
    await browser.close();
  }
}

testCrmDeep();
