#!/usr/bin/env node
// Keep the deployment's security contract auditable without needing Vercel.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const rules = Array.isArray(config.headers) ? config.headers : [];
const rule = rules.find((candidate) => candidate.source === '/(.*)');
const headers = new Map(
  Array.isArray(rule?.headers)
    ? rule.headers.map(({ key, value }) => [key.toLowerCase(), value])
    : [],
);

const required = [
  'content-security-policy',
  'permissions-policy',
  'referrer-policy',
  'x-content-type-options',
  'x-frame-options',
  'cross-origin-opener-policy',
];
const errors = required.filter((key) => !headers.has(key));
const csp = headers.get('content-security-policy');

for (const directive of ['default-src', 'object-src', 'base-uri', 'frame-ancestors']) {
  if (typeof csp !== 'string' || !csp.includes(directive))
    errors.push(`CSP is missing ${directive}`);
}

if (errors.length > 0) {
  console.error('vercel header check FAILED:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('vercel header check OK');
