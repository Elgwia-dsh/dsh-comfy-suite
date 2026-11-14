#!/usr/bin/env node
/**
 * Rebuild `client/client.js` from `client/_parts/*`.
 *
 * The merged client is a plain concatenation — there is no bundler in the
 * loop. Keeping the recipe in code (instead of in someone's shell history)
 * means the generated file can always be reproduced and verified:
 *
 *   node scripts/build-client.mjs            # rewrite client/client.js
 *   node scripts/build-client.mjs --check    # exit 1 if it is stale
 *
 * Parts are joined with a single newline and the result ends with one, which
 * is byte-for-byte what the historical build produced.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PARTS = [
    'client/_parts/_head.js',
    'client/_parts/vendor_comfyui_client_client.js',
    'client/_parts/vendor_launcher_client.js',
    'client/_parts/vendor_qwen-paint_lib_client.js',
    'client/_parts/suite_gallery.js',
    'client/_parts/_tail.js',
];
const TARGET = join(ROOT, 'client/client.js');

const check = process.argv.includes('--check');
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const pieces = [];
for (const part of PARTS) {
    try {
        pieces.push(await readFile(join(ROOT, part), 'utf8'));
    }
    catch (error) {
        console.error(`build-client: missing part ${part} — ${error.message}`);
        process.exit(1);
    }
}
const output = `${pieces.join('\n')}\n`;
let current = '';
try {
    current = await readFile(TARGET, 'utf8');
}
catch {
    current = '';
}

if (check) {
    if (current === output) {
        console.log(`client/client.js is up to date (${output.length} bytes, sha256 ${sha256(output).slice(0, 12)})`);
        process.exit(0);
    }
    console.error('client/client.js is STALE — run `node scripts/build-client.mjs`');
    console.error(`  built: ${output.length} bytes ${sha256(output)}`);
    console.error(`  disk:  ${current.length} bytes ${sha256(current)}`);
    process.exit(1);
}

if (current === output) {
    console.log(`unchanged (${output.length} bytes, sha256 ${sha256(output).slice(0, 12)})`);
    process.exit(0);
}
await writeFile(TARGET, output, 'utf8');
console.log(`wrote client/client.js (${output.length} bytes, sha256 ${sha256(output).slice(0, 12)})`);