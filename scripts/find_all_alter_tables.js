const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve('supabase/migrations');
const migrationFiles = [
  '20261107_016_phase12_1_team_management_and_agent_assignment.sql',
  '20261107_017_phase12_2_media_messaging.sql',
  '20261108_018_phase12_3_scheduled_messages.sql',
  '20261108_019_phase12_4_campaign_management.sql',
  '20261108_020_phase12_5_crm_lifecycle_and_followups.sql',
  '20261109_021_phase12_6_notification_center_and_durable_reminders.sql',
  '20261109_022_phase12_7_visual_flows_and_realtime.sql',
  '20261109_023_phase2_operational_reliability.sql',
  '20261109_024_phase_p3_2_labels_and_cron_locks.sql'
];

const baselineTables = [
  "business_members", "business_settings", "businesses", "contact_activity_logs",
  "contact_notes", "crm_categories", "crm_segments", "user_profiles",
  "wa_automation_execution_logs", "wa_automation_rules", "wa_connections",
  "wa_contacts", "wa_conversations", "wa_credentials", "wa_message_templates",
  "wa_messages", "wa_processing_jobs", "wa_rule_actions", "wa_rule_conditions", "wa_webhook_events"
];

for (const file of migrationFiles) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  console.log(`\n=== FILE: ${file} ===`);

  // Find all ALTER TABLE statements
  const alterRegex = /ALTER\s+TABLE\s+(?:ONLY\s+)?([^\s;]+)\s+([^;]+);/gis;
  let match;
  while ((match = alterRegex.exec(content)) !== null) {
    const rawTable = match[1].replace(/public\./, '').replace(/"/g, '');
    const operation = match[2].replace(/\s+/g, ' ').trim();
    const isBaseline = baselineTables.includes(rawTable);
    console.log(`  ALTER TABLE ${rawTable} [Baseline: ${isBaseline}]: ${operation}`);
  }
}
