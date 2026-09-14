import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const repoRoot = path.resolve(__dirname, '..', '..');
const fixturePath = path.join(repoRoot, 'test', 'fixtures', 'sample-pvss_ii.log');

function runCli(args: string[]): ReturnType<typeof spawnSync> {
    const distCli = path.join(repoRoot, 'dist', 'cjs', 'cli.js');
    const srcCli = path.join(repoRoot, 'src', 'cli.ts');
    const cliPath = fs.existsSync(distCli) ? distCli : srcCli;
    const nodeArgs =
        cliPath === srcCli ? ['--import', 'tsx', cliPath, ...args] : [cliPath, ...args];

    return spawnSync(process.execPath, nodeArgs, {
        cwd: repoRoot,
        encoding: 'utf8',
    });
}

test('CLI: "--help" prints usage and exits with code 1', () => {
    const result = runCli(['--help']);
    assert.equal(result.status, 1);
    assert.match(result.stderr ?? '', /Usage: winccoa-log-reader/);
});

test('CLI: reads fixture and emits JSON array', () => {
    const result = runCli([fixturePath, '--severity', 'INFO']);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout ?? 'null') as unknown;
    assert.ok(Array.isArray(parsed));
    assert.equal((parsed as { errorPriority: string }[]).length, 1);
    assert.equal((parsed as { errorText: string }[])[0].errorText, 'UI started');
});

test('CLI: --result-file writes payload', () => {
    const out = path.join(os.tmpdir(), `log-reader-test-${process.pid}.json`);
    try {
        const result = runCli([fixturePath, '--result-file', out, '--severity', 'DEBUG']);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stderr ?? '', /Wrote result to/);
        const body = fs.readFileSync(out, 'utf8');
        const parsed = JSON.parse(body) as { errorPriority: string }[];
        assert.equal(parsed.length, 1);
        assert.equal(parsed[0].errorPriority, 'DEBUG');
    } finally {
        fs.rmSync(out, { force: true });
    }
});
