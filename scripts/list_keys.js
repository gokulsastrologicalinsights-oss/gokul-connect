const fs = require('fs');
const keys = fs.readFileSync('.env.local', 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'))
  .map(l => l.split('=')[0].trim());
console.log('ENV KEYS:', keys);
