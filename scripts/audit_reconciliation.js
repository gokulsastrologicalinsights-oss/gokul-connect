const fs = require('fs');

const content = fs.readFileSync('docs/backup_full_extracted.sql', 'utf8');
const lines = content.split('\n');
let currentTable = null;
const tablesData = {};

for (let line of lines) {
  const match = line.match(/^COPY public\.([a-z_]+)\s*\(([^)]+)\)\s*FROM stdin;/);
  if (match) {
    currentTable = match[1];
    tablesData[currentTable] = {
      columns: match[2].split(',').map(s => s.trim()),
      rows: []
    };
    continue;
  }
  if (currentTable) {
    if (line.trim() === '\\.') {
      currentTable = null;
    } else {
      tablesData[currentTable].rows.push(line.trim());
    }
  }
}

console.log('=== SUMMARY OF TABLES IN BACKUP DUMP ===');
let totalRows = 0;
for (const [table, info] of Object.entries(tablesData)) {
  console.log(`${table.padEnd(30)}: ${info.rows.length} rows`);
  totalRows += info.rows.length;
}
console.log(`TOTAL ROWS IN BACKUP: ${totalRows}`);

console.log('\n=== TABLES WITH 4 ROWS ===');
for (const [table, info] of Object.entries(tablesData)) {
  if (info.rows.length === 4) {
    console.log(`Table: ${table} (columns: ${info.columns.join(', ')})`);
    info.rows.forEach((r, idx) => console.log(`  Row ${idx + 1}: ${r}`));
  }
}

console.log('\n=== WA_PROCESSING_JOBS ROWS ===');
if (tablesData['wa_processing_jobs']) {
  console.log('Columns:', tablesData['wa_processing_jobs'].columns);
  tablesData['wa_processing_jobs'].rows.forEach((r, idx) => {
    console.log(`  Job ${idx + 1}: ${r}`);
  });
}
