import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const eq = line.indexOf("=");
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL);

  // Check specifically whether crm_categories or columns exist
  const { data: catData, error: catError } = await supabase.from("crm_categories").select("*").limit(1);
  console.log("crm_categories check:", catError ? catError.message : "Table exists, rows found: " + catData?.length);

  const { data: segData, error: segError } = await supabase.from("crm_segments").select("*").limit(1);
  console.log("crm_segments check:", segError ? segError.message : "Table exists, rows found: " + segData?.length);

  const { data: notesData, error: notesError } = await supabase.from("contact_notes").select("*").limit(1);
  console.log("contact_notes check:", notesError ? notesError.message : "Table exists, rows found: " + notesData?.length);

  const { data: actData, error: actError } = await supabase.from("contact_activity_logs").select("*").limit(1);
  console.log("contact_activity_logs check:", actError ? actError.message : "Table exists, rows found: " + actData?.length);

  // Check column additions on wa_contacts
  const { data: contactCols, error: colsError } = await supabase.from("wa_contacts").select("status, category, is_archived, email, tags, custom_fields").limit(1);
  console.log("wa_contacts columns check:", colsError ? colsError.message : "Columns exist on wa_contacts");

  // Check RPCs from migration 014
  const { data: rpcSummary, error: rpcSummaryError } = await supabase.rpc("get_business_analytics_summary", {
    p_business_id: "11111111-1111-1111-1111-111111111111",
    p_start_date: new Date().toISOString(),
    p_end_date: new Date().toISOString()
  });
  console.log("RPC get_business_analytics_summary check:", rpcSummaryError ? rpcSummaryError.message : "RPC exists and callable");

  const { data: rpcTrends, error: rpcTrendsError } = await supabase.rpc("get_business_analytics_daily_trends", {
    p_business_id: "11111111-1111-1111-1111-111111111111",
    p_start_date: new Date().toISOString(),
    p_end_date: new Date().toISOString()
  });
  console.log("RPC get_business_analytics_daily_trends check:", rpcTrendsError ? rpcTrendsError.message : "RPC exists and callable");
}

inspect();
