/**
 * WinCC OA PVSS log parser.
 *
 * Ported from the VS Code logviewer extension's LogParser class with:
 * - No VS Code / extension API dependency
 * - Optional debugCallback instead of ExtensionOutputChannel
 * - msgnum field captured from the error-code portion of each line
 *
 * IMPORTANT — stateful flush contract
 * ------------------------------------
 * parseLine() only emits COMPLETED events.  The last event is held in an
 * internal buffer until the next main-line or until flush() is called.
 * Always call flush() after processing all lines, e.g.:
 *
 *   for (const line of lines) {
 *     const events = parser.parseLine(line);
 *     events.forEach(cb);
 *   }
 *   const last = parser.flush();
 *   if (last) cb(last);
 */

import type { LogEvent, LogSeverity, StacktraceEntry } from './types.js';

// ── PVSS main-line regex ───────────────────────────────────────────────────────
// Format:
//   <Identifier>(<num>), YYYY.MM.DD HH:mm:ss.SSS, SCOPE,  SEVERITY,     REST
//
// Identifier may have NO space before '(' (e.g. WCCILdataSQLite(0))
// or several spaces (WCCOActrl    (1)).
const MAIN_LINE_RE =
    /^(\w+)\s*\((\d+)\),\s+(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}),\s*(\w+),\s*(\w+),\s+(.+)$/;

// The "rest" after severity is:  <msgnum>,  <message text...>
// msgnum may be  "1"  or  "20/pmon"
const REST_RE = /^\s*(\d+(?:\/\w+)?),\s*(.*)$/;

// Stacktrace line:  N. funcName() at /path/to/file.ctl:LINE
const STACKTRACE_ENTRY_RE = /^(\d+)\.\s+(\S+)\s+at\s+(.+):(\d+)$/;

// Continuation line patterns
const SCRIPT_RE = /^Script:\s*(.+)$/;
const LIBRARY_RE = /^Library:\s*(.+)$/;
const LINE_LABEL_RE = /^Line:\s*(\d+)$/;
const INLINE_LINE_RE = /^,\s*Line\s+(\d+)$/;

function mapSeverity(raw: string): LogSeverity {
    switch (raw.toUpperCase()) {
        case 'INFO':
            return 'INFO';
        case 'WARNING':
            return 'WARNING';
        case 'FATAL':
        case 'ERROR':
            return 'FATAL';
        case 'SEVERE':
            return 'SEVERE';
        case 'DEBUG':
            return 'DEBUG';
        default:
            return 'OTHER';
    }
}

export class LogParser {
    private currentEvent: LogEvent | null = null;
    private inStacktrace = false;
    private readonly debug: (msg: string) => void;

    constructor(debugCallback?: (msg: string) => void) {
        this.debug =
            debugCallback ??
            (() => {
                /* noop */
            });
    }

    /**
     * Feed one log line. Returns an array of completed LogEvents (usually 0 or 1).
     */
    parseLine(line: string): LogEvent[] {
        if (line === '' || line === '\r') {
            return [];
        }

        const trimmed = line.trimEnd();
        const mainMatch = MAIN_LINE_RE.exec(trimmed);

        if (mainMatch) {
            const completed: LogEvent[] = [];
            if (this.currentEvent) {
                completed.push(this.currentEvent);
            }

            const [, identifierName, instanceNumber, timestamp, scope, severityRaw, rest] =
                mainMatch;
            const restMatch = REST_RE.exec(rest);

            let msgnum: string | undefined;
            let message: string;

            if (restMatch) {
                msgnum = restMatch[1];
                message = restMatch[2].trimEnd();
            } else {
                message = rest.trimEnd();
            }

            this.currentEvent = {
                identifier: `${identifierName.trim()}(${instanceNumber})`,
                timestamp,
                scope,
                severity: mapSeverity(severityRaw),
                message,
                msgnum,
                rawLines: [trimmed],
            };
            this.inStacktrace = false;

            this.debug(`[parser] new event: ${this.currentEvent.identifier} ${timestamp}`);
            return completed;
        }

        // Continuation line — attach to current event if present
        if (!this.currentEvent) {
            this.debug(`[parser] orphan continuation: ${trimmed}`);
            return [];
        }

        this.currentEvent.rawLines.push(trimmed);

        if (trimmed.trimStart() === 'Stacktrace:') {
            this.inStacktrace = true;
            if (!this.currentEvent.metadata) {
                this.currentEvent.metadata = {};
            }
            if (!this.currentEvent.metadata.stacktrace) {
                this.currentEvent.metadata.stacktrace = [];
            }
            return [];
        }

        if (this.inStacktrace) {
            const entryMatch = STACKTRACE_ENTRY_RE.exec(trimmed.trim());
            if (entryMatch) {
                const entry: StacktraceEntry = {
                    index: parseInt(entryMatch[1], 10),
                    functionName: entryMatch[2],
                    filePath: entryMatch[3],
                    line: parseInt(entryMatch[4], 10),
                };
                this.currentEvent.metadata!.stacktrace!.push(entry);
                return [];
            }
            // End of stacktrace block — fall through to generic handling
            this.inStacktrace = false;
        }

        if (!this.currentEvent.metadata) {
            this.currentEvent.metadata = {};
        }

        const scriptMatch = SCRIPT_RE.exec(trimmed.trim());
        if (scriptMatch) {
            this.currentEvent.metadata.script = scriptMatch[1].trim();
            return [];
        }

        const libMatch = LIBRARY_RE.exec(trimmed.trim());
        if (libMatch) {
            this.currentEvent.metadata.library = libMatch[1].trim();
            return [];
        }

        const lineLabelMatch = LINE_LABEL_RE.exec(trimmed.trim());
        if (lineLabelMatch) {
            this.currentEvent.metadata.line = parseInt(lineLabelMatch[1], 10);
            return [];
        }

        const inlineLineMatch = INLINE_LINE_RE.exec(trimmed.trim());
        if (inlineLineMatch) {
            this.currentEvent.metadata.line = parseInt(inlineLineMatch[1], 10);
            return [];
        }

        // Unrecognised continuation — append to raw
        const existing = this.currentEvent.metadata.raw;
        this.currentEvent.metadata.raw = existing ? `${existing}\n${trimmed}` : trimmed;

        return [];
    }

    /**
     * Flush the buffered (last) event. Call after all lines have been fed.
     * Returns the final event or null if the buffer is empty.
     */
    flush(): LogEvent | null {
        const event = this.currentEvent;
        this.currentEvent = null;
        this.inStacktrace = false;
        return event;
    }

    /** Reset parser state without returning the buffered event. */
    reset(): void {
        this.currentEvent = null;
        this.inStacktrace = false;
    }
}

// ── Convenience wrapper ────────────────────────────────────────────────────────

/**
 * Parse a complete log text (full file content or a multi-line string) into
 * an array of LogEvent objects.
 *
 * @param text         Raw log text (may contain \\r\\n or \\n line endings)
 * @param sourceFile   Optional file path attached to every event
 * @param debugCallback Optional trace callback
 */
export function parseLogContent(
    text: string,
    sourceFile?: string,
    debugCallback?: (msg: string) => void,
): LogEvent[] {
    const parser = new LogParser(debugCallback);
    const events: LogEvent[] = [];

    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        const completed = parser.parseLine(line);
        events.push(...completed);
    }

    const last = parser.flush();
    if (last) {
        events.push(last);
    }

    if (sourceFile) {
        for (const event of events) {
            event.sourceFile = sourceFile;
        }
    }

    return events;
}
