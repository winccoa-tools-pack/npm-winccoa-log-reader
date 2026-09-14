import test from 'node:test';
import assert from 'node:assert/strict';
import { LogParser, parseLogContent } from '../../src/parser.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INFO_LINE =
    'WCCOActrl    (1), 2026.01.15 21:31:37.956, SYS,  INFO,        1, Manager Start';

const WARNING_LINE =
    'WCCOActrl    (1), 2026.01.15 21:31:38.100, CTRL,  WARNING,       42, Something wrong';

const FATAL_LINE =
    'WCCOActrl    (1), 2026.01.15 21:31:39.001, SYS,  ERROR,        5, Fatal error here';

const SEVERE_LINE =
    'node         (4), 2026.01.15 21:31:41.500, SYS,  SEVERE,       99, Severe issue';

const DEBUG_LINE =
    'WCCOActrl    (1), 2026.01.15 21:31:40.000, SYS,  DEBUG,        0, debug trace';

const CATALOG_LINE =
    'WCCILpmon    (1), 2026.01.15 21:31:36.115, SYS,  INFO,       20/pmon, Got START_ALL';

// No space before '('
const NOSPACE_LINE =
    'WCCILdataSQLite(0), 2026.01.15 21:31:36.327, SYS,  INFO,        1, Manager Start';

const MULTI_WORD_REST =
    'WCCOActrl    (1), 2026.01.15 21:31:38.500, SYS,  INFO,        6, Initialization complete, PROJ, DevEnv3.21';

// ── Basic parsing ─────────────────────────────────────────────────────────────

test('parser: INFO line produces correct event', () => {
    const parser = new LogParser();
    const events = parser.parseLine(INFO_LINE);
    // First event stays in buffer until next line or flush
    assert.equal(events.length, 0);

    const last = parser.flush();
    assert.ok(last, 'flush should return event');
    assert.equal(last.identifier, 'WCCOActrl(1)');
    assert.equal(last.timestamp, '2026.01.15 21:31:37.956');
    assert.equal(last.scope, 'SYS');
    assert.equal(last.severity, 'INFO');
    assert.equal(last.msgnum, '1');
    assert.equal(last.message, 'Manager Start');
    assert.equal(last.rawLines.length, 1);
    assert.equal(last.rawLines[0], INFO_LINE);
});

test('parser: WARNING severity mapped correctly', () => {
    const parser = new LogParser();
    parser.parseLine(WARNING_LINE);
    const ev = parser.flush()!;
    assert.equal(ev.severity, 'WARNING');
    assert.equal(ev.msgnum, '42');
});

test('parser: ERROR severity maps to FATAL', () => {
    const parser = new LogParser();
    parser.parseLine(FATAL_LINE);
    const ev = parser.flush()!;
    assert.equal(ev.severity, 'FATAL');
});

test('parser: SEVERE severity mapped correctly', () => {
    const parser = new LogParser();
    parser.parseLine(SEVERE_LINE);
    const ev = parser.flush()!;
    assert.equal(ev.severity, 'SEVERE');
    assert.equal(ev.identifier, 'node(4)');
});

test('parser: DEBUG severity mapped correctly', () => {
    const parser = new LogParser();
    parser.parseLine(DEBUG_LINE);
    const ev = parser.flush()!;
    assert.equal(ev.severity, 'DEBUG');
});

test('parser: unknown severity maps to OTHER', () => {
    const parser = new LogParser();
    const weirdLine = 'WCCOActrl    (1), 2026.01.15 21:31:38.000, SYS,  TRACE,        1, some msg';
    parser.parseLine(weirdLine);
    const ev = parser.flush()!;
    assert.equal(ev.severity, 'OTHER');
});

test('parser: catalog/code msgnum preserved', () => {
    const parser = new LogParser();
    parser.parseLine(CATALOG_LINE);
    const ev = parser.flush()!;
    assert.equal(ev.msgnum, '20/pmon');
    assert.equal(ev.identifier, 'WCCILpmon(1)');
    assert.equal(ev.message, 'Got START_ALL');
});

test('parser: identifier with no space before parenthesis', () => {
    const parser = new LogParser();
    parser.parseLine(NOSPACE_LINE);
    const ev = parser.flush()!;
    assert.equal(ev.identifier, 'WCCILdataSQLite(0)');
});

test('parser: message includes comma-containing rest', () => {
    const parser = new LogParser();
    parser.parseLine(MULTI_WORD_REST);
    const ev = parser.flush()!;
    assert.equal(ev.message, 'Initialization complete, PROJ, DevEnv3.21');
});

// ── Two consecutive events ────────────────────────────────────────────────────

test('parser: second main line emits first event', () => {
    const parser = new LogParser();
    const first = parser.parseLine(INFO_LINE);
    assert.equal(first.length, 0); // still in buffer

    const second = parser.parseLine(WARNING_LINE);
    assert.equal(second.length, 1);
    assert.equal(second[0].severity, 'INFO');

    const last = parser.flush();
    assert.equal(last!.severity, 'WARNING');
});

// ── Continuation lines ────────────────────────────────────────────────────────

test('parser: Script: continuation sets metadata.script', () => {
    const parser = new LogParser();
    parser.parseLine(WARNING_LINE);
    parser.parseLine('Script: myScript');
    const ev = parser.flush()!;
    assert.equal(ev.metadata?.script, 'myScript');
    assert.equal(ev.rawLines.length, 2);
});

