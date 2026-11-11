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

const inventory = {};

for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  
  inventory[file] = {
    createTables: [],
    alterTables: [],
    dropTables: [],
    functions: [],
    triggers: [],
    policies: [],
    indexes: [],
    constraints: [],
    publications: [],
    grants: [],
    otherModsToExisting: []
  };

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('--')) continue;

    if (/^CREATE TABLE/i.test(line)) {
      const match = line.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([^\s(]+)/i);
      inventory[file].createTables.push(match ? match[1] : line);
    } else if (/^ALTER TABLE/i.test(line)) {
      const match = line.match(/^ALTER TABLE\s+(?:ONLY\s+)?([^\s(]+)\s+(.*)/i);
      inventory[file].alterTables.push(line);
      if (match) {
        const tbl = match[1].replace(/public\./, '');
        const rest = match[2];
        if (/ADD CONSTRAINT/i.test(rest)) {
          inventory[file].constraints.push(`Table ${tbl}: ${rest}`);
        }
        // Check if pre-existing table
        const baselineTables = [
          "business_members", "business_settings", "businesses", "contact_activity_logs",
          "contact_notes", "crm_categories", "crm_segments", "user_profiles",
          "wa_automation_execution_logs", "wa_automation_rules", "wa_connections",
          "wa_contacts", "wa_conversations", "wa_credentials", "wa_message_templates",
          "wa_messages", "wa_processing_jobs", "wa_rule_actions", "wa_rule_conditions", "wa_webhook_events"
        ];
        if (baselineTables.includes(tbl)) {
          inventory[file].otherModsToExisting.push(`ALTER TABLE ${tbl}: ${rest}`);
        }
      }
    } else if (/^DROP TABLE/i.test(line)) {
      inventory[file].dropTables.push(line);
    } else if (/^CREATE (?:OR REPLACE )?FUNCTION/i.test(line)) {
      const match = line.match(/^CREATE (?:OR REPLACE )?FUNCTION\s+([^\s(]+)/i);
      inventory[file].functions.push(match ? match[1] : line);
    } else if (/^CREATE (?:OR REPLACE )?TRIGGER/i.test(line) || /^CREATE CONSTRAINT TRIGGER/i.test(line)) {
      const match = line.match(/^CREATE (?:OR REPLACE )?(?:CONSTRAINT )?TRIGGER\s+([^\s]+)\s+.*\s+ON\s+([^\s]+)/i);
      inventory[file].triggers.push(line);
    } else if (/^DROP TRIGGER/i.test(line)) {
      inventory[file].triggers.push(line);
    } else if (/^CREATE POLICY/i.test(line)) {
      const match = line.match(/^CREATE POLICY\s+([^\s]+)\s+ON\s+([^\s]+)/i);
      inventory[file].policies.push(match ? `${match[1]} ON ${match[2]}` : line);
    } else if (/^DROP POLICY/i.test(line)) {
      inventory[file].policies.push(line);
    } else if (/^CREATE (?:UNIQUE )?INDEX/i.test(line)) {
      const match = line.match(/^CREATE (?:UNIQUE )?INDEX\s+(?:IF NOT EXISTS\s+)?([^\s]+)\s+ON\s+([^\s(]+)/i);
      inventory[file].indexes.push(match ? `${match[1]} ON ${match[2]}` : line);
    } else if (/^DROP INDEX/i.test(line)) {
      inventory[file].indexes.push(line);
    } else if (/ALTER PUBLICATION/i.test(line) || /CREATE PUBLICATION/i.test(line)) {
      inventory[file].publications.push(line);
    } else if (/^GRANT /i.test(line) || /^REVOKE /i.test(line)) {
      inventory[file].grants.push(line);
    }
  }
}

fs.writeFileSync('scripts/migration_inventory_output.json', JSON.stringify(inventory, null, 2));
console.log('Inventory extracted successfully to scripts/migration_inventory_output.json');
