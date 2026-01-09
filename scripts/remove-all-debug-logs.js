#!/usr/bin/env node
/**
 * Remove todos os blocos // #region agent log ... // #endregion
 */

const fs = require('fs');
const path = require('path');

const files = [
  'lib/tiny/api.ts',
  'lib/tiny/transformers.ts',
  'app/api/exports/[view].json/route.ts',
  'app/api/admin/sync/route.ts',
  'jobs/sync.ts',
  'app/api/exports/[view].xlsx/route.ts',
  'lib/tiny/oauth.ts',
  'app/api/admin/tiny/start/route.ts',
];

let totalRemoved = 0;

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalLength = content.length;
  
  // Remove blocos completos: // #region agent log ... // #endregion
  // Suporta múltiplas linhas entre region/endregion
  const regex = /\s*\/\/ #region agent log\s*\n[\s\S]*?\/\/ #endregion\s*\n?/g;
  
  let matches = 0;
  content = content.replace(regex, () => {
    matches++;
    return '';
  });
  
  if (matches > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}: removed ${matches} debug blocks`);
    totalRemoved += matches;
  } else {
    console.log(`   ${file}: no debug blocks found`);
  }
});

console.log(`\n🎉 Total: ${totalRemoved} debug blocks removed`);
