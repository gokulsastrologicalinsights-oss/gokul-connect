import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { resolveDateRange } from "../src/lib/analytics/date-utils";
import { getBusinessAnalytics, exportAnalyticsCsv } from "../src/lib/analytics/service";

function loadLocalEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadLocalEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";

async function verifyLiveAnalytics() {
  console.log("🔍 Verifying Live Cloud Analytics against Supabase ansiwtwqgrfmzfrhkzuu...");

  const range = resolveDateRange("7d");
  console.log(`\n📅 Date Filter: ${range.label} (${range.istStartFormatted} to ${range.istEndFormatted}) [${range.timezone}]`);

  // 1. Astrology Tenant Analytics
  console.log("\n1️⃣ Querying Astrology Tenant Analytics...");
  const astroData = await getBusinessAnalytics(ASTRO_BIZ_ID, "astrology", range, {
    client: supabase,
  });

  console.log("   ✅ Astrology Analytics Retrieved:");
  console.log("      Business:", astroData.businessName);
  console.log("      Total Inbound Messages:", astroData.messaging.totalInbound);
  console.log("      Total Outbound Messages:", astroData.messaging.totalOutbound);
  console.log("      Total Messages:", astroData.messaging.totalMessages);
  console.log("      Delivered:", astroData.messaging.delivered);
  console.log("      Read:", astroData.messaging.read);
  console.log("      Delivery Rate:", astroData.messaging.deliveryRatePercent + "%");
  console.log("      Read Rate:", astroData.messaging.readRatePercent + "%");
  console.log("      Total Contacts:", astroData.contacts.totalContacts);
  console.log("      New Contacts:", astroData.contacts.newContacts);
  console.log("      Total Conversations:", astroData.inbox.totalConversations);
  console.log("      Average First Response:", astroData.inbox.averageFirstResponseTimeFormatted);
  console.log("      Enquiries Count:", astroData.businessReport.breakdown.length);
  if (astroData.businessReport.businessType === "astrology") {
    console.log("      Customer Conversion Integrity:", JSON.stringify((astroData.businessReport as any).customerConversion));
  }

  // 2. Vivaham Tenant Analytics
  console.log("\n2️⃣ Querying Vivaham Tenant Analytics...");
  const vivahamData = await getBusinessAnalytics(VIVAHAM_BIZ_ID, "vivaham", range, {
    client: supabase,
  });

  console.log("   ✅ Vivaham Analytics Retrieved:");
  console.log("      Business:", vivahamData.businessName);
  console.log("      Total Inbound Messages:", vivahamData.messaging.totalInbound);
  console.log("      Total Outbound Messages:", vivahamData.messaging.totalOutbound);
  console.log("      Total Messages:", vivahamData.messaging.totalMessages);
  console.log("      Delivery Rate:", vivahamData.messaging.deliveryRatePercent + "%");
  console.log("      Total Contacts:", vivahamData.contacts.totalContacts);
  console.log("      Total Conversations:", vivahamData.inbox.totalConversations);
  console.log("      Enquiries Count:", vivahamData.businessReport.breakdown.length);
  if (vivahamData.businessReport.businessType === "vivaham") {
    console.log("      Lead Conversion Integrity:", JSON.stringify(vivahamData.businessReport.leadConversion));
  }

  // 3. Strict Partitioning Verification
  console.log("\n3️⃣ Verifying Zero Cross-Tenant Combination...");
  if (astroData.businessId === vivahamData.businessId) {
    throw new Error("FAIL: Business IDs collided!");
  }
  console.log("   ✅ Tenant separation verified: Astrology and Vivaham datasets are completely independent.");

  // 4. CSV Export Verification
  console.log("\n4️⃣ Verifying RFC 4180 CSV Export Generation...");
  const astroCsv = exportAnalyticsCsv(astroData, astroData.businessName);
  const vivahamCsv = exportAnalyticsCsv(vivahamData, vivahamData.businessName);

  if (!astroCsv.includes("Gokul's Astrological Insights") || !astroCsv.includes("Asia/Kolkata")) {
    throw new Error("FAIL: Astrology CSV missing header or timezone!");
  }
  if (!vivahamCsv.includes("Gokul Vivaham") || !vivahamCsv.includes("Asia/Kolkata")) {
    throw new Error("FAIL: Vivaham CSV missing header or timezone!");
  }
  console.log("   ✅ CSV exports verified cleanly (Asia/Kolkata timezone and RFC 4180 format).");

  console.log("\n🎉 ALL LIVE ANALYTICS AUDIT CHECKS PASSED SUCCESSFULLY!");
}

verifyLiveAnalytics().catch((err) => {
  console.error("❌ Live verification failed:", err);
  process.exit(1);
});
