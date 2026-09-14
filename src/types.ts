// ── Core log types ────────────────────────────────────────────────────────────

/** Severity levels used by WinCC OA PVSS log entries. */
export type LogSeverity = 'INFO' | 'WARNING' | 'FATAL' | 'SEVERE' | 'DEBUG' | 'OTHER';

/** Reference to a source file position (used e.g. in VS Code extension link handling). */
export interface LogFileRef {
    path: string;
    line?: number;
}

/** One frame in a CTRL stacktrace block. */
export interface StacktraceEntry {
    index: number;
    functionName: string;
    filePath: string;
    line?: number;
}

/** Structured metadata parsed from log continuation lines. */
export interface LogMetadata {
    /** `Script: <name>` continuation line. */
    script?: string;
    /** `Library: <path>` continuation line. */
    library?: string;
    /** `Line: <n>` continuation line. */
    line?: number;
    /** Parsed `Stacktrace:` block. */
    stacktrace?: StacktraceEntry[];
    /** Any other unrecognised continuation text. */
    raw?: string;
}

/**
 * A single parsed WinCC OA log event.
 *
 * Field names are intentionally identical to those in the VS Code logviewer
 * extension's logEvent.ts — migration is a single import-line swap.
 */
export interface LogEvent {
    /** Manager identifier, e.g. `WCCOActrl(1)` or `WCCILdataSQLite(0)`. */
    identifier: string;
    /** Raw timestamp string: `YYYY.MM.DD HH:mm:ss.SSS`. */
    timestamp: string;
    /** Log scope / error type, e.g. `SYS`, `CTRL`, `IMPL`, `PARAM`. */
    scope: string;
    severity: LogSeverity;
    /** Main message / error text. */
    message: string;
    /**
     * Error code (and optional catalog) extracted from the log line.
     * Examples: `"1"`, `"20/pmon"`, `"13/pmon"`, `"2/http"`.
     *
     * The CTL LogEntry class exposes these as separate errorCode +
     * errorCatalog fields; here they are kept as a single string to
     * preserve the original log format without information loss.
     */
    msgnum?: string;
    /** Present only when continuation lines were parsed. */
    metadata?: LogMetadata;
    /** All raw source lines that make up this event (first + continuations). */
    rawLines: string[];
    /** Absolute path of the source log file, set by reader / watcher. */
    sourceFile?: string;
}

// ── Reader options / result ────────────────────────────────────────────────────

export interface LogReadOptions {
    /**
     * Only return events with a timestamp >= this value.
     * Accepts a Date object or a raw PVSS timestamp string
     * YYYY.MM.DD HH:mm:ss.SSS.
     */
    sinceTimestamp?: Date | string;
    /** Return only the last N events (applied after all other filters). */
    lastN?: number;
    /** Restrict to specific severity levels. */
    filterSeverity?: LogSeverity[];
    /** Restrict to specific scope values (e.g. ['SYS', 'CTRL']). */
    filterScope?: string[];
}

export interface LogReadResult {
    events: LogEvent[];
    filePath: string;
    count: number;
}

// ── Watcher options ────────────────────────────────────────────────────────────

export interface LogWatcherOptions {
    /** One or more absolute paths to .log files to watch. */
    files: string[];
    /** Only emit events matching these severities. */
    filterSeverity?: LogSeverity[];
    /** Only emit events matching these scope values. */
    filterScope?: string[];
    /**
     * Optional debug callback — receives internal trace messages.
     * Replaces the VS Code ExtensionOutputChannel dependency used in the
     * logviewer extension.
     */
    debugCallback?: (msg: string) => void;
}
