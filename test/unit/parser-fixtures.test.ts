import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseLogContent } from '../../src/parser';
import { filterEntries } from '../../src/filter';
import { readLogFile } from '../../src/api';

const fixturesDir = path.join(__dirname, '..', 'fixtures');

function load(name: string) {
    const filePath = path.join(fixturesDir, name);
    const content = fs.readFileSync(filePath, 'utf8');
    return { filePath, content, entries: parseLogContent(content, name) };
}

test('fixture syntax-check: parses classic lines and script metadata', () => {
    const { entries } = load('sample-syntax-check-PVSS_II.log');

    assert.ok(entries.length >= 50, `expected many entries, got ${entries.length}`);
    assert.equal(entries[0].managerName, 'WCCOAui');
    assert.equal(entries[0].errorCode, 1);
    assert.match(entries[0].errorText, /Manager Start/);

    const last = entries[entries.length - 1];
    assert.equal(last.errorCode, 2);
    assert.equal(last.errorText, 'Manager Stop');

    const duplicates = entries.filter(
        (e) => e.errorCode === 9 && e.errorCatalog === 'ctrl',
    );
    assert.equal(duplicates.length, 2);
    assert.equal(duplicates[0].errorPriority, 'WARNING');
    assert.ok(duplicates[0].metadata?.script?.endsWith('GuiTestDpTree.ctl'));
    assert.equal(duplicates[0].metadata?.line, 31);

    const syntax = entries.find((e) => e.errorCode === 81);
    assert.ok(syntax);
    assert.equal(syntax.errorPriority, 'WARNING');
    assert.match(syntax.errorText, /Syntax error/i);
    assert.ok(syntax.metadata?.library?.endsWith('OaGuiTest.ctl'));
    assert.equal(syntax.metadata?.line, 134);
});

test('fixture syntax-check: filter warnings and textContains', () => {
    const { entries } = load('sample-syntax-check-PVSS_II.log');

    const warnings = filterEntries(entries, {
        includeErrorPriority: ['WARNING'],
    });
    assert.equal(warnings.length, 4);

    const ctrlOnly = filterEntries(entries, {
        includeErrorType: ['CTRL'],
        includeErrorPriority: ['WARNING'],
    });
    assert.equal(ctrlOnly.length, 3);
    assert.ok(ctrlOnly.every((e) => e.errorType === 'CTRL'));

    const duplicateId = filterEntries(entries, {
        textContains: ['Duplicate identifier'],
    });
    assert.equal(duplicateId.length, 2);

    const code81 = filterEntries(entries, { includeErrorCode: [81] });
    assert.equal(code81.length, 1);
    assert.match(code81[0].errorText, /unexpected/i);
});

test('fixture quick-fail: SEVERE project-not-registered', () => {
    const { entries } = load('sample-quick-fail-PVSS_II.log');

    // Non-classic preamble lines (root warning, unregistered config) are skipped
    assert.equal(entries.length, 3);
    assert.equal(entries[0].errorCode, 1);
    assert.match(entries[0].errorText, /Manager Start/);

    const severe = entries.find((e) => e.errorPriority === 'SEVERE');
    assert.ok(severe);
    assert.equal(severe.errorCode, 15);
    assert.equal(severe.errorCatalog, 'pv2admin');
    assert.match(severe.errorText, /not yet registered/i);

    assert.equal(entries[2].errorText, 'Manager Stop');

    const filtered = filterEntries(entries, {
        includeErrorPriority: ['SEVERE'],
        includeErrorCatalog: ['pv2admin'],
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].errorCode, 15);
});

test('fixture test-runner: managers, catalogs, script/library, stack frames', () => {
    const { entries } = load('sample-test-runner-PVSS_II.log');

    assert.equal(entries.length, 22);
    assert.ok(entries.every((e) => e.managerName === 'WCCOActrl'));

    const registerFail = entries.find(
        (e) =>
            e.errorCode === 54 &&
            e.errorPriority === 'SEVERE' &&
            e.errorText.includes('Could not register the project'),
    );
    assert.ok(registerFail);
    assert.ok(registerFail.metadata?.stacktrace);
    assert.ok(registerFail.metadata!.stacktrace!.length >= 4);
    assert.match(
        registerFail.metadata!.stacktrace![0].functionName,
        /ProjEnvErrorHandler::severe/,
    );
    assert.ok(
        registerFail.metadata!.stacktrace![0].filePath.includes(
            'ProjEnvErrorHandler.ctl',
        ),
    );

    const installDir = entries.find(
        (e) => e.errorCode === 55 && e.errorCatalog === 'pv2admin',
    );
    assert.ok(installDir);
    assert.equal(installDir.errorPriority, 'WARNING');
    assert.ok(installDir.metadata?.script?.includes('testRunner.ctl'));
    assert.ok(installDir.metadata?.library?.includes('ProjEnvProject.ctl'));
    assert.equal(installDir.metadata?.line, 1005);

    const jsonSyntax = entries.filter(
        (e) => e.errorCode === 81 && e.errorPriority === 'WARNING',
    );
    assert.equal(jsonSyntax.length, 2);
    assert.ok(jsonSyntax[0].metadata?.library?.includes('JsonFile.ctl'));
    assert.equal(jsonSyntax[0].metadata?.line, 90);

    const oaUnit = entries.find((e) => e.errorCatalog === 'oaUnit_errors');
    assert.ok(oaUnit);
    assert.match(oaUnit.errorText, /passed/i);
    assert.ok(oaUnit.metadata?.stacktrace);
    assert.ok(oaUnit.metadata!.stacktrace!.length >= 2);
});

test('fixture test-runner: filter options used in CLI workflows', () => {
    const { entries, filePath } = load('sample-test-runner-PVSS_II.log');

    const without54 = filterEntries(entries, { excludeErrorCode: [54] });
    assert.equal(without54.length, 18);
    assert.ok(without54.every((e) => e.errorCode !== 54));

    const severe = filterEntries(entries, { includeErrorPriority: ['SEVERE'] });
    assert.equal(severe.length, 5);

    const tfCatalogs = filterEntries(entries, {
        includeErrorCatalog: ['tfTestRun', 'tfTestProj', 'tfTestRunner'],
    });
    assert.ok(tfCatalogs.length >= 5);
    assert.ok(
        tfCatalogs.every((e) =>
            ['tfTestRun', 'tfTestProj', 'tfTestRunner'].includes(e.errorCatalog ?? ''),
        ),
    );

    const viaApi = readLogFile({
        filePath,
        filter: {
            includeManagerName: ['WCCOActrl'],
            excludeErrorCode: [54],
            includeErrorPriority: ['WARNING', 'SEVERE'],
        },
    });
    assert.ok(viaApi.length > 0);
    assert.ok(viaApi.every((e) => e.errorCode !== 54));
    assert.ok(
        viaApi.every(
            (e) => e.errorPriority === 'WARNING' || e.errorPriority === 'SEVERE',
        ),
    );

    const textFilter = filterEntries(entries, {
        textContains: ['configuration file'],
    });
    assert.ok(textFilter.length >= 2);
    assert.ok(
        textFilter.every((e) =>
            e.errorText.toLowerCase().includes('configuration file'),
        ),
    );

    const excludeText = filterEntries(entries, {
        includeErrorPriority: ['INFO'],
        excludeErrorText: ['Manager'],
    });
    assert.ok(excludeText.every((e) => !/manager/i.test(e.errorText)));
});
