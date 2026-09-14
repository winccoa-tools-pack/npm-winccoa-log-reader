/**
 * Integration tests: readLog() with real CTL script output captured to a temp file.
 *
 * Skipped automatically when WCCOActrl is not found.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readLog } from '../../src/reader.js';

import {
    getTestVersion,
    getCtrlBinaryPath,
    setupLogProject,
    teardownLogProject,
    runScript,
    FIXTURE_SCRIPTS_DIR,
} from '../helpers/log-integ-project.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = getTestVersion();
const binaryPath = version ? getCtrlBinaryPath(version) : undefined;
const SKIP = !version || !binaryPath;

if (SKIP) {
    console.log('[reader-filters] WCCOActrl not found — all integration tests skipped.');
}

let projectReady = false;
let tmpLogFile = '';

test('reader-filters setup', { skip: SKIP }, async () => {
    const project = await setupLogProject(version!);
    assert.ok(project);
    projectReady = true;

    // Run warning + severe scripts and save combined output to temp file
    const warnResult = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-warning.ctl'), version!);
    const severeResult = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-severe.ctl'), version!);
    const multiResult = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-multi.ctl'), version!);

    const combined = [warnResult.output, severeResult.output, multiResult.output].join('\n');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'winccoa-log-reader-test-'));
    tmpLogFile = path.join(dir, 'PVSS_II.log');
    fs.writeFileSync(tmpLogFile, combined, 'utf8');
});

test('reader-filters: readLog returns all events', { skip: SKIP }, () => {
    if (!projectReady) return;
    const result = readLog(tmpLogFile);
    assert.ok(result.count > 0, 'should find events');
    assert.equal(result.filePath, tmpLogFile);
});

test('reader-filters: filterSeverity=WARNING,SEVERE returns only those', { skip: SKIP }, () => {
    if (!projectReady) return;
    const result = readLog(tmpLogFile, { filterSeverity: ['WARNING', 'SEVERE'] });
    assert.ok(result.events.every((e) => e.severity === 'WARNING' || e.severity === 'SEVERE'));
    assert.ok(result.count >= 2, 'should include warning and severe events');
});

test('reader-filters: lastN=1 returns only the last event', { skip: SKIP }, () => {
    if (!projectReady) return;
    const all = readLog(tmpLogFile);
    const last1 = readLog(tmpLogFile, { lastN: 1 });
    assert.equal(last1.count, 1);
    assert.deepEqual(last1.events[0], all.events[all.count - 1]);
});

test('reader-filters teardown', { skip: SKIP }, async () => {
    if (tmpLogFile) {
        try { fs.unlinkSync(tmpLogFile); } catch { /* ignore */ }
    }
    await teardownLogProject();
});
