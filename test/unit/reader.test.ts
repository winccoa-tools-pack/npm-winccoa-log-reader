import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readLog } from '../../src/reader.js';

// ── Test fixture ─────────────────────────────────────────────────────────────

const LOG_LINES = [
    'WCCOActrl    (1), 2026.01.15 21:31:37.000, SYS,  INFO,        1, Manager Start',
    'WCCOActrl    (1), 2026.01.15 21:31:38.000, CTRL,  WARNING,       42, Warn msg',
    'WCCOActrl    (1), 2026.01.15 21:31:39.000, SYS,  FATAL,        5, Fatal msg',
    'node         (4), 2026.01.15 21:31:40.000, SYS,  SEVERE,       99, Severe msg',
    'WCCOActrl    (1), 2026.01.15 21:31:41.000, SYS,  INFO,        2, Another info',
];

let tmpFile: string;

test('reader: setup temp file', (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'winccoa-log-test-'));
    tmpFile = join(dir, 'PVSS_II.log');
    writeFileSync(tmpFile, LOG_LINES.join('\n') + '\n', 'utf8');
});

test('reader: reads all events without options', () => {
    const result = readLog(tmpFile);
    assert.equal(result.count, 5);
    assert.equal(result.events.length, 5);
    assert.equal(result.filePath, tmpFile);
});

test('reader: filterSeverity narrows results', () => {
    const result = readLog(tmpFile, { filterSeverity: ['WARNING', 'FATAL', 'SEVERE'] });
    assert.equal(result.count, 3);
    assert.ok(result.events.every((e) => ['WARNING', 'FATAL', 'SEVERE'].includes(e.severity)));
});

test('reader: filterScope narrows results', () => {
    const result = readLog(tmpFile, { filterScope: ['CTRL'] });
    assert.equal(result.count, 1);
    assert.equal(result.events[0].scope, 'CTRL');
});

test('reader: lastN returns last N events', () => {
    const result = readLog(tmpFile, { lastN: 2 });
    assert.equal(result.count, 2);
    assert.equal(result.events[0].message, 'Severe msg');
    assert.equal(result.events[1].message, 'Another info');
});

test('reader: sinceTimestamp filters by date (string)', () => {
    // Events at 39.000 and later
    const result = readLog(tmpFile, { sinceTimestamp: '2026.01.15 21:31:39.000' });
    assert.equal(result.count, 3);
    assert.ok(result.events[0].message.includes('Fatal'));
});

test('reader: combined filterSeverity + lastN', () => {
    const result = readLog(tmpFile, {
        filterSeverity: ['INFO'],
        lastN: 1,
    });
    assert.equal(result.count, 1);
    assert.equal(result.events[0].message, 'Another info');
});

test('reader: sourceFile is set on all events', () => {
    const result = readLog(tmpFile);
    assert.ok(result.events.every((e) => e.sourceFile === tmpFile));
});

test('reader: throws for missing file', () => {
    assert.throws(() => readLog('/nonexistent/path/PVSS_II.log'), /ENOENT/);
});

test('reader: cleanup temp file', () => {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
});