test('parser: Library: continuation sets metadata.library', () => {
    const parser = new LogParser();
    parser.parseLine(WARNING_LINE);
    parser.parseLine('Library: /path/to/lib.ctl');
    const ev = parser.flush()!;
    assert.equal(ev.metadata?.library, '/path/to/lib.ctl');
});

test('parser: Line: continuation sets metadata.line', () => {
    const parser = new LogParser();
    parser.parseLine(WARNING_LINE);
    parser.parseLine('Line: 42');
    const ev = parser.flush()!;
    assert.equal(ev.metadata?.line, 42);
});

test('parser: ", Line N" inline continuation sets metadata.line', () => {
    const parser = new LogParser();
    parser.parseLine(WARNING_LINE);
    parser.parseLine(', Line 99');
    const ev = parser.flush()!;
    assert.equal(ev.metadata?.line, 99);
});

test('parser: Stacktrace: block parsed correctly', () => {
    const parser = new LogParser();
    parser.parseLine(WARNING_LINE);
    parser.parseLine('Stacktrace:');
    parser.parseLine('1. myFunc() at /path/script.ctl:10');
    parser.parseLine('2. callerFunc() at /path/other.ctl:55');
    const ev = parser.flush()!;
    assert.ok(ev.metadata?.stacktrace);
    assert.equal(ev.metadata!.stacktrace!.length, 2);
    assert.equal(ev.metadata!.stacktrace![0].index, 1);
    assert.equal(ev.metadata!.stacktrace![0].functionName, 'myFunc()');
    assert.equal(ev.metadata!.stacktrace![0].filePath, '/path/script.ctl');
    assert.equal(ev.metadata!.stacktrace![0].line, 10);
    assert.equal(ev.metadata!.stacktrace![1].functionName, 'callerFunc()');
});

test('parser: unrecognised continuation appended to metadata.raw', () => {
    const parser = new LogParser();
    parser.parseLine(INFO_LINE);
    parser.parseLine('  some extra context line');
    const ev = parser.flush()!;
    assert.ok(ev.metadata?.raw?.includes('some extra context line'));
});

test('parser: multiple continuation types on one event', () => {
    const parser = new LogParser();
    parser.parseLine(WARNING_LINE);
    parser.parseLine('Script: theScript');
    parser.parseLine('Library: theLib.ctl');
    parser.parseLine('Line: 7');
    const ev = parser.flush()!;
    assert.equal(ev.metadata!.script, 'theScript');
    assert.equal(ev.metadata!.library, 'theLib.ctl');
    assert.equal(ev.metadata!.line, 7);
    assert.equal(ev.rawLines.length, 4);
});

// ── Orphan continuation ───────────────────────────────────────────────────────

test('parser: continuation without main line is ignored', () => {
    const parser = new LogParser();
    const events = parser.parseLine('Script: orphan');
    assert.equal(events.length, 0);
    const ev = parser.flush();
    assert.equal(ev, null);
});

// ── Empty / CRLF lines ────────────────────────────────────────────────────────

test('parser: empty lines are ignored', () => {
    const parser = new LogParser();
    parser.parseLine('');
    parser.parseLine(INFO_LINE);
    parser.parseLine('');
    const ev = parser.flush()!;
    assert.equal(ev.rawLines.length, 1);
});

// ── flush contract ────────────────────────────────────────────────────────────

test('parser: flush returns null when buffer empty', () => {
    const parser = new LogParser();
    assert.equal(parser.flush(), null);
});

test('parser: reset clears buffer without returning event', () => {
    const parser = new LogParser();
    parser.parseLine(INFO_LINE);
    parser.reset();
    assert.equal(parser.flush(), null);
});

// ── parseLogContent ───────────────────────────────────────────────────────────

test('parseLogContent: parses multi-line string', () => {
    const text = [INFO_LINE, WARNING_LINE, CATALOG_LINE].join('\n');
    const events = parseLogContent(text);
    assert.equal(events.length, 3);
    assert.equal(events[0].severity, 'INFO');
    assert.equal(events[1].severity, 'WARNING');
    assert.equal(events[2].msgnum, '20/pmon');
});

test('parseLogContent: handles \\r\\n line endings', () => {
    const text = INFO_LINE + '\r\n' + WARNING_LINE + '\r\n';
    const events = parseLogContent(text);
    assert.equal(events.length, 2);
});

test('parseLogContent: sets sourceFile on all events', () => {
    const text = [INFO_LINE, WARNING_LINE].join('\n');
    const events = parseLogContent(text, '/tmp/PVSS_II.log');
    assert.ok(events.every((e) => e.sourceFile === '/tmp/PVSS_II.log'));
});

test('parseLogContent: does not lose last event (flush contract)', () => {
    const events = parseLogContent(INFO_LINE);
    assert.equal(events.length, 1);
});

test('parseLogContent: continuation lines parsed via convenience wrapper', () => {
    const text = [WARNING_LINE, 'Script: testScript', 'Line: 3'].join('\n');
    const events = parseLogContent(text);
    assert.equal(events.length, 1);
    assert.equal(events[0].metadata?.script, 'testScript');
    assert.equal(events[0].metadata?.line, 3);
});

test('parseLogContent: empty string returns empty array', () => {
    assert.deepEqual(parseLogContent(''), []);
});

test('parseLogContent: debug callback receives trace messages', () => {
    const messages: string[] = [];
    parseLogContent(INFO_LINE + '\n' + WARNING_LINE, undefined, (msg) => messages.push(msg));
    assert.ok(messages.length > 0);
});
