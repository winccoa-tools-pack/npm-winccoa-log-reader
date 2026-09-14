import test from 'node:test';
import assert from 'node:assert/strict';

import { filterEntries, matchesFilter } from '../../src/filter';
import type { LogEntry } from '../../src/types';

function entry(partial: Partial<LogEntry> & Pick<LogEntry, 'managerName' | 'errorText'>): LogEntry {
    return {
        managerNum: 1,
        identifier: `${partial.managerName}(${partial.managerNum ?? 1})`,
        timeStampString: '2026.01.01 00:00:00.000',
        errorType: 'SYS',
        errorPriority: 'INFO',
        rawLines: [],
        ...partial,
    };
}

test('matchesFilter: empty filter passes all', () => {
    const e = entry({ managerName: 'WCCOAui', errorText: 'hello' });
    assert.equal(matchesFilter(e), true);
    assert.equal(matchesFilter(e, {}), true);
});

test('filterEntries: include manager and severity', () => {
    const list = [
        entry({ managerName: 'WCCOAui', errorText: 'a', errorPriority: 'INFO' }),
        entry({ managerName: 'WCCOActrl', errorText: 'b', errorPriority: 'WARNING' }),
        entry({ managerName: 'WCCOActrl', errorText: 'timeout', errorPriority: 'FATAL' }),
    ];

    const filtered = filterEntries(list, {
        includeManagerName: ['WCCOActrl'],
        includeErrorPriority: ['WARNING', 'FATAL'],
        textContains: ['time'],
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].errorText, 'timeout');
});

test('filterEntries: exclude type', () => {
    const list = [
        entry({ managerName: 'A', errorText: 'x', errorType: 'SYS' }),
        entry({ managerName: 'B', errorText: 'y', errorType: 'CTRL' }),
    ];
    const filtered = filterEntries(list, { excludeErrorType: ['SYS'] });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].managerName, 'B');
});

test('filterEntries: catalog and code include/exclude', () => {
    const list = [
        entry({
            managerName: 'WCCOActrl',
            errorText: 'a',
            errorCode: 54,
            errorCatalog: 'ctrl',
            errorPriority: 'SEVERE',
        }),
        entry({
            managerName: 'WCCOActrl',
            errorText: 'b',
            errorCode: 55,
            errorCatalog: 'pv2admin',
            errorPriority: 'WARNING',
        }),
        entry({
            managerName: 'WCCOActrl',
            errorText: 'c',
            errorCode: 100,
            errorCatalog: 'tfTestRun',
            errorPriority: 'INFO',
        }),
    ];

    assert.equal(filterEntries(list, { includeErrorCatalog: ['pv2admin'] }).length, 1);
    assert.equal(filterEntries(list, { excludeErrorCode: [54] }).length, 2);
    assert.equal(
        filterEntries(list, {
            includeErrorCode: [54, 100],
            excludeErrorCatalog: ['ctrl'],
        }).length,
        1,
    );
});
