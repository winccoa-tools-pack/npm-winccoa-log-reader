import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeSeverity, parseLogContent } from '../../src/parser';

const fixturePath = path.join(__dirname, '..', 'fixtures', 'sample-pvss_ii.log');

test('normalizeSeverity: ERROR maps to FATAL', () => {
    assert.equal(normalizeSeverity('ERROR'), 'FATAL');
    assert.equal(normalizeSeverity('info'), 'INFO');
    assert.equal(normalizeSeverity('weird'), 'OTHER');
});

test('parseLogContent: parses sample fixture with metadata and stacktrace', () => {
    const content = fs.readFileSync(fixturePath, 'utf8');
    const entries = parseLogContent(content, 'sample-pvss_ii.log');

    assert.equal(entries.length, 5);

    const info = entries[0];
    assert.equal(info.managerName, 'WCCOAui');
    assert.equal(info.managerNum, 1);
    assert.equal(info.identifier, 'WCCOAui(1)');
    assert.equal(info.errorType, 'SYS');
    assert.equal(info.errorPriority, 'INFO');
    assert.equal(info.errorCode, 0);
    assert.equal(info.errorText, 'UI started');
    assert.equal(info.sourceFile, 'sample-pvss_ii.log');

    const warning = entries[1];
    assert.equal(warning.errorPriority, 'WARNING');
    assert.equal(warning.errorCode, 42);
    assert.equal(warning.errorCatalog, 'ctrl');
    assert.equal(warning.metadata?.script, 'scripts/demo.ctl');
    assert.equal(warning.metadata?.library, 'libs/helpers.ctl');
    assert.equal(warning.metadata?.line, 88);

    const fatal = entries[2];
    assert.equal(fatal.errorPriority, 'FATAL');
    assert.ok(fatal.metadata?.stacktrace);
    assert.equal(fatal.metadata?.stacktrace?.length, 2);
    assert.equal(fatal.metadata?.stacktrace?.[0].functionName, 'main');
    assert.equal(fatal.metadata?.stacktrace?.[0].line, 12);

    assert.equal(entries[3].errorPriority, 'SEVERE');
    assert.equal(entries[4].errorPriority, 'DEBUG');
});
