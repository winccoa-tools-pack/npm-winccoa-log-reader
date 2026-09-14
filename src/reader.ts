/**
 * One-shot log file reader with filtering support.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLogContent } from './parser.js';
import type { LogEvent, LogReadOptions, LogReadResult } from './types.js';

// ── Timestamp helpers ──────────────────────────────────────────────────────────

/**
 * Convert a PVSS timestamp string (YYYY.MM.DD HH:mm:ss.SSS) or Date to
 * a comparable numeric value (milliseconds since epoch).
 */
function toMs(ts: Date | string): number {
    if (ts instanceof Date) {
        return ts.getTime();
    }
    // "2026.01.15 21:31:37.956" → "2026-01-15T21:31:37.956Z"
    const iso = ts.replace(/^(\d{4})\.(\d{2})\.(\d{2})\s+/, '$1-$2-$3T').replace(' ', 'T') + 'Z';
    const ms = Date.parse(iso);
    return isNaN(ms) ? 0 : ms;
}

function eventTimestampMs(event: LogEvent): number {
    return toMs(event.timestamp);
}

// ── Filter helpers ─────────────────────────────────────────────────────────────

function applyFilters(events: LogEvent[], opts: LogReadOptions): LogEvent[] {
    let result = events;

    if (opts.filterSeverity && opts.filterSeverity.length > 0) {
        const severities = new Set(opts.filterSeverity);
        result = result.filter((e) => severities.has(e.severity));
    }

    if (opts.filterScope && opts.filterScope.length > 0) {
        const scopes = new Set(opts.filterScope);
        result = result.filter((e) => scopes.has(e.scope));
    }

    if (opts.sinceTimestamp !== undefined) {
        const since = toMs(opts.sinceTimestamp);
        result = result.filter((e) => eventTimestampMs(e) >= since);
    }

    if (opts.lastN !== undefined && opts.lastN > 0) {
        result = result.slice(-opts.lastN);
    }

    return result;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Read and parse a WinCC OA log file synchronously, applying optional filters.
 *
 * @param filePath  Absolute or relative path to the log file
 * @param opts      Optional read/filter options
 * @returns         Parsed and filtered events together with metadata
 *
 * @throws {Error}  When the file cannot be read
 *
 * @example
 * ```ts
 * const result = readLog('/var/log/PVSS_II.log', {
 *     filterSeverity: ['WARNING', 'FATAL', 'SEVERE'],
 *     lastN: 100,
 * });
 * console.log(result.events);
 * ```
 */
export function readLog(filePath: string, opts: LogReadOptions = {}): LogReadResult {
    const absolutePath = resolve(filePath);
    const text = readFileSync(absolutePath, 'utf8');
    const allEvents = parseLogContent(text, absolutePath);
    const events = applyFilters(allEvents, opts);

    return {
        events,
        filePath: absolutePath,
        count: events.length,
    };
}
