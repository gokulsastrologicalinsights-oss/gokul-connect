import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== 1. STORAGE BUCKETS INSPECTION ===');
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) {
    console.error('Error fetching buckets:', bErr);
  } else {
    console.log('Found buckets:', buckets.map(b => ({
      id: b.id,
      name: b.name,
      public: b.public,
      file_size_limit: b.file_size_limit,
      allowed_mime_types: b.allowed_mime_types
    })));
  }

  console.log('\n=== 2. MIGRATION LEDGER INSPECTION ===');
  // Try querying schema_migrations
  const { data: migrations, error: mErr } = await admin
    .schema('supabase_migrations')
    .from('schema_migrations')
    .select('*')
    .order('version', { ascending: true });
  
  if (mErr) {
    console.log('Direct query to supabase_migrations.schema_migrations:', mErr.message);
  } else {
    console.log(`Found ${migrations.length} recorded migration(s):`, migrations);
  }

  console.log('\n=== 3. REALTIME PUBLICATION INSPECTION VIA REST/RPC ===');
  // Check if any RPC or direct query can inspect publications
  const { data: rpcData, error: rpcErr } = await admin.rpc('get_service_health');
  if (rpcErr) {
    console.log('get_service_health RPC:', rpcErr.message);
  } else {
    console.log('get_service_health RPC returned:', rpcData);
  }
}

run().catch(console.error);
