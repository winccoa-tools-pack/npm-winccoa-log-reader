/**
 * Integration test: CLI --help / usage output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function getCli(): (args: string[]) => string[] {
    const distCli = path.join(repoRoot, 'dist', 'cjs', 'cli.js');
    const srcCli = path.join(repoRoot, 'src', 'cli.ts');
    const cliPath = fs.existsSync(distCli) ? distCli : srcCli;
    return (args: string[]) =>
        cliPath.endsWith('.ts')
            ? ['--import', 'tsx', cliPath, ...args]
            : [cliPath, ...args];
}

test('CLI: help command exits 0 and prints winccoa-log usage', () => {
    const nodeArgs = getCli();
    const result = spawnSync(process.execPath, nodeArgs(['help']), {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.match(result.stderr ?? '', /winccoa-log/);
    assert.match(result.stderr ?? '', /read|tail/);
});

test('CLI: -h flag also shows help', () => {
    const nodeArgs = getCli();
    const result = spawnSync(process.execPath, nodeArgs(['-h']), {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.match(result.stderr ?? '', /Usage/i);
});

test('CLI: --help flag also shows help', () => {
    const nodeArgs = getCli();
    const result = spawnSync(process.execPath, nodeArgs(['--help']), {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.match(result.stderr ?? '', /Usage/i);
});
