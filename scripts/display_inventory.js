const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scripts/migration_inventory_output.json', 'utf8'));

for (const [file, inv] of Object.entries(data)) {
  console.log(`\n================================================================================`);
  console.log(`FILE: ${file}`);
  console.log(`================================================================================`);
  console.log(`  CREATE TABLE (${inv.createTables.length}):`, inv.createTables);
  console.log(`  MODS TO EXISTING BASELINE TABLES (${inv.otherModsToExisting.length}):`);
  inv.otherModsToExisting.forEach(m => console.log(`    * ${m}`));
  console.log(`  FUNCTIONS (${inv.functions.length}):`, inv.functions);
  console.log(`  TRIGGERS (${inv.triggers.length}):`, inv.triggers);
  console.log(`  RLS POLICIES (${inv.policies.length}):`, inv.policies);
  console.log(`  INDEXES (${inv.indexes.length}):`, inv.indexes);
  console.log(`  PUBLICATIONS (${inv.publications.length}):`, inv.publications);
  console.log(`  GRANTS (${inv.grants.length}):`, inv.grants);
}
