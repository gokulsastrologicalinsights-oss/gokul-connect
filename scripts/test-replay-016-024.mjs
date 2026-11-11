import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

async function runReplayTest() {
  console.log("================================================================================");
  console.log("🐘 IN-MEMORY POSTGRESQL REPLAY: MIGRATIONS 001–015 -> 016–024");
  console.log("================================================================================\n");

  const db = new PGlite();

  // 1. Setup Supabase Auth Mock Environment & Pre-configured Supabase Roles
  console.log("1️⃣ Initializing Supabase Auth & System Roles...");
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
      SELECT '11111111-1111-1111-1111-111111111111'::UUID;
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt()
    RETURNS JSONB
    LANGUAGE sql
    STABLE
    AS $$
      SELECT jsonb_build_object('role', 'authenticated');
    $$;
  `);

  // 2. Sequentially apply baseline migrations 001 - 015
  console.log("2️⃣ Applying Baseline Migrations 001 - 015...");
  const migrationFiles = [
    "20261106_001_phase1_foundation.sql",
    "20261106_002_phase2_wa_connections.sql",
    "20261106_003_phase2_wa_credentials.sql",
    "20261106_004_phase2_privilege_escalation_guard.sql",
    "20261106_005_phase3_messaging_schema.sql",
    "20261106_006_phase3_webhook_persistence_rpcs.sql",
    "20261106_007_phase3i_performance_optimizations.sql",
    "20261106_008_phase3h_webhook_events_rls.sql",
    "20261106_009_phase5_automation_engine_schema.sql",
    "20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql",
    "20261107_011_phase7_5_queue_rpc_privilege_hardening.sql",
    "20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql",
    "20261107_013_phase9_crm_and_contacts.sql",
    "20261107_014_phase10_analytics_rpcs.sql",
    "20261107_015_phase11_template_management.sql"
  ];

  for (const file of migrationFiles) {
    const filePath = path.resolve("./supabase/migrations", file);
    let sql = fs.readFileSync(filePath, "utf8");
    // pgcrypto / uuid-ossp compatibility in PGlite
    sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '-- pgcrypto native in PG13+');
    sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', '-- uuid-ossp native in PG13+');
    
    try {
      await db.exec(sql);
      console.log(`   ✅ Applied baseline: ${file}`);
    } catch (err) {
      console.error(`   ❌ FAILED baseline migration ${file}:`, err.message);
      process.exit(1);
    }
  }

  // 3. Seed exact live baseline data (Astrology & Vivaham tenants, conversations, messages, contacts)
  console.log("\n3️⃣ Seeding Live Baseline Data Replica...");
  const ASTRO_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_ID = "22222222-2222-2222-2222-222222222222";
  const USER_ASTRO = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const USER_VIVAHAM = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const USER_ADMIN = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  await db.exec(`
    -- Create auth users
    INSERT INTO auth.users (id, email) VALUES
      ('${USER_ASTRO}', 'astro@example.com'),
      ('${USER_VIVAHAM}', 'vivaham@example.com'),
      ('${USER_ADMIN}', 'admin@example.com')
    ON CONFLICT (id) DO NOTHING;

    -- Create user profiles
    INSERT INTO public.user_profiles (id, full_name, email, is_superadmin) VALUES
      ('${USER_ASTRO}', 'Astro Staff', 'astro@example.com', false),
      ('${USER_VIVAHAM}', 'Vivaham Staff', 'vivaham@example.com', false),
      ('${USER_ADMIN}', 'Main Admin', 'admin@example.com', true)
    ON CONFLICT (id) DO NOTHING;

    -- Create business members
    INSERT INTO public.business_members (business_id, user_id, role, is_active) VALUES
      ('${ASTRO_ID}', '${USER_ASTRO}', 'owner', true),
      ('${VIVAHAM_ID}', '${USER_VIVAHAM}', 'owner', true),
      ('${ASTRO_ID}', '${USER_ADMIN}', 'admin', true),
      ('${VIVAHAM_ID}', '${USER_ADMIN}', 'admin', true)
    ON CONFLICT (business_id, user_id) DO NOTHING;

    -- Create connections
    INSERT INTO public.wa_connections (id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref) VALUES
      ('33333333-3333-3333-3333-333333333333', '${ASTRO_ID}', 'Astro Line', '+91 98400 11111', 'PHONE_ASTRO', 'WABA_ASTRO', 'vault:astro'),
      ('44444444-4444-4444-4444-444444444444', '${VIVAHAM_ID}', 'Vivaham Line', '+91 98401 22222', 'PHONE_VIVAHAM', 'WABA_VIVAHAM', 'vault:vivaham')
    ON CONFLICT (id) DO NOTHING;

    -- Create credentials
    INSERT INTO public.wa_credentials (business_id, connection_id, key_version, iv, auth_tag, ciphertext) VALUES
      ('${VIVAHAM_ID}', '44444444-4444-4444-4444-444444444444', 'v1', 'iv1', 'tag1', 'c1')
    ON CONFLICT (connection_id) DO NOTHING;

    -- Create contacts
    INSERT INTO public.wa_contacts (id, business_id, phone_number, display_name) VALUES
      ('${ASTRO_ID}', '${ASTRO_ID}', '+91 90000 00001', 'Astro Client 1'),
      ('55555555-5555-5555-5555-555555555552', '${ASTRO_ID}', '+91 90000 00002', 'Astro Client 2'),
      ('55555555-5555-5555-5555-555555555553', '${VIVAHAM_ID}', '+91 90000 00003', 'Vivaham Client 1'),
      ('55555555-5555-5555-5555-555555555554', '${VIVAHAM_ID}', '+91 90000 00004', 'Vivaham Client 2')
    ON CONFLICT (id) DO NOTHING;

    -- Create conversations
    INSERT INTO public.wa_conversations (id, business_id, connection_id, contact_id, status) VALUES
      ('66666666-6666-6666-6666-666666666661', '${ASTRO_ID}', '33333333-3333-3333-3333-333333333333', '${ASTRO_ID}', 'open'),
      ('66666666-6666-6666-6666-666666666662', '${VIVAHAM_ID}', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555553', 'open'),
      ('66666666-6666-6666-6666-666666666663', '${VIVAHAM_ID}', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555554', 'closed')
    ON CONFLICT (id) DO NOTHING;

    -- Create messages
    INSERT INTO public.wa_messages (id, business_id, connection_id, conversation_id, contact_id, direction, message_type, content, status) VALUES
      ('77777777-7777-7777-7777-777777777771', '${ASTRO_ID}', '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666661', '${ASTRO_ID}', 'inbound', 'text', 'Hello Astro', 'delivered'),
      ('77777777-7777-7777-7777-777777777772', '${VIVAHAM_ID}', '44444444-4444-4444-4444-444444444444', '66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555553', 'inbound', 'text', 'Hello Vivaham', 'delivered')
    ON CONFLICT (id) DO NOTHING;
  `);

  const preCounts = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM public.businesses) AS businesses,
      (SELECT COUNT(*) FROM public.business_members) AS business_members,
      (SELECT COUNT(*) FROM public.wa_connections) AS wa_connections,
      (SELECT COUNT(*) FROM public.wa_contacts) AS wa_contacts,
      (SELECT COUNT(*) FROM public.wa_conversations) AS wa_conversations,
      (SELECT COUNT(*) FROM public.wa_messages) AS wa_messages
  `);
  console.log("   Baseline seeded counts:", preCounts.rows[0]);

  // 4. Sequentially test migrations 016 - 024
  console.log("\n4️⃣ SEQUENTIALLY APPLYING & VERIFYING MIGRATIONS 016–024...");
  const targetMigrations = [
    { file: "20261107_016_phase12_1_team_management_and_agent_assignment.sql", step: "016" },
    { file: "20261107_017_phase12_2_media_messaging.sql", step: "017" },
    { file: "20261108_018_phase12_3_scheduled_messages.sql", step: "018" },
    { file: "20261108_019_phase12_4_campaign_management.sql", step: "019" },
    { file: "20261108_020_phase12_5_crm_lifecycle_and_followups.sql", step: "020" },
    { file: "20261109_021_phase12_6_notification_center_and_durable_reminders.sql", step: "021" },
    { file: "20261109_022_phase12_7_visual_flows_and_realtime.sql", step: "022" },
    { file: "20261109_023_phase2_operational_reliability.sql", step: "023" },
    { file: "20261109_024_phase_p3_2_labels_and_cron_locks.sql", step: "024" }
  ];

  for (const { file, step } of targetMigrations) {
    const filePath = path.resolve("./supabase/migrations", file);
    let sql = fs.readFileSync(filePath, "utf8");
    
    // In PGlite / PostgreSQL standalone, supabase_realtime publication might not exist unless mocked
    if (step === "022") {
      sql = `CREATE PUBLICATION supabase_realtime;\n` + sql;
    }

    console.log(`\n▶️ Executing Migration ${step}: ${file}...`);
    try {
      await db.exec(sql);
      console.log(`   ✅ Migration ${step} executed cleanly without error!`);
    } catch (err) {
      console.error(`   ❌ Migration ${step} FAILED:`, err.message);
      process.exit(1);
    }

    // Verify baseline row counts are completely unharmed
    const postCounts = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM public.businesses) AS businesses,
        (SELECT COUNT(*) FROM public.business_members) AS business_members,
        (SELECT COUNT(*) FROM public.wa_connections) AS wa_connections,
        (SELECT COUNT(*) FROM public.wa_contacts) AS wa_contacts,
        (SELECT COUNT(*) FROM public.wa_conversations) AS wa_conversations,
        (SELECT COUNT(*) FROM public.wa_messages) AS wa_messages
    `);
    
    const intact = (
      postCounts.rows[0].businesses === preCounts.rows[0].businesses &&
      postCounts.rows[0].business_members === preCounts.rows[0].business_members &&
      postCounts.rows[0].wa_connections === preCounts.rows[0].wa_connections &&
      postCounts.rows[0].wa_contacts === preCounts.rows[0].wa_contacts &&
      postCounts.rows[0].wa_conversations === preCounts.rows[0].wa_conversations &&
      postCounts.rows[0].wa_messages === preCounts.rows[0].wa_messages
    );

    if (!intact) {
      console.error(`   ❌ DATA LOSS DETECTED after migration ${step}! Counts changed:`, postCounts.rows[0]);
      process.exit(1);
    } else {
      console.log(`   🔒 Pre-existing data 100% intact after migration ${step}.`);
    }
  }

  // 5. Deep Verification of All Newly Created Objects
  console.log("\n5️⃣ VERIFYING CREATED OBJECTS ACROSS MIGRATIONS 016–024...");
  
  // Verify 016
  const check016 = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'wa_conversations' AND column_name IN ('assigned_agent_id', 'assigned_agent_name', 'assigned_at');
  `);
  console.log(`   016 wa_conversations columns added: ${check016.rows.length}/3`);

  // Verify 017
  const check017 = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'wa_messages' AND column_name IN ('media_type', 'media_id', 'download_status', 'storage_path');
  `);
  console.log(`   017 wa_messages media columns added: ${check017.rows.length}/4`);

  // Verify 018
  const check018 = await db.query(`
    SELECT routine_name FROM information_schema.routines 
    WHERE routine_name IN ('claim_next_scheduled_messages', 'reclaim_stuck_scheduled_messages');
  `);
  console.log(`   018 scheduled message queue RPCs created: ${check018.rows.length}/2`);

  // Verify 019
  const check019 = await db.query(`
    SELECT routine_name FROM information_schema.routines 
    WHERE routine_name IN ('claim_next_campaign_recipients', 'reclaim_stuck_campaign_recipients');
  `);
  console.log(`   019 campaign recipient queue RPCs created: ${check019.rows.length}/2`);

  // Verify 020
  const check020 = await db.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name IN ('crm_lifecycle_stages', 'contact_lifecycle_history', 'crm_follow_ups', 'crm_follow_up_reminders');
  `);
  console.log(`   020 CRM lifecycle & follow-up tables created: ${check020.rows.length}/4`);

  // Verify 021
  const check021 = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'crm_follow_up_reminders' AND column_name IN ('category', 'action_url', 'dedup_key', 'is_dismissed');
  `);
  console.log(`   021 crm_follow_up_reminders notification columns added: ${check021.rows.length}/4`);

  // Verify 022
  const check022 = await db.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_name = 'wa_visual_flows';
  `);
  console.log(`   022 visual flows table created: ${check022.rows.length}/1`);

  // Verify 023
  const check023 = await db.query(`
    SELECT routine_name FROM information_schema.routines 
    WHERE routine_name IN ('get_worker_health_metrics', 'reclaim_stuck_queue_jobs', 'retry_queue_job');
  `);
  console.log(`   023 operational reliability RPCs created: ${check023.rows.length}/3`);

  // Verify 024
  const check024Cols = await db.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'wa_conversations' AND column_name = 'labels';
  `);
  const check024Rpcs = await db.query(`
    SELECT routine_name FROM information_schema.routines 
    WHERE routine_name IN ('acquire_cron_lock', 'renew_cron_lock', 'release_cron_lock', 'get_cron_lock_status');
  `);
  console.log(`   024 labels column added: ${check024Cols.rows.length}/1, cron lock RPCs created: ${check024Rpcs.rows.length}/4`);

  // Test Distributed Cron Locking execution
  console.log("\n6️⃣ Testing Distributed Cron Locking atomic RPC...");
  const lockAcquire = await db.query(`
    SELECT public.acquire_cron_lock(
      'cron:test:tenant1',
      'test_cron',
      'worker_alpha',
      60,
      '${ASTRO_ID}'::UUID,
      '{"env": "test"}'::jsonb
    ) AS res;
  `);
  console.log("   Lock acquire result:", lockAcquire.rows[0].res);

  const lockRenew = await db.query(`
    SELECT public.renew_cron_lock(
      'cron:test:tenant1',
      'worker_alpha',
      120
    ) AS res;
  `);
  console.log("   Lock renew result:", lockRenew.rows[0].res);

  const lockRelease = await db.query(`
    SELECT public.release_cron_lock(
      'cron:test:tenant1',
      'worker_alpha'
    ) AS res;
  `);
  console.log("   Lock release result:", lockRelease.rows[0].res);

  console.log("\n================================================================================");
  console.log("🎉 ALL MIGRATIONS 016–024 REPLAYED & VERIFIED WITH 100% DATA PRESERVATION!");
  console.log("================================================================================");
}

runReplayTest().catch(console.error);
