const fs = require('fs');

const content = fs.readFileSync('docs/backup_full_extracted.sql', 'utf8');
const lines = content.split('\n');
let currentTable = null;
let count = 0;
const results = {};
const rowsByTable = {};

for (let line of lines) {
  const match = line.match(/^COPY public\.([a-z_]+)\s*\(/);
  if (match) {
    currentTable = match[1];
    count = 0;
    rowsByTable[currentTable] = [];
    continue;
  }
  if (currentTable) {
    if (line.trim() === '\\.') {
      results[currentTable] = count;
      currentTable = null;
    } else {
      count++;
      rowsByTable[currentTable].push(line);
    }
  }
}

console.log('--- PUBLIC TABLE ROW COUNTS IN BACKUP FILE ---');
console.log(JSON.stringify(results, null, 2));
const total = Object.values(results).reduce((a, b) => a + b, 0);
console.log('TOTAL APPLICATION ROWS IN BACKUP:', total);
