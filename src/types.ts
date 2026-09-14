/**
 * Types for classic WinCC OA PVSS_II.log entries.
 *
 * Field names align with CTRL `classes/oaLogs/LogEntry` where practical,
 * plus multi-line metadata used by vscode-winccoa-logviewer.
 */

/** Normalized severity / priority values. */
export type LogSeverity = 'INFO' | 'WARNING' | 'FATAL' | 'SEVERE' | 'DEBUG' | 'OTHER';

/** One frame from a CTRL stacktrace block. */
export interface StacktraceEntry {
    index: number;
    functionName: string;
    filePath: string;
    line?: number;
}

/** Optional multi-line metadata attached to a main log line. */
export interface LogMetadata {
    script?: string;
    library?: string;
    line?: number;
    stacktrace?: StacktraceEntry[];
    /** Unstructured continuation text. */
    raw?: string;
}

/**
 * One logical log event (main line + optional continuation lines).
 *
 * Classic main line shape (CTRL LogParserClassic):
 * `managerName (managerNum), timeStamp, errorType, errorPriority, errorCode[/catalog], errorText`
 */
export interface LogEntry {
    /** Manager name, e.g. WCCOActrl */
    managerName: string;
    /** Manager instance number */
    managerNum: number;
    /** Combined `managerName(managerNum)` convenience id */
    identifier: string;
    /** Original timestamp string from the log */
    timeStampString: string;
    /** errorType / scope, e.g. SYS, CTRL, PARAM */
    errorType: string;
    /** Priority / severity string from the log (normalized) */
    errorPriority: LogSeverity;
    /** Numeric error code when present */
    errorCode?: number;
    /** Error catalog after code, e.g. `ctrl` in `5/ctrl` */
    errorCatalog?: string;
    /** Main message text */
    errorText: string;
    /** Multi-line metadata (Script / Library / Line / Stacktrace) */
    metadata?: LogMetadata;
    /** Raw lines that formed this event */
    rawLines: string[];
    /** Source file basename when known */
    sourceFile?: string;
}

/** Include/exclude filters inspired by CTRL LogEntry.matchByMap. */
export interface LogFilterOptions {
    includeManagerName?: string[];
    includeManagerNum?: number[];
    includeErrorType?: string[];
    includeErrorPriority?: Array<LogSeverity | string>;
    includeErrorCode?: number[];
    includeErrorCatalog?: string[];
    includeErrorText?: string[];
    excludeManagerName?: string[];
    excludeManagerNum?: number[];
    excludeErrorType?: string[];
    excludeErrorPriority?: Array<LogSeverity | string>;
    excludeErrorCode?: number[];
    excludeErrorCatalog?: string[];
    excludeErrorText?: string[];
    /**
     * Case-insensitive substring match against errorText (CLI convenience).
     * Applied as an additional include on text when set.
     */
    textContains?: string[];
}

/** Options for reading a log file. */
export interface ReadLogOptions {
    /** Path to PVSS_II.log or other classic log file. */
    filePath: string;
    /** Optional filters applied after parse. */
    filter?: LogFilterOptions;
    /** Encoding (default utf8). */
    encoding?: BufferEncoding;
}
