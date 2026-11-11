import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const content = fs.readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return env;
}

const env = loadEnv();
const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCatalogs() {
  console.log("Checking PostgREST catalog visibility...");
  for (const table of ["pg_tables", "pg_class", "information_schema.tables", "schema_migrations", "supabase_migrations"]) {
    const { data, error } = await adminClient.from(table).select("*").limit(1);
    console.log(`- ${table}:`, error ? `ERROR: ${error.message}` : `OK (${data?.length} rows)`);
  }

  // Let's check schema_migrations with schema prefix if any
  const resSchema = await adminClient.schema("supabase_migrations").from("schema_migrations").select("*");
  console.log("- supabase_migrations.schema_migrations via schema():", resSchema.error ? `ERROR: ${resSchema.error.message}` : resSchema.data);
}

checkCatalogs().catch(console.error);
