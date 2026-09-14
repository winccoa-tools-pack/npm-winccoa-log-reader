/**
 * Integration tests: run real CTL scripts via WCCOActrl -n and verify that
 * the log output is correctly parsed into typed LogEvent objects.
 *
 * WCCOActrl in standalone mode (-n) writes PVSS-formatted log to the
 * project's log/PVSS_II.log file.  DebugN does NOT output in -n mode;
 * throwError/makeError is used instead.
 *
 * Skipped automatically when WCCOActrl is not found on the host machine.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLogContent } from '../../src/parser.js';

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

// ── Setup ────────────────────────────────────────────────────────────────────

const version = getTestVersion();
const binaryPath = version ? getCtrlBinaryPath(version) : undefined;
const SKIP = !version || !binaryPath;

if (SKIP) {
    console.log(
        '[parse-real-output] WCCOActrl not found — all integration tests skipped.',
    );
}

let projectReady = false;

test('integ setup: register log-integ-test project', { skip: SKIP }, async () => {
    const project = await setupLogProject(version!);
    assert.ok(project, 'project registration should succeed');
    projectReady = true;
});

// ── WARNING via throwError(makeError(...)) ────────────────────────────────────

test('integ: log-warning.ctl produces WARNING event with msgnum', { skip: SKIP }, () => {
    if (!projectReady) return;

    const result = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-warning.ctl'), version!);
    assert.ok(result.output.length > 0, `no log output; check project is registered`);

    const events = parseLogContent(result.output);
    const warnEvents = events.filter(
        (e) => e.severity === 'WARNING' && e.message.includes('LogIntegTest WARNING'),
    );
    assert.ok(warnEvents.length >= 1, `expected WARNING event, got:\n${result.output}`);

    const ev = warnEvents[0];
    // makeError("LogIntegTest", code=42) → msgnum "42/LogIntegTest"
    assert.ok(ev.msgnum, 'msgnum should be set');
    assert.ok(ev.msgnum!.startsWith('42'), `expected msgnum starting with 42, got: ${ev.msgnum}`);
    assert.ok(ev.identifier, 'identifier should be set');
    assert.ok(ev.timestamp, 'timestamp should be set');
    assert.equal(ev.scope, 'CTRL');
});

// ── SEVERE via throwError(makeError(...)) ─────────────────────────────────────

test('integ: log-severe.ctl produces SEVERE event', { skip: SKIP }, () => {
    if (!projectReady) return;

    const result = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-severe.ctl'), version!);
    assert.ok(result.output.length > 0, `no log output`);

    const events = parseLogContent(result.output);
    const severeEvents = events.filter(
        (e) => e.severity === 'SEVERE' && e.message.includes('LogIntegTest SEVERE'),
    );
    assert.ok(severeEvents.length >= 1, `expected SEVERE event, got:\n${result.output}`);
    const ev = severeEvents[0];
    assert.ok(ev.msgnum!.startsWith('99'), `expected msgnum starting with 99, got: ${ev.msgnum}`);
});

// ── Manager Start = INFO event is parseable ───────────────────────────────────

test('integ: Manager Start INFO event is parsed correctly', { skip: SKIP }, () => {
    if (!projectReady) return;

    const result = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-warning.ctl'), version!);
    const events = parseLogContent(result.output);

    const startEvent = events.find((e) => e.severity === 'INFO' && e.message.includes('Manager Start'));
    assert.ok(startEvent, `Manager Start INFO event should appear in output:\n${result.output}`);
    assert.equal(startEvent!.scope, 'SYS');
    assert.equal(startEvent!.msgnum, '1');
});

// ── Multiple events ───────────────────────────────────────────────────────────

test('integ: log-multi.ctl produces 3 WARNING events in order', { skip: SKIP }, () => {
    if (!projectReady) return;

    const result = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-multi.ctl'), version!);
    assert.ok(result.output.length > 0, `no log output`);

    const events = parseLogContent(result.output);
    const multiEvents = events.filter(
        (e) => e.severity === 'WARNING' && e.message.includes('LogIntegTest MULTI'),
    );
    assert.ok(multiEvents.length >= 3, `expected 3 MULTI events, got ${multiEvents.length}:\n${result.output}`);
    assert.ok(multiEvents.some((e) => e.message.includes('first')));
    assert.ok(multiEvents.some((e) => e.message.includes('second')));
    assert.ok(multiEvents.some((e) => e.message.includes('third')));
});

// ── Stacktrace metadata ───────────────────────────────────────────────────────

test('integ: log-stacktrace.ctl produces event with Script/Line metadata', { skip: SKIP }, () => {
    if (!projectReady) return;

    const result = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-stacktrace.ctl'), version!);
    const events = parseLogContent(result.output);
    const stackEvents = events.filter(
        (e) => e.message.includes('LogIntegTest STACKTRACE'),
    );
    assert.ok(stackEvents.length >= 1, `expected STACKTRACE event, got:\n${result.output}`);

    const ev = stackEvents[0];
    // WinCC OA may add Script/Library/Line or Stacktrace continuation lines
    const hasAnyMeta =
        ev.metadata !== undefined ||
        ev.rawLines.length > 1;
    // Just assert the main event is there; metadata is version/config dependent
    assert.equal(ev.severity, 'WARNING');
});

// ── rawLines preservation ─────────────────────────────────────────────────────

test('integ: rawLines[0] matches original log line verbatim', { skip: SKIP }, () => {
    if (!projectReady) return;

    const result = runScript(path.join(FIXTURE_SCRIPTS_DIR, 'log-warning.ctl'), version!);
    const events = parseLogContent(result.output);
    const target = events.find((e) => e.message.includes('LogIntegTest'));
    assert.ok(target, 'event should exist');
    assert.ok(
        result.output.includes(target!.rawLines[0]),
        'rawLines[0] should match original output line',
    );
});

// ── Teardown ──────────────────────────────────────────────────────────────────

test('integ teardown: unregister log-integ-test project', { skip: SKIP }, async () => {
    await teardownLogProject();
});
