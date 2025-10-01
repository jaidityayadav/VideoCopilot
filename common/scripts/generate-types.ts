#!/usr/bin/env tsx

import { execSync } from 'child_process';

console.log('🔄 Generating all types and models from shared schema...');
console.log('='.repeat(50));

// Get current directory
const __dirname = new URL(import.meta.url).pathname.replace(/\/[^\/]*$/, '');

const scripts = [
  {
    name: 'TypeScript Types',
    command: 'tsx scripts/generate-typescript.ts',
    emoji: '📘'
  },
  {
    name: 'Python Models',
    command: 'tsx scripts/generate-python-models.ts',
    emoji: '🐍'
  }
];

let hasErrors = false;

for (const script of scripts) {
  try {
    console.log(`\n${script.emoji} Generating ${script.name}...`);
    execSync(script.command, {
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
  } catch (error) {
    console.error(`❌ Failed to generate ${script.name}`);
    hasErrors = true;
  }
}

console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Some generators failed. Check the errors above.');
  process.exit(1);
} else {
  console.log('✅ All types and models generated successfully!');
  console.log('\n📁 Generated files:');
  console.log('   - common/generated/typescript/ (TypeScript types)');
  console.log('   - common/generated/python/ (Python models)');
  console.log('\n💡 Import these in your services to maintain type safety!');
}