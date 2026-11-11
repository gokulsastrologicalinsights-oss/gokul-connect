const { execSync } = require('child_process');
const path = require('path');

const migrations = [
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

for (const m of migrations) {
  const filePath = path.join('supabase/migrations', m);
  console.log(`Applying ${m}...`);
  const cmd = `"C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" -h 127.0.0.1 -p 5433 -U postgres -d gokul_connect_gate2_rls_test -v ON_ERROR_STOP=1 -f "${filePath}"`;
  execSync(cmd, { stdio: 'inherit' });
}
console.log('All migrations 016-024 applied successfully to gokul_connect_gate2_rls_test.');
