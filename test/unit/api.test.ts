import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { readLogFile, readLogText } from '../../src/api';

const fixturePath = path.join(__dirname, '..', 'fixtures', 'sample-pvss_ii.log');

test('readLogFile: reads fixture and applies filter', () => {
    const entries = readLogFile({
        filePath: fixturePath,
        filter: { includeErrorPriority: ['FATAL'] },
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].errorPriority, 'FATAL');
    assert.match(entries[0].errorText, /Uncaught exception/);
});

test('readLogText: parses in-memory content', () => {
    const content =
        'WCCOAui (1), 2026.01.01 00:00:00.000, SYS, INFO, 0, hello\n';
    const entries = readLogText(content, undefined, 'mem.log');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].sourceFile, 'mem.log');
    assert.equal(entries[0].errorText, 'hello');
});
