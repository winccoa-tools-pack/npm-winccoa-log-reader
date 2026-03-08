/**
 * CLI unit tests — exercise the built CJS CLI via spawnSync so we don't need
 * to export internal parseArgs functions.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

function getCli(): { cliPath: string; nodeArgs: (extra: string[]) => string[] } {
    const distCli = join(repoRoot, 'dist', 'cjs', 'cli.js');
    const srcCli = join(repoRoot, 'src', 'cli.ts');
    const cliPath = existsSync(distCli) ? distCli : srcCli;
    const nodeArgs = (extra: string[]): string[] =>
        cliPath.endsWith('.ts')
            ? ['--import', 'tsx', cliPath, ...extra]
            : [cliPath, ...extra];
    return { cliPath, nodeArgs };
}

// ── help / usage ──────────────────────────────────────────────────────────────

test('CLI: help command prints usage', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(process.execPath, nodeArgs(['help']), {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    assert.match(result.stderr ?? '', /winccoa-log/);
    assert.equal(result.status, 0);
});

test('CLI: unknown command prints usage and exits 1', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(process.execPath, nodeArgs(['unknown-cmd']), {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    assert.ok(result.status !== 0, 'should fail');
    assert.match(result.stderr ?? '', /winccoa-log/);
});

test('CLI: no command prints usage and exits 1', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(process.execPath, nodeArgs([]), {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    assert.ok(result.status !== 0);
    assert.match(result.stderr ?? '', /Usage/i);
});

// ── read command ──────────────────────────────────────────────────────────────

let tmpLogFile = '';

test('CLI read: setup temp log file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'winccoa-log-cli-test-'));
    tmpLogFile = join(dir, 'test.log');
    const lines = [
        'WCCOActrl    (1), 2026.01.15 21:31:37.000, SYS,  INFO,        1, Manager Start',
        'WCCOActrl    (1), 2026.01.15 21:31:38.000, CTRL,  WARNING,       42, Warn msg',
        'WCCOActrl    (1), 2026.01.15 21:31:39.000, SYS,  FATAL,        5, Fatal msg',
    ].join('\n') + '\n';
    writeFileSync(tmpLogFile, lines, 'utf8');
});

test('CLI read: outputs valid JSON with all events', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(process.execPath, nodeArgs(['read', tmpLogFile]), {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.count, 3);
    assert.ok(Array.isArray(parsed.events));
});

test('CLI read: --severity filter reduces output', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(
        process.execPath,
        nodeArgs(['read', tmpLogFile, '--severity', 'FATAL']),
        { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.count, 1);
    assert.equal(parsed.events[0].severity, 'FATAL');
});

test('CLI read: --last-n limits output', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(
        process.execPath,
        nodeArgs(['read', tmpLogFile, '--last-n', '2']),
        { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.count, 2);
});

test('CLI read: --pretty outputs indented JSON', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(
        process.execPath,
        nodeArgs(['read', tmpLogFile, '--pretty']),
        { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 0);
    // Pretty JSON contains newlines inside the object
    assert.ok(result.stdout.includes('\n  '));
});

test('CLI read: nonexistent file exits with error code', () => {
    const { nodeArgs } = getCli();
    const result = spawnSync(
        process.execPath,
        nodeArgs(['read', '/nonexistent/PVSS_II.log']),
        { cwd: repoRoot, encoding: 'utf8' },
    );
    assert.ok(result.status !== 0);
    assert.match(result.stderr ?? '', /Error/i);
});

test('CLI read: cleanup', () => {
    try { unlinkSync(tmpLogFile); } catch { /* ignore */ }
});
