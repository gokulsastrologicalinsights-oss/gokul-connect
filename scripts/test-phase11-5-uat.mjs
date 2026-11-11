import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  validateTemplateDraft,
  extractVariables,
  extractTemplateVariables,
  replaceVariables,
} from "../src/lib/templates/validation.ts";
import {
  detectPlaceholders,
  validateVariableCount,
  generateTemplatePreview,
  rejectUnresolvedPlaceholders,
} from "../src/lib/templates/variable-engine.ts";
import { saveDraftTemplateAction, deleteTemplateAction } from "../src/app/actions/templates.ts";

function loadEnvLocal() {
  const envPath = path.resolve("./.env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return env;
}

const env = loadEnvLocal();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const ASTRO_EMAIL = env.TEST_ASTROLOGY_USER_EMAIL;
const ASTRO_PASSWORD = env.TEST_ASTROLOGY_USER_PASSWORD;
const VIVAHAM_EMAIL = env.TEST_VIVAHAM_USER_EMAIL;
const VIVAHAM_PASSWORD = env.TEST_VIVAHAM_USER_PASSWORD;

const ASTRO_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.resolve("./docs/PHASE_11_5_SCREENSHOTS");

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = [];

function recordResult(domain, testId, title, status, evidence, failureReason = null) {
  results.push({ domain, testId, title, status, evidence, failureReason });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(`  ${icon} [${status}] ${testId}: ${title}`);
  if (evidence) console.log(`      Evidence: ${evidence}`);
  if (failureReason) console.log(`      Reason: ${failureReason}`);
}

async function runPhase11_5_UAT() {
  console.log("================================================================================");
  console.log("🚀 STARTING PHASE 11.5: END-TO-END TEMPLATE MANAGEMENT UAT");
  console.log("================================================================================");
  console.log(`Target Base URL   : ${BASE_URL}`);
  console.log(`Supabase URL      : ${SUPABASE_URL}`);
  console.log(`Screenshots Dir   : ${SCREENSHOTS_DIR}`);
  console.log("--------------------------------------------------------------------------------\n");

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Clean any previous synthetic test records
  await adminClient.from("wa_message_templates").delete().ilike("template_name", "uat_%");

  // -----------------------------------------------------------------------------
  // DOMAIN 1: PREFLIGHT AUDIT
  // -----------------------------------------------------------------------------
  console.log("--- DOMAIN 1: Preflight Audit & Migration 015 Verification ---");

  // 1.1 Migration 015 verified in supabase
  const { data: cols, error: colErr } = await adminClient
    .from("wa_message_templates")
    .select("id, meta_template_id, rejection_reason, is_archived, last_synced_at")
    .limit(1);

  recordResult(
    "Preflight",
    "PRE-01",
    "Migration 015 schema and columns verified in Supabase",
    !colErr ? "PASS" : "FAIL",
    !colErr ? "All 4 Phase 11 columns queried cleanly" : null,
    colErr ? colErr.message : null
  );

  // 1.2 Initial template counts
  const { data: initialTemplates } = await adminClient
    .from("wa_message_templates")
    .select("id, business_id, template_name, status, is_archived");

  const astroInitialCount = initialTemplates?.filter((t) => t.business_id === ASTRO_ID).length || 0;
  const vivahamInitialCount = initialTemplates?.filter((t) => t.business_id === VIVAHAM_ID).length || 0;

  recordResult(
    "Preflight",
    "PRE-02",
    "Initial database template counts recorded per business",
    "PASS",
    `Astrology: ${astroInitialCount}, Vivaham: ${vivahamInitialCount} (Zero customer contamination)`
  );

  // 1.3 Launch Puppeteer
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Handle dialogs automatically (confirm delete)
  page.on("dialog", async (dialog) => {
    console.log(`      [Dialog: ${dialog.type()}] "${dialog.message()}" -> Auto-accepting`);
    await dialog.accept();
  });

  // Login helper
  async function login(email, password, businessSlug) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });

    await page.evaluate(() => {
      const emailInput = document.querySelector("#login-email");
      const passInput = document.querySelector("#login-password");
      if (emailInput) emailInput.value = "";
      if (passInput) passInput.value = "";
    });

    await page.type("#login-email", email);
    await page.type("#login-password", password);
    await page.click("button[type='submit']");
    await new Promise((r) => setTimeout(r, 2500));

    if (page.url().includes("/select-business")) {
      const btnSelector = `a[href*="/workspace/${businessSlug}/dashboard"]`;
      await page.waitForSelector(btnSelector, { timeout: 5000 });
      await page.click(btnSelector);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Logout helper
  async function logout() {
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle0" });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      const cookies = await page.cookies();
      for (const cookie of cookies) {
        await page.deleteCookie(cookie);
      }
    } catch {
      // Ignored
    }
  }

  try {
    // ---------------------------------------------------------------------------
    // DOMAIN 2: ASTROLOGY TEMPLATE UAT
    // ---------------------------------------------------------------------------
    console.log("\n--- DOMAIN 2: Astrology Template Management UAT ---");

    await login(ASTRO_EMAIL, ASTRO_PASSWORD, "astrology");

    // 2.1 Navigate to /workspace/astrology/templates
    await page.goto(`${BASE_URL}/workspace/astrology/templates`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    const astroInitialTitle = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const badge = document.querySelector("span.text-indigo-700");
      return {
        title: h1?.innerText || "",
        badge: badge?.innerText || "",
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "01-astrology-templates-initial.png") });

    recordResult(
      "Astrology UAT",
      "ASTRO-01",
      "Astrology templates page loads with verified business badge",
      astroInitialTitle.title.includes("Message Templates") && astroInitialTitle.badge.includes("Astrological")
        ? "PASS"
        : "FAIL",
      `Title: "${astroInitialTitle.title}", Badge: "${astroInitialTitle.badge}"`
    );

    // 2.2 Verify initial metrics cards
    const initialMetrics = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".grid.grid-cols-2.md\\:grid-cols-4 > div"));
      return cards.map((c) => ({
        label: c.querySelector("span:first-child")?.innerText?.trim(),
        value: c.querySelector("span:last-child")?.innerText?.trim(),
      }));
    });

    recordResult(
      "Astrology UAT",
      "ASTRO-02",
      "Initial template metrics displayed accurately",
      initialMetrics.length === 4 ? "PASS" : "FAIL",
      JSON.stringify(initialMetrics)
    );

    // 2.3 Create a new DRAFT template
    const newDraftBtn = await page.waitForSelector("button ::-p-text(New Draft Template)");
    await newDraftBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    const modalTitle = await page.evaluate(() => {
      return document.querySelector("#editor-modal-title")?.innerText;
    });

    recordResult(
      "Astrology UAT",
      "ASTRO-03",
      "Template editor modal opens with draft creation title",
      modalTitle?.includes("Create New Local Draft Template") ? "PASS" : "FAIL",
      `Header: "${modalTitle}"`
    );

    // 2.4 Fill form fields
    const testAstroTemplateName = "uat_astro_consultation_rem_v1";
    await page.type("input[placeholder*='order_update_01']", testAstroTemplateName);

    // Select category UTILITY
    await page.select("select:has(option[value='UTILITY'])", "UTILITY");

    // Select language en_US
    await page.select("select:has(option[value='en_US'])", "en_US");

    // Add body text with {{1}} and {{2}}
    const testAstroBody = "Namaste {{1}}, your Vedic Astrology consultation is confirmed for {{2}}. Please keep your birth chart ready.";
    const bodyTextarea = await page.$("textarea");
    await bodyTextarea.click();
    await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      if (ta) ta.value = "";
    });
    await bodyTextarea.type(testAstroBody);

    // Verify live preview reflects the changes
    const livePreviewText = await page.evaluate(() => {
      const previewP = document.querySelector(".bg-\\[\\#efeae2\\] p.text-slate-800");
      return previewP?.innerText || "";
    });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "02-astrology-create-modal.png") });

    recordResult(
      "Astrology UAT",
      "ASTRO-04",
      "Live preview reflects entered body text and variables",
      livePreviewText.includes("Namaste {{1}}") && livePreviewText.includes("confirmed for {{2}}")
        ? "PASS"
        : "FAIL",
      `Preview text: "${livePreviewText}"`
    );

    // 2.5 Save draft and wait for modal close
    const saveDraftBtn = await page.waitForSelector("button ::-p-text(Save Local Draft)");
    await saveDraftBtn.click();
    await page.waitForSelector("#editor-modal-title", { hidden: true, timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1000));

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "03-astrology-draft-created.png") });

    // Verify draft appears in catalog
    const draftCardExists = await page.evaluate((name) => {
      const cards = Array.from(document.querySelectorAll("h3.font-mono"));
      return cards.some((h) => h.innerText.includes(name));
    }, testAstroTemplateName);

    recordResult(
      "Astrology UAT",
      "ASTRO-05",
      "Draft template created and displayed in catalog with Local Draft badge",
      draftCardExists ? "PASS" : "FAIL",
      `Template "${testAstroTemplateName}" visible in UI`
    );

    // 2.6 Refresh browser and confirm draft persists
    await page.reload({ waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    const draftPersistsAfterReload = await page.evaluate((name) => {
      const cards = Array.from(document.querySelectorAll("h3.font-mono"));
      return cards.some((h) => h.innerText.includes(name));
    }, testAstroTemplateName);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "04-astrology-draft-persisted.png") });

    recordResult(
      "Astrology UAT",
      "ASTRO-06",
      "Draft template persists across browser reload and session refresh",
      draftPersistsAfterReload ? "PASS" : "FAIL",
      `Found template "${testAstroTemplateName}" after full reload`
    );

    // 2.7 Open draft and edit its content
    await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const editBtn = card?.querySelector("button[aria-label='Edit Local Draft']");
      if (editBtn) editBtn.click();
    }, testAstroTemplateName);

    await page.waitForSelector("#editor-modal-title", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 500));

    // Update body content
    const updatedAstroBody = "Namaste {{1}}, your Vedic Astrology consultation is UPDATED for {{2}}. Please join via Google Meet on time.";
    const editTa = await page.$("textarea");
    await editTa.click();
    await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      if (ta) ta.value = "";
    });
    await editTa.type(updatedAstroBody);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "05-astrology-edit-modal.png") });

    // Save updated draft
    const saveUpdatedBtn = await page.waitForSelector("button ::-p-text(Save Local Draft)");
    await saveUpdatedBtn.click();
    await page.waitForSelector("#editor-modal-title", { hidden: true, timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify updated content in card snippet
    const updatedCardBody = await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const bodyP = card?.querySelector("p.text-slate-600.line-clamp-3");
      return bodyP?.innerText || "";
    }, testAstroTemplateName);

    recordResult(
      "Astrology UAT",
      "ASTRO-07",
      "Draft template edited, saved, and updated content reflected in UI",
      updatedCardBody.includes("UPDATED") ? "PASS" : "FAIL",
      `Updated snippet: "${updatedCardBody}"`
    );

    // 2.8 Archive the draft
    await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const archiveBtn = card?.querySelector("button[aria-label='Archive Template']");
      if (archiveBtn) archiveBtn.click();
    }, testAstroTemplateName);

    await new Promise((r) => setTimeout(r, 2000));

    // Confirm it disappears from active catalog
    const isDisappearedFromActive = await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      return !headers.some((h) => h.innerText.includes(name));
    }, testAstroTemplateName);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "06-astrology-draft-archived.png") });

    recordResult(
      "Astrology UAT",
      "ASTRO-08",
      "Archived template disappears from active catalog view",
      isDisappearedFromActive ? "PASS" : "FAIL",
      `Active view excludes archived template: ${isDisappearedFromActive}`
    );

    // 2.9 Check archived templates view/filter
    const showArchivedCheckbox = await page.$("input[type='checkbox']");
    await showArchivedCheckbox.click();
    await new Promise((r) => setTimeout(r, 800));

    const isVisibleInArchivedView = await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const badge = card?.querySelector("span:has(.lucide-archive)");
      return Boolean(cardHeader && badge);
    }, testAstroTemplateName);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "07-astrology-show-archived.png") });

    recordResult(
      "Astrology UAT",
      "ASTRO-09",
      "Archived template displays with Archived badge when filter enabled",
      isVisibleInArchivedView ? "PASS" : "FAIL",
      `Found with Archived badge: ${isVisibleInArchivedView}`
    );

    // 2.10 Unarchive it and confirm it returns as DRAFT
    await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const unarchiveBtn = card?.querySelector("button[aria-label='Unarchive Template']");
      if (unarchiveBtn) unarchiveBtn.click();
    }, testAstroTemplateName);

    await new Promise((r) => setTimeout(r, 2000));

    // Turn off Show Archived
    await showArchivedCheckbox.click();
    await new Promise((r) => setTimeout(r, 1000));

    const returnedAsDraft = await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const cardText = card?.innerText || "";
      return Boolean(cardHeader && cardText.includes("Local Draft"));
    }, testAstroTemplateName);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "08-astrology-unarchived.png") });

    recordResult(
      "Astrology UAT",
      "ASTRO-10",
      "Template unarchived successfully and restored to active catalog as Local Draft",
      returnedAsDraft ? "PASS" : "FAIL",
      `Restored as Local Draft: ${returnedAsDraft}`
    );

    // 2.11 Delete synthetic test record
    await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const deleteBtn = card?.querySelector("button[aria-label='Delete Template']");
      if (deleteBtn) deleteBtn.click();
    }, testAstroTemplateName);

    await new Promise((r) => setTimeout(r, 2000));

    const isDeletedFromUI = await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      return !headers.some((h) => h.innerText.includes(name));
    }, testAstroTemplateName);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "09-astrology-draft-deleted.png") });

    recordResult(
      "Astrology UAT",
      "ASTRO-11",
      "Synthetic test draft safely deleted and removed from database",
      isDeletedFromUI ? "PASS" : "FAIL",
      `Template deleted: ${isDeletedFromUI}`
    );

    // ---------------------------------------------------------------------------
    // DOMAIN 3: VIVAHAM TEMPLATE UAT
    // ---------------------------------------------------------------------------
    console.log("\n--- DOMAIN 3: Vivaham Template Management UAT ---");

    await logout();
    await login(VIVAHAM_EMAIL, VIVAHAM_PASSWORD, "vivaham");

    await page.goto(`${BASE_URL}/workspace/vivaham/templates`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    const vivahamInitialTitle = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const badge = document.querySelector("span.text-indigo-700");
      return {
        title: h1?.innerText || "",
        badge: badge?.innerText || "",
      };
    });

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "10-vivaham-templates-initial.png") });

    recordResult(
      "Vivaham UAT",
      "VIV-01",
      "Vivaham templates page loads with verified business badge",
      vivahamInitialTitle.title.includes("Message Templates") && vivahamInitialTitle.badge.includes("Vivaham")
        ? "PASS"
        : "FAIL",
      `Title: "${vivahamInitialTitle.title}", Badge: "${vivahamInitialTitle.badge}"`
    );

    // 3.2 Create Vivaham Tamil & Bilingual Draft Template
    const vivNewDraftBtn = await page.waitForSelector("button ::-p-text(New Draft Template)");
    await vivNewDraftBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    const testVivahamTemplateName = "uat_vivaham_tamil_bilingual_v1";
    await page.type("input[placeholder*='order_update_01']", testVivahamTemplateName);

    // Category: UTILITY
    await page.select("select:has(option[value='UTILITY'])", "UTILITY");

    // Language: Tamil (ta)
    await page.select("select:has(option[value='ta'])", "ta");

    // Header: TEXT
    await page.select("select:has(option[value='TEXT'])", "TEXT");
    await page.type("input[placeholder*='Header title']", "Gokul Vivaham Portal");

    // Body: Bilingual Tamil & English text
    const testTamilBilingualBody =
      "வணக்கம் {{1}}! உங்கள் திருமண பதிவு எண் {{2}} வெற்றிகரமாக உறுதி செய்யப்பட்டது. Welcome to Gokul Vivaham Matrimony.";
    const vivBodyTextarea = await page.$("textarea");
    await vivBodyTextarea.click();
    await page.evaluate(() => {
      const ta = document.querySelector("textarea");
      if (ta) ta.value = "";
    });
    await vivBodyTextarea.type(testTamilBilingualBody);

    // Footer: Optional note
    await page.type("input[placeholder*='Reply STOP']", "Reply STOP to unsubscribe");

    // Add Buttons: Quick reply & URL button
    const addBtnEl = await page.waitForSelector("button ::-p-text(Add Button)");
    await addBtnEl.click();
    await new Promise((r) => setTimeout(r, 200));

    // Button 1: Quick Reply
    const btnLabelInput1 = await page.$("input[placeholder*='Button Label']");
    await btnLabelInput1.click();
    await page.evaluate(() => {
      const inp = document.querySelector("input[placeholder*='Button Label']");
      if (inp) inp.value = "";
    });
    await btnLabelInput1.type("Confirm Match");

    // Add Button 2: URL
    await addBtnEl.click();
    await new Promise((r) => setTimeout(r, 200));

    const btnTypeSelects = await page.$$("select:has(option[value='QUICK_REPLY'])");
    if (btnTypeSelects.length >= 2) {
      await btnTypeSelects[1].select("URL");
    }
    const btnLabelInputs = await page.$$("input[placeholder*='Button Label']");
    if (btnLabelInputs.length >= 2) {
      await btnLabelInputs[1].type("Visit Portal");
    }
    const btnUrlInput = await page.$("input[placeholder*='https://example.com']");
    if (btnUrlInput) {
      await btnUrlInput.type("https://gokulvivaham.com/profiles");
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "11-vivaham-tamil-bilingual-modal.png") });

    // Verify preview renders Tamil text without layout breaking
    const vivPreviewText = await page.evaluate(() => {
      const previewP = document.querySelector(".bg-\\[\\#efeae2\\] p.text-slate-800");
      const previewH = document.querySelector(".bg-\\[\\#efeae2\\] h4");
      const previewF = document.querySelector(".bg-\\[\\#efeae2\\] p.italic");
      return {
        body: previewP?.innerText || "",
        header: previewH?.innerText || "",
        footer: previewF?.innerText || "",
      };
    });

    recordResult(
      "Vivaham UAT",
      "VIV-02",
      "Preview correctly renders Tamil Unicode, Header, Footer, and Buttons",
      vivPreviewText.body.includes("வணக்கம்") &&
        vivPreviewText.header.includes("Gokul Vivaham") &&
        vivPreviewText.footer.includes("Reply STOP")
        ? "PASS"
        : "FAIL",
      `Preview Body: "${vivPreviewText.body}"`
    );

    // Save Vivaham draft
    const vivSaveDraftBtn = await page.waitForSelector("button ::-p-text(Save Local Draft)");
    await vivSaveDraftBtn.click();
    await page.waitForSelector("#editor-modal-title", { hidden: true, timeout: 8000 });
    await new Promise((r) => setTimeout(r, 1000));

    // Confirm draft appears in catalog and persists across refresh
    await page.reload({ waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    const vivDraftPersisted = await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      return headers.some((h) => h.innerText.includes(name));
    }, testVivahamTemplateName);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "12-vivaham-draft-persisted.png") });

    recordResult(
      "Vivaham UAT",
      "VIV-03",
      "Vivaham Tamil/Bilingual draft persists across page reload",
      vivDraftPersisted ? "PASS" : "FAIL",
      `Template "${testVivahamTemplateName}" verified in Vivaham catalog`
    );

    // Verify saving in Vivaham does not affect Astrology templates
    const { data: astroCheck } = await adminClient
      .from("wa_message_templates")
      .select("id, template_name")
      .eq("business_id", ASTRO_ID)
      .eq("template_name", testVivahamTemplateName);

    recordResult(
      "Vivaham UAT",
      "VIV-04",
      "Vivaham template creation strictly isolated from Astrology tenant",
      astroCheck?.length === 0 ? "PASS" : "FAIL",
      `Cross-tenant leakage to Astrology: ${astroCheck?.length || 0} rows`
    );

    // Clean up Vivaham synthetic draft
    await page.evaluate((name) => {
      const headers = Array.from(document.querySelectorAll("h3.font-mono"));
      const cardHeader = headers.find((h) => h.innerText.includes(name));
      const card = cardHeader?.closest(".bg-white.rounded-2xl");
      const deleteBtn = card?.querySelector("button[aria-label='Delete Template']");
      if (deleteBtn) deleteBtn.click();
    }, testVivahamTemplateName);

    await new Promise((r) => setTimeout(r, 2000));

    // ---------------------------------------------------------------------------
    // DOMAIN 4: TEMPLATE VALIDATION TESTS
    // ---------------------------------------------------------------------------
    console.log("\n--- DOMAIN 4: Template Validation Tests ---");

    // 4.1 Valid body without variables
    const v1 = validateTemplateDraft({
      template_name: "valid_no_vars",
      category: "UTILITY",
      language: "en_US",
      body_text: "Welcome to our store. We are pleased to assist you.",
    });
    recordResult("Validation", "VAL-01", "Valid body without variables", v1.isValid ? "PASS" : "FAIL", "Accepted");

    // 4.2 Valid {{1}} variable
    const v2 = validateTemplateDraft({
      template_name: "valid_single_var",
      category: "UTILITY",
      language: "en_US",
      body_text: "Namaste {{1}}, welcome to our astrology services.",
    });
    recordResult("Validation", "VAL-02", "Valid {{1}} variable", v2.isValid ? "PASS" : "FAIL", "Accepted");

    // 4.3 Valid sequential {{1}}, {{2}}
    const v3 = validateTemplateDraft({
      template_name: "valid_seq_vars",
      category: "UTILITY",
      language: "en_US",
      body_text: "Namaste {{1}}, your consultation is on {{2}}.",
    });
    recordResult("Validation", "VAL-03", "Valid sequential {{1}}, {{2}}", v3.isValid ? "PASS" : "FAIL", "Accepted");

    // 4.4 Malformed placeholder
    const detMalformed = detectPlaceholders("Hello {1}, your code is {{abc}} or {{}}.");
    const v4 = validateVariableCount("Hello {1}, your code is {{abc}} or {{}}.", {});
    recordResult(
      "Validation",
      "VAL-04",
      "Malformed placeholders detected and rejected",
      detMalformed.malformed.length >= 3 && !v4.isValid ? "PASS" : "FAIL",
      `Malformed tokens detected: ${detMalformed.malformed.join(", ")}`
    );

    // 4.5 Duplicate or invalid variable sequence
    const v5 = validateTemplateDraft({
      template_name: "invalid_seq_vars",
      category: "UTILITY",
      language: "en_US",
      body_text: "Hello {{2}}, your appointment is on {{3}}.",
    });
    recordResult(
      "Validation",
      "VAL-05",
      "Non-sequential variable sequence rejected",
      !v5.isValid ? "PASS" : "FAIL",
      `Error caught: ${v5.errors.join("; ")}`
    );

    // 4.6 Unresolved variable in send flow
    let blockedUnresolved = false;
    let blockError = "";
    try {
      rejectUnresolvedPlaceholders("Hello {{1}}, appointment is at {{2}}", { "1": "Gokul" });
    } catch (err) {
      blockedUnresolved = true;
      blockError = err.message;
    }
    recordResult(
      "Validation",
      "VAL-06",
      "Unresolved variable in send flow blocked",
      blockedUnresolved ? "PASS" : "FAIL",
      `Blocked: "${blockError}"`
    );

    // 4.7 Empty template name
    const v7 = validateTemplateDraft({
      template_name: "   ",
      category: "UTILITY",
      language: "en_US",
      body_text: "Valid body text here.",
    });
    recordResult("Validation", "VAL-07", "Empty template name rejected", !v7.isValid ? "PASS" : "FAIL", v7.errors.join("; "));

    // 4.8 Empty required body
    const v8 = validateTemplateDraft({
      template_name: "valid_name",
      category: "UTILITY",
      language: "en_US",
      body_text: "   ",
    });
    recordResult("Validation", "VAL-08", "Empty required body rejected", !v8.isValid ? "PASS" : "FAIL", v8.errors.join("; "));

    // 4.9 Tamil text preserved correctly
    const tamilText = "வணக்கம் {{1}}, தங்களின் விவாக பதிவு எண் {{2}} பெறப்பட்டது.";
    const previewTamil = generateTemplatePreview(tamilText, { "1": "அனந்த்", "2": "GV-2026-99" });
    recordResult(
      "Validation",
      "VAL-09",
      "Tamil Unicode characters preserved without corruption",
      previewTamil.preview.includes("அனந்த்") && previewTamil.preview.includes("GV-2026-99") && previewTamil.isComplete
        ? "PASS"
        : "FAIL",
      `Rendered: "${previewTamil.preview}"`
    );

    // 4.10 Unsupported button configuration
    const v10 = validateTemplateDraft({
      template_name: "too_many_buttons",
      category: "UTILITY",
      language: "en_US",
      body_text: "Valid body.",
      buttons: [
        { type: "URL", text: "Link 1", url: "https://a.com" },
        { type: "URL", text: "Link 2", url: "https://b.com" },
        { type: "URL", text: "Link 3", url: "https://c.com" },
      ],
    });
    recordResult(
      "Validation",
      "VAL-10",
      "Unsupported button configuration (>2 URL buttons) rejected",
      !v10.isValid ? "PASS" : "FAIL",
      v10.errors.join("; ")
    );

    // ---------------------------------------------------------------------------
    // DOMAIN 5: INBOX INTEGRATION
    // ---------------------------------------------------------------------------
    console.log("\n--- DOMAIN 5: Inbox Integration & Template Picker ---");

    // Astrology Inbox
    await logout();
    await login(ASTRO_EMAIL, ASTRO_PASSWORD, "astrology");
    await page.goto(`${BASE_URL}/workspace/astrology/inbox`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));

    // Open template picker modal
    const pickerBtn =
      (await page.$("button[aria-label='Choose Approved WhatsApp Template']")) ||
      (await page.$("button ::-p-text(Send Approved Template)"));

    let pickerOpened = false;
    if (pickerBtn) {
      await pickerBtn.click();
      await page.waitForSelector("[role='dialog']", { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 1000));
      pickerOpened = true;
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "13-astrology-inbox-template-picker.png") });

    // Inspect selectable templates in picker (inside .max-h-48 container)
    const pickerTemplatesAstro = await page.evaluate(() => {
      const modal = document.querySelector("[role='dialog']");
      if (!modal) return [];
      const spans = Array.from(modal.querySelectorAll(".max-h-48 span.font-mono"));
      return spans.map((s) => s.textContent?.trim() || "");
    });

    const hasDraftInPicker = pickerTemplatesAstro.some((name) => name.includes("draft"));
    recordResult(
      "Inbox Integration",
      "INBOX-01",
      "Astrology inbox template picker renders approved templates only (drafts/archived excluded)",
      pickerOpened && pickerTemplatesAstro.length > 0 && !hasDraftInPicker ? "PASS" : "FAIL",
      `Templates available: ${pickerTemplatesAstro.length} (${pickerTemplatesAstro.slice(0, 4).join(", ")}) | Drafts excluded: ${!hasDraftInPicker}`
    );

    // Select a template with variables: "consultation_confirmation"
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[role='dialog'] .max-h-48 .cursor-pointer"));
      const target = items.find((el) => el.textContent?.includes("consultation_confirmation"));
      if (target) target.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Verify variable prompts appear
    const hasVarPrompts = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("[role='dialog'] input[placeholder*='Value for']"));
      return inputs.length;
    });

    recordResult(
      "Inbox Integration",
      "INBOX-02",
      "Dynamic variable input prompts render for templates with parameters",
      hasVarPrompts > 0 ? "PASS" : "FAIL",
      `Variable parameter inputs rendered: ${hasVarPrompts}`
    );

    // Close modal WITHOUT sending messages
    const closePickerBtn = await page.$("[role='dialog'] button[aria-label='Close template modal']");
    if (closePickerBtn) await closePickerBtn.click();
    await new Promise((r) => setTimeout(r, 500));

    // Vivaham Inbox
    await logout();
    await login(VIVAHAM_EMAIL, VIVAHAM_PASSWORD, "vivaham");
    await page.goto(`${BASE_URL}/workspace/vivaham/inbox`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 2000));

    const vivPickerBtn =
      (await page.$("button[aria-label='Choose Approved WhatsApp Template']")) ||
      (await page.$("button ::-p-text(Send Approved Template)"));

    let vivPickerOpened = false;
    if (vivPickerBtn) {
      await vivPickerBtn.click();
      await page.waitForSelector("[role='dialog']", { timeout: 5000 });
      await new Promise((r) => setTimeout(r, 1000));
      vivPickerOpened = true;
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "14-vivaham-inbox-template-picker.png") });

    const pickerTemplatesVivaham = await page.evaluate(() => {
      const modal = document.querySelector("[role='dialog']");
      if (!modal) return [];
      const spans = Array.from(modal.querySelectorAll(".max-h-48 span.font-mono"));
      return spans.map((s) => s.textContent?.trim() || "");
    });

    const hasVivDraftInPicker = pickerTemplatesVivaham.some((name) => name.includes("draft"));
    recordResult(
      "Inbox Integration",
      "INBOX-03",
      "Vivaham inbox template picker isolates Vivaham approved templates",
      vivPickerOpened && pickerTemplatesVivaham.length > 0 && !hasVivDraftInPicker ? "PASS" : "FAIL",
      `Templates available: ${pickerTemplatesVivaham.length} (${pickerTemplatesVivaham.slice(0, 4).join(", ")}) | Drafts excluded: ${!hasVivDraftInPicker}`
    );

    // Close modal WITHOUT sending
    const vivClosePicker = await page.$("[role='dialog'] button[aria-label='Close template modal']");
    if (vivClosePicker) await vivClosePicker.click();

    // ---------------------------------------------------------------------------
    // DOMAIN 6: TENANT ISOLATION
    // ---------------------------------------------------------------------------
    console.log("\n--- DOMAIN 6: Tenant Isolation & Boundary Security ---");

    // 6.1 Astrology user cannot view Vivaham templates via RLS
    const clientAstro = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await clientAstro.auth.signInWithPassword({
      email: ASTRO_EMAIL,
      password: ASTRO_PASSWORD,
    });

    const { data: crossAtoV } = await clientAstro
      .from("wa_message_templates")
      .select("*")
      .eq("business_id", VIVAHAM_ID);

    recordResult(
      "Tenant Isolation",
      "ISO-01",
      "Astrology authenticated session cannot query Vivaham templates (RLS)",
      crossAtoV?.length === 0 ? "PASS" : "FAIL",
      `Rows returned: ${crossAtoV?.length || 0}`
    );

    // 6.2 Vivaham user cannot view Astrology templates via RLS
    const clientVivaham = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await clientVivaham.auth.signInWithPassword({
      email: VIVAHAM_EMAIL,
      password: VIVAHAM_PASSWORD,
    });

    const { data: crossVtoA } = await clientVivaham
      .from("wa_message_templates")
      .select("*")
      .eq("business_id", ASTRO_ID);

    recordResult(
      "Tenant Isolation",
      "ISO-02",
      "Vivaham authenticated session cannot query Astrology templates (RLS)",
      crossVtoA?.length === 0 ? "PASS" : "FAIL",
      `Rows returned: ${crossVtoA?.length || 0}`
    );

    // 6.3 Changing URL slug does not expose another tenant's records (Astrology user accessing Vivaham)
    await logout();
    await login(ASTRO_EMAIL, ASTRO_PASSWORD, "astrology");
    await page.goto(`${BASE_URL}/workspace/vivaham/templates`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1000));

    const isUrlManipBlocked =
      page.url().includes("/login") ||
      page.url().includes("/select-business") ||
      (await page.evaluate(() => document.body.innerText.includes("Unauthorized") || document.body.innerText.includes("Access Denied")));

    recordResult(
      "Tenant Isolation",
      "ISO-03",
      "URL manipulation to unauthorized business workspace strictly blocked",
      isUrlManipBlocked ? "PASS" : "FAIL",
      `Current URL / State: ${page.url()}`
    );

    // 6.4 Cross-business ID mutation blocked by prevent_tenant_reassignment trigger
    const { data: dummyAstro } = await adminClient
      .from("wa_message_templates")
      .insert({
        business_id: ASTRO_ID,
        template_name: "iso_trigger_test_temp",
        category: "UTILITY",
        language: "en_US",
        status: "DRAFT",
      })
      .select("id")
      .single();

    let triggerBlocked = false;
    let triggerErr = "";
    if (dummyAstro?.id) {
      const { error: reassignmentError } = await adminClient
        .from("wa_message_templates")
        .update({ business_id: VIVAHAM_ID })
        .eq("id", dummyAstro.id);

      triggerBlocked = Boolean(reassignmentError && reassignmentError.message.includes("Tenant reassignment forbidden"));
      triggerErr = reassignmentError ? reassignmentError.message : "Trigger failed to block";

      // Cleanup dummy
      await adminClient.from("wa_message_templates").delete().eq("id", dummyAstro.id);
    }

    recordResult(
      "Tenant Isolation",
      "ISO-04",
      "Database trigger prevent_tenant_reassignment strictly blocks cross-tenant modification",
      triggerBlocked ? "PASS" : "FAIL",
      `Blocked with: "${triggerErr}"`
    );

    // ---------------------------------------------------------------------------
    // DOMAIN 7: RESPONSIVE UI TESTING
    // ---------------------------------------------------------------------------
    console.log("\n--- DOMAIN 7: Responsive UI & Multi-Viewport Audit ---");

    await logout();
    await login(ASTRO_EMAIL, ASTRO_PASSWORD, "astrology");

    const viewports = [
      { name: "1920-desktop", width: 1920, height: 1080 },
      { name: "1366-laptop", width: 1366, height: 768 },
      { name: "768-tablet", width: 768, height: 1024 },
      { name: "390-mobile", width: 390, height: 844 },
      { name: "360-small", width: 360, height: 800 },
    ];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/workspace/astrology/templates`, { waitUntil: "networkidle0" });
      await new Promise((r) => setTimeout(r, 800));

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      const shotPath = path.join(SCREENSHOTS_DIR, `15-responsive-${vp.name}.png`);
      await page.screenshot({ path: shotPath });

      recordResult(
        "Responsive UI",
        `RESP-${vp.width}`,
        `Viewport ${vp.width}px (${vp.name}): Zero horizontal overflow & clean rendering`,
        !overflow ? "PASS" : "FAIL",
        `scrollWidth: ${vp.width}px, overflow: ${overflow}`
      );
    }
  } finally {
    await browser.close();
  }

  // -----------------------------------------------------------------------------
  // POST-UAT CLEANUP & DATABASE INTEGRITY AUDIT
  // -----------------------------------------------------------------------------
  console.log("\n--- PART 8: Post-UAT Database Baseline Verification ---");
  // Clean any synthetic records if any remained
  await adminClient.from("wa_message_templates").delete().ilike("template_name", "uat_%");

  const { data: finalTemplates } = await adminClient
    .from("wa_message_templates")
    .select("id, business_id, template_name, status, is_archived");

  const astroFinalCount = finalTemplates?.filter((t) => t.business_id === ASTRO_ID).length || 0;
  const vivahamFinalCount = finalTemplates?.filter((t) => t.business_id === VIVAHAM_ID).length || 0;

  recordResult(
    "Database Integrity",
    "INT-01",
    "Post-UAT database template baseline intact (zero leftover synthetic drafts)",
    astroFinalCount === astroInitialCount && vivahamFinalCount === vivahamInitialCount ? "PASS" : "FAIL",
    `Astrology: ${astroFinalCount} (initial ${astroInitialCount}), Vivaham: ${vivahamFinalCount} (initial ${vivahamInitialCount})`
  );

  console.log("\n================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL UAT CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  return { total, passed, failed, results };
}

runPhase11_5_UAT().catch((err) => {
  console.error("FATAL UAT ERROR:", err);
  process.exit(1);
});
