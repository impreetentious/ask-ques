#!/usr/bin/env node
// One version is enough only when every release surface agrees on it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

const version = json('package.json').version;
const errors = [];

if (!version) errors.push('package.json is missing a version');

const lock = json('package-lock.json');
if (lock.version !== version) {
  errors.push(`package-lock.json version ${lock.version ?? 'missing'} != ${version}`);
}
if (lock.packages?.['']?.version !== version) {
  errors.push(
    `package-lock.json packages[""].version ${lock.packages?.['']?.version ?? 'missing'} != ${version}`,
  );
}

const marker = read('README.md').match(/\*\*Version:\*\*\s*v?([0-9]+\.[0-9]+\.[0-9]+)/u)?.[1];
if (!marker) errors.push('README.md is missing its **Version:** vX.Y.Z marker');
else if (marker !== version) errors.push(`README.md version ${marker} != ${version}`);

const source = read('src/ask/version.ts').match(/ASK_QUES_VERSION\s*=\s*'([^']+)'/u)?.[1];
if (!source) errors.push('src/ask/version.ts is missing ASK_QUES_VERSION');
else if (source !== version) errors.push(`src/ask/version.ts ${source} != ${version}`);

if (errors.length > 0) {
  console.error('version-coherence FAILED:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`version-coherence OK — ${version}`);
