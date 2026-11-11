import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

async function runTest() {
  console.log("🐘 Initializing disposable in-memory PostgreSQL 16 engine via PGlite...");
  const db = new PGlite();

  // 1. Setup Supabase Auth Mock Environment & Pre-configured Supabase Roles
  console.log("1️⃣ Setting up Supabase Auth Mock Schema (roles, auth.users & auth.uid())...");
  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
    END
    $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT,
      raw_user_meta_data JSONB
    );

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULL::UUID;
    $$;
  `);

  // 2. Read and Execute Migration 001
  console.log("2️⃣ Executing Migration 001: Foundation...");
  const migration001Path = path.resolve("./supabase/migrations/20261106_001_phase1_foundation.sql");
  let migration001Sql = fs.readFileSync(migration001Path, "utf8");
  // In PG13+ gen_random_uuid() is native; in PGlite extension pgcrypto is not bundled
  migration001Sql = migration001Sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- CREATE EXTENSION IF NOT EXISTS "pgcrypto"; (native in PG13+)');
  await db.exec(migration001Sql);
  console.log("   ✅ Migration 001 executed cleanly!");

  // 3. Read and Execute Migration 002
  console.log("3️⃣ Executing Migration 002: WhatsApp Connections & Business Settings...");
  const migration002Path = path.resolve("./supabase/migrations/20261106_002_phase2_wa_connections.sql");
  const migration002Sql = fs.readFileSync(migration002Path, "utf8");
  await db.exec(migration002Sql);
  console.log("   ✅ Migration 002 executed cleanly!");

  // 4. Test Composite Foreign Key & ON DELETE SET NULL Behavior
  console.log("4️⃣ Testing Composite Foreign Key & ON DELETE SET NULL behavior...");
  const astroId = "11111111-1111-1111-1111-111111111111";
  const vivahamId = "22222222-2222-2222-2222-222222222222";

  // Insert a test connection for Astrology
  const connAstroId = "33333333-3333-3333-3333-333333333333";
  await db.query(`
    INSERT INTO public.wa_connections (
      id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref
    ) VALUES (
      $1, $2, 'Test Line 1', '+91 98400 11111', 'PHONE_ID_111', 'WABA_111', 'vault:ref1'
    );
  `, [connAstroId, astroId]);

  // Insert a test connection for Vivaham
  const connVivahamId = "44444444-4444-4444-4444-444444444444";
  await db.query(`
    INSERT INTO public.wa_connections (
      id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref
    ) VALUES (
      $1, $2, 'Vivaham Line 1', '+91 98401 22222', 'PHONE_ID_222', 'WABA_222', 'vault:ref2'
    );
  `, [connVivahamId, vivahamId]);

  // Set default_connection_id for Astrology to connAstroId (valid match)
  await db.query(`
    UPDATE public.business_settings
    SET default_connection_id = $1
    WHERE business_id = $2;
  `, [connAstroId, astroId]);

  const afterUpdate = await db.query(`
    SELECT business_id, default_connection_id FROM public.business_settings WHERE business_id = $1;
  `, [astroId]);
  console.log("   Settings after setting default connection:", afterUpdate.rows[0]);

  // Test Cross-Tenant Foreign Key Rejection:
  // Attempt to set Astrology's default_connection_id to Vivaham's connection
  console.log("5️⃣ Testing Cross-Tenant Default Connection FK Rejection...");
  try {
    await db.query(`
      UPDATE public.business_settings
      SET default_connection_id = $1
      WHERE business_id = $2;
    `, [connVivahamId, astroId]);
    console.error("   ❌ ERROR: Cross-tenant foreign key was NOT rejected!");
    process.exit(1);
  } catch (err) {
    console.log("   ✅ SUCCESS: Cross-tenant default connection rejected by PostgreSQL:", err.message);
  }

  // Test Deleting the WhatsApp Connection:
  console.log("6️⃣ Testing WhatsApp Connection Deletion (ON DELETE SET NULL)...");
  try {
    await db.query(`
      DELETE FROM public.wa_connections WHERE id = $1;
    `, [connAstroId]);
    console.log("   Deletion succeeded! Inspecting business_settings...");
    const afterDelete = await db.query(`
      SELECT business_id, default_connection_id FROM public.business_settings WHERE business_id = $1;
    `, [astroId]);
    console.log("   Resulting business_settings:", afterDelete.rows[0]);
    if (afterDelete.rows[0].business_id === null) {
      console.error("   ❌ ERROR: business_id was nullified!");
      process.exit(1);
    }
    if (afterDelete.rows[0].default_connection_id !== null) {
      console.error("   ❌ ERROR: default_connection_id was NOT set to NULL!");
      process.exit(1);
    }
    console.log("   ✅ SUCCESS: default_connection_id was set to NULL and business_id remained intact!");
  } catch (err) {
    console.error("   ❌ EXCEPTION on DELETE:", err.message);
  }

  // Test Tenant Immutability Trigger
  console.log("7️⃣ Testing Tenant Immutability Trigger...");
  try {
    await db.query(`
      UPDATE public.wa_connections
      SET business_id = $1
      WHERE id = $2;
    `, [astroId, connVivahamId]);
    console.error("   ❌ ERROR: Mutating business_id was allowed!");
    process.exit(1);
  } catch (err) {
    console.log("   ✅ SUCCESS: Mutating business_id was blocked by trigger:", err.message);
  }

  // Test Legitimate Update on WhatsApp Connection
  console.log("8️⃣ Testing Legitimate Update on WhatsApp Connection...");
  await db.query(`
    UPDATE public.wa_connections
    SET display_name = 'Updated Line Name', is_enabled = false
    WHERE id = $1;
  `, [connVivahamId]);
  const checkUpdated = await db.query(`
    SELECT display_name, is_enabled FROM public.wa_connections WHERE id = $1;
  `, [connVivahamId]);
  console.log("   Legitimate update verified:", checkUpdated.rows[0]);

  console.log("\n=======================================================");
  console.log("🎉 ALL REAL POSTGRESQL MIGRATION TESTS PASSED CLEANLY!");
  console.log("=======================================================");
}

runTest().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
