import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../../src/cli';

test('parseArgs: returns null for --help', () => {
    const parsed = parseArgs(['node', 'cli.ts', '--help']);
    assert.equal(parsed, null);
});

test('parseArgs: returns null when logfile missing', () => {
    const originalWrite = process.stderr.write.bind(process.stderr);
    let stderr = '';
    (process.stderr.write as unknown as (chunk: string) => boolean) = (chunk: string) => {
        stderr += chunk;
        return true;
    };

    try {
        const parsed = parseArgs(['node', 'cli.ts', '--severity', 'INFO']);
        assert.equal(parsed, null);
        assert.match(stderr, /Missing <logfile>/);
    } finally {
        process.stderr.write = originalWrite;
    }
});

test('parseArgs: parses logfile and filters', () => {
    const parsed = parseArgs([
        'node',
        'cli.ts',
        'logs/PVSS_II.log',
        '--severity',
        'WARNING,FATAL',
        '--manager',
        'WCCOActrl',
        '--type',
        'CTRL',
        '--code',
        '5,42',
        '--text',
        'timeout',
        '--result-file',
        'out.json',
        '--no-json',
    ]);

    assert.ok(parsed);
    assert.equal(parsed.filePath, 'logs/PVSS_II.log');
    assert.equal(parsed.json, false);
    assert.equal(parsed.resultFile, 'out.json');
    assert.deepEqual(parsed.filter.includeErrorPriority, ['WARNING', 'FATAL']);
    assert.deepEqual(parsed.filter.includeManagerName, ['WCCOActrl']);
    assert.deepEqual(parsed.filter.includeErrorType, ['CTRL']);
    assert.deepEqual(parsed.filter.includeErrorCode, [5, 42]);
    assert.deepEqual(parsed.filter.textContains, ['timeout']);
});

test('parseArgs: rejects invalid --code values', () => {
    const originalWrite = process.stderr.write.bind(process.stderr);
    let stderr = '';
    (process.stderr.write as unknown as (chunk: string) => boolean) = (chunk: string) => {
        stderr += chunk;
        return true;
    };

    try {
        const parsed = parseArgs(['node', 'cli.ts', 'x.log', '--code', 'not-a-number']);
        assert.equal(parsed, null);
        assert.match(stderr, /comma-separated integers/);
    } finally {
        process.stderr.write = originalWrite;
    }
});
